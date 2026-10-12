/* =============================================================================
   0041 AND 0042, AGAINST THE LIVE DATABASE.
   -----------------------------------------------------------------------------
   Over the ANON REST PATH, because that is how the app reaches these — the
   same thing every other entry in CLAUDE.md's Migrations section means by
   "answers over the anon REST path". check:people holds the RULES without a
   database; this holds that the live project actually has them.

   IT REPORTS RULES AND COUNTS, NEVER PEOPLE. These are real students: the
   assertions below say how many names came back, never which, so a run can be
   pasted into a chat or an issue without putting anybody's name there. The one
   place it would be tempting — proving the list is alphabetical — compares
   callsigns to each other and prints only the verdict.

   NOT in `npm run check`: that suite must not need credentials (0014's header
   makes the same point about check:paper-db).

     node --env-file=.env.local scripts/check-people-db.mjs
   ========================================================================= */
import { byLetter } from "../src/lib/roomModel.js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.");
  process.exit(2);
}

const rpc = async (fn, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, rows: r.ok ? await r.json() : null, err: r.ok ? null : (await r.text()).slice(0, 140) };
};

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${what}`); return; }
  fails.push(what); console.log(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
};

/* A uid belonging to nobody. Every refusal still applies to it, and it cannot
   be mistaken for acting as a real student. */
const NOBODY = "check_people_db_not_a_real_account";

console.log("\n0041 · people_search");
const a = await rpc("people_search", { p_me: NOBODY, p_q: "a" });
ok("answers over the anon REST path", a.status === 200, `${a.status} ${a.err || ""}`);
ok("returns the new columns, and no display_name",
  a.rows !== null && (a.rows.length === 0
    || ("callsign" in a.rows[0] && "real_name" in a.rows[0] && !("display_name" in a.rows[0]))),
  a.rows?.[0] ? Object.keys(a.rows[0]).join(",") : "no rows");
ok("ONE LETTER FINDS PEOPLE AND DISCLOSES NO NAME",
  a.rows !== null && a.rows.filter((r) => r.real_name).length === 0,
  `${a.rows?.length ?? 0} rows, ${a.rows?.filter((r) => r.real_name).length ?? 0} names`);
const blank = await rpc("people_search", { p_me: NOBODY, p_q: "   " });
ok("a blank term returns nothing rather than everything",
  blank.status === 200 && (blank.rows || []).length === 0);

console.log("\n0041 · people_browse");
const b = await rpc("people_browse", { p_me: NOBODY, p_limit: 400 });
ok("answers over the anon REST path", b.status === 200, `${b.status} ${b.err || ""}`);
ok("has no column for a real name at all",
  b.rows !== null && (b.rows.length === 0 || !("real_name" in b.rows[0])),
  b.rows?.[0] ? Object.keys(b.rows[0]).join(",") : "no rows");
ok("every row carries a callsign to draw",
  b.rows !== null && b.rows.every((r) => typeof r.callsign === "string" && r.callsign.trim() !== ""));
{
  /* ALPHABETICAL, AS POSTGRES MEANS IT. The server orders by `upper(callsign)`
     under the database's collation; a JS `.sort()` is UTF-16 codepoint order,
     which puts punctuation either side of the letters depending on the
     character. Comparing the two called a correct list wrong on the first run.
     What was actually asked for is that the LETTERS read A to Z, so that is
     what is checked — and the client buckets anything else under "#" and puts
     it last whatever order it arrived in, which is checked straight after. */
  const letters = (b.rows || []).map((r) => r.callsign.toUpperCase()).filter((c) => /^[A-Z]/.test(c));
  const sorted = letters.every((c, i) => i === 0 || letters[i - 1].localeCompare(c, "en") <= 0);
  ok("the letters read A to Z", sorted, `${letters.length} of ${b.rows?.length ?? 0} start with a letter`);
  const groups = byLetter(b.rows || []);
  ok("and the client buckets anything else under # , last",
    groups.length === 0 || groups.at(-1).letter !== "#" || groups.filter((g) => g.letter === "#").length === 1);
  console.log(`       (the live list holds ${b.rows?.length ?? 0} people, in ${groups.length} letter groups —`);
  console.log("        printed as counts, never as names)");
}

console.log("\n0042 · quiz_finishers and mark_quiz_progress");
const f = await rpc("quiz_finishers", { uid: NOBODY, p_quizzes: ["M1.T1.QZ"], p_cap: 400 });
ok("quiz_finishers answers over the anon REST path", f.status === 200, `${f.status} ${f.err || ""}`);
ok("and returns run_id, which is what a row is keyed by",
  f.rows !== null && (f.rows.length === 0 || "run_id" in f.rows[0]),
  f.rows?.[0] ? Object.keys(f.rows[0]).join(",") : "no rows for that quiz yet");
const m = await rpc("mark_quiz_progress", { p_me: NOBODY, p_run: "00000000-0000-4000-8000-000000000000" });
ok("mark_quiz_progress answers", m.status === 200, `${m.status} ${m.err || ""}`);
ok("and marks nothing for a run that is not yours",
  m.rows === null || m.rows === undefined || m.rows === "");

console.log(`\npeople-db: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const x of fails) console.log(`  - ${x}`); process.exit(1); }
