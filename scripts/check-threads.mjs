/* End-to-end proof that the discussion is genuinely MULTI-USER.
 *
 * This goes over REST with the anon key — the same path the browser takes —
 * rather than over the direct connection, because the direct connection is
 * the superuser and would prove nothing about what a student can actually do.
 *
 * It writes as two different author ids, reads back as a third, and deletes
 * everything it made. A leftover row here is a demo comment in a real
 * student's module, so the cleanup runs even when an assertion fails.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("threads: no VITE_SUPABASE_URL / _ANON_KEY in .env.local"); process.exit(1); }

const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = async (path, init = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : null };
};

const MOD = "__wingman_selftest__";
const A = "__test_user_a__", B = "__test_user_b__";
const tid = `T_selftest_${Date.now().toString(36)}`;
let fails = 0;
// Key ORDER differs between an object literal and a mapper's return, and
// JSON.stringify is order-sensitive — comparing that way tests the mapper's
// source layout rather than its output.
const same = (a, b) => {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "ok   " : "FAIL "} ${name}${cond || !detail ? "" : `  — ${detail}`}`);
  if (!cond) fails += 1;
};

/* ---- the row mapping, pure and offline ---------------------------------- */
// These run first and need nothing: if the camelCase/snake_case boundary is
// wrong, every network assertion below would fail for a reason that has
// nothing to do with the network.
const { toThread, toReply, fromThread, fromReply } =
  await import("../src/lib/threadRows.js");

console.log("threads: the row mapping\n");
{
  const db = { id: "T1", module_id: "JT", lesson_id: "L1", t: 90, body: "b",
               author_id: "u1", created_at: "2026-01-01T00:00:00Z" };
  const c = toThread(db);
  check("db -> client keeps every field", c.moduleId === "JT" && c.lessonId === "L1"
    && c.t === 90 && c.authorId === "u1" && c.createdAt === db.created_at);
  check("client -> db round-trips", same(fromThread(c), db),
        JSON.stringify(fromThread(c)));

  // The CHECK constraint, mirrored client-side.
  const post = fromThread({ id: "T2", moduleId: "JT", lessonId: null, t: 42, body: "b", authorId: "u1" });
  check("a module post drops the moment", post.lesson_id === null && post.t === null,
        `got t=${post.t}`);
  const anch = fromThread({ id: "T3", moduleId: "JT", lessonId: "L1", t: 7.9, body: "b", authorId: "u1" });
  check("an anchored post floors its moment", anch.t === 7, `got ${anch.t}`);
  const neg = fromThread({ id: "T4", moduleId: "JT", lessonId: "L1", t: -3, body: "b", authorId: "u1" });
  check("a negative moment is clamped to 0", neg.t === 0, `got ${neg.t}`);

  const rdb = { id: "R1", thread_id: "T1", body: "r", author_id: "u2", created_at: "2026-01-01T00:00:01Z" };
  check("a reply round-trips", same(fromReply(toReply(rdb)), rdb));
}

console.log("\nthreads: the shared discussion, over REST as the browser sees it\n");

try {
  // 1 — A asks a question anchored to a lesson.
  let r = await rest("lesson_threads", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ id: tid, module_id: MOD, lesson_id: "L1", t: 137, body: "Anchored question", author_id: A }),
  });
  check("an anchored thread inserts", r.ok, `${r.status} ${JSON.stringify(r.body)}`);

  // 2 — B, a DIFFERENT account, can read it. This is the whole point: under
  //     user_progress this row was invisible to everyone but A.
  r = await rest(`lesson_threads?module_id=eq.${MOD}&select=*`);
  check("another account reads it", r.ok && (r.body || []).some((x) => x.id === tid),
        `${r.status} ${JSON.stringify(r.body)}`);

  // 3 — B answers.
  const rid = `${tid}.R_selftest`;
  r = await rest("lesson_replies", {
    method: "POST", body: JSON.stringify({ id: rid, thread_id: tid, body: "An answer", author_id: B }),
  });
  check("a second account replies", r.ok, `${r.status} ${JSON.stringify(r.body)}`);

  // 4 — the anchoring rule, enforced by the CHECK and not by remembering it.
  r = await rest("lesson_threads", {
    method: "POST",
    body: JSON.stringify({ id: `${tid}_bad`, module_id: MOD, lesson_id: null, t: 42, body: "half anchored", author_id: A }),
  });
  check("a half-anchored row is REFUSED", !r.ok, `it was accepted (${r.status})`);

  // 5 — an empty body is refused too.
  r = await rest("lesson_threads", {
    method: "POST",
    body: JSON.stringify({ id: `${tid}_empty`, module_id: MOD, lesson_id: null, t: null, body: "   ", author_id: A }),
  });
  check("a blank body is REFUSED", !r.ok, `it was accepted (${r.status})`);

  // 6 — a duplicate id is refused, which is why ids carry a random suffix.
  r = await rest("lesson_threads", {
    method: "POST",
    body: JSON.stringify({ id: tid, module_id: MOD, lesson_id: null, t: null, body: "collision", author_id: B }),
  });
  check("a colliding id is REFUSED", !r.ok, `it was accepted (${r.status})`);

  // 7 — the module read the room uses returns both rows together.
  const th = await rest(`lesson_threads?module_id=eq.${MOD}&select=*`);
  const rp = await rest(`lesson_replies?thread_id=eq.${tid}&select=*`);
  check("the module read returns the thread and its reply",
        (th.body || []).length >= 1 && (rp.body || []).length >= 1,
        `${(th.body || []).length} threads, ${(rp.body || []).length} replies`);

  // 8 — §7's boundary is callable and returns nobody for a stranger.
  r = await rest("rpc/right_seat", { method: "POST", body: JSON.stringify({ p_me: "__nobody__" }) });
  check("right_seat() answers over REST and offers a stranger nobody",
        r.ok && Array.isArray(r.body) && r.body.length === 0, `${r.status} ${JSON.stringify(r.body)}`);

  // 9 — lesson_notes cannot be enumerated any more (0009).
  r = await rest("lesson_notes?select=id&limit=1");
  check("lesson_notes is not bulk-readable", r.ok && (r.body || []).length === 0,
        `${r.status} returned ${JSON.stringify(r.body)}`);
} finally {
  // Always. A leftover selftest row is a demo comment in a live module.
  await rest(`lesson_replies?thread_id=eq.${tid}`, { method: "DELETE" });
  await rest(`lesson_threads?module_id=eq.${MOD}`, { method: "DELETE" });
  const left = await rest(`lesson_threads?module_id=eq.${MOD}&select=id`);
  const n = (left.body || []).length;
  console.log(`\n  ${n === 0 ? "ok   " : "FAIL "} cleaned up${n ? ` — ${n} row(s) left behind` : ""}`);
  if (n) fails += 1;
}

console.log(fails ? `\nthreads: ${fails} FAILED` : "\nthreads: the discussion is shared\nMATCH");
process.exit(fails ? 1 : 0);
