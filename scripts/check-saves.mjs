// The saves store's rules, driven against a stand-in server. Run: npm run check:saves
//
// THESE ARE THE PACK'S OWN NINE TESTS, moved off Vitest. The pack shipped
// `savesStore.test.js` and said to add Vitest and jsdom if needed. Neither was
// needed: none of the nine touches the DOM, and this repo already has one gate
// — `npm run check` — with thirty checks in it and a browser walk beside it.
// A second runner would have put the one rule that can silently lose a
// student's bookmark outside the suite anybody actually runs.
//
// What it took was splitting the toast bus out of Toast.jsx (see its header):
// the store raises toasts, node cannot parse .jsx, and the pack's answer was
// to mock the module. The bus is plain JavaScript, so nothing is mocked here —
// the real toast is observed through the real listener.
import { onToast } from "../src/features/bookmarks/toastBus.js";
import { makeFakeSupabase } from "../src/features/bookmarks/fakeSupabase.js";
import {
  initSaves, resetSaves, addSave, addMany, removeSave, restoreSave,
  findSave, getSnapshot,
} from "../src/features/bookmarks/savesStore.js";

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

let toasts = [];
onToast((t) => toasts.push(t));

let fake;
async function fresh() {
  toasts = [];
  fake = makeFakeSupabase([]);
  fake.db.latency = 1;
  resetSaves();
  await initSaves({ getSupabase: async () => fake.client, userId: "u1" });
}

/* 1 — the screen changes first and the server follows. This is the whole
   promise of the store: a bookmark that waits for the network reads as broken
   on a phone on college wifi. */
await fresh();
{
  const p = addSave({ kind: "question", moduleId: "m1", refId: "q1", chapter: 1 });
  ok("instant", "a save is on screen before the server has answered", !!findSave("question", "q1"));
  const r = await p;
  ok("instant", "and on the server after", r.ok && fake.db.rows.length === 1);
}

/* 2 — a double tap is one save. The unique constraint holds the server end
   (0028); this holds the screen's. */
await fresh();
{
  await addSave({ kind: "card", moduleId: "m1", refId: "q1" });
  await addSave({ kind: "card", moduleId: "m1", refId: "q1" });
  ok("once", "saving the same thing twice never makes two",
     getSnapshot().rows.filter((r) => r.kind === "card").length === 1 && fake.db.rows.length === 1);
}

/* 3 — the decision, held by a test so it cannot be tidied away: one question
   saved from the quiz and from its card set is TWO saves, because one is
   practised as a quiz and the other is flipped as a card. */
await fresh();
{
  await addSave({ kind: "question", moduleId: "m1", refId: "q1" });
  await addSave({ kind: "card", moduleId: "m1", refId: "q1" });
  ok("kinds", "a question and a card of the same question are kept apart",
     getSnapshot().rows.length === 2);
}

/* 4 — a lesson saved again MOVES its second. Tapping the bookmark at 1:30 on a
   lesson already saved at 0:30 plainly means "this moment now". */
await fresh();
{
  await addSave({ kind: "video", moduleId: "m1", refId: "l1", atSeconds: 30 });
  await addSave({ kind: "video", moduleId: "m1", refId: "l1", atSeconds: 90 });
  ok("video", "saving a lesson again moves its second rather than adding a save",
     getSnapshot().rows.length === 1 && findSave("video", "l1").at_seconds === 90);
}

/* 5 — two pages of one paper are two different saves, which is why `page` is
   inside the unique constraint and `at_seconds` is not. */
await fresh();
{
  await addSave({ kind: "page", moduleId: "m1", refId: "p1", page: 12 });
  await addSave({ kind: "page", moduleId: "m1", refId: "p1", page: 40 });
  ok("pages", "two pages of one paper are two saves", getSnapshot().rows.length === 2);
}

/* 6 — nothing is ever shown as saved that is not saved. Three refusals in a
   row exhaust the retries; the row comes off the screen and the student is
   told, with a way to try again. */
await fresh();
{
  fake.db.failNext = 3;
  const r = await addSave({ kind: "question", moduleId: "m1", refId: "q9" });
  ok("refused", "a refused save goes back off the screen", !r.ok && !findSave("question", "q9"));
  ok("refused", "and says so, with Retry",
     toasts.length === 1 && /didn't save/.test(toasts.at(-1).message) && toasts.at(-1).action?.label === "Retry");
}

/* 7 — Undo puts it back EXACTLY: same second, same page, not a fresh save at
   zero. */
await fresh();
{
  await addSave({ kind: "video", moduleId: "m1", refId: "l1", atSeconds: 372 });
  const r = await removeSave(findSave("video", "l1"));
  ok("undo", "a removal is instant", !findSave("video", "l1") && r.ok);
  await restoreSave(r.row);
  ok("undo", "and Undo puts it back at the same second", findSave("video", "l1")?.at_seconds === 372);
}

/* 8 — "Save the ones I missed" is one result and one toast, not eight. */
await fresh();
{
  const res = await addMany([
    { kind: "question", moduleId: "m1", refId: "a" },
    { kind: "question", moduleId: "m1", refId: "b" },
  ]);
  ok("many", "several saves report once", res.saved === 2 && res.failed === 0);
  ok("many", "and raise no toast of their own when they all land", toasts.length === 0);
}

/* 9 — sign-out forgets everything. On a shared college machine the next person
   must not see the last one's bookmarks while their own are loading. */
await fresh();
{
  await addSave({ kind: "question", moduleId: "m1", refId: "q1" });
  resetSaves();
  ok("signout", "signing out forgets every save", getSnapshot().rows.length === 0);
}

/* 10 — and the one the pack did not have: a failed REMOVE puts the row back
   where it was, rather than at the top. The list is newest-first, so a row
   that reappears in the wrong place is a row the student cannot find again. */
await fresh();
{
  await addSave({ kind: "question", moduleId: "m1", refId: "a" });
  await addSave({ kind: "question", moduleId: "m1", refId: "b" });
  await addSave({ kind: "question", moduleId: "m1", refId: "c" });
  const middle = findSave("question", "b");
  fake.db.failNext = 3;
  toasts = [];
  await removeSave(middle);
  const order = getSnapshot().rows.map((r) => r.ref_id).join("");
  ok("refused", "a refused removal puts the row back where it was", order === "cba", order);
  ok("refused", "and says so", toasts.some((t) => /didn't remove/.test(t.message)));
}

/* 11 — R13, and it is the only way to be sure. The test double is a real file
   in the feature's folder; if a live file ever imports it, it reaches the
   bundle and every student's browser downloads a fake server. Nothing but this
   script may name it. */
{
  const { readdirSync, statSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const importers = walk("src").filter((f) => /\.(js|jsx)$/.test(f) && /fakeSupabase/.test(readFileSync(f, "utf8")));
  ok("ships", "nothing in src/ imports the fake server", importers.length === 0, importers.join(" "));
}

console.log(`\nsaves: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
