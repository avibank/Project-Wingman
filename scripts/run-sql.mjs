// Runs SQL against the Supabase database, for the things the publishable key
// cannot do: creating tables, functions and policies.
//
//   npm run sql -- supabase/SETUP.sql          show what it would run
//   npm run sql -- supabase/SETUP.sql --yes    actually run it
//   npm run sql -- --exec "select 1" --yes
//
// Dry by default. It prints the statement count and the first line of each
// statement, and does nothing until --yes. Destructive verbs need --force on
// top of --yes, because a migration paste should never quietly drop a table.
//
// Needs SUPABASE_DB_URL in .env.local — Supabase dashboard, Project Settings ->
// Database -> Connection string. That string contains the database password, so
// it is not named VITE_ and never reaches the browser.

import { readFileSync } from "node:fs";
import pg from "pg";
import { require1 } from "./env.mjs";

const argv = process.argv.slice(2);
const yes = argv.includes("--yes");
const force = argv.includes("--force");
const execAt = argv.indexOf("--exec");
const inlineSql = execAt >= 0 ? argv[execAt + 1] : null;
const file = argv.find((a) => !a.startsWith("--") && a !== inlineSql);

if (!file && !inlineSql) {
  console.error("Usage: npm run sql -- <file.sql> [--yes]\n       npm run sql -- --exec \"<sql>\" [--yes]");
  process.exit(2);
}

const sql = inlineSql ?? readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const label = inlineSql ? "inline statement" : file;

// Rough split, for the preview only. The whole text is sent as one script, so
// dollar-quoted function bodies are never actually cut apart.
const preview = sql
  .split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

const DESTRUCTIVE = /\b(drop\s+(table|schema|database|function|view)|truncate|delete\s+from(?![\s\S]{0,200}?\bwhere\b))/i;
const danger = preview.filter((s) => DESTRUCTIVE.test(s));

console.log(`${label}: ${preview.length} statement(s)\n`);
for (const s of preview.slice(0, 40)) console.log(`  ${s.split("\n")[0].slice(0, 96)}`);
if (preview.length > 40) console.log(`  … and ${preview.length - 40} more`);

if (danger.length) {
  console.log(`\n!! ${danger.length} destructive statement(s):`);
  for (const s of danger) console.log(`   ${s.split("\n")[0].slice(0, 96)}`);
  if (!force) {
    console.log("\nRefusing. Re-run with --force if this is genuinely intended.");
    process.exit(1);
  }
}

if (!yes) {
  console.log("\nDry run. Nothing was sent. Add --yes to run it.");
  process.exit(0);
}

const conn = require1(
  ["SUPABASE_DB_URL", "DATABASE_URL"],
  "Supabase -> Project Settings -> Database -> Connection string.",
  "Put it in .env.local as SUPABASE_DB_URL=postgresql://…  (not VITE_).",
);

const client = new pg.Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },   // Supabase terminates TLS at the pooler
});

try {
  await client.connect();
  const who = await client.query("select current_database() db, current_user usr");
  console.log(`\nconnected: ${who.rows[0].db} as ${who.rows[0].usr}`);
  console.log("running…");
  const res = await client.query(sql);
  const results = Array.isArray(res) ? res : [res];
  for (const r of results) if (r.rows?.length) console.table(r.rows.slice(0, 20));
  console.log(`done: ${results.length} result set(s)`);
} catch (e) {
  console.error(`\nFAILED: ${e.message}`);
  if (e.position) {
    const upto = sql.slice(0, Number(e.position));
    console.error(`  at line ${upto.split("\n").length}: ${upto.split("\n").pop().slice(-80)}`);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
