/* =============================================================================
   THE QUIZ HUB — the room you walk into before the paper (owner, 2026-11-14).
   -----------------------------------------------------------------------------
   Pressing a quiz lands here first and the paper starts from a button. Nothing
   on this screen is marked or timed, and opening it opens no run: the clock and
   the board begin when the student presses Start.

   WHAT IS ON IT, top to bottom, and why:
     · The paper's facts as icons and numbers.
     · YOUR attempt: a dial and three equal tiles — grade, time, place. A first
       sitting shows the same shape with dashes and the student's own faint
       stamp in the ring, so the card never reads as a hole. The score and the
       grade are the student's alone: the eye-off mark says so without a word.
     · A PODIUM, first second third, ranked and never scored. Nobody's score is
       drawn on the board.
     · SEVEN DOTS under it for places four to ten, in the batch strip's own
       drawing: a stamp where there is a person, a dashed ring where there is
       not. Only the top ten ever appear.
     · Start, then the study cards.

   UNMARKED SHOWS THE HOUSE STAMP, NOT YOURS (owner, 2026-11-14): until a sitting is
   finished the ring and first place carry the default seal, and the student's
   real stamp arrives with their finished run, on the board.

   AN EMPTY BOARD IS HONEST AND NOT BLEAK (owner: "just as encouraging if it has
   twenty attempts or none"). The three places are drawn as faded gold, silver
   and bronze seals — medals waiting to be given — and first place carries the
   student's own stamp at half strength. No "nobody has", no zero, no spinner:
   a placeholder that shimmers reads as a screen that failed to load.

   THE GRADE is the owner's scale on the percentage: under 75 is F, then B- (75),
   B (80), B+ (85), A- (90), A (94). It is a presentation of the student's own
   score, so it lives here and is held by check:quiz-stamps.

   THE CLIENT ONLY FORMATS. Rank, score and seconds arrive decided from
   `fetchBoard` (board.js R5). Nothing is sorted or timed here.

   ONE LIMIT, STATED: the board rows carry no timestamp, so the dial shows the
   student's BEST run on the board, not strictly the latest. Showing the latest
   needs the leaderboard function to return `submitted_at`, which is a
   migration; until then the label says "Your best".
   ========================================================================= */
import { useEffect, useMemo, useState } from "react";
import Stamp from "../Stamp.jsx";
import { stampOf } from "../../lib/stamp.js";
import { fetchBoard, mmss, ord, setRunHidden } from "../../lib/board.js";
import { allowanceFor, passAt } from "../../lib/quiz.js";
import { path as routePath } from "../../lib/routes.js";
import { useGo } from "../../features/bookmarks/nav.jsx";
import { tilt } from "./Leaderboard.jsx";

export const TOP = 10;

/** The owner's scale, on a percentage. */
export const gradeOf = (pct) =>
  pct >= 94 ? "A" : pct >= 90 ? "A-" : pct >= 85 ? "B+" : pct >= 80 ? "B" : pct >= 75 ? "B-" : "F";

const R = 42, CIRC = 2 * Math.PI * R;

/* A scalloped seal in a metal's tone: a seat on the podium nobody holds yet. */
function Seal({ size, tone, label = null }) {
  const n = 28, r1 = size / 2 - 1.5, r2 = r1 - size * 0.05;
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r2 : r1;
    d += `${i ? "L" : "M"}${(size / 2 + Math.cos(a) * rr).toFixed(1)} ${(size / 2 + Math.sin(a) * rr).toFixed(1)}`;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={`${d}Z`} fill={tone} fillOpacity=".16" stroke={tone} strokeWidth="1.4" />
      <circle cx={size / 2} cy={size / 2} r={r2 - size * 0.07} fill="none" stroke={tone} strokeWidth="1.2" strokeDasharray="2 2.4" />
      {label && (
        <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="600"
              fontSize={size * 0.27} fill={tone}>{label}</text>
      )}
    </svg>
  );
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  q: "M9 9.5a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8M12 17.5v.1M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  clock: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M12 7v5l3 2",
  check: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M8 12.5l2.8 2.8L16.5 9.5",
  eyeOpen: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0",
  eye: "M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.6 3.3M6.3 7.6A12.5 12.5 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.4 0 2.6-.3 3.7-.8",
};

export default function QuizHub({
  title, eyebrow, quizId, total, moduleCode, chapterId, hasCards = false,
  resuming = false, me = null, onOpenPerson = null, onStart,
}) {
  const go = useGo();
  const [board, setBoard] = useState(null);
  useEffect(() => {
    let live = true;
    fetchBoard({ me, quizId, limit: 50 })
      .then((b) => { if (live) setBoard(b); })
      .catch(() => { if (live) setBoard({ runs: [], total: 0 }); });
    return () => { live = false; };
  }, [me, quizId]);

  const runs = useMemo(() => (board?.runs || []).slice(0, TOP), [board]);
  /* The student's own run, wherever it ranks — the dial shows it even from
     eleventh or lower, though the board itself stops at ten. */
  const mine = (board?.runs || []).find((r) => r.isYou) || null;
  const [bar, setBar] = useState(false);
  /* THE EYE (owner, 2026-11-14): on by default, so nothing is hidden until the
     student hides it. Pressed, the attempt's score, grade and time are withheld
     from everyone else — by the server (0044), not by this screen. */
  const [hiddenNow, setHiddenNow] = useState(null);   // null until the board says
  const hidden = hiddenNow ?? Boolean(mine?.hidden);
  const toggleEye = async () => {
    if (!mine) return;
    const next = !hidden;
    setHiddenNow(next);
    const ok = await setRunHidden({ me, runId: mine.id, hidden: next });
    if (!ok) setHiddenNow(!next);
  };
  /* Tapping a person. Their numbers when they are shown; otherwise straight to
     the profile card — the licence, the add and the rest — which is what the
     rest of the app does for a person. */
  const [peek, setPeek] = useState(null);
  const tap = (p) => {
    if (!p) return;
    if (p.score != null) setPeek((cur) => (cur && cur.id === p.id ? null : p));
    else if (!p.isYou) onOpenPerson?.({ userId: p.userId, name: p.callsign });
  };
  useEffect(() => {
    if (!peek) return undefined;
    const k = (e) => { if (e.key === "Escape") setPeek(null); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [peek]);
  useEffect(() => { const t = setTimeout(() => setBar(true), 80); return () => clearTimeout(t); }, []);

  const pct = mine ? Math.round(((mine.score || 0) / (mine.total || total || 1)) * 100) : 0;
  const grade = mine ? gradeOf(pct) : null;

  const seat = (pos) => {
    const p = runs[pos - 1];
    const size = pos === 1 ? 84 : 64;
    const d = pos === 1 ? ".05s" : pos === 2 ? ".18s" : ".3s";
    if (p) {
      return (
        <div className="qh-who" style={{ "--d": d }}>
          <button type="button" className="qh-hit is-inline" onClick={() => tap(p)} aria-label={`${p.callsign}, place ${pos}`}>
            <Stamp stamp={stampOf(p.profile)} size={size} rot={tilt(pos)} on={!!p.profile?.stamp_issued_at} />
          </button>
          <span className="qh-nm">{p.callsign}</span>
        </div>
      );
    }
    const tone = pos === 1 ? "var(--gold)" : pos === 2 ? "var(--silver)" : "var(--bronze)";
    return (
      <div className="qh-who" style={{ "--d": d }}>
        {pos === 1 && !mine
          ? <span className="qh-seal qh-mine"><Stamp stamp={null} size={size} rot={-4} on={false} /></span>
          : <span className="qh-seal"><Seal size={size} tone={tone} label={ord(pos)} /></span>}
      </div>
    );
  };

  return (
    <div className="qhub">
      <header className="qhub__head">
        {eyebrow && <p className="qhub__eye">{eyebrow}</p>}
        <h1>{title}</h1>
      </header>

      <ul className="qhub__facts" aria-label="About this paper">
        <li><Icon d={ICONS.q} /><b>{total}</b><span>Questions</span></li>
        <li><Icon d={ICONS.clock} /><b>{Math.round(allowanceFor(total) / 60)}</b><span>Minutes</span></li>
        <li><Icon d={ICONS.check} /><b>{passAt(total)}</b><span>To pass</span></li>
      </ul>

      <section className="qhub__latest" aria-label="Your attempt">
        <span className="qh-lbl">{mine ? "Your best" : "Your first attempt"}
          {mine && (
            <button type="button" className="qh-eye is-inline" onClick={toggleEye} aria-pressed={hidden}
                    aria-label={hidden ? "Show my attempt to others" : "Hide my attempt from others"}>
              <Icon d={hidden ? ICONS.eye : ICONS.eyeOpen} />
            </button>
          )}
        </span>
        <div className="qh-lbody">
          <div className="qh-ring">
            <svg viewBox="0 0 104 104" aria-hidden="true">
              {mine ? (
                <>
                  <circle className="qh-trk" cx="52" cy="52" r={R} fill="none" strokeWidth="8" />
                  <circle className="qh-bar" cx="52" cy="52" r={R} fill="none" strokeWidth="8"
                          strokeDasharray={CIRC}
                          strokeDashoffset={bar ? CIRC * (1 - (mine.score || 0) / (mine.total || total || 1)) : CIRC} />
                </>
              ) : <circle className="qh-dash" cx="52" cy="52" r={R} fill="none" strokeWidth="3" />}
            </svg>
            <div className="qh-mid">
              {mine
                ? <>{mine.score}<small>/{mine.total || total}</small></>
                : <Stamp stamp={null} size={98} rot={0} on={false} />}
            </div>
          </div>
          <div className="qh-tiles">
            <div className={`qh-tile ${mine ? "qh-accent" : "qh-none"}`}><b>{mine ? grade : "–"}</b><span>Grade</span></div>
            <div className={`qh-tile ${mine ? "" : "qh-none"}`}><b>{mine ? mmss(mine.seconds) : "–"}</b><span>Time</span></div>
            <div className={`qh-tile ${mine ? "" : "qh-none"}`}><b>{mine ? ord(mine.rank) : "–"}</b><span>Place</span></div>
          </div>
        </div>
      </section>

      <section className="qhub__stage" aria-label="The board">
        <div className="qh-podium">
          {[2, 1, 3].map((pos) => (
            <div key={pos} className={`qh-pcol qh-p${pos}${runs[pos - 1]?.isYou ? " qh-you" : ""}`}>
              {seat(pos)}
              <div className="qh-block" style={{ "--d": pos === 1 ? ".05s" : pos === 2 ? ".18s" : ".3s" }}></div>
            </div>
          ))}
        </div>
      </section>

      <div className="qh-dots" aria-label="Places four to ten">
        {[4, 5, 6, 7, 8, 9, 10].map((n) => {
          const p = runs[n - 1];
          return (
            <div key={n} className={`qh-dot${p ? " qh-on" : ""}${p?.isYou ? " qh-you" : ""}`} style={{ "--k": n - 4 }}>
              <span className="qh-c">
                {!p && <span className="qh-ord">{ord(n)}</span>}
                {p && (
                  <button type="button" className="qh-hit is-inline" onClick={() => tap(p)} aria-label={`${p.callsign}, place ${n}`}>
                    <Stamp stamp={stampOf(p.profile)} size={36} rot={tilt(n)} on={!!p.profile?.stamp_issued_at} />
                  </button>
                )}
              </span>
              <span className="qh-n" style={p ? undefined : { visibility: "hidden" }}>{ord(n)}</span>
            </div>
          );
        })}
      </div>

      {/* THE PEEK IS A PANEL IN THE PAGE, not a window over it: nothing is frozen
          or dimmed, the board stays in view and a second tap on the same stamp
          (or the close mark) puts it away. */}
      {peek && (
        <section className="qh-peek" aria-label={`${peek.callsign}'s attempt`}>
          <Stamp stamp={stampOf(peek.profile)} size={52} rot={-4} on={!!peek.profile?.stamp_issued_at} />
          <div className="qh-pbody">
            <b className="qh-pn">{peek.callsign}</b>
            <div className="qh-tiles">
              <div className="qh-tile"><b>{peek.score}/{peek.total || total}</b><span>Score</span></div>
              <div className="qh-tile qh-accent"><b>{gradeOf(Math.round((peek.score / (peek.total || total || 1)) * 100))}</b><span>Grade</span></div>
              <div className="qh-tile"><b>{mmss(peek.seconds)}</b><span>Time</span></div>
            </div>
            {!peek.isYou && onOpenPerson && (
              <button type="button" className="qh-prof" onClick={() => onOpenPerson({ userId: peek.userId, name: peek.callsign })}>
                View profile
              </button>
            )}
          </div>
          <button type="button" className="qh-x is-inline" onClick={() => setPeek(null)} aria-label="Close">
            <Icon d="M6 6l12 12M18 6L6 18" />
          </button>
        </section>
      )}

      <div className="qhub__go">
        <button type="button" className="qhub__start" data-hub="start" onClick={onStart}>
          {resuming ? "Pick up where you left off" : "Start the quiz"}
        </button>
        {hasCards && (
          <button type="button" className="qhub__warm" data-hub="cards"
                  onClick={() => go(routePath.cards(moduleCode, chapterId))}>
            Warm up with the study cards
          </button>
        )}
      </div>

      <style>{`
        .qhub { --gold: #e7b94f; --silver: #aeb8c9; --bronze: #d99a68;
          display: grid; gap: 16px; max-width: 560px; margin: 0 auto; padding: 8px 0 88px; }
        .app.theme-light .qhub { --gold: #b9851a; --silver: #7e8aa0; --bronze: #a8693a; }
        .qhub__head h1 { margin: 2px 0 0; font-size: clamp(26px, 5vw, 34px); line-height: 1.12; font-weight: 600; letter-spacing: -.02em; color: var(--t1); text-wrap: balance; }
        .qhub__eye { margin: 0; font: 600 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--t2); }
        .qhub__facts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .qhub__facts li { display: grid; justify-items: center; gap: 4px; padding: 12px 6px 10px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
        .qhub__facts svg { width: 18px; height: 18px; color: var(--t2); }
        .qhub__facts b { font: 600 22px/1 var(--font-mono); color: var(--t1); font-variant-numeric: tabular-nums; }
        .qhub__facts span { font-size: 11.5px; color: var(--t2); }

        .qhub__latest { display: grid; gap: 12px; padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); }
        .qhub .qh-lbl { font: 600 11px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--t2); display: flex; align-items: center; gap: 6px; }
        .qhub .qh-lbl svg { width: 14px; height: 14px; }
        .qhub .qh-lbody { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: clamp(8px, 2.5vw, 14px); align-items: center; }
        .qhub .qh-ring { position: relative; width: 104px; height: 104px; }
        /* the RING turns so it starts at twelve o'clock; a stamp inside it must not turn with it */
        .qhub .qh-ring > svg { width: 100%; height: 100%; transform: rotate(-90deg); }
        .qhub .qh-ring .qh-trk { stroke: var(--raised); }
        .qhub .qh-ring .qh-bar { stroke: var(--active); stroke-linecap: round; transition: stroke-dashoffset 1.1s cubic-bezier(.2, .8, .2, 1); }
        .qhub .qh-ring .qh-dash { stroke: var(--line); stroke-dasharray: 3 5; stroke-linecap: round; }
        .qhub .qh-ring .qh-mid { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; line-height: 1; font: 600 24px var(--font-mono); color: var(--t1); font-variant-numeric: tabular-nums; }
        .qhub .qh-ring .qh-mid small { margin-top: 3px; font-size: 12px; color: var(--t2); font-weight: 500; }
        .qhub .qh-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
        .qhub .qh-tile { display: grid; place-content: center; justify-items: center; gap: 5px; height: 76px; border-radius: 14px; background: var(--raised); }
        .qhub .qh-tile b { font: 600 clamp(17px, 4.6vw, 22px)/1 var(--font-mono); letter-spacing: -.02em; color: var(--t1); font-variant-numeric: tabular-nums; }
        .qhub .qh-tile span { font: 500 10px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--t2); }
        .qhub .qh-tile.qh-accent { background: var(--active-fill); }
        .qhub .qh-tile.qh-accent b, .qhub .qh-tile.qh-accent span { color: var(--on-mark, var(--ground)); }
        .app.theme-light[data-paper] .qhub .qh-tile.qh-accent { background: var(--active-text); }
        .qhub .qh-tile.qh-none b { color: var(--t2); font-weight: 500; }

        .qhub__stage { padding: 18px 12px 0; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(180deg, var(--panel), var(--raised)); overflow: hidden; }
        .qhub .qh-podium { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-items: end; max-width: 460px; margin: 0 auto; }
        .qhub .qh-pcol { display: grid; justify-items: center; align-content: end; gap: 6px; min-width: 0; }
        .qhub .qh-who { display: grid; justify-items: center; gap: 4px; min-width: 0; animation: qhDrop .7s cubic-bezier(.2, 1.2, .3, 1) both; animation-delay: var(--d); }
        .qhub .qh-nm { font: 500 13px var(--font-ui); color: var(--t1); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .qhub .qh-pcol.qh-you .qh-nm { color: var(--active-text, var(--active)); font-weight: 600; }
        .qhub .qh-seal { display: grid; place-items: center; opacity: .34; }
        .qhub .qh-seal.qh-mine { opacity: .62; filter: drop-shadow(0 0 12px color-mix(in oklab, var(--gold) 55%, transparent)); }
        .qhub .qh-block { width: 100%; border-radius: 12px 12px 0 0; display: grid; place-items: start center; padding-top: 10px; transform-origin: bottom; animation: qhRise .8s cubic-bezier(.2, .9, .2, 1) both; animation-delay: var(--d); }
        .qhub .qh-block b { font: 600 clamp(30px, 8vw, 44px)/1 var(--font-mono); letter-spacing: -.02em; }
        .qhub .qh-p1 .qh-block { height: 128px; background: color-mix(in oklab, var(--gold) 18%, var(--panel)); color: var(--gold); border: 1px solid color-mix(in oklab, var(--gold) 40%, transparent); border-bottom: 0; }
        .qhub .qh-p2 .qh-block { height: 96px; background: color-mix(in oklab, var(--silver) 18%, var(--panel)); color: var(--silver); border: 1px solid color-mix(in oklab, var(--silver) 40%, transparent); border-bottom: 0; }
        .qhub .qh-p3 .qh-block { height: 72px; background: color-mix(in oklab, var(--bronze) 18%, var(--panel)); color: var(--bronze); border: 1px solid color-mix(in oklab, var(--bronze) 40%, transparent); border-bottom: 0; }

        .qhub .qh-dots { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 4px 0 0; }
        .qhub .qh-dots::before { content: ""; position: absolute; left: calc(100% / 14); right: calc(100% / 14); top: 27px; border-top: 1.5px dashed var(--line); }
        .qhub .qh-dot { position: relative; display: grid; justify-items: center; gap: 5px; z-index: 1; animation: qhSlide .5s both; animation-delay: calc(var(--k) * 60ms); }
        .qhub .qh-dot .qh-c { width: clamp(36px, 9.5vw, 46px); height: clamp(36px, 9.5vw, 46px); border-radius: 50%; display: grid; place-items: center; background: var(--ground); border: 1.5px dashed var(--line); }
        .qhub .qh-dot.qh-on .qh-c { border: 1.5px solid var(--line); background: var(--panel); }
        .qhub .qh-dot.qh-you .qh-c { border-color: var(--active); box-shadow: 0 0 0 3px color-mix(in oklab, var(--active) 22%, transparent); }
        .qhub .qh-ord { font: 600 11px var(--font-mono); color: var(--t2); }
        .qhub .qh-dot .qh-n { font: 600 10.5px var(--font-mono); color: var(--t2); }
        .qhub .qh-dot:first-child:not(.qh-on) .qh-c { border-color: color-mix(in oklab, var(--active) 60%, var(--line)); }

        .qhub__go { display: grid; gap: 10px; }
        .qhub__start { height: 56px; border: 0; border-radius: 16px; background: var(--active-fill); color: var(--on-mark, var(--ground)); font: 600 17px var(--font-ui); cursor: pointer; }
        .qhub__start:hover { filter: brightness(1.08); }
        .app.theme-light[data-paper] .qhub__start { background: var(--active-text); }
        .qhub__warm { height: 50px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); color: var(--t1); font: 500 15px var(--font-ui); cursor: pointer; }
        .qhub__warm:hover { border-color: var(--active); }
        .qhub .qh-hit { position: relative; display: grid; place-items: center; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 50%; min-height: 0; }
        .qhub .qh-hit::after { content: ""; position: absolute; left: 50%; top: 50%; width: max(100%, 44px); height: max(100%, 44px); transform: translate(-50%, -50%); }
        .qhub .qh-hit:hover { transform: translateY(-2px); }
        .qhub .qh-eye { position: relative; display: inline-grid; place-items: center; width: 26px; height: 26px; min-height: 0; margin-left: auto; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--t2); cursor: pointer; }
        .qhub .qh-eye::after { content: ""; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
        .qhub .qh-eye:hover { background: var(--raised); color: var(--t1); }
        .qhub .qh-eye[aria-pressed="true"] { color: var(--active-text, var(--active)); }
        .qhub .qh-peek { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: center; padding: 14px 40px 14px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); animation: qhSlide .3s both; }
        .qhub .qh-pbody { display: grid; gap: 10px; min-width: 0; }
        .qhub .qh-pn { font: 600 18px var(--font-ui); color: var(--t1); }
        .qhub .qh-peek .qh-tile { height: 60px; }
        .qhub .qh-prof { width: 100%; height: 42px; border: 1px solid var(--line); border-radius: 14px; background: var(--raised); color: var(--t1); font: 500 15px var(--font-ui); cursor: pointer; }
        .qhub .qh-prof:hover { border-color: var(--active); }
        .qhub .qh-x { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 30px; height: 30px; min-height: 0; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--t3); cursor: pointer; }
        .qhub .qh-x svg { width: 15px; height: 15px; }
        @keyframes qhRise { from { transform: scaleY(0); } to { transform: none; } }
        @keyframes qhDrop { from { opacity: 0; transform: translateY(-26px) scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes qhSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .app.smooth-air .qhub, .app.smooth-air .qhub * { animation: none !important; transition: none !important; }
        @media (prefers-reduced-motion: reduce) { .qhub, .qhub * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  );
}
