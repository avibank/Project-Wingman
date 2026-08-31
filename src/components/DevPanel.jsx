import { useState } from "react";

// The developer's panel. Two locks: the dev.panel flag, and an admin check
// that this component makes for itself rather than trusting its caller — it
// writes progress and can wipe an account, so it does not render on the word
// of whoever mounted it.
//
// The two resets are the point of the whole thing. Without them, checking
// "what does a new student see" means a new account every time, and that stops
// happening after the second one. With them it is one tap, so the empty state
// — the only screen that cannot be un-seen — gets checked twenty times rather
// than twice.
const KEYS = {
  done: "pw-lesson-done",
  pos: "pw-lesson-pos",
  quiz: "pw-quiz-scores",
  opened: "pw-paper-opened",
};

// Everything a first visit must not have. Listed rather than pattern-matched,
// so a key added later is a deliberate decision to include here, not an
// accident of its name.
const ACCOUNT_KEYS = [
  ...Object.values(KEYS),
  "pw-completed", "pw-livery", "pw-finish", "pw-ruled", "pw-notices",
  "pw-streak",
  // The user's own bar. A reset has to put it back to the default, or the
  // next "first visit" starts with somebody else's standard and lamps that
  // light for no visible reason.
  "pw-minimums",
  // These three were listed under names that do not exist — pw-variant,
  // pw-scale and pw-name — so a reset silently left the real settings behind.
  // The real keys, verified against every progress.get/set in src.
  "pw-variant-pin", "pw-font-size", "pw-greet-name",
  // Retention and its stamp: the re-check pile IS account progress.
  "pw-retention", "pw-last-recheck",
];

const DEVP_CSS = `
.devp{position:fixed;right:0;bottom:14vh;z-index:60;font-family:var(--font-ui)}
.devp-tab{background:var(--raised);color:var(--t2);border:1px solid var(--line);border-right:0;
  border-radius:8px 0 0 8px;padding:10px 9px;font-family:var(--font-mono);font-size:11px;
  letter-spacing:.12em;text-transform:uppercase;cursor:pointer;writing-mode:vertical-rl}
.devp-body{position:absolute;right:0;bottom:0;width:288px;background:var(--panel);
  border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:9px;
  box-shadow:var(--drop,none);max-height:70vh;overflow:auto}
.devp-h{font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--t3);margin:4px 0 0}
.devp-n{font-size:11.5px;color:var(--t3);line-height:1.45;margin:0}
.devp select{width:100%;background:var(--raised);color:var(--t1);border:1px solid var(--line);
  border-radius:7px;padding:8px;font-family:inherit;font-size:13px}
.devp-row{display:flex;gap:6px;flex-wrap:wrap}
.devp-row button{background:var(--raised);color:var(--t2);border:1px solid var(--line);
  border-radius:7px;padding:7px 10px;font-family:inherit;font-size:12.5px;cursor:pointer}
.devp-row button:hover{color:var(--t1)}
.devp-danger{color:var(--danger,#e06666) !important}
.devp-confirm{border-top:1px solid var(--line);padding-top:9px;display:grid;gap:8px}
.devp-confirm p{font-size:12.5px;color:var(--t2);margin:0;line-height:1.45}
`;

export default function DevPanel({ isAdmin, enabled, progress, modules, chapters, moduleCode, onGo, onRecordLesson, onRecordQuiz }) {
  const [open, setOpen] = useState(false);
  const [lessonId, setLessonId] = useState("");
  const [confirming, setConfirming] = useState(null);

  if (!enabled || !isAdmin) return null;

  const done = progress.get(KEYS.done, {});
  const pos = progress.get(KEYS.pos, {});
  const quiz = progress.get(KEYS.quiz, {});
  const lessons = chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];

  // Marking done here writes the logbook entry too. A dev control that skips
  // it would produce flags with no history, which is exactly the divergence
  // the single completion rule exists to prevent.
  const setDone = (id, on, chapterId) => {
    if (on && onRecordLesson) return onRecordLesson(id, chapterId);
    progress.set(KEYS.done, { ...done, [id]: on });
  };
  const setPos = (id, pct) => progress.set(KEYS.pos, { ...pos, [id]: { pct } });
  const setQuiz = (chId, correct, total) =>
    onRecordQuiz ? onRecordQuiz(chId, correct, total)
                 : progress.set(KEYS.quiz, { ...quiz, [chId]: { correct, total } });

  // Scoped to the module in view. Everything else on the account survives.
  const resetModule = () => {
    const ids = new Set(lessons.map((l) => l.id));
    const chIds = new Set(chapters.map((c) => c.id));
    progress.set(KEYS.done, Object.fromEntries(Object.entries(done).filter(([k]) => !ids.has(k))));
    progress.set(KEYS.pos, Object.fromEntries(Object.entries(pos).filter(([k]) => !ids.has(k))));
    progress.set(KEYS.quiz, Object.fromEntries(Object.entries(quiz).filter(([k]) => !chIds.has(k))));
    setConfirming(null);
  };

  const resetAccount = () => {
    for (const k of ACCOUNT_KEYS) progress.set(k, undefined);
    setConfirming(null);
  };

  return (
    <div className="devp">
      <button type="button" className="devp-tab" onClick={() => setOpen((v) => !v)}
              aria-expanded={open}>Dev</button>
      {open && (
        <div className="devp-body">
          <p className="devp-h">Lesson</p>
          <select value={lesson?.id || ""} onChange={(e) => setLessonId(e.target.value)}
                  aria-label="Lesson">
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.chapter.title} · {l.title}</option>
            ))}
          </select>
          {lesson && (
            <>
              <div className="devp-row">
                <button type="button" onClick={() => setDone(lesson.id, !done[lesson.id], lesson.chapter.id)}>
                  {done[lesson.id] ? "Mark not done" : "Mark done"}
                </button>
              </div>
              <div className="devp-row">
                {[0, 0.25, 0.5, 0.89, 0.95].map((p) => (
                  <button key={p} type="button" onClick={() => setPos(lesson.id, p)}>
                    {Math.round(p * 100)}%
                  </button>
                ))}
              </div>
              <p className="devp-n">
                {/* 89 and 95 straddle the completion rule on purpose: one is
                    below 90% and one is above, so the threshold itself can be
                    tested rather than assumed. */}
                89% and 95% sit either side of the 90% completion rule.
              </p>

              <p className="devp-h">{lesson.chapter.title} quiz</p>
              <div className="devp-row">
                {[8, 7, 5, 3].map((n) => (
                  <button key={n} type="button" onClick={() => setQuiz(lesson.chapter.id, n, 8)}>
                    {n}/8
                  </button>
                ))}
                <button type="button" onClick={() => {
                  const { [lesson.chapter.id]: _drop, ...rest } = quiz;
                  progress.set(KEYS.quiz, rest);
                }}>Untake</button>
              </div>
            </>
          )}

          <p className="devp-h">Go to</p>
          <div className="devp-row">
            {modules.map((m) => (
              <button key={m.code} type="button" onClick={() => onGo("module", m.code)}>{m.code}</button>
            ))}
          </div>
          <div className="devp-row">
            <button type="button" onClick={() => onGo("lesson", moduleCode, lesson)}>Lesson</button>
            <button type="button" onClick={() => onGo("quiz", moduleCode, lesson)}>Quiz</button>
            <button type="button" onClick={() => onGo("library", moduleCode)}>Library</button>
            <button type="button" onClick={() => onGo("people", moduleCode)}>People</button>
          </div>

          <p className="devp-h">Reset</p>
          <div className="devp-row">
            {/* Both resets confirm. They are the two controls here that
                destroy something, and one of them is the whole account. */}
            <button type="button" onClick={() => setConfirming("module")}>This module</button>
            <button type="button" className="devp-danger" onClick={() => setConfirming("account")}>
              Whole account
            </button>
          </div>
          {confirming && (
            <div className="devp-confirm">
              <p>{confirming === "module"
                ? "Clear progress for this module only?"
                : "Put this account back to a first visit? Everything goes."}</p>
              <div className="devp-row">
                <button type="button" className="devp-danger"
                        onClick={confirming === "module" ? resetModule : resetAccount}>Do it</button>
                <button type="button" onClick={() => setConfirming(null)}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
      <style>{DEVP_CSS}</style>
    </div>
  );
}
