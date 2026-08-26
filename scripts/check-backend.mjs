// Checks the live Supabase project against what the code actually calls.
//
// Nothing here has ever been verified against a real backend — every pass to
// date used a stubbed client in a desktop browser — so this is the first thing
// to run once credentials exist.
//
// It is strictly read-only. It does NOT call the RPCs to see whether they
// answer: assign_squadron and post_opener_if_quiet both write. Instead it reads
// PostgREST's OpenAPI document, which lists every table, view and function the
// anon role can reach, and compares that against the set the code needs.
//
// Run: npm run check:backend

import { readFileSync, readdirSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

// ---------------------------------------------------------------- credentials
// Vite reads .env.local itself; this script is plain node, so it parses the
// same file rather than making anyone export variables by hand.
function envFromFile() {
  for (const name of [".env.local", ".env"]) {
    const p = new URL(name, ROOT);
    if (!existsSync(p)) continue;
    const out = {};
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
      if (m && !line.trimStart().startsWith("#")) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  }
  return {};
}
const fileEnv = envFromFile();
const pick = (...keys) => keys.map((k) => process.env[k] || fileEnv[k]).find(Boolean);
const url = pick("VITE_SUPABASE_URL", "SUPABASE_URL");
const key = pick("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");

if (!url || !key) {
  console.error("Not configured. Create .env.local with:\n");
  console.error("  VITE_SUPABASE_URL=https://<project>.supabase.co");
  console.error("  VITE_SUPABASE_ANON_KEY=<anon key>");
  console.error("  VITE_CLERK_PUBLISHABLE_KEY=<publishable key>\n");
  console.error("Both Supabase values are in the Supabase dashboard under");
  console.error("Project Settings -> API. Use a Publishable key (sb_publishable_...),");
  console.error("or the anon key on the Legacy tab. Never a Secret key");
  console.error("(sb_secret_... / service_role): VITE_ vars ship to every visitor.");
  process.exit(2);
}

// ------------------------------------------------- what the code actually needs
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const needTables = new Map();   // name -> Set(file)
const needRpcs = new Map();
for (const f of walk(new URL("src/", ROOT))) {
  const s = readFileSync(f, "utf8");
  const short = f.pathname.split("/src/")[1];
  for (const m of s.matchAll(/\.from\(\s*["'](\w+)["']\s*\)/g))
    (needTables.get(m[1]) ?? needTables.set(m[1], new Set()).get(m[1])).add(short);
  for (const m of s.matchAll(/\.rpc\(\s*["'](\w+)["']/g))
    (needRpcs.get(m[1]) ?? needRpcs.set(m[1], new Set()).get(m[1])).add(short);
}

// ------------------------------------- which migration would create a given name
const migDir = new URL("supabase/migrations/", ROOT);
const definedIn = new Map();
for (const f of readdirSync(migDir).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort()) {
  const s = readFileSync(new URL(f, migDir), "utf8");
  const tag = f.slice(0, 4);
  const add = (re) => { for (const m of s.matchAll(re)) if (!definedIn.has(m[1])) definedIn.set(m[1], tag); };
  add(/create table if not exists\s+(?:public\.)?(\w+)/gi);
  add(/create (?:or replace )?(?:materialized )?view(?: if not exists)?\s+(?:public\.)?(\w+)/gi);
  add(/create or replace function\s+(?:public\.)?(\w+)/gi);
}

// --------------------------------------------------------- what the project has
const base = url.replace(/\/+$/, "");
let spec;
try {
  // Two key styles are in the wild. The legacy anon key is a JWT and goes in
  // both headers; the newer sb_publishable_ key is not a JWT, and sending it as
  // a Bearer token gets rejected as a malformed JWT. apikey carries both.
  const headers = { apikey: key, Accept: "application/openapi+json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/rest/v1/`, { headers });
  if (!res.ok) {
    console.error(`Supabase answered ${res.status} ${res.statusText} for ${base}/rest/v1/`);
    if (res.status === 401) console.error("That usually means the anon key does not match the project URL.");
    process.exit(1);
  }
  spec = await res.json();
} catch (e) {
  console.error(`Could not reach ${base}: ${e.message}`);
  process.exit(1);
}

const haveTables = new Set(Object.keys(spec.definitions ?? {}));
const haveRpcs = new Set(
  Object.keys(spec.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)),
);

// ----------------------------------------------------------------------- report
let missing = 0;
const report = (label, need, have) => {
  console.log(`\n${label}`);
  for (const name of [...need.keys()].sort()) {
    const ok = have.has(name);
    if (!ok) missing++;
    const where = definedIn.get(name);
    const note = ok ? "" : where ? `  <- run migration ${where}` : "  <- NOT DEFINED IN ANY MIGRATION";
    console.log(`  ${ok ? "ok     " : "MISSING"} ${name.padEnd(24)}${note}`);
  }
};
report("tables and views", needTables, haveTables);
report("functions", needRpcs, haveRpcs);

console.log(
  `\n${missing ? `${missing} missing` : "everything the code calls is present"}` +
  `  (project has ${haveTables.size} tables/views, ${haveRpcs.size} functions)`,
);
if (missing) {
  const mids = [...new Set([...needTables.keys(), ...needRpcs.keys()]
    .filter((n) => !haveTables.has(n) && !haveRpcs.has(n))
    .map((n) => definedIn.get(n)).filter(Boolean))].sort();
  if (mids.length) console.log(`Apply: ${mids.join(", ")}. supabase/SETUP.sql bundles 0005-0007 as one paste.`);
}
process.exit(missing ? 1 : 0);
