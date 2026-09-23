// The quiz-stamps brief (docs/launch/BRIEF-QUIZ-STAMPS.md, 2026-09-23), held
// to its own four rules. Run: npm run check:quiz-stamps
//
// Stamps reached two more screens that day: the board under a result, and the
// quiz rows in the Library. The four rules are short and every one of them is
// the kind that a tidy-up undoes without noticing:
//
//   1 · a stamp belongs to the PERSON, not to the run;
//   2 · the student's own stamp leads the result at 132px, and the plane is gone;
//   3 · on the board, one stamp per person, on their best run, and every run
//       keeps its row;
//   4 · in the Library, one stamp per person, most recent first, eleven at
//       most, then "+n", then the count in words.
//
// Rule 4's ordering and cap are the SERVER'S (0038), so the last part of this
// file drives the demo's emulation of it — the same code the harness serves —
// with a class of fourteen, a repeat, a block and somebody flying solo.
import { readFileSync } from "node:fs";
import { makeStore, RPC } from "../src/demo/pgcore.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

const lb   = read("../src/components/module/Leaderboard.jsx");
const lib  = read("../src/components/module/LibraryTab.jsx");
const exam = read("../src/components/module/Exam.jsx");
const css  = read("../src/components/module/quiz-stamps.css");
const rs   = read("../src/components/module/result-stamp.css");
const sql  = read("../supabase/migrations/0038_who_has_finished_a_quiz.sql");
const board = read("../src/lib/board.js");
const brief = read("../docs/launch/BRIEF-QUIZ-STAMPS.md");

/* ------------------------------------------ 1 · a stamp belongs to the person */
{
  /* The brief's check is "grep both screens for inspStamp( — every hit must be
     inside stampFor". Here the one way in is <Stamp>, which is the app's
     equivalent and also the cache, so the grep is for the engine itself: a
     screen that reached past it would be drawing a stamp by hand. */
  for (const [name, src] of [["the board", lb], ["the Library", lib], ["the result", exam]])
    ok("person", `${name} draws no stamp of its own`,
       !/stamp-engine/.test(src) && !/inspStamp\(/.test(src) && /<Stamp /.test(src));

  /* stampOf takes the PROFILE — the account's row — never the run's. */
  ok("person", "the board looks a stamp up by account, not by run",
     /stampOf\(r\.profile\)/.test(lb) && !/stampOf\(r\)/.test(lb));
  ok("person", "and so does the Library",
     /stampOf\(p\.profile\)/.test(lib) && !/stampOf\(p\)\b/.test(lib));
  /* The server sends the account's CURRENT stamp with each row, rather than
     whatever it was on the night of the run. */
  ok("person", "the stamp the server sends is the account's current one",
     /-- The stamp columns are the account's CURRENT ones/.test(sql)
     && /left join pilot_profiles pp on pp\.user_id = r\.user_id/.test(sql));
}

/* ------------------------------------------------ 2 · the result leads with it */
{
  ok("result", "the plane glyph is gone from the result",
     !/IconPlane/.test(exam.replace(/\/\*[\s\S]*?\*\//g, "")) && !/M21 16v-2l-8-5V3\.5/.test(exam));
  ok("result", "and the student's own stamp leads it at 132px, rotated -6",
     /<span className="res__stamp"[\s\S]{0,200}<Stamp stamp=\{myStamp\} size=\{132\} rot=\{-6\}/.test(exam));
  ok("result", "which is the student's own, handed down rather than looked up here",
     /myStamp/.test(read("../src/components/module/QuizPage.jsx")) && /myStamp=/.test(read("../src/App.jsx")));
  ok("result", "it sits in the column BESIDE the headline, not above it",
     /\.result__top\.has-stamp \{[\s\S]{0,140}grid-template-columns: auto minmax\(0, 1fr\)/.test(rs)
     && /\.res__stamp \{[\s\S]{0,80}grid-row: 1 \/ -1/.test(rs));
  ok("result", "and the brief's own breakpoint collapses it to one column",
     /@media \(max-width: 620px\)[\s\S]{0,260}grid-template-columns: 1fr/.test(rs));
  ok("result", "no ring, no border and no plate behind it",
     !/\.res__stamp[^{]*\{[^}]*(border|box-shadow|background)/.test(rs));
}

/* ------------------------------------------- 3 · one stamp per person, best run */
{
  ok("board", "the de-duplication is at render, over a Set of accounts",
     /const seen = new Set\(\);/.test(lb) && /const first = !seen\.has\(r\.userId\);/.test(lb) && /seen\.add\(r\.userId\);/.test(lb));
  ok("board", "so a repeat keeps its row, loses its stamp and takes the word again",
     /br__st\$\{first \? "" : " rep"\}/.test(lb) && /\{!first && <span className="br__ag">again<\/span>\}/.test(lb));
  ok("board", "the slot the stamp leaves stays the width of a stamp",
     /\.br\s*\{[^}]*grid-template-columns:\s*28px 42px/.test(css) && /\.br__st\.rep\s*\{\s*opacity:\s*0/.test(css));
  ok("board", "the stamp on a row is 42px", /size=\{42\}/.test(lb));
  /* The board's rows are RUNS and the query must keep them that way — the
     brief says outright: "do not DISTINCT it in SQL, the board needs every
     run". 0038 is a different function for a different question. */
  ok("board", "0038 leaves the board's own query alone",
     !/(create|drop)[\s\S]{0,40}quiz_leaderboard/i.test(sql) && /create or replace function quiz_finishers/.test(sql)
     && !/\bdistinct\b/i.test(sql));
  ok("board", "and nothing about the order is decided here",
     !/\.sort\(/.test(lb) && !/Date\.parse/.test(lb));
}

/* ------------------------------------------------ 4 · the Library's finisher line */
{
  ok("library", "eleven is declared once, at the top", (lib.match(/STAMP_CAP = 11/g) || []).length === 1);
  ok("library", "a stamp on the line is 36px", /LIB_STAMP_PX = 36/.test(lib) && /size=\{LIB_STAMP_PX\}/.test(lib));
  ok("library", "the remainder is +n, and the count is in words",
     /<span className="fin__more">\+\{over\}<\/span>/.test(lib) && /<span className="fin__n">\{found\.total\} finished<\/span>/.test(lib));
  ok("library", "+n is the whole count less what is shown, never the page's length",
     /Math\.max\(0, \(found\.total \|\| people\.length\) - people\.length\)/.test(lib));
  /* §10 — the brief's "Nobody has taken this one yet" is an absence named. */
  ok("library", "an untouched quiz names its next action instead of its emptiness",
     /Be the first to take it/.test(lib) && !/Nobody has taken this one yet/.test(lib));
  ok("library", "and it is a sentence, never an empty strip",
     /if \(!people\.length\) \{[\s\S]{0,160}className="fin__n">Be the first/.test(lib));
  ok("library", "the line asks the server once for every quiz on the page",
     /fetchFinishers\(\{ me, quizIds: quizIds\.split\(","\), cap: STAMP_CAP \}\)/.test(lib)
     && /supabase\.rpc\("quiz_finishers", \{\s*uid: me, p_quizzes: ids, p_cap: cap,\s*\}\)/.test(board));
}

/* --------------------------------------------- the sheet is the pack's, scoped */
{
  ok("sheet", "quiz-stamps.css is generated from the pack, not written here",
     /GENERATED/.test(css) && /19-quiz-stamps\.css/.test(css) && /npm run ref:css/.test(css));
  /* The pack's own comment NAMES the demo bar ("do not port it"), and the
     comment is carried over with everything else — so the rules are what is
     asserted, with the comments taken out first. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  ok("sheet", "the demo's own chrome did not come with it",
     !/\.dbar/.test(rules) && !/\.qs-page/.test(rules));
  ok("sheet", "the board wears no card and no shadow",
     !/box-shadow/.test(rules) && !/\.brows[^}]*border-radius/.test(rules));
  ok("sheet", "and both screens are inside its scope",
     /<div className="qstamps">/.test(lb) && /className="papers qstamps"/.test(lib));
}

/* ------------------------------------- the server's half of rule 4, driven live */
{
  /* Fourteen people on one quiz, one of whom is me and finished FIRST of all —
     so recency alone would have dropped me off the end of a cap of eleven. */
  const s = makeStore();
  const day = (n) => `2026-09-${String(n).padStart(2, "0")}T10:00:00Z`;
  const people = ["me", ...Array.from({ length: 13 }, (_, i) => `u${i + 1}`)];
  s.pilot_profiles = people.map((u, i) => ({ user_id: u, callsign: `P${i}`, code: "AAA" }));
  s.quiz_runs = [
    { id: "r0", quiz_id: "Q1", user_id: "me", submitted_at: day(1) },
    ...people.slice(1).map((u, i) => ({ id: `r${i + 1}`, quiz_id: "Q1", user_id: u, submitted_at: day(2 + i) })),
    /* the same person again, later: one person, not two */
    { id: "again", quiz_id: "Q1", user_id: "u1", submitted_at: day(20) },
    /* another quiz entirely, to prove one call answers for several */
    { id: "other", quiz_id: "Q2", user_id: "u2", submitted_at: day(3) },
  ];
  const rows = RPC.quiz_finishers(s, { uid: "me", p_quizzes: ["Q1", "Q2"], p_cap: 11 });
  const q1 = rows.filter((r) => r.quiz_id === "Q1");
  ok("server", "fourteen finishers show eleven stamps and a count of fourteen",
     q1.length === 11 && q1.every((r) => r.finishers === 14), `${q1.length} rows, ${q1[0]?.finishers} counted`);
  ok("server", "so the row says +3", (q1[0]?.finishers ?? 0) - q1.length === 3);
  ok("server", "somebody who sat it twice is one stamp, at their later finish",
     q1.filter((r) => r.user_id === "u1").length === 1
     && q1.find((r) => r.user_id === "u1")?.finished_at === day(20));
  ok("server", "yours is pinned first, where a cap on recency would have dropped it",
     q1[0]?.user_id === "me" && q1[0]?.is_you === true);
  ok("server", "and the rest are most recent first",
     q1.slice(1).every((r, i, a) => i === 0 || String(a[i - 1].finished_at) >= String(r.finished_at)));
  ok("server", "one call answers for every quiz on the page",
     rows.some((r) => r.quiz_id === "Q2") && rows.filter((r) => r.quiz_id === "Q2").length === 1);

  /* Fly solo and blocks, which 0034's board has and this must have too. */
  const t = makeStore();
  t.pilot_profiles = [
    { user_id: "me", callsign: "Me" },
    { user_id: "solo", callsign: "Solo", invisible: true },
    { user_id: "blocked", callsign: "Blocked" },
    { user_id: "blocker", callsign: "Blocker" },
    { user_id: "seen", callsign: "Seen" },
  ];
  t.blocks = [{ user_id: "me", blocked_id: "blocked" }, { user_id: "blocker", blocked_id: "me" }];
  t.quiz_runs = ["me", "solo", "blocked", "blocker", "seen"]
    .map((u, i) => ({ id: `x${i}`, quiz_id: "Q1", user_id: u, submitted_at: day(i + 1) }));
  const v = RPC.quiz_finishers(t, { uid: "me", p_quizzes: ["Q1"], p_cap: 11 }).map((r) => r.user_id);
  ok("server", "somebody flying solo is on nobody else's line", !v.includes("solo"));
  ok("server", "a block cuts both ways", !v.includes("blocked") && !v.includes("blocker"));
  ok("server", "you are always on your own, and a stranger still shows",
     v.includes("me") && v.includes("seen") && v.length === 2);

  /* A student who is flying solo still sees their own line, and their own
     count is of the people they can see — not a number they cannot square. */
  const alone = RPC.quiz_finishers(t, { uid: "solo", p_quizzes: ["Q1"], p_cap: 11 });
  ok("server", "and somebody flying solo is still on their own line",
     alone.some((r) => r.user_id === "solo" && r.is_you) && alone[0].finishers === alone.length);

  /* The emulation above is the demo's; the SQL is what the site runs. They are
     two statements of one rule, so the pieces that could drift are compared. */
  ok("server", "the SQL pins yours first the same way",
     /order by \(pe\.user_id = uid\) desc, pe\.finished_at desc/.test(sql));
  ok("server", "counts the whole quiz, not the capped page",
     /count\(\*\) over \(partition by pe\.quiz_id\)\s+as finishers/.test(sql));
  ok("server", "groups runs into people before it ranks them",
     /max\(v\.submitted_at\) as finished_at/.test(sql) && /group by v\.quiz_id, v\.user_id/.test(sql));
  ok("server", "and caps at eleven", /least\(coalesce\(p_cap, 11\), 24\)/.test(sql) && /p_cap integer default 11/.test(sql));
}

/* The brief's two open questions were answered by the owner, and the answers
   are decisions rather than defaults — so they are written where the code is. */
ok("answers", "a person with no stamp yet draws the un-inked outline",
   /on=\{!!r\.profile\?\.stamp_issued_at\}/.test(lb) && /on=\{!!p\.profile\?\.stamp_issued_at\}/.test(lib)
   && /open question 1/.test(lb) && /open question 1/.test(lib));
ok("answers", "and yours is pinned first in the Library line, in the SQL",
   /open question 2/.test(lib) && /YOURS FIRST \(owner, 2026-09-23, on the brief's open question 2\)/.test(sql));
ok("answers", "the brief itself is in the repo, beside the pack it came with",
   /Rule 4 — in the Library, up to eleven finishers/.test(brief));

console.log(`\nquiz-stamps: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
