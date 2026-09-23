/* Quiz stamps — the post-quiz leaderboard and the Library quiz rows.
   Reference build: reference/03-quiz-stamps.html (artifact "Quiz Stamps").

   Depends on code/05-stamp-engine.js for inspStamp(). Nothing here draws a stamp
   by hand; every stamp on both screens comes through stampFor().

   Shapes this expects from the app:
     account  { id, name, stamp }            stamp = the record the licence editor issues
     attempt  { accountId, callsign, score, seconds, finishedAt }   one row per run
   Rename to match the real models, but keep ONE attempt row per run — the
   de-duplication happens at render time, never in the query. */

const STAMP_CAP = 11;          // how many finisher stamps a Library row shows
const BOARD_STAMP_PX = 42;     // leaderboard row
const LIB_STAMP_PX = 36;       // Library finisher line
const RESULT_STAMP_PX = 132;   // the result header — the stamp leads, level with the headline

/* The stamp belongs to the ACCOUNT, not the run. Always look it up by account. */
function stampFor(account, size, rot = 0) {
  if (!account || !account.stamp) return '';
  return inspStamp(true, size, rot, { ...account.stamp, ring: '', rim: true });
}

/* A small deterministic tilt so a row of stamps doesn't look printed by machine.
   Index-based, not random — the same stamp must not move between renders. */
const tilt = i => (i % 3 - 1) * 4;

/* ---------------------------------------------------------------------------
   1 · The result card
   The plane glyph is gone. The person's own stamp sits where it was.
   --------------------------------------------------------------------------- */
function resultIcon(me) {
  return `<span class="res__stamp" aria-label="Your stamp">${stampFor(me, RESULT_STAMP_PX, -6)}</span>`;
}

/* ---------------------------------------------------------------------------
   2 · The leaderboard
   Every run keeps its row. The stamp is drawn only on an account's FIRST row —
   which, because the board is sorted, is that account's best run. Later runs by
   the same person keep an empty slot and take the word "again".
   --------------------------------------------------------------------------- */
function boardRows(attempts, accounts, totalQ, myAttemptId) {
  const sorted = [...attempts].sort((a, b) => b.score - a.score || a.seconds - b.seconds);
  const seen = new Set();
  return sorted.map((run, i) => {
    const acct = accounts[run.accountId];
    const first = !seen.has(run.accountId);
    seen.add(run.accountId);
    const you = run.id === myAttemptId;
    return `<li class="br${you ? ' you' : ''}" style="--i:${i}"${you ? ' aria-current="true"' : ''}>
      <span class="br__n">${i + 1}</span>
      <span class="br__st${first ? '' : ' rep'}" aria-hidden="${first ? 'false' : 'true'}">${first ? stampFor(acct, BOARD_STAMP_PX, tilt(i)) : ''}</span>
      <span class="br__who"><span class="br__ac">[${acct.name}]</span><span class="br__cs">${run.callsign}</span>${first ? '' : '<span class="br__ag">again</span>'}</span>
      <span class="br__sc">${run.score}/${totalQ}</span>
      <span class="br__tm">${mmss(run.seconds)}</span>
    </li>`;
  }).join('');
}
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/* ---------------------------------------------------------------------------
   3 · The Library quiz row
   One stamp per person who has finished, most recent finish first, STAMP_CAP at
   most, the remainder as "+n". An untouched quiz says so in words — never an
   empty strip.
   --------------------------------------------------------------------------- */
function finishers(attempts, accounts) {
  /* newest first, then one entry per account */
  const order = [...attempts].sort((a, b) => b.finishedAt - a.finishedAt);
  const seen = new Set(), people = [];
  for (const a of order) {
    if (seen.has(a.accountId)) continue;
    seen.add(a.accountId);
    people.push(accounts[a.accountId]);
  }
  return people;
}

function finisherLine(attempts, accounts) {
  const people = finishers(attempts, accounts);
  if (!people.length) return '<span class="fin"><span class="fin__n">Nobody has taken this one yet</span></span>';
  const shown = people.slice(0, STAMP_CAP), over = people.length - shown.length;
  return `<span class="fin">
    <span class="fin__set">${shown.map((p, i) => `<span title="${p.name}">${stampFor(p, LIB_STAMP_PX, tilt(i) + (i % 2 ? 1 : -1))}</span>`).join('')}</span>
    ${over > 0 ? `<span class="fin__more">+${over}</span>` : ''}
    <span class="fin__n">${people.length} finished</span>
  </span>`;
}

/* The row itself — the existing Library row plus the finisher line as a second
   grid line under the title. The row stays one button. */
function quizRow(quiz, attempts, accounts, myScore) {
  return `<button class="lrow" type="button" data-quiz="${quiz.id}">
    <span class="th">${quizThumb(quiz)}</span>
    <span><span class="lt">Chapter ${quiz.chapter} quiz</span><span class="ls">${quiz.questions} questions</span></span>
    <span class="rt">${myScore != null
      ? `<span class="sc">${myScore} of ${quiz.questions}</span><span class="act-o">Re-check</span>`
      : '<span class="act-o">Take it</span>'}</span>
    ${finisherLine(attempts, accounts)}
  </button>`;
}
