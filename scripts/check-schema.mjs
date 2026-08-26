// Checks column references in src/ against the DDL in supabase/migrations/.
//
// PostgREST answers an unknown column with a 400 at runtime, not at build time,
// so a typo in a .select() or .eq() is invisible until someone hits that screen.
// This is the offline half of the backend check: check:backend needs credentials
// and tells you what the live project has; this one needs none and tells you
// whether the code and the migrations agree.
//
// Deliberately conservative — it would rather say nothing than cry wolf:
//   * views are skipped (resolving their columns needs a real SQL parser)
//   * embedded resource selects, `table(col)`, are skipped
//   * only plain identifiers are checked
// So a clean run means "found no disagreement", not "proved there is none".
//
// Run: npm run check:schema

import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const migDir = new URL("supabase/migrations/", ROOT);

const cols = new Map();
const views = new Set();
for (const f of readdirSync(migDir).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort()) {
  const s = readFileSync(new URL(f, migDir), "utf8");
  for (const m of s.matchAll(/create table if not exists\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    const set = cols.get(m[1]) ?? cols.set(m[1], new Set()).get(m[1]);
    for (const raw of m[2].split("\n")) {
      const line = raw.trim().replace(/,$/, "");
      if (!line || line.startsWith("--")) continue;
      const first = line.split(/\s+/)[0];
      if (["primary", "foreign", "unique", "check", "constraint"].includes(first.toLowerCase())) continue;
      set.add(first);
    }
  }
  for (const m of s.matchAll(/alter table\s+(?:public\.)?(\w+)\s+add column if not exists\s+(\w+)/gi))
    (cols.get(m[1]) ?? cols.set(m[1], new Set()).get(m[1])).add(m[2]);
  for (const m of s.matchAll(/create (?:or replace )?view\s+(?:public\.)?(\w+)/gi)) views.add(m[1]);
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const FILTERS = "eq|neq|gt|gte|lt|lte|order|is|in|like|ilike";
let checked = 0;
const bad = [];
for (const f of walk(new URL("src/", ROOT))) {
  const s = readFileSync(f, "utf8");
  const short = f.pathname.split("/src/")[1];
  for (const m of s.matchAll(/\.from\(\s*["'](\w+)["']\s*\)((?:\s*\.\w+\([^;]*?\))*)/g)) {
    const [, table, chain] = m;
    if (views.has(table) || !cols.has(table)) continue;
    const known = cols.get(table);
    const flag = (op, col) => { checked++; if (!known.has(col)) bad.push({ short, table, op, col }); };
    for (const c of chain.matchAll(new RegExp(`\\.(${FILTERS})\\(\\s*["']([\\w.]+)["']`, "g")))
      flag(c[1], c[2].split(".")[0]);
    for (const sel of chain.matchAll(/\.select\(\s*["']([^"']+)["']/g)) {
      if (sel[1].includes("(")) continue;
      for (let col of sel[1].split(",")) {
        col = col.trim().split(":").pop().trim();
        if (col && col !== "*" && /^\w+$/.test(col)) flag("select", col);
      }
    }
  }
}

console.log(`schema: ${checked} column references checked against ${cols.size} tables` +
  (views.size ? ` (views skipped: ${[...views].sort().join(", ")})` : ""));
if (!bad.length) { console.log("MATCH"); process.exit(0); }
for (const b of bad) console.log(`  ${b.short}: ${b.table}.${b.col} via .${b.op}() is not a column of ${b.table}`);
console.log(`${bad.length} mismatch(es)`);
process.exit(1);
