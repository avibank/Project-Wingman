import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, Volume2, VolumeX, Volume1, Maximize, Minimize, PenLine, X, RotateCcw, Check } from "lucide-react";
import { resolveVideo } from "../../lib/videoHost.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import { path as routePath } from "../../lib/routes.js";
import {
  BANNER_MS, SPEEDS, VOLUME_STEP, HUD_MS,
  lessonMarks, markClusters, notesCrossed, bannerFrom, bannerLabel,
  densityBuckets, densityPath, densityLabel, commentsFor,
  openBar, closeBar, discardBar, editNote, expandBanner, dismissBanner,
  notesFor, keyAction, hudLabel, barPosition, barFraction, nudgeBar, isPin,
} from "../../lib/lessonSurface.js";
import { shouldPrefetchNext } from "../../lib/familiar.js";
import "./lesson.css";

// The one player. Mounted once, above the router, site-wide — it keeps playing
// across the Flight Deck, People, everywhere — and the <video> node is never
// re-parented, because re-parenting restarts playback in every browser.
//
// It is positioned over the lesson page's empty slot by transform. The slot
// owns the size; this only ever copies its measured rect.
// The silhouette's height in px. Small on purpose: it is a hint about where
// the lesson gets hard, not a chart, and anything taller starts to look like
// one thing the player does rather than one thing it mentions.
const DENSITY_H = 18;

export default function PlayerLayer() {
  const {
    session, setSession, mutate, dispatchPlayer, stage, clearSeek,
    setBarPos, setRate, setVolume, me,
  } = useSession();
  const { player, bar, banner, hud, barPos } = session;
  const navigate = useNavigate();

  const layerRef = useRef(null);
  const ref = useRef(null);
  const trackRef = useRef(null);
  const barRef = useRef(null);
  const handleRef = useRef(null);
  const hideTimer = useRef(null);
  const prevT = useRef(0);
  const lastSaved = useRef(0);
  const lastDispatched = useRef(-1);
  const completed = useRef(false);

  const [pct, setPct] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [idle, setIdle] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [restamped, setRestamped] = useState(false);
  const fieldRef = useRef(null);
  const flash = useRef(null);
  useEffect(() => () => clearTimeout(flash.current), []);

  // §3.4 — the note keeps the timestamp it opened at while the video plays on.
  // Tapping the chip re-stamps it to now. Pressing Note again while a bar is
  // open does the same rather than opening a second one.
  const reStamp = () => {
    const el = ref.current;
    const t = Math.floor(el?.currentTime ?? 0);
    setSession((s) => (s.bar ? { ...s, bar: { ...s.bar, t } } : s));
    setRestamped(true);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setRestamped(false), 420);
  };

  // Height only. Reset first, or it can only ever grow.
  const growField = (e) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };
  const [barBox, setBarBox] = useState({ width: 0, height: 0 });
  // §3.1 — the end card. Its own state rather than pct >= 1: a lesson can sit
  // at the last frame after a scrub without having been watched to the end, and
  // offering "Watch again" to somebody who just dragged there is nonsense.
  const [ended, setEnded] = useState(false);

  const lesson = stage?.lesson || null;
  const dur = lesson?.duration || 0;
  const video = lesson?.video ? resolveVideo(lesson.videoKind, lesson.video) : null;
  const { playing, dock, rate, volume, muted, fullscreen } = player;

  // ---------------------------------------------------------------- position
  // NO SCROLL TRACKING, and that survives the shell coming back. A fixed
  // element repositioned from a scroll handler is always a frame behind the
  // content, which is why the video visibly slid against the page — structural,
  // not imagination.
  //
  // The layer is a child of .deck, the scroller, so an absolutely positioned
  // element placed at the slot's offset IN THE SCROLLER'S OWN COORDINATES moves
  // with the content for free. Those coordinates are the only thing that
  // changed when the document stopped being the scroller: it is the scroller's
  // scrollTop and its box that matter now, not window.scrollY and the page.
  const place = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (dock === "inline") {
      const slot = stage?.slotEl;
      if (!slot) return;
      const scroller = layer.closest(".deck");
      const r = slot.getBoundingClientRect();
      layer.style.width = `${r.width}px`;
      layer.style.height = `${r.height}px`;
      if (scroller) {
        const s = scroller.getBoundingClientRect();
        layer.style.transform = `translate(${r.left - s.left + scroller.scrollLeft}px, ${r.top - s.top + scroller.scrollTop}px)`;
      } else {
        // No shell (a gate is rendering on its own): fall back to the document.
        layer.style.transform = `translate(${r.left + window.scrollX}px, ${r.top + window.scrollY}px)`;
      }
    } else {
      layer.style.width = "";
      layer.style.height = "";
      layer.style.transform = "";
    }
  }, [dock, stage]);

  useEffect(() => {
    if (dock === "none") return undefined;
    place();
    // Resize and layout only. No scroll listener at all — that is the point.
    window.addEventListener("resize", place);
    const ro = stage?.slotEl ? new ResizeObserver(place) : null;
    if (ro && stage.slotEl) ro.observe(stage.slotEl);
    return () => {
      window.removeEventListener("resize", place);
      ro?.disconnect();
    };
  }, [dock, place, stage]);

  // The wheel forwarding that used to live here is gone. It existed because
  // the page scrolled inside .deck and the fixed player was not inside it;
  // with the document scrolling, a wheel anywhere scrolls it natively and
  // forwarding would be a second, laggier copy of the browser's own job.

  // One step ahead, at halfway — never the whole module. Prefetching
  // everything is how you make the first paint slow to make the second fast.
  const prefetched = useRef(null);
  useEffect(() => {
    const next = stage?.next;
    if (!next?.video || prefetched.current === next.id) return;
    if (!shouldPrefetchNext(player, { durationS: lesson?.duration })) return;
    prefetched.current = next.id;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = next.video;
    document.head.appendChild(link);
  }, [player.seconds, player.playing, stage, lesson]);

  // Going site-wide means every scrollable page has to reserve this, or the
  // last row of every list on the site sits behind the bar.
  useEffect(() => {
    document.body.style.setProperty("--mini-h", dock === "mini" ? "64px" : "0px");
  }, [dock]);

  // ------------------------------------------------------------------- media
  const resumeTo = useRef(0);
  useEffect(() => { resumeTo.current = stage?.resume || 0; completed.current = false; setEnded(false); }, [lesson?.id]);

  const onMeta = () => {
    setReady(true);
    const el = ref.current;
    if (!el) return;
    el.playbackRate = rate;
    el.volume = muted ? 0 : volume;
    const want = resumeTo.current;
    if (el.duration && want) el.currentTime = want * el.duration;
  };

  // Any deliberate move back into the video dismisses the card — it is an
  // offer, not a wall.
  useEffect(() => { if (playing) setEnded(false); }, [playing]);

  const seekTo = useCallback((p) => {
    // Scrubbing back into the video is a way out of the end card too.
    setEnded(false);
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

  // `me` — see the note at the LessonPage call site. Without it the marks on
  // the scrub bar and the note list disagreed about which notes exist.
  const myNotes = useMemo(
    () => (lesson ? notesFor(session.notes, lesson.id, me) : []), [session.notes, lesson, me]);

  const onTime = () => {
    const el = ref.current;
    if (!el || !el.duration) return;
    const t = el.currentTime;
    const p = t / el.duration;
    setPct(p);
    if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1) / el.duration);

    const crossed = notesCrossed(prevT.current, t, myNotes);
    prevT.current = t;
    // Clustered against THIS lesson's notes: handed the whole account,
    // bannerFrom() reaches into other lessons and announces a note from a video
    // you are not watching.
    if (crossed.length && !banner && !bar) {
      setSession((s) => ({ ...s, banner: bannerFrom(crossed, myNotes) }));
    }

    const now = Date.now();
    if (now - lastSaved.current > 4000) { lastSaved.current = now; stage?.onProgress?.(p); }
    if (!completed.current && p >= 0.9) { completed.current = true; stage?.onComplete?.(); }
    // Once a second: player.seconds lives in session, and every consumer
    // re-renders with it.
    if (Math.floor(t) !== Math.floor(lastDispatched.current)) {
      lastDispatched.current = t;
      dispatchPlayer({ type: "time", seconds: t });
    }
  };

  const stageForUnmount = useRef(stage);
  stageForUnmount.current = stage;
  useEffect(() => () => {
    const el = ref.current;
    if (el && el.duration && el.currentTime > 0) {
      stageForUnmount.current?.onProgress?.(el.currentTime / el.duration);
    }
  }, []);

  useEffect(() => {
    if (!session.seekTo) return;
    const el = ref.current;
    if (el && el.duration) seekTo(session.seekTo.seconds / el.duration);
    clearSeek();
  }, [session.seekTo, seekTo, clearSeek]);

  // A panel over the video is the only thing that stops playback. The element
  // is otherwise the source of truth and the reducer records what it did.
  const stopped = Boolean(bar) || Boolean(banner?.expanded);
  const resumeAfter = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stopped) { resumeAfter.current = !el.paused; el.pause(); }
    else if (resumeAfter.current) { resumeAfter.current = false; el.play().catch(() => {}); }
  }, [stopped]);

  // Close on the mini player STOPS. There is no closedByUser flag and there
  // must not be one: the dock rule already refuses to dock what is not playing.
  useEffect(() => {
    const el = ref.current;
    if (el && dock === "none" && !el.paused) el.pause();
  }, [dock]);

  // §3.2 — the speed persists across lessons, so it has to be applied when the
  // SOURCE changes too, not only when the rate does. Loading a new lesson gives
  // a fresh element at playbackRate 1 while the control still reads 1.5x, and
  // the player then quietly disagrees with its own button.
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate, video?.url]);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.volume = muted ? 0 : volume; el.muted = muted; }
  }, [volume, muted]);

  useEffect(() => {
    if (!banner || banner.expanded) return undefined;
    const id = setTimeout(
      () => setSession((s) => (s.banner && !s.banner.expanded ? { ...s, banner: null } : s)), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner, setSession]);

  useEffect(() => {
    if (!hud) return undefined;
    const id = setTimeout(() => setSession((s) => ({ ...s, hud: null })), HUD_MS);
    return () => clearTimeout(id);
  }, [hud, setSession]);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setIdle(true), 2600);
  }, []);
  useEffect(() => {
    if (!playing || scrubbing) { setIdle(false); clearTimeout(hideTimer.current); return undefined; }
    wake();
    return () => clearTimeout(hideTimer.current);
  }, [playing, scrubbing, wake]);

  useEffect(() => {
    const onFs = () => dispatchPlayer({ type: "fullscreen", on: Boolean(document.fullscreenElement) });
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [dispatchPlayer]);

  const goFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else layerRef.current?.requestFullscreen?.();
  }, []);

  const bumpVolume = useCallback((delta) => {
    const next = Math.min(1, Math.max(0, (muted ? 0 : volume) + delta));
    setVolume(next, next === 0);
    setSession((s) => ({ ...s, hud: { kind: "volume", value: next, shownAt: Date.now() } }));
  }, [muted, volume, setVolume, setSession]);

  const pickRate = useCallback((r) => {
    setRate(r);
    setSession((s) => ({ ...s, hud: { kind: "rate", value: r, shownAt: Date.now() } }));
  }, [setRate, setSession]);

  const openNote = useCallback(() => {
    const el = ref.current;
    if (!lesson) return;
    // §3.4 — pressing Note while a bar is already open RE-STAMPS it rather
    // than opening a second one. Two capture bars over one video is a state
    // nobody can reason about, and the press plainly means "note this moment".
    if (bar) { reStamp(); return; }
    setSession((s) => openBar(s, { lessonId: lesson.id, seconds: el?.currentTime ?? 0 }));
  }, [lesson, setSession, bar, reStamp]);

  // ------------------------------------------------------------------ keymap
  // On the document, not the player, so it works whether or not the player has
  // focus — and keyAction() returns null while anything is being typed into,
  // which is the one thing that ships broken if it is missed.
  useEffect(() => {
    const onKey = (e) => {
      const a = keyAction(e);
      if (!a) return;
      const el = ref.current;
      if (a.type === "escape") {
        if (bar) { e.preventDefault(); setSession(discardBar); }
        else if (document.fullscreenElement) { e.preventDefault(); document.exitFullscreen?.(); }
        return;
      }
      if (!el || !lesson || dock === "none") return;
      e.preventDefault();
      if (a.type === "toggle") toggle();
      else if (a.type === "volume") bumpVolume(a.delta);
      else if (a.type === "mute") {
        const next = !muted;
        const value = next ? 0 : volume || 1;
        setVolume(value, next);
        setSession((s) => ({ ...s, hud: { kind: "volume", value, shownAt: Date.now() } }));
      } else if (a.type === "seek") seekTo((el.currentTime + a.delta) / (el.duration || 1));
      if (e.key === "Escape") setRateOpen(false);
      else if (a.type === "fullscreen") goFullscreen();
      else if (a.type === "note") openNote();
      wake();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bar, dock, lesson, muted, volume, toggle, bumpVolume, seekTo, goFullscreen,
      openNote, setSession, setVolume, wake]);

  // ------------------------------------------------------------ the note bar
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBarBox((prev) => (Math.abs(prev.width - r.width) > 0.5 || Math.abs(prev.height - r.height) > 0.5
      ? { width: r.width, height: r.height } : prev));
  });

  const barStyle = useMemo(() => {
    const layer = layerRef.current;
    if (!layer || !barBox.width) return { transform: "translate(0px, 0px)" };
    const p = { width: layer.clientWidth, height: layer.clientHeight };
    const { x, y } = barPosition(barPos, p, barBox);
    return { transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)` };
    // fullscreen is a dependency because the frame changes size without the
    // bar re-rendering for any other reason.
  }, [barPos, barBox, dock, fullscreen]);

  const onHandleDown = (e) => {
    const handle = handleRef.current, layer = layerRef.current, el = barRef.current;
    if (!handle || !layer || !el) return;
    handle.setPointerCapture(e.pointerId);
    const p = layer.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const off = { x: e.clientX - b.left, y: e.clientY - b.top };
    let latest = barPos;
    // The phone keyboard shrinks the visible area; a bar clamped to the layout
    // viewport ends up underneath it, and you are typing into something you
    // cannot see.
    const move = (ev) => {
      const vv = window.visualViewport;
      const maxBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const y = Math.min(ev.clientY - p.top - off.y, maxBottom - p.top - b.height);
      latest = barFraction({ x: ev.clientX - p.left - off.x, y }, p, b);
      setBarPos(latest, false);
    };
    // pointerup is not the only way a drag ends. A captured pointer that gets
    // cancelled — a system gesture, an incoming call, the browser taking the
    // touch back — fires pointercancel and NEVER pointerup, so listening only
    // for the happy ending left pointermove attached and the bar stuck to the
    // finger for the rest of the session.
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      setBarPos(latest, true);   // persisted on drop, not on every pointermove
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const onHandleKey = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    setBarPos(nudgeBar(barPos, e.key, e.shiftKey), true);
  };

  // ------------------------------------------------------------------- marks
  const marks = useMemo(
    () => (lesson ? lessonMarks(session.notes, session.threads, lesson.id, me) : []),
    [session.notes, session.threads, lesson, me]);

  const [trackW, setTrackW] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    // Measured synchronously: with a ResizeObserver alone the width is zero
    // until the first delivery, and with no width there are no clusters, so the
    // bar renders no marks at all on first paint.
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setTrackW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dock, video]);

  const clusters = useMemo(() => markClusters(marks, dur, trackW), [marks, dur, trackW]);

  // §3.1 — the comment-density silhouette. Comments only: notes are one
  // person's and would draw a shape about them rather than about the lesson.
  const density = useMemo(() => {
    if (!lesson || !dur) return null;
    const ts = commentsFor(session.threads, lesson.id).map((c) => c.t);
    return densityBuckets(ts, dur);
  }, [session.threads, lesson, dur]);
  const densityD = useMemo(
    () => (density && trackW ? densityPath(density, trackW, DENSITY_H) : null),
    [density, trackW]);

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
    // Same reason as the note bar's drag: a cancelled pointer never sends
    // pointerup, so scrubbing stayed true and the video went on seeking to
    // every mouse move afterwards, with no button held down.
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [scrubbing, seekTo]);

  if (!lesson || !video) return null;

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const showControls = !playing || hovering || !idle || scrubbing;
  const expanded = banner?.expanded ? banner : null;
  const expandedNotes = expanded
    ? expanded.noteIds.map((id) => session.notes.find((n) => n.id === id)).filter(Boolean) : [];

  return (
    <div ref={layerRef} className={`player-layer${showControls ? "" : " hushed"}`}
         data-dock={dock} data-idle={idle ? "1" : "0"}
         role="group" aria-label={`${lesson.title} player`}
         onPointerMove={wake} onPointerEnter={() => setHovering(true)}
         onPointerLeave={() => setHovering(false)}>

      <div className="mini-wrap">
        <video ref={ref} src={video.url} playsInline preload="metadata"
               onClick={dock === "inline" ? toggle : undefined}
               onDoubleClick={dock === "inline" ? goFullscreen : undefined}
               onTimeUpdate={onTime} onLoadedMetadata={onMeta} onProgress={onTime}
               onError={() => setError("offline")}
               onWaiting={() => setBuffering(true)}
               onCanPlay={() => setBuffering(false)}
               onPlaying={() => { setBuffering(false); dispatchPlayer({ type: "play" }); }}
               onPlay={() => dispatchPlayer({ type: "play" })}
               onEnded={() => setEnded(true)}
               onPause={() => dispatchPlayer({ type: "pause" })} />

      {/* §3.1 — what a finished lesson offers. Two things and no autoplay: the
          next lesson is already one row down the page, and a countdown that
          moves somebody somewhere they did not ask to go is the single most
          complained-about behaviour in every player that has one. */}
      {ended && dock === "inline" && (
        <div className="pend">
          <p className="pend-t">{lesson?.title}</p>
          <div className="pend-acts">
            <button type="button" className="pend-go" onClick={() => {
              setEnded(false);
              const el = ref.current;
              if (el) { el.currentTime = 0; el.play?.().catch(() => {}); }
            }}>
              <RotateCcw aria-hidden="true" /> Watch again
            </button>
            {stage?.chapterId && stage?.moduleCode && (
              <button type="button" className="pend-go" data-primary="" onClick={() => {
                setEnded(false);
                navigate(routePath.chapter(stage.moduleCode, stage.chapterId, "quiz"));
              }}>
                {stage.chapterTitle ? `${stage.chapterTitle} quiz` : "Take the chapter quiz"}
              </button>
            )}
          </div>
        </div>
      )}

        {/* Two controls, and only two. Tap the body to come back to the lesson,
            tap the X to stop. It is a way back, not a second player. */}
        <div className="mini-bar">
          <button type="button" className="mini-title"
                  onClick={() => {
                    const m = player.moduleId, ch = stage?.chapterId;
                    if (m && ch) navigate(routePath.lesson(m, ch, lesson.id));
                  }}>
            {lesson.title}
          </button>
          <button type="button" className="mini-btn" aria-label="Stop"
                  onClick={() => dispatchPlayer({ type: "close" })}>
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
      {/* §2.2 — one triangle. The big centre button lost its centring when the
          old player rules came out, and landed on top of the control bar's own
          Play, so two play triangles were visible at once. The bar already has
          one and clicking the picture already toggles, so the duplicate goes
          rather than being repositioned. */}
      {buffering && <span className="pspin" aria-label="Buffering" />}

      {/* Volume and speed share one slab. Two different-looking indicators for
          the same class of feedback is noise. */}
      {hud && <div className="phud" aria-live="polite"><span className="phud-slab">{hudLabel(hud)}</span></div>}

      {banner && !banner.expanded && dock === "inline" && (
        <button type="button" className="pbanner" onClick={() => setSession(expandBanner)}>
          <span className="pbanner-t">{mmss(session.notes.find((n) => n.id === banner.noteIds[0])?.t || 0)}</span>
          <span className="pbanner-body">{bannerLabel(banner, session.notes)}</span>
        </button>
      )}

      {expanded && expandedNotes.length > 0 && (
        <div className="pnote">
          <div className="pnote-head">
            <span className="pnote-t">{mmss(expandedNotes[0].t)}</span>
          </div>
          <div className="pnote-body">
            {expandedNotes.map((n) => <p key={n.id}>{n.body || "You marked this moment"}</p>)}
          </div>
          <div className="pnote-acts">
            {/* This is where a pin usually gets filled in. Pin it now, pass it
                later, write it then — that is the whole loop. */}
            <button type="button" className="nbar-act" data-primary=""
                    onClick={() => setSession((s) => editNote(s, expandedNotes[0].id))}>
              {isPin(expandedNotes[0]) ? "Add a note" : "Edit"}
            </button>
            <button type="button" className="nbar-act" onClick={() => setSession(dismissBanner)}>Close</button>
          </div>
        </div>
      )}

      {/* One line that grows, never a panel: the thing you are writing about is
          on screen and covering it is backwards. */}
      {bar && (
        <div className="nbar" ref={barRef} style={barStyle} data-restamp={restamped ? "1" : undefined}>
          {/* §3.4 — the whole bar drags, from a press anywhere on it. The chip
              is also the re-stamp: tapping it moves the note to the current
              second, with a brief flash so the change is seen rather than
              guessed at. */}
          <button type="button" className="nbar-handle" ref={handleRef}
                  onPointerDown={onHandleDown} onKeyDown={onHandleKey}
                  onClick={reStamp}
                  aria-label={`Noted at ${mmss(bar.t)}. Press to re-stamp to the current time.`}>
            {mmss(bar.t)}
          </button>
          {/* Grows in HEIGHT as you type, never in width — widening reflows the
              text under the cursor. Past the maximum it scrolls inside. */}
          <textarea className="nbar-field" autoFocus rows={1} ref={fieldRef}
                    value={bar.body}
                    onInput={growField}
                    onChange={(e) => setSession((s) => ({ ...s, bar: { ...s.bar, body: e.target.value } }))} />
          {/* The only two ways to finish. */}
          <div className="nbar-acts">
            <button type="button" className="nbar-round" data-primary=""
                    onClick={() => mutate((s) => closeBar(s))} aria-label="Save this note">
              <Check aria-hidden="true" />
            </button>
            <button type="button" className="nbar-round" aria-label="Discard this note"
                    onClick={() => {
                      // Confirms only if there is something to lose.
                      if (bar.body.trim() && !window.confirm("Discard this note?")) return;
                      setSession(discardBar);
                    }}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="pctl">
        {/* Above the bar, aligned to it 1:1 — it is drawn against the track's
            measured width, so a peak sits over the second it describes. */}
        {densityD && (
          <svg className="pdens" width={trackW} height={DENSITY_H}
               viewBox={`0 0 ${trackW} ${DENSITY_H}`} role="img"
               aria-label={densityLabel(density, dur)}>
            <path className="pdens-f" d={densityD} />
          </svg>
        )}

        <div className="scrub" ref={trackRef}
             role="slider" tabIndex={0} aria-label="Seek"
             aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(dur * pct)}
             onPointerDown={(e) => { setScrubbing(true); seekTo(posFromEvent(e)); }}>
          <i className="scrub-buf" style={{ width: `${buffered * 100}%` }} />
          <i className="scrub-fill" style={{ width: `${pct * 100}%` }} />
          {clusters.map((c) => (
            <s key={`m-${c.items[0].id}`} className="scrub-mark"
               data-kind={c.kind} data-many={c.items.length > 1 ? "1" : "0"}
               style={{ left: `${c.pct}%` }} />
          ))}
          {clusters.map((c) => (
            <button key={`h-${c.items[0].id}`} type="button" className="scrub-hit"
                    style={{ left: `${c.pct}%` }}
                    aria-label={c.items.length > 1
                      ? `${c.items.length} marks at ${mmss(c.items[0].t)}`
                      : `Mark at ${mmss(c.items[0].t)}`}
                    onClick={(e) => { e.stopPropagation(); seekTo(c.items[0].t / (dur || 1)); }} />
          ))}
        </div>

        <div className="pctl-row">
          <button type="button" className="pbtn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          {/* The duration half is its own element so a narrow player can drop
              it. On a phone the bar is about 289px, and play + time + three
              44px controls came to 309 — the fullscreen button was clipped by
              the layer's own overflow: hidden, so the control nearest the edge
              was the one you could neither see nor finish tapping. YouTube
              solves it the same way: position stays, total goes. */}
          <span className="ptime">
            {mmss(dur * pct)}
            <span className="ptime-dur"> / {ready ? mmss(dur) : "--:--"}</span>
          </span>
          <span className="pspacer" />

          {/* A pen over a page, and deliberately not the edit pencil used
              elsewhere — people expect that one to rename something. */}
          <button type="button" className="pbtn" data-note="" onClick={openNote}
                  aria-pressed={Boolean(bar)} aria-label="Take a note here">
            <PenLine aria-hidden="true" />
          </button>

          <div className="pvol">
            <button type="button" className="pbtn"
                    onClick={() => { const next = !muted; setVolume(next ? 0 : volume || 1, next); }}
                    aria-label={muted ? "Unmute" : "Mute"}>
              <VolIcon aria-hidden="true" />
            </button>
            <span className="pvol-track">
              <input className="pvol-range" type="range" min="0" max="1" step={VOLUME_STEP}
                     value={muted ? 0 : volume} aria-label="Volume"
                     onChange={(e) => bumpVolume(Number(e.target.value) - (muted ? 0 : volume))} />
            </span>
          </div>

          {/* §3.2 — a real control, not a cycle. Cycling through six speeds
              means up to five presses to reach the one you want, and you
              cannot see what the options are before committing. A word, not an
              icon; the choice persists across lessons through pw-rate. */}
          <div className="prate-wrap">
            <button type="button" className="prate" aria-haspopup="menu"
                    aria-expanded={rateOpen ? "true" : "false"}
                    onClick={() => setRateOpen((v) => !v)}
                    aria-label={`Playback speed, currently ${rate} times`}>
              {rate}×
            </button>
            {rateOpen && (
              <div className="prate-menu" role="menu" aria-label="Playback speed">
                {SPEEDS.map((r) => (
                  <button key={r} type="button" role="menuitemradio"
                          aria-checked={r === rate} className="prate-opt"
                          onClick={() => { pickRate(r); setRateOpen(false); }}>
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="pbtn" onClick={goFullscreen}
                  aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
