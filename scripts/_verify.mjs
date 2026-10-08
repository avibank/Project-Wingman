import { readFileSync } from "node:fs";
import pg from "pg";
for (const line of readFileSync("/Users/hassa/Documents/Project Wingman/.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const one = async (label, sql) => {
  const r = await c.query(sql);
  console.log(`  ${String(r.rows[0].n).padStart(4)}  ${label}`);
};
console.log("anything still pointing at an M1 question, card or paper:");
await one("progress docs with an M1 quiz score", "select count(*)::int n from user_progress where exists (select 1 from jsonb_object_keys(coalesce(data->'pw-quiz-scores','{}'::jsonb)) k where k='M1' or k like 'M1.%')");
await one("…an M1 quiz run", "select count(*)::int n from user_progress where exists (select 1 from jsonb_object_keys(coalesce(data->'pw-quiz-run','{}'::jsonb)) k where k='M1' or k like 'M1.%')");
await one("…an M1 card seen", "select count(*)::int n from user_progress where exists (select 1 from jsonb_object_keys(coalesce(data->'pw-cards-seen','{}'::jsonb)) k where k like 'M1.%')");
await one("…an M1 card got", "select count(*)::int n from user_progress where exists (select 1 from jsonb_object_keys(coalesce(data->'pw-cards-got','{}'::jsonb)) k where k like 'M1.%')");
await one("board runs", "select count(*)::int n from quiz_runs where quiz_id like 'M1.%' or chapter_id like 'M1.%'");
await one("sign-offs", "select count(*)::int n from chapter_completions where chapter_id like 'M1.%'");
await one("saves", "select count(*)::int n from saves where ref_id like 'M1.%'");
console.log("\nwhat deliberately stays:");
await one("progress docs with hours flown on M1", "select count(*)::int n from user_progress where coalesce(data->'pw-hobbs','{}'::jsonb) ? 'M1'");
await c.end();
