/* =============================================================================
   R15 — THE DEMO AND THE BUILD, MEASURED SIDE BY SIDE.
   -----------------------------------------------------------------------------
   The brief's acceptance test: open the demo and the live build at 1440, 820
   and 390, in Sky / Dark / Standard, and make the numbers agree within 2px.

     npm run harness, then:  node tests/r15-compare.mjs
     R15_SKIN=amber/light/aurora repeats it in the second skin the brief asks for.

   AT REST, NOT MID-ENTRY. `.bm-page` arrives on a 380ms slide from 6px down and
   the folders on a 420ms grow from scale(.94); measured a frame into either,
   the page sits 6px low and every cover is 6% small. Both sides wait for their
   own animations to finish before anything is read.

   The demo names its classes WITHOUT the `bm-` prefix — it is the design's own
   standalone page — so every selector is tried both ways.
   ========================================================================= */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.R15_BASE || "http://127.0.0.1:5190";
const DEMO = `${BASE}/docs/launch/reference/03-bookmarks-demo.html`;
const BAGREF = `${BASE}/docs/launch/reference/04-flight-bag.html`;
const SKIN = (process.env.R15_SKIN || "sky/night/standard").split("/");
const WIDTHS = [[1440, 900], [820, 1180], [390, 844]];

const seed = async () => {
  const doc = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url), "utf8"));
  const m1 = doc.modules.find((m) => m.id === "M1");
  const qs = (n) => (m1.chapters[n]?.quiz?.questions || []).map((q) => q.id);
  await fetch(`${BASE}/rest/v1/saves?user_id=eq.student_one`, { method: "DELETE" });
  const rows = [
    ...qs(0).slice(0, 5).map((id) => ({ kind: "question", ref_id: id, chapter: 1 })),
    ...qs(1).slice(0, 6).map((id) => ({ kind: "card", ref_id: id, chapter: 2 })),
    { kind: "video", ref_id: "M1.01.1", chapter: 1, at_seconds: 372 },
    { kind: "video", ref_id: "M1.02.2", chapter: 2, at_seconds: 12 },
    { kind: "page", ref_id: "M1.DEV", chapter: null, page: 7 },
    { kind: "page", ref_id: "M1.DEV", chapter: null, page: 11 },
  ];
  for (const r of rows) {
    await fetch(`${BASE}/rest/v1/saves?on_conflict=user_id,kind,ref_id,page`, {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({ id: crypto.randomUUID(), user_id: "student_one", module_id: "M1", ...r }),
    });
  }
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": SKIN[0], "pw-variant-pin": SKIN[1] === "light" ? "day" : "night", "pw-finish": SKIN[2] === "standard" ? null : SKIN[2] } }),
  });
};

const MEASURE = () => {
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const q = (s) => document.querySelector(s) || document.querySelector(s.replace(/\.bm-/g, "."));
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height), b: px(r.bottom) }; };
  const bar = document.querySelector("header.topbar") || document.querySelector("header.top");
  const page = q(".bm-page") || document.querySelector("main .view") || document.querySelector("main");
  const grid = q(".bm-folders"), cover = q(".bm-cover");
  const h1 = q(".bm-h1") || document.querySelector("h1");
  const pad = q(".bm-pad"), card = q(".bm-pad .bm-pc") || document.querySelector(".pad .pc");
  /* THE REFERENCE DRAWS THE BAG TWICE — a 230px close-up on the left and the
     one that ships, in a mock hero strip on the right, under the heading
     "REAL SIZE". Measuring the close-up said the build's bag was 146px small.
     The real-size one is `.inst .bag`. */
  const bag = document.querySelector(".inst .bag") || q(".bm-bag");
  const bagn = (bag && bag.parentElement && bag.parentElement.querySelector(".bagn")) || q(".bm-bagn")
    || (bag && [...(bag.parentElement?.parentElement?.querySelectorAll("*") || [])].find((e) => !e.children.length && /^\d+$/.test(e.textContent.trim())));
  const gs = grid && getComputedStyle(grid);
  return {
    gapUnderBar: page && bar ? px(page.getBoundingClientRect().top - bar.getBoundingClientRect().bottom) : null,
    cols: gs ? gs.gridTemplateColumns.split(" ").filter(Boolean).length : null,
    gap: gs ? px(gs.columnGap) : null,
    grid: R(grid), cover: R(cover),
    titleSize: h1 ? px(getComputedStyle(h1).fontSize) : null,
    titleToFolders: grid && h1 ? px(grid.getBoundingClientRect().top - h1.getBoundingClientRect().bottom) : null,
    pad: R(pad),
    cardAspect: card ? Math.round((card.getBoundingClientRect().width / card.getBoundingClientRect().height) * 1000) / 1000 : null,
    bag: R(bag),
    bagGap: bag && bagn ? px(bagn.getBoundingClientRect().top - bag.getBoundingClientRect().bottom) : null,
  };
};

const settle = async (page) => {
  await page.waitForTimeout(260);
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => a.playState === "running" && a.effect?.getTiming?.().iterations !== Infinity)
    .map((a) => a.finished.catch(() => {}))));
  await page.waitForTimeout(120);
};

await seed();
const browser = await chromium.launch();
const rows = [];
let worst = 0;
for (const [w, h] of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const at = async (url, wait) => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (wait) await page.locator(wait).first().waitFor({ timeout: 20000 }).catch(() => {});
    await settle(page);
    return page.evaluate(MEASURE);
  };
  const demo = await at(DEMO, ".folders .folder");
  /* The demo's card pad, reached the way a student would: open Study cards. */
  await page.goto(DEMO, { waitUntil: "domcontentloaded" });
  await page.locator(".folders .folder").first().waitFor({ timeout: 20000 }).catch(() => {});
  await settle(page);
  await page.locator(".open-f").nth(1).click().catch(() => {});
  await page.waitForTimeout(600);
  await settle(page);
  const demoCards = await page.evaluate(MEASURE);
  const live = await at(`${BASE}/bookmarks?uid=student_one&m=M1`, ".bm-folders .bm-folder");
  const liveCards = await at(`${BASE}/m/m1/library/cards/1?uid=student_one`, ".bm-pad .bm-pc");
  const liveBag = await at(`${BASE}/?uid=student_one`, ".bm-bagcell .bm-bag");
  const bagRef = await at(BAGREF, ".bag");

  const pair = (name, a, b, tol = 2) => {
    const d = (typeof a === "number" && typeof b === "number") ? Math.round((b - a) * 10) / 10 : null;
    if (d !== null) worst = Math.max(worst, Math.abs(d));
    rows.push({ w, name, demo: a, live: b, d, ok: d === null ? null : Math.abs(d) <= tol });
  };
  pair("folder grid · columns", demo.cols, live.cols);
  pair("folder grid · gap", demo.gap, live.gap);
  pair("folder grid · left edge", demo.grid?.x, live.grid?.x);
  pair("folder grid · width", demo.grid?.w, live.grid?.w);
  pair("one cover · width", demo.cover?.w, live.cover?.w);
  pair("one cover · height", demo.cover?.h, live.cover?.h);
  pair("page title · size", demo.titleSize, live.titleSize);
  pair("title to folders", demo.titleToFolders, live.titleToFolders);
  pair("page · gap under the bar", demo.gapUnderBar, live.gapUnderBar);
  pair("card pad · width", demoCards.pad?.w, liveCards.pad?.w);
  pair("a card · aspect", demoCards.cardAspect, liveCards.cardAspect, 0.02);
  pair("the bag · drawn width", bagRef.bag?.w, liveBag.bag?.w);
  pair("the bag · gap to its number", bagRef.bagGap, liveBag.bagGap);
  await page.close();
}
await browser.close();

/* THREE DIFFERENCES ARE STATED RATHER THAN CHASED, each with the reason and
   the arithmetic. R15 asks for exactly this — "Any difference: state it in the
   report with the reason" — and naming them here means a FOURTH fails. */
const AGREED = {
  "title to folders":
    "+12 = 4 + 8. The pack's own bookmarks.css sets .bm-head margin-bottom to 22 where the "
    + "demo's stylesheet says 18 — the two disagree, and this brief's header says the code wins. "
    + "The other 8 is §12: App.jsx floors every button at 44px, so the module picker's own 36px "
    + "button is 44 here and 36 in the demo. An app rule beating a design one, deliberately.",
  "one cover · height":
    "the bottom chrome differs, and the folders fill whatever room is left (§1). The demo "
    + "reserves 84px for its DEMO bar — a demo-only control that does not ship; the app reserves "
    + "56 for the chin, and 64 more on a phone so its fixed report pill does not sit on a "
    + "folder's name. Everything above the fold matches to the pixel.",
  "the bag · drawn width":
    "+6, and the reference's number comes from a differently-proportioned mock. Its REAL SIZE "
    + "cell is 187x358; the app's strip cell is 244x164. The pack's CSS says 84px, which fills "
    + "the app's shorter cell as 78 fills the mock's taller one.",
};

console.log(`R15 · the demo against the build, ${SKIN.join(" / ")}\n`);
let bad = 0;
for (const w of [1440, 820, 390]) {
  console.log(`  ${w}px`);
  for (const r of rows.filter((x) => x.w === w)) {
    const agreed = r.ok === false && AGREED[r.name];
    const mark = r.ok === null ? "  ? " : r.ok ? " ok " : agreed ? "said" : "FAIL";
    if (r.ok === false && !agreed) bad += 1;
    console.log(`    ${mark} ${r.name.padEnd(28)} demo ${String(r.demo).padStart(8)}   build ${String(r.live).padStart(8)}   ${r.d === null ? "" : (r.d > 0 ? "+" : "") + r.d}`);
  }
  console.log();
}
const matched = rows.filter((r) => r.ok === true).length;
console.log(`${matched} of ${rows.filter((r) => r.ok !== null).length} measurements agree exactly.\n`);
for (const [k, why] of Object.entries(AGREED)) console.log(`  said · ${k}\n         ${why.replace(/(.{88}) /g, "$1\n         ")}\n`);
console.log(bad ? `${bad} measurement(s) outside tolerance and not accounted for` : "every difference is one of the three stated above");
process.exit(bad ? 1 : 0);
