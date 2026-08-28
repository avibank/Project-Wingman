import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Volume1, Maximize, Minimize, Subtitles, Settings } from "lucide-react";
import { resolveVideo } from "../../lib/videoHost.js";
import { mmss } from "./lessonState.js";

// One player, in the shape everybody already knows.
//
// The grammar is deliberately YouTube's, because a student should not have to
// learn a video player: controls overlaid on the picture and hidden while it
// plays, a thin progress bar that thickens under the pointer, buffered range
// behind the played range, time as "now / total", volume that opens on hover,
// click the picture to pause, double-click for full screen, and the keys in
// the places the hands already go.
//
// One thing is deliberately NOT YouTube's: the played bar is the livery accent
// rather than red. Red in this system means a genuine danger state, and a
// progress bar is not one.
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function Player({
  lesson, position = 0, marks = [], onProgress, onComplete, onSeek, captionsOn = false,
}) {
  const wrapRef = useRef(null);
  const ref = useRef(null);
  const trackRef = useRef(null);
  const hideTimer = useRef(null);
  const completed = useRef(false);
  const lastSaved = useRef(0);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; });

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [captions, setCaptions] = useState(captionsOn);
  const [pct, setPct] = useState(position);
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

  const dur = lesson.duration || 0;
  const video = lesson.video ? resolveVideo(lesson.videoKind, lesson.video) : null;

  // Resume on loadedmetadata, never on arrival: currentTime set before the
  // browser knows the duration is silently ignored, which is what made resume
  // look broken.
  const resumeTo = useRef(position);
  useEffect(() => { resumeTo.current = position; }, [lesson.id]);

  const onMeta = () => {
    setReady(true);
    const el = ref.current;
    const want = resumeTo.current;
    if (!el || !el.duration || !want) return;
    if (want >= 0.98) return;          // that is a rewatch, not a resume
    el.currentTime = want * el.duration;
  };

  // Leaving is the moment that matters most for resume and the one the
  // throttle below would miss.
  useEffect(() => () => {
    const el = ref.current;
    if (el && el.duration && el.currentTime > 0) onProgressRef.current?.(el.currentTime / el.duration);
  }, []);

  const seekTo = useCallback((p) => {
    const el = ref.current;
    const next = Math.min(1, Math.max(0, p));
    setPct(next);
    if (el && el.duration) el.currentTime = next * el.duration;
    onSeek?.(next);
  }, [onSeek]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setError("offline"));
    else el.pause();
  }, []);

  const onTime = () => {
    const el = ref.current;
    if (!el || !el.duration) return;
    const p = el.currentTime / el.duration;
    setPct(p);
    if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1) / el.duration);
    const now = Date.now();
    if (now - lastSaved.current > 4000) { lastSaved.current = now; onProgress?.(p); }
    if (!completed.current && p >= 0.9) { completed.current = true; onComplete?.(); }
  };

  // Controls fade out while it plays and come back on any movement. They stay
  // put whenever the pointer is on them, the menu is open, or it is paused.
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setIdle(true), 2600);
  }, []);
  useEffect(() => {
    if (!playing || menu || scrubbing) { setIdle(false); clearTimeout(hideTimer.current); return; }
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
    else wrapRef.current?.requestFullscreen?.();
  };

  const posFromEvent = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    return Math.min(1, Math.max(0, x / r.width));
  };

  // Dragging the scrub keeps following the pointer after it leaves the bar,
  // which is what makes a scrubber feel like a scrubber rather than a row of
  // click targets.
  useEffect(() => {
    if (!scrubbing) return;
    const move = (e) => seekTo(posFromEvent(e));
    const up = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [scrubbing, seekTo]);

  const onKeyDown = (e) => {
    const el = ref.current;
    if (!el) return;
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
    else if (/^[0-9]$/.test(k)) { e.preventDefault(); seekTo(Number(k) / 10); }
    wake();
  };

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const showControls = !playing || hovering || !idle || menu || scrubbing;

  if (!video) {
    return (
      <>
        <div className="player"><p className="ptag">Not recorded yet.</p></div>
        <div className="scrub"><span className="tc">0:00</span><div className="track" /><span className="tc">{mmss(dur)}</span></div>
      </>
    );
  }

  if (error) {
    return (
      <div className="player">
        <div className="perr">
          <p>This will not play — the connection dropped.</p>
          <button type="button" onClick={() => { setError(null); ref.current?.load(); }}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`player yt${showControls ? "" : " hushed"}${full ? " full" : ""}`}
         onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label={`${lesson.title} player`}
         onPointerMove={wake} onPointerEnter={() => setHovering(true)}
         onPointerLeave={() => { setHovering(false); setMenu(false); }}
         onDoubleClick={fullscreen}>
      <video ref={ref} src={video.url} playsInline preload="metadata"
             onClick={toggle}
             onTimeUpdate={onTime} onLoadedMetadata={onMeta}
             onProgress={onTime}
             onError={() => setError("offline")}
             onWaiting={() => setBuffering(true)}
             onPlaying={() => { setBuffering(false); setPlaying(true); }}
             onCanPlay={() => setBuffering(false)}
             onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
        {lesson.captions && (
          <track kind="captions" src={lesson.captions} srcLang="en" label="English" default={captions} />
        )}
      </video>

      {/* The one big button, only before it has been started. */}
      {!playing && !buffering && pct === 0 && (
        <button type="button" className="pbig" onClick={toggle} aria-label={`Play ${lesson.title}`}>
          <Play aria-hidden="true" />
        </button>
      )}
      {buffering && <span className="pspin" aria-label="Buffering" />}

      <div className="ytbar">
        <div className="yttrack" ref={trackRef}
             role="slider" tabIndex={0} aria-label="Seek"
             aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(dur * pct)}
             onPointerDown={(e) => { setScrubbing(true); seekTo(posFromEvent(e)); }}
             onPointerMove={(e) => setHoverAt(posFromEvent(e))}
             onPointerLeave={() => setHoverAt(null)}>
          <i className="ytbuf" style={{ width: `${buffered * 100}%` }} />
          <i className="ytplayed" style={{ width: `${pct * 100}%` }} />
          <b className="ytdot" style={{ left: `${pct * 100}%` }} />
          {/* Wingman's own addition to a familiar shape: a mark at every
              question's moment. */}
          {dur > 0 && marks.map((m) => (
            <s key={m.id} style={{ left: `${(m.at / dur) * 100}%` }} title={`Question at ${mmss(m.at)}`} />
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
