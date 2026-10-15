import { readFileSync } from "node:fs";
import pg from "pg";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const sql = readFileSync("supabase/reset-mock-exams-progress.sql", "utf8");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
c.on("notice", (n) => console.log("  NOTICE:", n.message));
await c.connect();
const before = await c.query(`select
  (select count(*) from quiz_runs where quiz_id like 'M1.M%' or chapter_id like 'M1.M%') runs,
  (select count(*) from saves where ref_id like 'M1.M%') saves,
  (select count(*) from chapter_completions where chapter_id like 'M1.M%') done,
  (select count(*) from quiz_runs where quiz_id like 'M1.V%') vruns,
  (select count(*) from saves where ref_id like 'M1.V%') vsaves`);
console.log("before:", JSON.stringify(before.rows[0]));
await c.query("begin");
await c.query(sql);
await c.query("commit");
const after = await c.query(`select
  (select count(*) from quiz_runs where quiz_id like 'M1.M%' or chapter_id like 'M1.M%') runs,
  (select count(*) from saves where ref_id like 'M1.M%') saves,
  (select count(*) from chapter_completions where chapter_id like 'M1.M%') done,
  (select count(*) from quiz_runs where quiz_id like 'M1.V%') vruns,
  (select count(*) from saves where ref_id like 'M1.V%') vsaves`);
console.log("after :", JSON.stringify(after.rows[0]));
await c.end();
