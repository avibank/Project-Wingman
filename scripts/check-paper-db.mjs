/* THE RULES ONLY THE DATABASE CAN ANSWER.
 *
 * R9 says a correction written by one student is ABSENT from another student's
 * payload — not hidden, absent. R12 says a Fly solo reader sees only their own.
 * Neither can be checked by reading the client: the whole point is that the
 * client is not the one deciding. So this drives the real functions over the
 * real anon REST path, as two different accounts, and deletes every row it
 * makes before it exits.
 *
 * Deliberately NOT in `npm run check`: that suite must not need credentials.
 * Run: npm run check:paper-db
 */
import { createAnchor } from "../src/lib/anchor.js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("paper-db: needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (node --env-file=.env.local)");
  process.exit(2);
}
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const rest = async (path, init = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const rpc = (fn, args) => rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(name); console.log(`  FAIL ${name}  ${detail}`); }
};

const stamp = Date.now().toString(36);
const A = `chk_paper_A_${stamp}`;      // a student
const B = `chk_paper_B_${stamp}`;      // another student on the same module
const PAPER = `chk_paper_${stamp}`;
const TEXT = "Alpha beta gamma delta. Epsilon zeta eta theta. Iota kappa lambda mu.";
const made = [];

const mark = async (author, kind, ring, body) => {
  const anchor = createAnchor(TEXT, 24, 47);
  const { status, body: rows } = await rest("paper_annotations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      paper_id: PAPER, module_code: "M1", author_id: author,
      kind, ring, body: body ?? null, anchor,
    }),
  });
  if (status >= 300) return { status, id: null };
  const id = rows?.[0]?.id;
  if (id) made.push(id);
  return { status, id };
};

try {
  console.log("\nwriting");
  const h = await mark(A, "highlight", "module", null);
  ok("R5 · a highlight saves with no body at all", h.status < 300 && h.id, `status ${h.status}`);

  const n = await mark(A, "note", "module", "A note everyone on the module may read.");
  ok("—  · a note saves", n.status < 300);

  const solo = await mark(A, "highlight", "solo", null);
  ok("—  · a solo mark saves", solo.status < 300);

  const corr = await mark(A, "correction", "solo", "This figure is out of date.");
  ok("—  · a correction saves", corr.status < 300);

  // R1, at the database rather than in review.
  const bad = await rest("paper_annotations", {
    method: "POST",
    body: JSON.stringify({
      paper_id: PAPER, module_code: "M1", author_id: A, kind: "highlight",
      ring: "module", anchor: { quote: "x", page: 4, rect: [1, 2, 3, 4] },
    }),
  });
  ok("R1 · the database refuses an anchor carrying a position", bad.status >= 400, `status ${bad.status}`);

  // R10, at the database: a question with no thread cannot exist.
  const noThread = await rest("paper_annotations", {
    method: "POST",
    body: JSON.stringify({
      paper_id: PAPER, module_code: "M1", author_id: A, kind: "question",
      ring: "module", anchor: createAnchor(TEXT, 0, 10),
    }),
  });
  ok("R10 · a question without a thread is refused", noThread.status >= 400, `status ${noThread.status}`);

  console.log("\nreading, as the author");
  const mine = await rpc("paper_annotations_for", { uid: A, p_paper: PAPER });
  ok("—  · the author sees all four of their own", mine.body?.length === 4, `got ${mine.body?.length}`);
  ok("—  · and they are marked close", (mine.body || []).every((r) => r.close === true));

  console.log("\nreading, as somebody else on the module");
  const theirs = await rpc("paper_annotations_for", { uid: B, p_paper: PAPER });
  const kinds = (theirs.body || []).map((r) => r.kind).sort();
  ok("R9 · the correction is ABSENT from another student's payload",
     !kinds.includes("correction"), JSON.stringify(kinds));
  ok("R12 · a solo mark is absent too", (theirs.body || []).every((r) => r.ring !== "solo"));
  ok("—  · the module-ring marks do arrive", kinds.join(",") === "highlight,note", JSON.stringify(kinds));
  ok("R4 · and they are NOT close, so they render as density",
     (theirs.body || []).every((r) => r.close === false));
  ok("—  · a stranger never sees a body they should not",
     !(theirs.body || []).some((r) => r.body === "This figure is out of date."));

  console.log("\nFly solo");
  await rest("pilot_profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: B, invisible: true }),
  });
  const soloRead = await rpc("paper_annotations_for", { uid: B, p_paper: PAPER });
  ok("R12 · a Fly solo reader's payload holds only their own",
     (soloRead.body || []).length === 0, `got ${soloRead.body?.length}`);

  await rest("pilot_profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: B, invisible: false }),
  });

  console.log("\nblocks");
  await rest("blocks", { method: "POST", body: JSON.stringify({ user_id: B, blocked_id: A }) });
  const blocked = await rpc("paper_annotations_for", { uid: B, p_paper: PAPER });
  ok("—  · blocking the author removes their marks", (blocked.body || []).length === 0,
     `got ${blocked.body?.length}`);
  await rest(`blocks?user_id=eq.${B}&blocked_id=eq.${A}`, { method: "DELETE" });

  console.log("\nthe author queue");
  const queueForB = await rpc("paper_corrections_for", { uid: B, p_module: "M1" });
  ok("R9 · a student sees no correction queue at all", (queueForB.body || []).length === 0);

  // The other side of the same rule: the author does see it, and sees who
  // found it. B is promoted to staff for one call and put back afterwards.
  await rest("pilot_profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: B, is_staff: true }),
  });
  const queueForAuthor = await rpc("paper_corrections_for", { uid: B, p_module: "M1" });
  const found = (queueForAuthor.body || []).find((r) => r.body === "This figure is out of date.");
  ok("R9 · the author does see it, with the passage and the finder", !!found,
     JSON.stringify((queueForAuthor.body || []).length));
  ok("R9 · and the correction itself reaches staff on the page too",
     ((await rpc("paper_annotations_for", { uid: B, p_paper: PAPER })).body || [])
       .some((r) => r.kind === "correction"));

  if (found) {
    await rest(`paper_annotations?id=eq.${found.id}`, {
      method: "PATCH",
      body: JSON.stringify({ resolved_at: new Date().toISOString() }),
    });
    const after = await rpc("paper_corrections_for", { uid: B, p_module: "M1" });
    ok("R9 · resolving it takes it off the queue",
       !(after.body || []).some((r) => r.id === found.id));
  }
  await rest("pilot_profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: B, is_staff: false }),
  });

  console.log("\norphaning");
  await rpc("paper_annotation_status", { p_id: h.id, p_status: "orphaned" });
  const after = await rpc("paper_annotations_for", { uid: A, p_paper: PAPER });
  const row = (after.body || []).find((r) => r.id === h.id);
  ok("R2 · an orphaned mark is still there, marked", row && row.status === "orphaned",
     JSON.stringify(row?.status));
} finally {
  console.log("\ncleaning up");
  await rest(`paper_annotations?paper_id=eq.${PAPER}`, { method: "DELETE" });
  await rest(`pilot_profiles?user_id=in.(${A},${B})`, { method: "DELETE" });
  await rest(`blocks?user_id=eq.${B}`, { method: "DELETE" });
  const left = await rest(`paper_annotations?paper_id=eq.${PAPER}&select=id`);
  console.log(`  ${made.length} rows written, ${(left.body || []).length} left behind`);
}

console.log(`\npaper-db: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
