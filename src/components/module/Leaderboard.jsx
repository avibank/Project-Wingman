/* =============================================================================
   THE BOARD — R5 and R6, drawn as the pack draws it.
   -----------------------------------------------------------------------------
   The element tree, the class names and the order are `Leaderboard` in
   docs/launch/code/18-exam-markup.jsx, unchanged. Three things are this app's
   rather than the pack's, and each is marked where it is made:

   · THE SCOPE. `.examport` on the wrapper, because the pack's stylesheet is
     scoped there (see the exam pack commit): 128 of its rules are bare class
     names this app already renders elsewhere, and `.board`, `.lb-row` and
     `.mark` are among them.
   · THE STAMP. The pack calls `<Stamp callsign ink shape>`; this app has one
     stamp renderer and it takes a row through `stampOf`, which is the only
     thing allowed to read one (R7 says the same in its own words: "Nothing
     else may draw a stamp").
   · NOTHING IS SORTED HERE. R5 puts the ranking on the server, so the rank,
     the seconds and the size of the board all arrive decided. `--n` and `--i`
     are the two inline styles R1 allows.
   ========================================================================= */
import Stamp from "../Stamp.jsx";
import { stampOf } from "../../lib/stamp.js";
import { mmss, ord } from "../../lib/board.js";

export default function Leaderboard({ title, runs = [], total = 0, boardSize = 0, onShowWho }) {
  /* NOT RENDERED UNTIL THERE IS SOMEBODY ON IT. A board of one, on the first
     sitting of a new quiz, is a ranking of yourself — and §10 forbids naming
     an absence, so it is absent instead. The first person to sit a paper sees
     the result screen they always saw. */
  if (runs.length < 2) return null;

  const you = runs.find((r) => r.isYou) || null;
  const place = you ? you.rank : 0;
  const size = boardSize || runs.length;

  return (
    <div className="examport">
      <section className="board is-in" aria-label="Leaderboard" style={{ "--n": Math.max(0, place - 1) }}>
        <div className="board__head">
          <span className="board__title">{title}</span>
          {you && <span className="board__place">You&rsquo;re <b>{ord(place)}</b> of {size}</span>}
        </div>
        <ol className="lb-list">
          {runs.map((r, i) => (
            <li key={r.id} className={`lb-row${r.isYou ? " is-you" : ""}`} style={{ "--i": i }}
                aria-current={r.isYou ? "true" : undefined}>
              {/* The RANK the server gave it, not this row's place in the array
                  — with a limit on, those are the same number until they are
                  not, and the one that is true is the server's. */}
              <span className="lb-row__rank">{r.rank}</span>
              <button className="lb-row__stamp is-inline" type="button"
                      onClick={() => onShowWho?.(r)}
                      aria-label={`${r.callsign}, ${r.account}`}>
                <Stamp stamp={stampOf(r.profile)} size={30} on={!!r.profile?.stamp_issued_at} />
              </button>
              <span className="lb-row__who">
                <span className="lb-row__acct">[{r.account}]</span>
                <span className="lb-row__call">{r.callsign}</span>
              </span>
              <span className="lb-row__score">{r.score}/{r.total || total}</span>
              <span className="lb-row__time">{mmss(r.seconds)}</span>
            </li>
          ))}
        </ol>
        <div className="board__foot">
          <span>Ranked on score, then time taken.</span>
          {you && <span>Your run: {you.score}/{you.total || total} in {mmss(you.seconds)}</span>}
        </div>
      </section>
    </div>
  );
}
