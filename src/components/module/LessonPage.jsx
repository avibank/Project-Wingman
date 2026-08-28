import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight } from "lucide-react";
import Player from "./Player.jsx";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import "./module.css";

export default function LessonPage({
  module: mod, chapters, chapter, lesson, state, questions = [],
  openQuestionId, onBack, onOpenLesson, onOpenQuiz, onSeekSaved, onComplete, onMarkDone, done,
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
          {/* The player owns its own controls now — the separate scrub that
              used to sit under the frame has gone with them. */}
          <Player lesson={lesson} position={pos} marks={questions}
                  onSeek={scrubTo}
                  onProgress={(p) => { setPos(p); onSeekSaved?.(lesson.id, p); }}
                  onComplete={() => onComplete?.(lesson.id)} />

          <div className="lbody">
            <p className="cap">What this covers</p>
            {lesson.covers
              ? <p>{lesson.covers}</p>
              : <p>The transcript arrives with the recording.</p>}
          </div>

          {/* The manual half of the completion rule, which had no control
              anywhere until now — the rule has always been "90% watched OR
              marked by hand", and only the dev panel could do the second. A
              student who reads the transcript instead of watching, or whose
              connection will not carry video, could never finish a lesson. */}
          <button type="button" className="markdone" aria-pressed={done}
                  onClick={() => onMarkDone?.(lesson.id, !done)}>
            {done ? "Done — mark it not done" : "Mark as done"}
          </button>

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
