/* ==========================================================================
   Wingman — exam, end sheet, result and leaderboard markup.
   COPY THIS STRUCTURE AS IS. Every element, class and order here matches
   reference-demo.html. Wire the data to the real stores; change nothing else.
   Styling lives only in wingman-exam.css — add no inline styles, no extra
   wrappers, no utility classes.
   ========================================================================== */
import { useEffect } from 'react';
import { Stamp } from './stamp';

const pad = n => String(n).padStart(2, '0');
export const clock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;      // 09:33
export const mmss  = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;           // 7:35
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

/* R2: the exam owns the screen while it is open. */
export function useExamScreen() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.screen = 'exam';
    return () => { delete root.dataset.screen; };
  }, []);
}

const Icon = {
  prev: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5"/></svg>,
  next: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3 5 5-5 5"/></svg>,
  flag: <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.5v13h1.5V9.2h7.8l-1.6-3.1 1.6-3.1H4.5V1.5z"/></svg>,
  mark: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 2h8v12l-4-3.2L4 14z"/></svg>,
  markOn: <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h8v12l-4-3.2L4 14z"/></svg>,
};

/* ---- top bar: locked while the exam is open (R4) ------------------------ */
export function ExamTopbar({ locked }) {
  return (
    <div className="exam-topbar">
      <span className="brand">Wingman</span>
      {locked
        ? <span className="locked-note">Exam in progress</span>
        : <AppTopbarActions /> /* the app's normal Ready Room pill + profile */}
    </div>
  );
}

/* ---- the bar above the exam -------------------------------------------- */
export function ExamBar({ module, chapter, quizName, secondsLeft, answered, total, onEnd }) {
  return (
    <header className="exam-bar">
      <div className="exam-bar__title">
        <span className="exam-bar__eyebrow">{module} · {chapter}</span>
        <span className="exam-bar__name">{quizName}</span>
      </div>
      <div className={`exam-timer${secondsLeft < 60 ? ' is-low' : ''}`}>
        <span className="exam-timer__label">Time left</span>
        <span className="exam-timer__value">{clock(secondsLeft)}</span>
      </div>
      {onEnd && <button className="btn" type="button" onClick={onEnd}>End exam</button>}
      <span className="route" aria-hidden="true">
        <span className="route__fill" style={{ width: `${(answered / total) * 100}%` }} />
      </span>
    </header>
  );
}

/* ---- question list ------------------------------------------------------ */
export function Navigator({ questions, current, answers, flagged, saved, answeredCount, onGo }) {
  return (
    <nav className="navigator" aria-label="Questions">
      <p className="navigator__title">Questions <span>{answeredCount}/{questions.length}</span></p>
      <div className="navigator__grid">
        {questions.map((q, i) => (
          <button key={q.id} type="button" onClick={() => onGo(i)}
            aria-label={`Question ${i + 1}`}
            aria-current={i === current ? 'step' : undefined}
            className={'qcell'
              + (answers[i] != null ? ' is-answered' : '')
              + (i === current ? ' is-current' : '')
              + (flagged[i] ? ' is-flagged' : '')
              + (saved[i] ? ' is-saved' : '')}>
            {saved[i] && <span className="dog">{Icon.mark}</span>}
            {i + 1}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---- the question ------------------------------------------------------- */
export function Question({ q, index, total, answer, isFlagged, isSaved, onAnswer, onFlag, onSave, onPrev, onNext, onFinish }) {
  return (
    <section className="question">
      <div className="question__head">
        <span className="question__num">Question <b>{index + 1}</b> of {total}</span>
        {/* bookmark sits in the far corner opposite the question number */}
        <button className="mark" type="button" onClick={onSave} aria-pressed={!!isSaved}
          aria-label={isSaved ? 'Saved to bookmarks' : 'Save this question'}
          title={isSaved ? 'Saved' : 'Save this question'}>
          {isSaved ? Icon.markOn : Icon.mark}
        </button>
      </div>
      <div className="question__main">
        <p className="question__text">{q.text}</p>
        <fieldset className="options">
          <legend className="sr-only">Choose one answer</legend>
          {q.options.map((opt, i) => (
            <label className="option" key={i}>
              <input type="radio" name={`q${index}`} value={i} checked={answer === i} onChange={() => onAnswer(i)} />
              <span className="option__radio" />
              <span className="option__key">{'ABC'[i]}</span>
              <span className="option__text">{opt}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="question__foot">
        <button className="btn" type="button" onClick={onPrev} disabled={index === 0}>{Icon.prev}Previous</button>
        <button className="btn btn--ghost btn--flag" type="button" onClick={onFlag} aria-pressed={!!isFlagged}>
          {Icon.flag}<span>Flag for review</span>
        </button>
        <span className="spacer" />
        {index === total - 1
          ? <button className="btn btn--primary" type="button" onClick={onFinish}>Finish</button>
          : <button className="btn btn--primary" type="button" onClick={onNext}>Next{Icon.next}</button>}
      </div>
    </section>
  );
}

/* ---- end-exam confirm: the only way out (R4) ---------------------------- */
export function EndExamSheet({ answered, total, flaggedCount, onConfirm, onBack }) {
  const blank = total - answered;
  return (
    <section className="question">
      <div className="sheet">
        <h2>End the exam?</h2>
        <p>
          {answered} of {total} answered
          {blank ? `, ${blank} still blank` : ''}
          {flaggedCount ? `, ${flaggedCount} flagged` : ''}
          . You can&rsquo;t change answers after this, and the clock stops when you do.
        </p>
        <div className="row">
          <button className="btn btn--primary" type="button" onClick={onConfirm}>End exam</button>
          <button className="btn" type="button" onClick={onBack}>Back to the exam</button>
        </div>
      </div>
    </section>
  );
}

/* ---- result ------------------------------------------------------------- */
export function Result({ percent, passMark, bar, you, variant, missed, onSaveMissed, onRetake }) {
  const verdict = percent >= passMark
    ? (percent >= bar ? 'Passed, above your bar' : 'Passed, under your bar')
    : 'Not this time';
  return (
    <section className="result">
      <div className="result__top">
        <p className="score">{percent}%</p>
        <div className="verdict">
          <Stamp callsign={you.callsign} ink={you.ink} shape={you.shape} variant={variant} big press />
          <h1>{verdict}</h1>
        </div>
        <div>
          <div className="meter">
            <span className="meter__fill" style={{ width: `${percent}%` }} />
            <span className="meter__mark" style={{ left: `${passMark}%` }}><span>Pass {passMark}%</span></span>
            <span className="meter__mark" style={{ left: `${bar}%`, opacity: .45 }}><span>Your bar</span></span>
          </div>
          <div className="meter-legend" />
        </div>
      </div>
      <ul className="missed">
        {missed.map(m => (
          <li key={m.index}>
            <span className="n">{pad(m.index + 1)}</span>
            <span className="q">
              <b>{m.text}</b>
              <span className="ans">
                <span className="was">{'ABC'[m.chose]} {m.choseText}</span>&rarr;
                <span className="is">{'ABC'[m.correct]} {m.correctText}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="result__foot">
        {missed.length > 0 && <button className="btn" type="button" onClick={onSaveMissed}>Save the ones I missed</button>}
        <button className="btn btn--primary" type="button" onClick={onRetake}>Retake</button>
      </div>
    </section>
  );
}

/* ---- leaderboard -------------------------------------------------------- */
/* runs: [{ id, account, callsign, ink, shape, score, seconds, isYou }]
   already sorted by the server: score desc, seconds asc (R5). */
export function Leaderboard({ title, runs, total, variant, onShowWho }) {
  const yourPlace = runs.findIndex(r => r.isYou) + 1;
  const you = runs[yourPlace - 1];
  return (
    <section className="board is-in" aria-label="Leaderboard" style={{ '--n': yourPlace - 1 }}>
      <div className="board__head">
        <span className="board__title">{title}</span>
        <span className="board__place">You&rsquo;re <b>{ord(yourPlace)}</b> of {runs.length}</span>
      </div>
      <ol className="lb-list">
        {runs.map((r, i) => (
          <li key={r.id} className={`lb-row${r.isYou ? ' is-you' : ''}`} style={{ '--i': i }}
              aria-current={r.isYou ? 'true' : undefined}>
            <span className="lb-row__rank">{i + 1}</span>
            <button className="lb-row__stamp" type="button" onClick={() => onShowWho(r)} aria-label={`${r.callsign}, ${r.account}`}>
              <Stamp callsign={r.callsign} ink={r.ink} shape={r.shape} variant={variant} />
            </button>
            <span className="lb-row__who">
              <span className="lb-row__acct">[{r.account}]</span>
              <span className="lb-row__call">{r.callsign}</span>
            </span>
            <span className="lb-row__score">{r.score}/{total}</span>
            <span className="lb-row__time">{mmss(r.seconds)}</span>
          </li>
        ))}
      </ol>
      <div className="board__foot">
        <span>Ranked on score, then time taken.</span>
        {you && <span>Your run: {you.score}/{total} in {mmss(you.seconds)}</span>}
      </div>
    </section>
  );
}

/* ---- the whole screen --------------------------------------------------- */
export function ExamScreen({ state, actions, variant }) {
  useExamScreen();
  const { phase } = state;   // 'exam' | 'ending' | 'result'
  const locked = phase !== 'result';
  return (
    <div className="exam-page">
      <ExamTopbar locked={locked} />
      {phase === 'result' ? (
        <>
          <Result {...state.result} variant={variant} onSaveMissed={actions.saveMissed} onRetake={actions.retake} />
          <Leaderboard {...state.board} variant={variant} onShowWho={actions.showWho} />
        </>
      ) : (
        <div className="exam-frame"><div className="exam">
          <ExamBar {...state.bar} onEnd={phase === 'exam' ? actions.askEnd : null} />
          <div className="exam-body">
            <Navigator {...state.navigator} onGo={actions.go} />
            {phase === 'ending'
              ? <EndExamSheet {...state.ending} onConfirm={actions.endExam} onBack={actions.backToExam} />
              : <Question {...state.question} onAnswer={actions.answer} onFlag={actions.flag} onSave={actions.save}
                  onPrev={actions.prev} onNext={actions.next} onFinish={actions.askEnd} />}
          </div>
        </div></div>
      )}
    </div>
  );
}
