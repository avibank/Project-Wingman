import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Play, ArrowRight } from "lucide-react";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import "./module.css";

// The player is the only rounded object on the screen. It is genuinely a piece
// of media, which is why it is allowed a corner while nothing else is.
function Player({ lesson, pos, onScrub, marks, onPlay }) {
  const dur = lesson.duration || 0;
  const trackRef = useRef(null);

  const seek = (e) => {
    const el = trackRef.current;
    if (!el || !dur) return;
    const r = el.getBoundingClientRect();
    onScrub(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <>
      <div className="player">
        {/* No source yet is a state, not a failure. It says so rather than
            showing a broken frame or a spinner that never resolves. */}
        {lesson.video ? (
          <button type="button" className="pbig" onClick={onPlay} aria-label={`Play ${lesson.title}`}>
            <Play aria-hidden="true" />
          </button>
        ) : (
          <p className="ptag">Not recorded yet.</p>
        )}
        {lesson.video && <p className="ptag">{lesson.code}</p>}
      </div>

      <div className="scrub">
        <span className="tc">{mmss(dur * pos)}</span>
        <div className="track" ref={trackRef} onClick={seek}
             role="slider" tabIndex={0} aria-label="Position"
             aria-valuemin={0} aria-valuemax={Math.round(dur)}
             aria-valuenow={Math.round(dur * pos)}
             onKeyDown={(e) => {
               if (!dur) return;
               const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
               if (!step) return;
               e.preventDefault();
               onScrub(Math.min(1, Math.max(0, pos + step / dur)));
             }}>
          <i style={{ width: `${pos * 100}%` }} />
          {/* A mark at every question's moment, so you can see where people
              got stuck before you get stuck. */}
          {dur > 0 && marks.map((m) => (
            <b key={m.id} style={{ left: `${(m.at / dur) * 100}%` }} title={`Question at ${mmss(m.at)}`} />
          ))}
        </div>
        <span className="tc">{mmss(dur)}</span>
      </div>
    </>
  );
}

export default function LessonPage({
  module: mod, chapters, chapter, lesson, state, questions = [],
  openQuestionId, onBack, onOpenLesson, onOpenQuiz, onSeekSaved,
}) {
  const [pos, setPos] = useState(state?.pos?.[lesson.id]?.pct || 0);
  const [openQ, setOpenQ] = useState(openQuestionId || null);

  // Arriving with a question in the URL is the other half of "Watch at 6:12":
  // the page opens at that moment with that question already open.
  useEffect(() => {
    if (!openQuestionId) return;
    const q = questions.find((x) => String(x.id) === String(openQuestionId));
    if (q && lesson.duration) setPos(q.at / lesson.duration);
    setOpenQ(openQuestionId);
  }, [openQuestionId, questions, lesson.duration]);

  const scrubTo = (p) => { setPos(p); onSeekSaved?.(lesson.id, p); };

  // Opening a question moves the video to its moment. Without this round trip
  // the model is just a forum with timestamps written on it.
  const openQuestion = (q) => {
    setOpenQ(q.id === openQ ? null : q.id);
    if (lesson.duration) scrubTo(q.at / lesson.duration);
  };

  const next = nextAfterLesson(chapters, chapter.id, lesson.id, state);

  return (
    <div className="mscreen">
      <div className="hdr">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {mod.name}
        </button>
      </div>

      <div className="lesson">
        <div>
          <Player lesson={lesson} pos={pos} onScrub={scrubTo}
                  marks={questions} onPlay={() => {}} />

          <div className="lbody">
            <p className="cap">What this covers</p>
            {lesson.covers
              ? <p>{lesson.covers}</p>
              : <p>The transcript arrives with the recording.</p>}
          </div>

          {next && (
            <button type="button" className="nextup"
                    onClick={() => next.kind === "quiz" ? onOpenQuiz(next.chapter) : onOpenLesson(next.chapter, next.lesson)}>
              <span>
                <span className="cap">Next</span>
                <span className="nextn">{nextLabel(next)}</span>
                <span className="nextm">{nextWhere(next)}</span>
              </span>
              <span className="nextgo">Continue <ArrowRight aria-hidden="true" /></span>
            </button>
          )}
        </div>

        <aside className="side">
          <h4>Questions</h4>
          <p className="sh">
            {questions.length
              ? "Each one is pinned to a moment. Opening one moves the video there."
              : "Ask about the moment you are on and it stays pinned there for whoever comes next."}
          </p>
          {questions.map((q) => (
            <button key={q.id} type="button" className="qitem" onClick={() => openQuestion(q)}
                    aria-expanded={openQ === q.id}>
              <span className="stime">{mmss(q.at)}</span>
              <span className="sq2">{q.title}</span>
              <span className="smeta">
                {/* Coloured words, not pills. */}
                <span className={`tagd${q.answers?.length ? "" : " open"}`}>
                  {q.answers?.length ? "Answered" : "Waiting"}
                </span>
                {q.who}
              </span>
              {openQ === q.id && q.answers?.map((a, i) => (
                <span key={i} className="smeta">{a}</span>
              ))}
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
