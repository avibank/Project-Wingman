/* =============================================================================
   THE BOARD — the quiz-stamps pack (2026-09-23), which supersedes the exam
   pack's board.
   -----------------------------------------------------------------------------
   The element tree, the class names and the order are `boardRows` in
   docs/launch/code/18-quiz-stamps.js; the sheet is 19-quiz-stamps.css, scoped
   to `.qstamps` by `npm run ref:css`. Rows on hairlines, no card, no shadow.

   RULE 3 — ONE STAMP PER PERSON, ON THEIR BEST RUN. Every run keeps its row,
   its rank, its score and its time. The stamp is drawn only on an account's
   FIRST row in board order — and because the board arrives sorted on score
   then time, that row is that person's best run. Later rows by the same
   person keep an empty slot and take the word "again" after the callsign.
   Twelve runs from nine people otherwise read as twelve people.

   THE DE-DUPLICATION IS HERE, AT RENDER, and the query still returns one row
   per run (the brief says so outright, and 0034's board is untouched).

   Three things are this app's rather than the pack's:

   · NOTHING IS SORTED HERE. R5 of the exam brief puts the ranking on the
     server, so the rank, the seconds and the size of the board all arrive
     decided. The pack's own `boardRows` sorts because its page has no server.
   · THE STAMP is the app's one renderer, through `stampOf` — the pack calls
     `stampFor(account)`, which is the same rule in its own words: a stamp
     belongs to the person, never to the run.
   · A PERSON WITH NO STAMP YET gets the un-inked outline (owner, 2026-09-23,
     on the brief's open question 1), which is the same "not yet" mark the
     licence draws before you make one — not a blank, and not a plane.
   ========================================================================= */
import Stamp from "../Stamp.jsx";
import { stampOf } from "../../lib/stamp.js";
import { mmss, ord } from "../../lib/board.js";
import "./quiz-stamps.css";

/* A small deterministic tilt, so a column of stamps is not machine-printed.
   Index-based, never random: the same stamp must not move between renders. */
export const tilt = (i) => (i % 3 - 1) * 4;

export default function Leaderboard({ title, runs = [], total = 0, boardSize = 0 }) {
  /* NOT RENDERED UNTIL THERE IS SOMEBODY ON IT. A board of one, on the first
     sitting of a new quiz, is a ranking of yourself — and §10 forbids naming
     an absence, so it is absent instead. The first person to sit a paper sees
     the result screen they always saw. */
  if (runs.length < 2) return null;

  const you = runs.find((r) => r.isYou) || null;
  const place = you ? you.rank : 0;
  const size = boardSize || runs.length;
  const seen = new Set();

  return (
    <div className="qstamps">
      <section aria-label="Leaderboard">
        <div className="bhead">
          <h2>{title}</h2>
          {you && <span>You&rsquo;re <b>{ord(place)}</b> of {size}</span>}
        </div>
        <ol className="brows">
          {runs.map((r, i) => {
            const first = !seen.has(r.userId);
            seen.add(r.userId);
            return (
              <li key={r.id} className={`br${r.isYou ? " you" : ""}`} style={{ "--i": i }}
                  aria-current={r.isYou ? "true" : undefined}>
                {/* The RANK the server gave it, not this row's place in the
                    array — with a limit on, those are the same number until
                    they are not, and the one that is true is the server's. */}
                <span className="br__n">{r.rank}</span>
                <span className={`br__st${first ? "" : " rep"}`} aria-hidden={first ? undefined : "true"}>
                  {first && <Stamp stamp={stampOf(r.profile)} size={42} rot={tilt(i)}
                                   on={!!r.profile?.stamp_issued_at}
                                   label={`${r.callsign}, ${r.account}`} />}
                </span>
                <span className="br__who">
                  <span className="br__ac">[{r.account}]</span>
                  <span className="br__cs">{r.callsign}</span>
                  {!first && <span className="br__ag">again</span>}
                </span>
                <span className="br__sc">{r.score}/{r.total || total}</span>
                <span className="br__tm">{mmss(r.seconds)}</span>
              </li>
            );
          })}
        </ol>
        <div className="bfoot">
          <span>Ranked on score, then time taken.</span>
          {you && <span>Your run: {you.score}/{you.total || total} in {mmss(you.seconds)}</span>}
        </div>
      </section>
    </div>
  );
}
