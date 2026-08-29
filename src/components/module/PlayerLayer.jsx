import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { Play, Pause, Volume2, VolumeX, Volume1, Maximize, Minimize, Subtitles, Settings, StickyNote, X } from "lucide-react";
import { resolveVideo } from "../../lib/videoHost.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import {
  MINI_W, MINI_MARGIN, BANNER_MS,
  lessonMarks, markClusters, notesCrossed, bannerFrom, bannerLabel,
  openComposer, closeComposer, discardComposer, expandBanner, dismissBanner,
  notesFor,
} from "../../lib/lessonSurface.js";
import "./lesson.css";

// The one player. Mounted once, above the router, never re-parented.
//
// It is positioned over the lesson page's empty slot by transform. Moving the
// <video> node into that slot instead would restart playback on every
// navigation, which is the exact thing the mini player exists to prevent.
//
// The control grammar is YouTube's on purpose — a student should not have to
// learn a video player — with one addition that is Wingman's: the note button
// sits in this bar, which is the one surface that exists both in the page and
// in fullscreen, so taking a note is one behaviour rather than two designs.
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function PlayerLayer() {
  const { session, setSession, mutate, dispatchPlayer, stage, clearSeek } = useSession();
  const { player, composer, banner } = session;

  const layerRef = useRef(null);
  const ref = useRef(null);
  const trackRef = useRef(null);
  const hideTimer = useRef(null);
  const prevT = useRef(0);
  const lastSaved = useRef(0);
  const completed = useRef(false);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [pct, setPct] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [full, setFull] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [idle, setIdle] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverAt, setHoverAt] = useState(null);

  const lesson = stage?.lesson || null;
  const dur = lesson?.duration || 0;
  const video = lesson?.video ? resolveVideo(lesson.videoKind, lesson.video) : null;
  const playing = player.playing;
  const dock = player.dock;

  // ---------------------------------------------------------------- position
  // Transform and width only. Never animate filter, opacity, backdrop-filter
  // or box-shadow on this layer: an element composited over live video that
  // cannot composite alone re-rasterises every frame.
  const place = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (dock === "inline") {
      const slot = stage?.slotEl;
      if (!slot) return;
      const r = slot.getBoundingClientRect();
      layer.style.width = `${r.width}px`;
      layer.style.transform = `translate(${r.left}px, ${r.top}px)`;
    } else if (dock === "mini") {
      // Below 768px the stylesheet docks this to the bottom edge and overrides
      // the transform, so there is nothing to measure.
      if (window.innerWidth < 768) return;
      const h = (MINI_W * 9) / 16 + 44;
      layer.style.width = `${MINI_W}px`;
      layer.style.transform =
        `translate(${window.innerWidth - MINI_W - MINI_MARGIN}px, ${window.innerHeight - h - MINI_MARGIN}px)`;
    }
  }, [dock, stage]);

  useEffect(() => {
    if (dock === "none") return undefined;
    place();
    // Coalesced to one write per frame: scroll fires far faster than the
    // screen refreshes and each handler here writes a style.
    let queued = false;
    const onMove = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; place(); });
    };
    // Capture, on the document, rather than a listener on window: this app
    // scrolls an inner element, not the page, and scroll events do not bubble.
    // A window listener never fires here, so the inline player would have sat
    // where the slot used to be.
    document.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    const ro = stage?.slotEl ? new ResizeObserver(onMove) : null;
    if (ro && stage.slotEl) ro.observe(stage.slotEl);
    return () => {
      document.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      ro?.disconnect();
    };
  }, [dock, place, stage]);

  // ------------------------------------------------------------------- media
  const resumeTo = useRef(0);
  useEffect(() => { resumeTo.current = stage?.resume || 0; completed.current = false; }, [lesson?.id]);

  const onMeta = () => {
    setReady(true);
    const el = ref.current;
    const want = resumeTo.current;
    if (!el || !el.duration || !want) return;
    el.currentTime = want * el.duration;
  };

  const seekTo = useCallback((p) => {
    const el = ref.current;
    const next = Math.min(1, Math.max(0, p));
    setPct(next);
    if (el && el.duration) el.currentTime = next * el.duration;
    prevT.current = next * (el?.duration || 0);
    dispatchPlayer({ type: "seek", seconds: prevT.current });
    stage?.onSeek?.(next);
  }, [dispatchPlayer, stage]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setError("offline"));
    else el.pause();
  }, []);

  // The banner is driven from here. notesCrossed() is what keeps a scrub from
  // firing every note in the lesson at once — a jump wider than the tolerance
  // is a seek, and a seek announces nothing.
  const myNotes = useMemo(
    () => (lesson ? notesFor(session.notes, lesson.id) : []), [session.notes, lesson]);

  const onTime = () => {
    const el = ref.current;
    if (!el || !el.duration) return;
    const t = el.currentTime;
    const p = t / el.duration;
    setPct(p);
    if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1) / el.duration);

    const crossed = notesCrossed(prevT.current, t, myNotes);
    prevT.current = t;
    if (crossed.length && !banner && !composer) {
      // Clustered against THIS lesson's notes, not the whole collection.
      // bannerFrom() takes whatever it is given and gathers everything within
      // CLUSTER_S of the first — handed every note in the account it happily
      // reaches into other lessons, so passing a note at 0:42 announced "2
      // notes here" because a different lesson had one at 0:44, and expanding
      // it showed a note from a video you were not watching.
      setSession((s) => ({ ...s, banner: bannerFrom(crossed, myNotes) }));
    }

    const now = Date.now();
    if (now - lastSaved.current > 4000) { lastSaved.current = now; stage?.onProgress?.(p); }
    if (!completed.current && p >= 0.9) { completed.current = true; stage?.onComplete?.(); }
    dispatchPlayer({ type: "time", seconds: t });
  };

  // Leaving is the moment the throttle above would miss.
  const stageRefForUnmount = useRef(stage);
  stageRefForUnmount.current = stage;
  useEffect(() => () => {
    const el = ref.current;
    if (el && el.duration && el.currentTime > 0) {
      stageRefForUnmount.current?.onProgress?.(el.currentTime / el.duration);
    }
  }, []);

  // The banner fades on its own. Expanding stops that, because an expanded
  // note is a panel the reader closes.
  useEffect(() => {
    if (!banner || banner.expanded) return undefined;
    const id = setTimeout(() => setSession((s) => (s.banner && !s.banner.expanded ? { ...s, banner: null } : s)), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner, setSession]);

  // The element is the source of truth for play/pause and the reducer records
  // what it did — an effect that pushed the reducer's value back onto the
  // element fought every real play(), because any unrelated re-render between
  // calling play() and the play event landing would pause it again.
  //
  // One thing does stop playback: a panel opening over the video. You cannot
  // watch and read at once, which is also what makes a note's timestamp exact.
  const stopped = Boolean(composer) || Boolean(banner?.expanded);
  const resumeAfterPanel = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stopped) { resumeAfterPanel.current = !el.paused; el.pause(); }
    else if (resumeAfterPanel.current) {
      resumeAfterPanel.current = false;
      el.play().catch(() => {});
    }
  }, [stopped]);

  // A row in the Notes or Comments list asked for a second.
  useEffect(() => {
    if (!session.seekTo) return;
    const el = ref.current;
    if (el && el.duration) seekTo(session.seekTo.seconds / el.duration);
    clearSeek();
  }, [session.seekTo, seekTo, clearSeek]);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setIdle(true), 2600);
  }, []);
  useEffect(() => {
    if (!playing || menu || scrubbing) { setIdle(false); clearTimeout(hideTimer.current); return undefined; }
    wake();
    return () => clearTimeout(hideTimer.current);
  }, [playing, menu, scrubbing, wake]);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const setVol = (v) => {
    const el = ref.current;
    const next = Math.min(1, Math.max(0, v));
    setVolume(next);
    setMuted(next === 0);
    if (el) { el.volume = next; el.muted = next === 0; }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else layerRef.current?.requestFullscreen?.();
  };

  const posFromEvent = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    return Math.min(1, Math.max(0, x / r.width));
  };

  useEffect(() => {
    if (!scrubbing) return undefined;
    const move = (e) => seekTo(posFromEvent(e));
    const up = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [scrubbing, seekTo]);

  // ------------------------------------------------------------------- notes
  const openNote = useCallback(() => {
    const el = ref.current;
    setSession((s) => openComposer(s, { lessonId: lesson.id, seconds: el?.currentTime ?? 0 }));
  }, [lesson, setSession]);

  const saveNote = useCallback(() => mutate((s) => closeComposer(s)), [mutate]);
  const dropNote = useCallback(() => setSession((s) => discardComposer(s)), [setSession]);

  const marks = useMemo(() => {
    if (!lesson) return [];
    return lessonMarks(session.notes, session.threads, lesson.id);
  }, [session.notes, session.threads, lesson]);

  // The bar's width decides which marks merge, so it has to be known on the
  // first paint. A ResizeObserver alone left it at zero until the first
  // delivery — and with no width there are no clusters, so the bar rendered
  // empty. Measured synchronously after layout, with the observer kept for
  // later changes.
  const [barW, setBarW] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setBarW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dock, video]);

  const clusters = useMemo(
    () => markClusters(marks, dur, barW), [marks, dur, barW]);

  const onKeyDown = (e) => {
    const el = ref.current;
    if (!el || composer) return;
    const k = e.key;
    const jump = (s) => { e.preventDefault(); seekTo((el.currentTime + s) / (el.duration || 1)); };
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "ArrowRight" || k === "l") jump(k === "l" ? 10 : 5);
    else if (k === "ArrowLeft" || k === "j") jump(k === "j" ? -10 : -5);
    else if (k === "ArrowUp") { e.preventDefault(); setVol(volume + 0.1); }
    else if (k === "ArrowDown") { e.preventDefault(); setVol(volume - 0.1); }
    else if (k === "f") { e.preventDefault(); fullscreen(); }
    else if (k === "m") { e.preventDefault(); muted ? setVol(volume || 1) : setVol(0); }
    else if (k === "c") { e.preventDefault(); setCaptions((v) => !v); }
    else if (k === "n") { e.preventDefault(); openNote(); }
    else if (/^[0-9]$/.test(k)) { e.preventDefault(); seekTo(Number(k) / 10); }
    wake();
  };

  // Only a lesson with no video has nothing to mount. dock "none" is a hidden
  // player, not an absent one — returning null here would unmount the <video>
  // and throw away the buffer and the position, which is the exact loss the
  // dock rule exists to prevent.
  if (!lesson || !video) return null;

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const showControls = !playing || hovering || !idle || menu || scrubbing;
  const expanded = banner?.expanded ? banner : null;
  const expandedNote = expanded
    ? session.notes.find((n) => n.id === expanded.noteIds[0]) : null;

  return (
    <div ref={layerRef} className={`player-layer yt${showControls ? "" : " hushed"}${full ? " full" : ""}`}
         data-dock={dock} data-idle={idle ? "1" : "0"}
         onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label={`${lesson.title} player`}
         onPointerMove={wake} onPointerEnter={() => setHovering(true)}
         onPointerLeave={() => { setHovering(false); setMenu(false); }}>

      <div className="mini-wrap">
        <video ref={ref} src={video.url} playsInline preload="metadata"
               onClick={dock === "inline" ? toggle : undefined}
               onDoubleClick={dock === "inline" ? fullscreen : undefined}
               onTimeUpdate={onTime} onLoadedMetadata={onMeta}
               onProgress={onTime}
               onError={() => setError("offline")}
               onWaiting={() => setBuffering(true)}
               onPlaying={() => { setBuffering(false); dispatchPlayer({ type: "play" }); }}
               onCanPlay={() => setBuffering(false)}
               onPlay={() => dispatchPlayer({ type: "play" })}
               onPause={() => dispatchPlayer({ type: "pause" })}>
          {lesson.captions && (
            <track kind="captions" src={lesson.captions} srcLang="en" label="English" default={captions} />
          )}
        </video>

        {/* The mini bar. Title, play, close — nothing to drag and nothing to
            resize, because windows were cancelled. */}
        <div className="mini-bar">
          <button type="button" className="mini-btn" onClick={toggle}
                  aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <span className="mini-title">{lesson.title}</span>
          <button type="button" className="mini-btn" onClick={() => dispatchPlayer({ type: "close" })}
                  aria-label="Close the player">
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="perr">
          <p>This will not play — the connection dropped.</p>
          <button type="button" onClick={() => { setError(null); ref.current?.load(); }}>Try again</button>
        </div>
      )}

      {!playing && !buffering && pct === 0 && dock === "inline" && (
        <button type="button" className="pbig" onClick={toggle} aria-label={`Play ${lesson.title}`}>
          <Play aria-hidden="true" />
        </button>
      )}
      {buffering && <span className="pspin" aria-label="Buffering" />}

      {/* The banner. It does NOT pause — you wrote the sentence, and eight
          notes must not become eight interruptions on every rewatch. */}
      {banner && !banner.expanded && dock === "inline" && (
        <button type="button" className="pbanner" onClick={() => setSession(expandBanner)}>
          <span className="pbanner-t">
            {mmss((session.notes.find((n) => n.id === banner.noteIds[0])?.t) || 0)}
          </span>
          <span className="pbanner-body">{bannerLabel(banner, session.notes)}</span>
        </button>
      )}

      {/* One surface, two uses: writing a note, and reading one you passed.
          Both cover the player, which is fine because the video is stopped in
          both cases. */}
      {composer && (
        <div className="npanel">
          <div className="npanel-head">
            <span className="npanel-t">{mmss(composer.t)}</span>
            <span className="npanel-where">Only you see this</span>
          </div>
          <textarea className="npanel-field" autoFocus
                    placeholder="Write a note — or just close it to drop a pin here"
                    value={composer.body}
                    onChange={(e) => setSession((s) => ({ ...s, composer: { ...s.composer, body: e.target.value } }))} />
          <div className="npanel-acts">
            <button type="button" className="npanel-act" data-primary="" onClick={saveNote}>Close</button>
            <button type="button" className="npanel-act" onClick={dropNote}>Discard</button>
            <span className="npanel-hint">Close to save. Empty is fine.</span>
          </div>
        </div>
      )}

      {expanded && (
        <div className="npanel">
          <div className="npanel-head">
            <span className="npanel-t">{mmss(expandedNote?.t || 0)}</span>
            <span className="npanel-where">Your note</span>
          </div>
          <div className="npanel-read">
            {expanded.noteIds.length > 1
              ? expanded.noteIds.map((id) => {
                  const n = session.notes.find((x) => x.id === id);
                  return n ? <p key={id}>{n.body || "You marked this moment"}</p> : null;
                })
              : <p>{expandedNote?.body || "You marked this moment"}</p>}
          </div>
          <div className="npanel-acts">
            <button type="button" className="npanel-act" data-primary=""
                    onClick={() => setSession(dismissBanner)}>Close</button>
          </div>
        </div>
      )}

      <div className="ytbar pctl-host">
        <div className="yttrack" ref={trackRef}
             role="slider" tabIndex={0} aria-label="Seek"
             aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(dur * pct)}
             onPointerDown={(e) => { setScrubbing(true); seekTo(posFromEvent(e)); }}
             onPointerMove={(e) => setHoverAt(posFromEvent(e))}
             onPointerLeave={() => setHoverAt(null)}>
          <i className="ytbuf" style={{ width: `${buffered * 100}%` }} />
          <i className="ytplayed" style={{ width: `${pct * 100}%` }} />
          <b className="ytdot" style={{ left: `${pct * 100}%` }} />

          {/* One mark per note and per thread, never per reply. Clusters carry
              the tap target, which is how two marks 3px apart avoid two
              overlapping 44px buttons. */}
          {clusters.map((c) => (
            <s key={`${c.kind}-${c.items[0].id}`} className="scrub-mark"
               data-kind={c.kind} data-many={c.items.length > 1 ? "1" : "0"}
               style={{ left: `${c.pct}%` }} />
          ))}
          {clusters.map((c) => (
            <button key={`hit-${c.items[0].id}`} type="button" className="scrub-hit"
                    style={{ left: `${c.pct}%` }}
                    aria-label={c.items.length > 1
                      ? `${c.items.length} marks at ${mmss(c.items[0].t)}`
                      : `Mark at ${mmss(c.items[0].t)}`}
                    onClick={(e) => { e.stopPropagation(); seekTo(c.items[0].t / (dur || 1)); }} />
          ))}

          {hoverAt !== null && (
            <span className="yttip" style={{ left: `${hoverAt * 100}%` }}>{mmss(hoverAt * dur)}</span>
          )}
        </div>

        <div className="ytrow">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>

          <div className="ytvol">
            <button type="button" onClick={() => (muted ? setVol(volume || 1) : setVol(0))}
                    aria-label={muted ? "Unmute" : "Mute"}>
              <VolIcon aria-hidden="true" />
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                   aria-label="Volume" onChange={(e) => setVol(Number(e.target.value))} />
          </div>

          <span className="yttime">{mmss(dur * pct)} <i>/</i> {ready ? mmss(dur) : "--:--"}</span>

          <span className="ytspacer" />

          {/* The note button. It is in this bar and not on the page because
              this bar is the one surface that exists in fullscreen too. */}
          <button type="button" data-note="" onClick={openNote} aria-label="Take a note here">
            <StickyNote aria-hidden="true" />
          </button>

          <button type="button" onClick={() => setCaptions((v) => !v)}
                  aria-label="Captions" aria-pressed={captions} className={captions ? "on" : ""}>
            <Subtitles aria-hidden="true" />
          </button>

          <div className="ytmenu">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Settings"
                    aria-expanded={menu}><Settings aria-hidden="true" /></button>
            {menu && (
              <div className="ytpop" role="menu">
                <p className="ytpoph">Speed</p>
                {SPEEDS.map((s) => (
                  <button key={s} type="button" role="menuitemradio" aria-checked={speed === s}
                          className={speed === s ? "on" : ""}
                          onClick={() => { setSpeed(s); if (ref.current) ref.current.playbackRate = s; setMenu(false); }}>
                    {s === 1 ? "Normal" : `${s}×`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={fullscreen} aria-label={full ? "Exit full screen" : "Full screen"}>
            {full ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
