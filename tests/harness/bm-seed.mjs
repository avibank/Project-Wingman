/* =============================================================================
   THE BOOKMARKS DEMO'S OWN FIXTURE, for the harness.
   -----------------------------------------------------------------------------
   `scripts/visual-diff.mjs` compares the demo at /__ref/bookmarks with the
   live screen. Rule 4 of the handover: seed the same data first, "otherwise
   you're comparing content, not layout."

   The counts are the demo's `ITEMS` list, counted per module rather than taken
   from the summary in the paste — which says four cards where the demo draws
   six. Module 1 carries 5 questions, 6 cards, 4 videos and 4 pages; module 2
   carries 2 questions, 1 video and 1 page, which is what makes the module
   switcher's counts mean anything.

   SEPARATE FROM `tests/bm-run.mjs`'s seeder on purpose. That one builds
   exactly fifteen rows and the walk asserts on them; this one answers to the
   demo. Two fixtures, two questions, neither quietly changing the other.

     npm run harness, then:  node tests/harness/bm-seed.mjs
   ========================================================================= */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function seedBookmarks(BASE = process.env.HARNESS || "http://127.0.0.1:5190") {
  await fetch(`${BASE}/rest/v1/saves?user_id=eq.student_one`, { method: "DELETE" });

  /* READ OFF DISK, not over HTTP — the prod harness serves a BUILT bundle and
     answers /src/... with the SPA fallback, which parses as nothing and seeds
     no questions at all. Same note as bm-run.mjs, same reason. */
  const doc = JSON.parse(readFileSync(new URL("../../src/content/test-content.json", import.meta.url), "utf8"));
  const qs = (mod, ch) =>
    (doc?.modules?.find((m) => m.id === mod)?.chapters?.[ch]?.quiz?.questions || []).map((q) => q.id);

  /* A question id identifies the question, not the module — `saves_one_per_thing`
     is (user_id, kind, ref_id, page) — so M2's rows carry M2's OWN ids. */
  const pick = (mod, n) => {
    const out = [];
    for (let ch = 0; out.length < n; ch += 1) {
      const got = qs(mod, ch);
      if (!got.length) break;
      for (const id of got) { if (out.length < n) out.push({ id, chapter: ch + 1 }); }
    }
    return out;
  };

  const row = (r, i) => ({
    id: crypto.randomUUID(), user_id: "student_one",
    created_at: new Date(Date.now() - i * 60000).toISOString(), ...r,
  });

  const questionsM1 = pick("M1", 5).map((q) => ({ module_id: "M1", kind: "question", ref_id: q.id, chapter: q.chapter }));
  /* The cards come from the END of the same pool, so a question saved as a
     question and the same one saved as a card do not collide by accident —
     they are two rows by design (CLAUDE.md) and the demo has one such pair. */
  const pool = pick("M1", 12);
  const cardsM1 = pool.slice(-6).map((q) => ({ module_id: "M1", kind: "card", ref_id: q.id, chapter: q.chapter }));
  const questionsM2 = pick("M2", 2).map((q) => ({ module_id: "M2", kind: "question", ref_id: q.id, chapter: q.chapter }));

  const videos = [
    { module_id: "M1", kind: "video", ref_id: "M1.01.1", chapter: 1, at_seconds: 372 },
    { module_id: "M1", kind: "video", ref_id: "M1.01.2", chapter: 1, at_seconds: 700 },
    { module_id: "M1", kind: "video", ref_id: "M1.02.1", chapter: 2, at_seconds: 175 },
    { module_id: "M1", kind: "video", ref_id: "M1.02.2", chapter: 2, at_seconds: 0 },
    { module_id: "M2", kind: "video", ref_id: "M2.02.2", chapter: 2, at_seconds: 260 },
  ];
  const pages = [212, 57, 388, 402].map((page) => ({ module_id: "M1", kind: "page", ref_id: "M1.DEV", chapter: null, page }));
  pages.push({ module_id: "M2", kind: "page", ref_id: "M2.DEV", chapter: null, page: 30 });

  const rows = [...questionsM1, ...cardsM1, ...questionsM2, ...videos, ...pages].map(row);
  if (questionsM1.length !== 5 || cardsM1.length !== 6) {
    throw new Error(`the seed built ${questionsM1.length} questions and ${cardsM1.length} cards — the content did not load`);
  }
  for (const r of rows) {
    await fetch(`${BASE}/rest/v1/saves?on_conflict=user_id,kind,ref_id,page`, {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(r),
    });
  }
  /* AND THE LIGHTING, because the demo is drawn dark and a headless browser
     reports prefers-color-scheme: light. Pinned in the student's own
     preference rather than in the diff script, so the live screen is dark the
     same way a student's would be. `visual-diff.mjs` is the drop's file and
     is left as sent. */
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-variant-pin": "night" } }),
  });

  return `seeded ${rows.length} saves — M1: 5 questions, 6 cards, 4 videos, 4 pages · lighting pinned to night`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await seedBookmarks());
}
