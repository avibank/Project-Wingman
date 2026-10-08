#!/usr/bin/env node
/* =============================================================================
   PUBLISH THE COURSE DOCUMENT TO `course_docs`.
   -----------------------------------------------------------------------------
   A commit does not publish. The live app reads `current_course()`, so until
   this runs the class is on whatever was last published — which is how an
   earlier port shipped to a commit and the owner still saw the old screen.

   IT CHECKS ITS PAPERS ARE ACTUALLY THERE FIRST, and reads the first five
   bytes rather than the status: this app answers every unknown path with
   index.html and a 200, on the dev server and on Vercel both, so `r.ok` calls
   every missing paper present. That is measured, not assumed — it is why the
   Studio's own publish greps for `%PDF-`, and the same rule applies here.

   It refuses a document the client-side validator would refuse, before the
   RPC, so a bad publish costs nothing rather than a version.

   Usage:  node scripts/publish-course.mjs [--note "why"] [--base https://…]
   Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and COURSE_PUBLISH_KEY in
   .env.local. The key is a shared secret and is never printed.
   ========================================================================= */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const key = process.env.COURSE_PUBLISH_KEY;
if (!url || !anon || !key) {
  console.error("Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and COURSE_PUBLISH_KEY in .env.local.");
  process.exit(1);
}
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const note = argOf("--note", "course update");
const base = argOf("--base", "https://wingman.institute");

const doc = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url), "utf8"));

/* ---- what the database and the client both refuse ---- */
const faults = [];
if (!Array.isArray(doc.modules) || !doc.modules.length) faults.push("no modules");
for (const m of doc.modules || []) {
  if (!m.id) faults.push("a module with no id");
  if (!m.name) faults.push(`module ${m.id || "?"} has no name`);
  for (const c of m.chapters || []) {
    if (!c.id) faults.push(`a chapter of ${m.id} has no id`);
    if (c.quiz && !c.quiz.id) faults.push(`${c.id}'s quiz has no id`);
  }
}
if (faults.length) { console.error("REFUSING, the document is malformed:"); faults.forEach((f) => console.error(`  ! ${f}`)); process.exit(1); }

/* ---- every paper it names has to be on the other end ---- */
const papers = (doc.modules || []).flatMap((m) => (m.downloads || []).map((d) => ({ m: m.id, ...d })));
console.log(`checking ${papers.length} papers against ${base} …`);
const missing = [];
for (const p of papers) {
  const href = `${base}/${String(p.file).replace(/^\//, "")}`;
  try {
    const r = await fetch(href, { headers: { Range: "bytes=0-4" } });
    const head = new Uint8Array(await r.arrayBuffer()).slice(0, 5);
    const txt = String.fromCharCode(...head);
    if (txt !== "%PDF-") missing.push(`${p.file} — served ${JSON.stringify(txt)} (status ${r.status}), not a PDF`);
  } catch (e) { missing.push(`${p.file} — ${e.message}`); }
}
if (missing.length) {
  console.error("REFUSING, these papers are not on the other end yet:");
  missing.forEach((f) => console.error(`  ! ${f}`));
  console.error("Deploy first — publishing would put a row in front of the class whose file 404s.");
  process.exit(1);
}
console.log(`  all ${papers.length} papers answer with %PDF-`);

/* ---- publish, then read it back ---- */
const h = { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" };
const rpc = async (fn, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, j, text };
};

const before = await rpc("current_course", {});
/* `current_course()` returns id, doc, note, published_at — the version IS
   the row id; there is no `version` column, and asking for one printed
   "version undefined" over a perfectly good publish. */
console.log(`live now: version ${before.j?.[0]?.id ?? "—"} (${before.j?.[0]?.note ?? "no note"})`);

const res = await rpc("publish_course", { p_doc: doc, p_key: key, p_note: note, p_by: "publish-course.mjs" });
if (res.status !== 200 || !res.j?.[0]?.id) {
  console.error("REFUSING: the publish was not accepted —", res.text.slice(0, 300));
  process.exit(1);
}

const after = await rpc("current_course", {});
const live = after.j?.[0];
const m1 = (live?.doc?.modules || []).find((m) => m.id === "M1");
const chapters = m1?.chapters || [];
const q = chapters.reduce((a, c) => a + (c.quiz?.questions?.length || 0), 0);
const cards = chapters.reduce((a, c) => a + (c.cards?.length || 0), 0);
console.log(`\npublished as version ${live?.id}, note ${JSON.stringify(live?.note)}, at ${live?.published_at}`);
console.log(`read back: ${chapters.length} chapters · ${q} quiz questions · ${cards} cards · ${(m1?.downloads || []).length} papers`);
console.log(`           batches ${chapters.map((c) => c.batch).join(", ")}`);
if (chapters.length !== (doc.modules.find((m) => m.id === "M1").chapters || []).length) {
  console.error("WARNING: what came back is not what went in.");
  process.exit(1);
}
