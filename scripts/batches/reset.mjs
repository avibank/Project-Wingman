/* =============================================================================
   RUN THE MODULE 13d RESET, AND COUNT WHAT IT TOOK.
   -----------------------------------------------------------------------------
   The SQL carries its own proof — a `do $$ ... raise exception` block in the
   same transaction as the deletes — so a reset that did not reset cannot
   commit. This adds the other half: what was there BEFORE, so the line that
   goes into CLAUDE.md is a measurement rather than "it ran".

   Hours flown (`pw-hobbs`) are deliberately not touched, and that is counted
   here too, so the claim can be checked rather than repeated.

     node --env-file=.env.local scripts/batches/reset.mjs <reset.sql>
   ========================================================================= */
import pg from "pg";
import { readFileSync } from "node:fs";

const dbUrl = process.env.SUPABASE_DB_URL;
const file = process.argv[2];
if (!dbUrl || !file) { console.error("needs SUPABASE_DB_URL and a .sql file"); process.exit(2); }

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const one = async (sql) => Number((await c.query(sql)).rows[0].n);
const snap = async () => ({
  "board runs":        await one(`select count(*) n from quiz_runs where quiz_id like 'M1.%' or chapter_id like 'M1.%'`),
  "completions":       await one(`select count(*) n from chapter_completions where chapter_id like 'M1.%'`),
  "saves":             await one(`select count(*) n from saves where ref_id like 'M1.%'`),
  "progress docs w/M1": await one(`select count(*) n from user_progress
     where exists (select 1 from jsonb_object_keys(coalesce(data->'pw-quiz-scores','{}'::jsonb)) k where k='M1' or k like 'M1.%')
        or exists (select 1 from jsonb_object_keys(coalesce(data->'pw-cards-seen','{}'::jsonb)) k where k like 'M1.%')
        or exists (select 1 from jsonb_object_keys(coalesce(data->'pw-cards-got','{}'::jsonb)) k where k like 'M1.%')`),
  "hours flown (kept)": await one(`select count(*) n from user_progress where data ? 'pw-hobbs'`),
});

const before = await snap();
console.log("before:");
for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(22)} ${v}`);

process.stdout.write(`\nrunning ${file.split("/").pop()} ... `);
try {
  await c.query("begin");
  await c.query(readFileSync(file, "utf8"));
  await c.query("commit");
  console.log("committed");
} catch (e) {
  await c.query("rollback").catch(() => {});
  console.log("FAILED - rolled back, nothing changed");
  console.error(`  ${e.message}`);
  await c.end();
  process.exit(1);
}

const after = await snap();
console.log("\nafter:");
for (const [k, v] of Object.entries(after)) {
  const d = before[k] - v;
  console.log(`  ${k.padEnd(22)} ${v}${d ? `   (${d} gone)` : ""}`);
}
if (after["hours flown (kept)"] !== before["hours flown (kept)"]) {
  console.log("\n  !! hours flown changed, and it must not");
  await c.end();
  process.exit(1);
}
await c.end();
