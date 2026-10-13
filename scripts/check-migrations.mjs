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

/* --------------------------------------------------- functions that are widened */
/* `create or replace function` CANNOT CHANGE A RETURN TYPE. That is the second
   way this series stopped being replayable, and it is invisible in any one
   file: 0011 defines people_search returning four columns, 0041 and 0043 widen
   it to sixteen, and replaying 0011 against a database holding the final shape
   fails with 42P13. Seven definitions across the series were in that state.

   So the rule is per OVERLOAD — name plus argument types, since a different
   argument list is a different function and not affected — and it compares
   each definition's return shape against the LAST definition of that overload,
   which is what a replayed database is holding. Trigger functions return
   `trigger` everywhere, so they never differ and are never asked to be dropped
   (they could not be, without cascading through the trigger that uses them). */
const ALIAS = {
  int: "integer", int4: "integer", int8: "bigint", int2: "smallint",
  bool: "boolean", float4: "real", float8: "double precision",
  timestamptz: "timestamp with time zone", varchar: "character varying",
  decimal: "numeric",
};
const nt = (s) => {
  const k = s.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIAS[k] || k;
};
const stripSql = (s) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const splitTop = (s) => {
  const out = []; let dep = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") dep += 1;
    else if (ch === ")") dep -= 1;
    if (ch === "," && dep === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};
const typeOf = (prm) => {
  const p = prm.replace(/\s+default\s+[\s\S]*$/i, "").replace(/^(in|out|inout|variadic)\s+/i, "").trim();
  const toks = p.split(/\s+/);
  return nt(toks.length > 1 ? toks.slice(1).join(" ") : p);
};
const shapeOf = (ret) => {
  const r = stripSql(ret).trim();
  const m = r.match(/^table\s*\(([\s\S]*)\)$/i);
  if (!m) return nt(r);
  return `table(${splitTop(m[1]).map((c) => {
    const toks = c.split(/\s+/);
    return nt(toks.length > 1 ? toks.slice(1).join(" ") : c);
  }).join(",")})`;
};

const overloads = new Map();
for (const f of numbered) {
  const txt = readFileSync(`${dir}/${f}`, "utf8");
  const re = /^[ \t]*create (or replace )?function\s+([\w.]+)\s*\(/gm;
  let m;
  while ((m = re.exec(txt))) {
    const name = m[2].split(".").pop();
    let i = txt.indexOf("(", m.index + m[0].length - 1), dep = 0, j = i;
    for (; j < txt.length; j += 1) {
      if (txt[j] === "(") dep += 1;
      else if (txt[j] === ")") { dep -= 1; if (dep === 0) break; }
    }
    const types = splitTop(stripSql(txt.slice(i + 1, j))).map(typeOf);
    const tail = txt.slice(j + 1, j + 4000);
    const rm = tail.match(
      /\breturns\s+(table\s*\([\s\S]*?\)|setof\s+[\w.[\]]+|[\w.[\]]+)\s*(?:language|as\b|stable|immutable|volatile|security|set\s)/i);
    const key = `${name}(${types.join(",")})`;
    const dropped = new RegExp(`drop function if exists\\s+${name}\\b`, "i")
      .test(txt.slice(0, m.index));
    if (!overloads.has(key)) overloads.set(key, []);
    overloads.get(key).push({
      f, line: txt.slice(0, m.index).split("\n").length,
      shape: rm ? shapeOf(rm[1]) : "?", dropped,
    });
  }
}

const widened = [];
let multi = 0;
for (const [key, rows] of overloads) {
  if (rows.length < 2) continue;
  multi += 1;
  const final = rows.at(-1).shape;
  for (const r of rows.slice(0, -1)) {
    if (r.shape !== final && !r.dropped) widened.push(`${r.f}:${r.line} ${key}`);
  }
}

console.log("\na function the series widens is dropped before it is redefined");
ok(`${overloads.size} overloads, ${multi} of them defined more than once`, overloads.size > 0);
ok("no definition would hit 42P13 on a replay",
  widened.length === 0, widened.join("; "));

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
