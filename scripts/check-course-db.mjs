/* 0040 — THE COURSE IN A TABLE, driven against the live database.
 *
 * Over the anon REST path the app itself uses, with the publishing key from
 * .env.local, and every row it makes deleted afterwards — which puts the
 * version that was newest before the check back on top, because "the course"
 * is simply the newest row.
 *
 * Like check:licence-db this is NOT in `npm run check`: that suite must not
 * need credentials.
 *
 * Run: npm run check:course-db
 */
import pg from "pg";

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const key = process.env.COURSE_PUBLISH_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
if (!url || !anon || !key || !dbUrl) {
  console.error("Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, COURSE_PUBLISH_KEY and SUPABASE_DB_URL in .env.local.");
  process.exit(2);
}

const h = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };
const rpc = async (fn, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, j };
};
const rest = async (path, init = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: h, ...init });
  return { status: r.status, text: await r.text() };
};

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(name); console.log(`  FAIL ${name}  ${detail}`); }
};

const tag = `check-${Date.now().toString(36)}`;
const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();
const made = [];

try {
  /* What is live before anything here touches it. */
  const before = await rpc("current_course", {});
  const liveDoc = before.j?.[0]?.doc;
  ok("the published course reads over the anon path",
     before.status === 200 && Array.isArray(liveDoc?.modules) && liveDoc.modules.length > 0,
     JSON.stringify(before).slice(0, 140));

  /* A publish, with the real key, of the live document plus a marker — so
     nothing about the course changes even if the cleanup were to fail. */
  const probe = JSON.parse(JSON.stringify(liveDoc));
  probe.note = tag;
  const p = await rpc("publish_course", { p_doc: probe, p_key: key, p_note: tag, p_by: "check:course-db" });
  ok("a publish with the key is accepted", p.status === 200 && p.j?.[0]?.id > 0, JSON.stringify(p).slice(0, 140));
  if (p.j?.[0]?.id) made.push(p.j[0].id);

  const after = await rpc("current_course", {});
  ok("and it becomes the course on the next read", after.j?.[0]?.note === tag, JSON.stringify(after.j?.[0]?.note));

  /* The gates. */
  const wrong = await rpc("publish_course", { p_doc: probe, p_key: `${key}x`, p_note: "should not land" });
  ok("a wrong key is refused, by name", wrong.status >= 400 && /publishing key is not right/.test(JSON.stringify(wrong.j)), JSON.stringify(wrong.j).slice(0, 120));

  const empty = await rpc("publish_course", { p_doc: { modules: [] }, p_key: key });
  ok("a document with no modules is refused", empty.status >= 400, JSON.stringify(empty.j).slice(0, 120));

  const nameless = await rpc("publish_course", { p_doc: { modules: [{ id: "M9" }] }, p_key: key });
  ok("a module with no name is refused", nameless.status >= 400, JSON.stringify(nameless.j).slice(0, 120));

  const chapterless = await rpc("publish_course", { p_doc: { modules: [{ id: "M9", name: "Nine", chapters: [{ name: "no id" }] }] }, p_key: key });
  ok("a chapter with no id is refused", chapterless.status >= 400, JSON.stringify(chapterless.j).slice(0, 120));

  /* And the table itself, with the key every browser carries. */
  const countBefore = (await c.query("select count(*)::int n from course_docs")).rows[0].n;
  const ins = await rest("course_docs", { method: "POST", body: JSON.stringify({ doc: { modules: [] } }) });
  const del = await rest("course_docs?id=gt.0", { method: "DELETE" });
  const upd = await rest("course_docs?id=gt.0", { method: "PATCH", body: JSON.stringify({ note: "rewritten" }) });
  const countAfter = (await c.query("select count(*)::int n from course_docs")).rows[0].n;
  const notes = (await c.query("select count(*)::int n from course_docs where note = 'rewritten'")).rows[0].n;
  ok("the publishable key cannot insert a version", ins.status >= 400, `${ins.status} ${ins.text.slice(0, 80)}`);
  ok("cannot delete one", countAfter === countBefore, `${countBefore} -> ${countAfter} (delete said ${del.status})`);
  ok("and cannot rewrite one", notes === 0, `${notes} rewritten (patch said ${upd.status})`);

  const keys = await rest("course_keys?select=*");
  ok("the key table gives nothing away", keys.status === 200 && keys.text.trim() === "[]", keys.text.slice(0, 80));

  const versions = await rest("course_docs?select=id,published_at&limit=3");
  ok("but the version list is readable, which is what the Studio shows", versions.status === 200 && /\[/.test(versions.text));
} finally {
  if (made.length) {
    const r = await c.query("delete from course_docs where id = any($1)", [made]);
    ok("every version this check published is deleted", r.rowCount === made.length, `${r.rowCount} of ${made.length}`);
  }
  const back = await rpc("current_course", {});
  ok("and the course that was live before it ran is live again", back.j?.[0]?.note !== tag, String(back.j?.[0]?.note));
  await c.end();
}

console.log(`\ncourse-db: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
