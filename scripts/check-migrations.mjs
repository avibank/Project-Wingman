/* =============================================================================
   THE SERIES CAN BE RUN TWICE, AND THE BUNDLE IS NOT A MIGRATION.
   -----------------------------------------------------------------------------
   Supabase's preview CI applies every file in supabase/migrations/ to a branch
   database. Two things about that have already broken it, four days apart, and
   neither was visible from reading the files:

   1 · supabase/ALL.sql LIVED IN THAT DIRECTORY. It is a concatenation of the
       series, so the tooling applied it as a migration — and, having no
       `NNNN_` prefix, applied it FIRST. Every object was created twice and the
       branch died on the first unguarded statement it reached. Moved out on
       2026-10-12; this check is what stops it coming back.

   2 · AND THE POLICIES WERE NOT RE-RUNNABLE. Eight `create policy` statements
       across 0008, 0009 and 0010 had no guard, while all three files' headers
       said "safe to re-run". Once a run had died past 0009's policies, the
       branch kept those policies and never recorded 0009 as applied, so every
       later run stopped on

         ERROR: policy "lesson_notes_no_bulk_read" ... already exists

       forever, with nothing in the files to say why. Fixed 2026-10-13.

   SO THE RULE IS: every DDL statement in the series is re-runnable, in one of
   the three idioms this repo already uses — `drop … if exists` first, a
   do-block that swallows duplicate_object, or an `if not exists (… pg_policies
   …)` test. Which one is a judgement per site; HAVING one is not.

   It reads the SQL rather than a database, so it needs no credentials and
   belongs in `npm run check`, unlike check:backend and the other live ones.
   ========================================================================= */

import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = "supabase/migrations";
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${what}`); return; }
  fails.push(what); console.log(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
};

const all = readdirSync(dir).sort();
const numbered = all.filter((f) => /^\d{4}_.*\.sql$/.test(f));

console.log("\nthe directory holds migrations and nothing else");
ok("every .sql in supabase/migrations/ carries an NNNN_ prefix",
  all.filter((f) => f.endsWith(".sql")).every((f) => /^\d{4}_/.test(f)),
  all.filter((f) => f.endsWith(".sql") && !/^\d{4}_/.test(f)).join(", "));
ok("and the bundles sit beside it, not in it",
  !all.some((f) => /^(ALL|SETUP)\.sql$/i.test(f))
  && existsSync("supabase/ALL.sql") && existsSync("supabase/SETUP.sql"));
ok("the series has no gaps or duplicate numbers",
  new Set(numbered.map((f) => f.slice(0, 4))).size === numbered.length);

/* ------------------------------------------------------------------ re-runs */
/* One entry per kind: how to spot the statement, and what a `drop` for it is
   called. `create or replace` is already re-runnable and never reaches here. */
const KINDS = [
  ["policy",   /^\s*create policy\s+"?([\w]+)"?\s+on\s+([\w.]+)/i,              "policy"],
  ["table",    /^\s*create table\s+(?!if not exists)"?([\w.]+)"?/i,             "table"],
  ["index",    /^\s*create (?:unique )?index\s+(?!if not exists|concurrently)"?([\w.]+)"?/i, "index"],
  ["trigger",  /^\s*create trigger\s+"?([\w]+)"?/i,                             "trigger"],
  ["type",     /^\s*create type\s+"?([\w.]+)"?/i,                               "type"],
  ["function", /^\s*create function\s+"?([\w.]+)"?/i,                           "function"],
  ["view",     /^\s*create view\s+"?([\w.]+)"?/i,                               "view"],
];

const unguarded = [];
const counted = Object.fromEntries(KINDS.map(([k]) => [k, 0]));

for (const f of numbered) {
  const lines = readFileSync(`${dir}/${f}`, "utf8").split("\n");
  lines.forEach((ln, i) => {
    for (const [kind, re, dropWord] of KINDS) {
      const m = ln.match(re);
      if (!m) continue;
      counted[kind] += 1;
      const name = m[1];
      const before = lines.slice(0, i).join("\n");
      const after = lines.slice(i, i + 8).join("\n");
      const dropped = new RegExp(`drop ${dropWord} if exists\\s+"?${name}"?`, "i").test(before);
      const swallows = /duplicate_object|duplicate_table|duplicate_function/i.test(after);
      const tested = new RegExp(`if not exists\\s*\\([\\s\\S]{0,240}${name}`, "i")
        .test(before.slice(-700));
      if (!(dropped || swallows || tested)) unguarded.push(`${f}:${i + 1} ${kind} ${name}`);
      break;
    }
  });
}

console.log("\nevery DDL statement in the series is re-runnable");
for (const [kind] of KINDS) {
  if (!counted[kind]) continue;
  const bad = unguarded.filter((u) => u.includes(` ${kind} `));
  const plural = kind === "policy" ? "policies" : `${kind}s`;
  ok(`${String(counted[kind]).padStart(2)} ${counted[kind] === 1 ? kind : plural}, all guarded`,
    bad.length === 0, bad.join("; "));
}
ok("nothing in the series would fail on a second run",
  unguarded.length === 0, `${unguarded.length} unguarded`);

/* ------------------------------------------------------------------- bundle */
/* THE BUNDLES GO STALE SILENTLY, AND BOTH HAVE. ALL.sql sat at 0013 while the
   series had reached 0042, and it was still missing 0043 when this check was
   written. So rather than describing what they should contain, this RUNS the
   two generators into a temp file and compares — a second copy of their header
   here would be a second thing to drift. */
console.log("\nthe bundles beside the series are up to date");
const tmp = mkdtempSync(join(tmpdir(), "wm-sql-"));
for (const [gen, file] of [
  ["scripts/build-migration-bundle.mjs", "supabase/ALL.sql"],
  ["scripts/build-setup-sql.mjs", "supabase/SETUP.sql"],
]) {
  const out = join(tmp, file.split("/").pop());
  let ran = true;
  try {
    execFileSync(process.execPath, [gen, out], { stdio: "ignore" });
  } catch { ran = false; }
  const fresh = ran && existsSync(out) ? readFileSync(out, "utf8") : null;
  const have = existsSync(file) ? readFileSync(file, "utf8") : null;
  ok(`${file} is what ${gen.replace("scripts/", "")} would write`,
    fresh !== null && fresh === have,
    fresh === null ? "the generator did not run"
      : `stale — run \`npm run build:sql\``);
}
rmSync(tmp, { recursive: true, force: true });

console.log(`\nmigrations: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const x of fails) console.log(`  - ${x}`); process.exit(1); }
