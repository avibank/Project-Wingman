// Read-only. Exercises the exact call shapes the app uses against the live
// project, through the new PostgrestClient, and compares with supabase-js.
import { readFileSync } from "node:fs";
import { PostgrestClient } from "@supabase/postgrest-js";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync("/Users/hassa/Documents/Project Wingman/.env.local", "utf8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));

const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.log("MISSING env"); process.exit(1); }

const pg = new PostgrestClient(`${url}/rest/v1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const sb = createClient(url, key);

const shapes = [
  ["select+limit",       c => c.from("user_progress").select("data").limit(1)],
  ["select+eq+maybe",    c => c.from("user_progress").select("data").eq("user_id", "__nobody__").maybeSingle()],
  ["select+order",       c => c.from("discussion_posts").select("id").order("created_at", { ascending: false }).limit(2)],
  ["select+in",          c => c.from("user_prefs").select("user_id").in("user_id", ["__a__", "__b__"])],
  ["head+count",         c => c.from("wingmen").select("*", { count: "exact", head: true })],
  ["rpc",                c => c.rpc("question_miss_stats", { q_id: "__nope__" })],
];

let mismatch = 0;
for (const [name, run] of shapes) {
  const a = await run(pg), b = await run(sb);
  const norm = (r) => ({ err: r.error ? (r.error.code || r.error.message) : null, rows: Array.isArray(r.data) ? r.data.length : (r.data === null ? "null" : "obj"), count: r.count ?? null });
  const A = norm(a), B = norm(b);
  const same = JSON.stringify(A) === JSON.stringify(B);
  if (!same) mismatch++;
  console.log(`${same ? "ok  " : "DIFF"}  ${name.padEnd(16)} postgrest=${JSON.stringify(A)}  supabase-js=${JSON.stringify(B)}`);
}
console.log(mismatch ? `MISMATCHES: ${mismatch}` : "MATCH — every call shape agrees with supabase-js against the live project");
process.exitCode = mismatch ? 1 : 0;
