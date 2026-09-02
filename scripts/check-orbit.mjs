/* §3 OF THE DISCOVERY BRIEF, AS A TEST.
 *
 * "A person may only appear in results if the searcher already shares a
 * squadron with them, or that person has answered in a module the searcher is
 * studying. No other person is reachable by name, ever. Enforce this in the
 * query itself, not in a UI filter — an unscoped endpoint that the client
 * happens not to call is the same bug."
 *
 * That last sentence is the whole reason this file exists. The browser holds
 * the anon key and every table carries `using (true)`, so PostgREST will serve
 * pilot_profiles to anyone who asks. The scope holds only while people-search
 * goes through the SQL function in 0011, which cannot return a stranger. One
 * innocent-looking `.from("pilot_profiles").ilike("callsign", ...)` added later
 * to "make search faster" undoes it silently: the UI looks identical, the
 * build passes, and the app has a name-searchable directory of students, some
 * of whom are under 18.
 *
 * So: the client may not query the people table by name at all, and the
 * function it must use has to still be there.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(e)) files.push(p);
  }
})("src");

const fail = [];

/* 1 — nobody may search the people table by name from the client. A read of a
   single known id is fine and is how a profile sheet loads; it is `ilike` and
   `like` on a name that turn a table into a directory. */
for (const f of files) {
  const src = strip(readFileSync(f, "utf8"));
  const idx = src.indexOf('from("pilot_profiles")');
  if (idx === -1) continue;
  const stmt = src.slice(idx, idx + 400);
  if (/\.(i?like|textSearch|or)\(/.test(stmt)) {
    fail.push(`${f} searches pilot_profiles by name from the client — people-search `
      + `must go through the people_search function, which scopes to the orbit`);
  }
}

/* 2 — and the function that holds the rule has to exist. */
const mig = readFileSync("supabase/migrations/0011_discovery.sql", "utf8");
for (const fn of ["in_my_orbit", "people_search"]) {
  if (!new RegExp(`create or replace function ${fn}\\b`).test(mig)) {
    fail.push(`0011 no longer defines ${fn} — the scope has nowhere to live`);
  }
}
/* 3 — blocks are symmetric. A one-way check leaves the blocker visible to the
   person they blocked, which is the direction that matters most. */
const ps = mig.slice(mig.indexOf("function people_search"), mig.indexOf("function squadron_headcount"));
if (!/b\.user_id = p_me and b\.blocked_id = p\.user_id/.test(ps)
    || !/b\.user_id = p\.user_id and b\.blocked_id = p_me/.test(ps)) {
  fail.push("people_search no longer checks blocks in BOTH directions");
}
/* 4 — capacity is never rendered as a fraction. */
for (const f of files) {
  const src = strip(readFileSync(f, "utf8"));
  if (/\$\{\s*\w*(members|headcount|count)\w*\s*\}\s*(of|\/)\s*\$\{\s*\w*(cap|max)/i.test(src)) {
    fail.push(`${f} renders capacity as a fraction — always "8 members", never "8 of 32"`);
  }
}

console.log("orbit: people-search scope, symmetric blocks, and the no-fraction rule");
if (fail.length) {
  for (const f of fail) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log(`  ${files.length} files scanned; people reachable only through people_search`);
console.log("MATCH");
