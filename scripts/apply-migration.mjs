/* =============================================================================
   APPLY A MIGRATION TO THE LIVE PROJECT, AND VERIFY IT BY CONNECTING.
   -----------------------------------------------------------------------------
   Every entry in CLAUDE.md's Migrations section says it was "verified by
   connecting rather than inferred". This is that, done the same way the live
   checks already connect (`pg`, `rejectUnauthorized: false`, SUPABASE_DB_URL
   out of .env.local) rather than by a second mechanism.

   EACH FILE RUNS INSIDE ONE TRANSACTION, so a migration that fails part way
   leaves nothing behind — DDL is transactional in Postgres, which is the whole
   reason this is safe to run by hand.

   It prints the shape of the functions it touches before and after, so the
   "verified afterwards" line in CLAUDE.md can be written from what it shows
   instead of from what the file was supposed to do.

     node --env-file=.env.local scripts/apply-migration.mjs \
       supabase/migrations/0041_search_finds_anybody.sql \
       supabase/migrations/0042_a_paper_you_started.sql
   ========================================================================= */
import pg from "pg";
import { readFileSync } from "node:fs";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Needs SUPABASE_DB_URL in .env.local.");
  process.exit(2);
}
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Name at least one .sql file.");
  process.exit(2);
}

/* The functions and columns these two migrations are about. Extend the list
   when a later migration touches something else; it only decides what gets
   printed, never what gets run. */
const WATCH_FNS = ["people_search", "people_browse", "quiz_finishers", "mark_quiz_progress"];
const WATCH_COLS = [["quiz_runs", "answered_at"]];

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const shape = async () => {
  const fns = (await c.query(
    `select proname, pg_get_function_result(oid) as returns
       from pg_proc where proname = any($1) and pronamespace = 'public'::regnamespace
      order by proname`, [WATCH_FNS])).rows;
  const lines = fns.map((r) => `  ${r.proname.padEnd(20)} ${r.returns.replace(/\s+/g, " ").slice(0, 88)}`);
  for (const [t, col] of WATCH_COLS) {
    const n = (await c.query(
      `select 1 from information_schema.columns where table_name = $1 and column_name = $2`,
      [t, col])).rows.length;
    lines.push(`  ${`${t}.${col}`.padEnd(20)} ${n ? "present" : "absent"}`);
  }
  const missing = WATCH_FNS.filter((n) => !fns.some((r) => r.proname === n));
  if (missing.length) lines.push(`  (not defined: ${missing.join(", ")})`);
  return lines.join("\n");
};

console.log("=== before ===\n" + await shape());

for (const f of files) {
  process.stdout.write(`\napplying ${f.split("/").pop()} ... `);
  try {
    await c.query("begin");
    await c.query(readFileSync(f, "utf8"));
    await c.query("commit");
    console.log("committed");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.log("FAILED — rolled back, nothing changed");
    console.error(`  ${e.message}`);
    await c.end();
    process.exit(1);
  }
}

console.log("\n=== after ===\n" + await shape());
await c.end();
