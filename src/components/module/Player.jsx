import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Subtitles } from "lucide-react";
import { resolveVideo } from "../../lib/videoHost.js";
import { mmss } from "./lessonState.js";

// One player, for every lesson there will ever be.
//
// It takes a src and a kind and knows nothing about who serves them, so moving
// host is a change in videoHost.js and nowhere else. Everything the brief calls
// expensive-later is here from the start: position resumes per lesson per
// account, the scrub carries a mark at every question's moment, keys work, and
// captions are wired rather than promised — retrofitting captions means
// re-processing every video that was never captioned, which does not happen,
// which is how a product ends up permanently unable to search its own video.
export default function Player({
  lesson, position = 0, marks = [], onProgress, onComplete, onSeek, captionsOn: initialCaptions = false,
}) {
  const ref = useRef(null);
  const trackRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(initialCaptions);
  const [pct, setPct] = useState(position);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const completed = useRef(false);

  const dur = lesson.duration || 0;
  const video = lesson.video ? resolveVideo(lesson.videoKind, lesson.video) : null;

  // Resume where they were. The Flight Deck already promises "pick up at 6:12"
  // and this is the half of that promise that lives in the player.
  useEffect(() => {
    const el = ref.current;
    if (!el || !dur || !position) return;
    const at = position * dur;
    if (Math.abs(el.currentTime - at) > 1) el.currentTime = at;
    // Only on arrival at a lesson, never on every render, or a seek would be
    // undone by the value it just replaced.
  }, [lesson.id]);

  const seekTo = useCallback((p) => {
    const el = ref.current;
    const next = Math.min(1, Math.max(0, p));
    setPct(next);
    if (el && dur) el.currentTime = next * dur;
    onSeek?.(next);
  }, [dur, onSeek]);

  // Exposed so a question can move the video to its moment from outside.
  useEffect(() => { if (position !== pct && !playing) setPct(position); }, [position]);

  const onTime = () => {
    const el = ref.current;
    if (!el || !dur) return;
    const p = el.currentTime / dur;
    setPct(p);
    onProgress?.(p);
    // Completion fires once. Firing it on every timeupdate past 90% would
    // write the same flag forty times a second.
    if (!completed.current && p >= 0.9) { completed.current = true; onComplete?.(); }
  };

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => setError("offline"));
    else { el.pause(); setPlaying(false); }
  };

  const onKeyDown = (e) => {
    const el = ref.current;
    if (!el) return;
    const k = e.key;
    const step = (s) => { e.preventDefault(); seekTo(pct + s / (dur || 1)); };
    if (k === " " || k === "Enter") { e.preventDefault(); toggle(); }
    else if (k === "ArrowRight") step(5);
    else if (k === "ArrowLeft") step(-5);
    else if (k === "ArrowUp") { e.preventDefault(); el.volume = Math.min(1, el.volume + 0.1); }
    else if (k === "ArrowDown") { e.preventDefault(); el.volume = Math.max(0, el.volume - 0.1); }
    else if (k === "f" || k === "F") { e.preventDefault(); el.requestFullscreen?.(); }
    else if (k === "m" || k === "M") { e.preventDefault(); setMuted((v) => { el.muted = !v; return !v; }); }
    else if (k === "c" || k === "C") { e.preventDefault(); setCaptions((v) => !v); }
  };

  // waiting and stalled fire routinely while buffering. Treating them as
  // failure turns a slow connection into a dead one, which is the opposite of
  // the honesty this state is for — only a real error ends playback.
  return (
    <>
      <div className="player" onKeyDown={onKeyDown} tabIndex={0}
           role="group" aria-label={`${lesson.title} player`}>
        {!video ? (
          <p className="ptag">Not recorded yet.</p>
        ) : error ? (
          // Says what happened and what to do. Never a spinner that goes on
          // for ever, which is what a dropped connection looks like otherwise.
          <div className="perr">
            <p>This will not play — the connection dropped.</p>
            <button type="button" onClick={() => { setError(null); ref.current?.load(); }}>Try again</button>
          </div>
        ) : (
          <>
            <video ref={ref} src={video.url} playsInline preload="metadata"
                   onTimeUpdate={onTime} onLoadedMetadata={() => setReady(true)}
                   onError={() => setError("offline")}
                   onWaiting={() => setBuffering(true)}
                   onPlaying={() => setBuffering(false)}
                   onCanPlay={() => setBuffering(false)}
                   onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
              {/* Wired from the start. A caption track that arrives later means
                  re-processing every video that never had one. */}
              {lesson.captions && (
                <track kind="captions" src={lesson.captions} srcLang="en" label="English"
                       default={captions} />
              )}
            </video>
            {!playing && (
              <button type="button" className="pbig" onClick={toggle}
                      aria-label={`Play ${lesson.title}`}>
                <Play aria-hidden="true" />
              </button>
            )}
          </>
        )}
        {video && !error && <p className="ptag">{buffering ? "Buffering" : ready ? lesson.code : "Loading"}</p>}
      </div>

      <div className="scrub">
        <span className="tc">{mmss(dur * pct)}</span>
        <div className="track" ref={trackRef}
             role="slider" tabIndex={0} aria-label="Position"
             aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(dur * pct)}
             onKeyDown={onKeyDown}
             onClick={(e) => {
               const r = trackRef.current.getBoundingClientRect();
               seekTo((e.clientX - r.left) / r.width);
             }}>
          <i style={{ width: `${pct * 100}%` }} />
          {dur > 0 && marks.map((m) => (
            <b key={m.id} style={{ left: `${(m.at / dur) * 100}%` }}
               title={`Question at ${mmss(m.at)}`} />
          ))}
        </div>
        <span className="tc">{mmss(dur)}</span>
        {video && (
          <span className="pctl">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setMuted((v) => { if (ref.current) ref.current.muted = !v; return !v; })}
                    aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
              {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setCaptions((v) => !v)}
                    aria-label="Captions" aria-pressed={captions}>
              <Subtitles aria-hidden="true" />
            </button>
            <button type="button" onClick={() => ref.current?.requestFullscreen?.()} aria-label="Full screen">
              <Maximize2 aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    </>
  );
}
