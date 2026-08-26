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
const env = (k) => pick(k);
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
// Supabase's newer key system restricts the OpenAPI document at /rest/v1/ to
// secret keys ("Only secret API keys can be used for this endpoint"), so the
// spec is only readable when one is configured. With a publishable key the
// tables are still probed one by one — a plain read with limit=0 returns 200
// when the table exists and 404 when it does not.
//
// Functions cannot be probed that way. Calling one to see whether it answers is
// not an option: assign_squadron, post_opener_if_quiet, rate_limit_take and
// mark_answer all write. And PostgREST returns byte-identical PGRST202 errors
// for "no such function" and "wrong arguments", so an empty-argument call tells
// you nothing. Without a secret key they are reported as unverified rather than
// guessed at.

const base = url.replace(/\/+$/, "");
const secret = env("SUPABASE_SECRET_KEY");
const headers = (k) => {
  const h = { apikey: k };
  if (k.startsWith("eyJ")) h.Authorization = `Bearer ${k}`;
  return h;
};

let haveTables = null;
let haveRpcs = null;

if (secret) {
  const res = await fetch(`${base}/rest/v1/`, {
    headers: { ...headers(secret), Accept: "application/openapi+json" },
  });
  if (res.ok) {
    const spec = await res.json();
    haveTables = new Set(Object.keys(spec.definitions ?? {}));
    haveRpcs = new Set(
      Object.keys(spec.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)),
    );
  } else {
    console.error(`secret key rejected (${res.status}); falling back to probing`);
  }
}

if (!haveTables) {
  haveTables = new Set();
  const probe = async (t) => {
    try {
      const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=0`, { headers: headers(key) });
      if (r.status === 401) throw new Error("401 — the key does not match the project URL");
      if (r.ok) haveTables.add(t);
    } catch (e) {
      console.error(`could not reach ${base}: ${e.message}`);
      process.exit(1);
    }
  };
  await Promise.all([...needTables.keys()].map(probe));
}

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
if (haveRpcs) {
  report("functions", needRpcs, haveRpcs);
} else {
  console.log("\nfunctions");
  console.log(`  not verified — needs SUPABASE_SECRET_KEY. ${needRpcs.size} called by the code:`);
  console.log(`  ${[...needRpcs.keys()].sort().join(", ")}`);
}

console.log(
  `\n${missing ? `${missing} missing` : "everything the code calls is present"}` +
  `  (project has ${haveTables.size} of the ${needTables.size} tables the code needs${haveRpcs ? `, ${haveRpcs.size} functions` : ""})`,
);
if (missing) {
  const mids = [...new Set([...needTables.keys(), ...needRpcs.keys()]
    .filter((n) => !haveTables.has(n) && !haveRpcs.has(n))
    .map((n) => definedIn.get(n)).filter(Boolean))].sort();
  if (mids.length) console.log(`Apply: ${mids.join(", ")}. supabase/SETUP.sql bundles 0005-0007 as one paste.`);
}
process.exit(missing ? 1 : 0);
