import { readFileSync } from "node:fs";
import pg from "pg";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (label, sql) => {
  const r = await c.query(sql);
  console.log(`${label.padEnd(38)} ${JSON.stringify(r.rows).slice(0, 300)}`);
};
await q("quiz_runs on a mock", "select count(*) from quiz_runs where quiz_id like 'M1.M%' or chapter_id like 'M1.M%'");
await q("saves into a mock", "select count(*) from saves where ref_id like 'M1.M%'");
await q("completions on a mock", "select count(*) from chapter_completions where chapter_id like 'M1.M%'");
await q("progress docs mentioning a mock", `
  select count(*) from user_progress where
       exists (select 1 from jsonb_each(coalesce(data->'pw-quiz-scores','{}'::jsonb)) e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-quiz-run','{}'::jsonb))   e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-cards-seen','{}'::jsonb)) e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-cards-got','{}'::jsonb))  e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-retention','{}'::jsonb)) p(pile,items),
                    jsonb_each(items) e(k,v) where k like 'M1.M%')`);
await q("progress docs with pw-batch >= 11", `
  select count(*) from user_progress where (data->'pw-batch'->>'M1')::int >= 11`);
await q("--- for contrast, the V-batches ---", `
  select (select count(*) from quiz_runs where quiz_id like 'M1.V%') as runs,
         (select count(*) from saves where ref_id like 'M1.V%') as saves,
         (select count(*) from user_progress) as progress_docs`);
await c.end();
