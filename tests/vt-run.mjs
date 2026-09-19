/* =============================================================================
   EVERY SCREEN CHANGE, WATCHED.
   -----------------------------------------------------------------------------
   The transitions brief's own final checklist, run instead of clicked through:
   the walk it lists, with document.startViewTransition hooked so each step
   records what kind of transition started, which pseudo-elements its
   animations actually ran on, whether a skeleton was on screen when the new
   side was photographed, and any layout shift and long frame it cost.

   A step passes when every named area it moves animates on BOTH sides — an
   old snapshot fading out with nothing arriving is the "pops in after a
   freeze" the brief found on the module open — and nothing shifts. Some steps
   name more: a pseudo-element that has to be running (the app bar leaving,
   the ground dissolving into the exam), or an element that has to have moved
   in the page, which is how a tab's pill and a switch with no view
   transition behind it are checked.

     npm run harness, then:  npm run test:vt
     VT_REPORT=1 prints every step without failing, which is how the baseline
     was taken. VT_VARIANT, VT_LIVERY and VT_WIDTH pick the skin and the size;
     VT_MOTION=smooth-air or VT_MOTION=reduce turns motion off the two ways a
     student can, and then every step passes only if NOTHING animated — no
     view transition started and nothing moved — because "reduce motion"
     means none, not less.

     FRAMES. Every step reports the long animation frames (over 50ms) that
     started during its movement — from the transition's first animated frame
     to its last, or for a switch with no transition, the half second after
     the press — and, apart from them, the frame in which the next screen was
     built, which ends as the movement starts. VT_CPU=4 slows the main thread
     fourfold, as the brief's Performance-panel check does, and VT_GPU=1 runs
     a full browser on the GPU: the default headless shell rasterises in
     software, which repaints the deck's blurred light at a few frames a
     second and makes every frame number meaningless. VT_FRAMES=1 fails a
     step on a long frame while moving. Measure frames against a production
     build — `npm run harness:prod`, then VT_BASE=http://127.0.0.1:5191 —
     because React's development build does several times the work per
     commit and the dev server's frames are not the site's.
   ========================================================================= */
import { chromium, webkit } from "playwright";
import { seedRoom } from "./harness/room-seed.mjs";

const BASE = process.env.VT_BASE || "http://127.0.0.1:5190";
const REPORT = process.env.VT_REPORT === "1";
const VARIANT = process.env.VT_VARIANT || "night";
const LIVERY = process.env.VT_LIVERY || "sky";
const WIDTH = Number(process.env.VT_WIDTH || 1440);
const MOTION = process.env.VT_MOTION || "";
const MOTION_OFF = MOTION === "smooth-air" || MOTION === "reduce";
const CPU = Number(process.env.VT_CPU || 1);
const GPU = process.env.VT_GPU === "1";
const FRAMES = process.env.VT_FRAMES === "1";
/* VT_BROWSER=webkit walks it in Safari's engine, which is what most of these
   students' phones run. No CPU throttling and no frame timing there — both are
   Chromium's — but every transition, pill and switch is judged the same way. */
const WEBKIT = process.env.VT_BROWSER === "webkit";

const HOOK = () => {
  window.__vt = [];
  window.__ls = [];
  window.__lf = [];
  window.__moved = [];
  window.__ran = [];
  window.__last = Promise.resolve();
  /* Every CSS transition that starts, as class:property — a popover, a dialog,
     a sheet and a grid track move this way, with no script and no snapshot. */
  document.addEventListener("transitionrun", (e) => {
    /* The room's own stylesheet answers reduced motion by setting every
       transition inside it to a thousandth of a millisecond — which still
       RUNS, and still fires this event, and moves nothing. An instant
       transition is not a movement. */
    const longest = Math.max(...getComputedStyle(e.target, e.pseudoElement || null)
      .transitionDuration.split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 0.001 : 1)));
    if (!(longest > 0.01)) return;
    const cls = String(e.target.className || e.target.nodeName).split(" ")[0];
    window.__ran.push(`${cls}${e.pseudoElement || ""}:${e.propertyName}`);
  }, true);
  /* Every animation started from script, by the class of what it moved. */
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    window.__moved.push(String(this.className || this.id || this.nodeName).split(" ")[0]);
    return animate.apply(this, args);
  };
  const orig = Document.prototype.startViewTransition;
  if (orig) {
    Document.prototype.startViewTransition = function (cb) {
      const t0 = performance.now();
      const rec = { kind: null, anims: [], skeleton: false, from: null, to: null };
      window.__vt.push(rec);
      const t = orig.call(this, cb);
      t.ready.then(() => {
        rec.from = performance.now();
        rec.kind = document.documentElement.dataset.vt || "(unnamed)";
        rec.readyMs = Math.round(performance.now() - t0);
        rec.skeleton = Boolean(document.querySelector('.deck [aria-busy="true"]'));
        rec.anims = [...new Set(document.getAnimations()
          .map((a) => a.effect?.pseudoElement).filter((p) => p && p.startsWith("::view-transition")))];
      }).catch((e) => { rec.error = String(e.name || e).slice(0, 60); });
      window.__last = t.finished.catch(() => {}).then(() => { rec.to = performance.now(); });
      return t;
    };
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__ls.push({ v: e.value, src: (e.sources || []).map((s) => String(s.node?.className || s.node?.nodeName || "").split(" ")[0]).slice(0, 3) });
      }
    }).observe({ type: "layout-shift", buffered: false });
  } catch { /* not supported */ }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.duration > 50) window.__lf.push({ at: e.startTime, end: e.startTime + e.duration, ms: Math.round(e.duration) });
    }).observe({ type: "long-animation-frame", buffered: false });
  } catch { /* not supported */ }
};

const results = [];
let failures = 0;

async function main() {
  /* The seed resets the harness first, so the skin and the motion setting go
     in AFTER it. The other way round, the reset wiped them and every run was
     walked in the default skin with motion on, whatever it said it was. */
  await seedRoom(BASE).catch(() => {});
  /* A few saves, so the Bookmarks steps have folders to open. seedRoom resets
     the store, so this goes after it — the same order the room's own prefs do,
     and for the same reason. */
  await (async () => {
    try {
      const doc = await (await fetch(`${BASE}/src/content/test-content.json`)).json();
      const qs = (doc.modules.find((m) => m.id === "M1")?.chapters?.[0]?.quiz?.questions || []).slice(0, 3);
      for (const q of qs) {
        await fetch(`${BASE}/rest/v1/saves?on_conflict=user_id,kind,ref_id,page`, {
          method: "POST",
          headers: { "content-type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
          body: JSON.stringify({ id: crypto.randomUUID(), user_id: "student_one", module_id: "M1", kind: "question", ref_id: q.id, chapter: 1 }),
        });
      }
    } catch { /* the walk still runs; the Bookmarks steps will say so */ }
  })();
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": LIVERY, "pw-variant-pin": VARIANT, "pw-finish": null, "pw-reduce-motion": MOTION === "smooth-air" } }),
  });

  const browser = WEBKIT ? await webkit.launch() : await chromium.launch(GPU
    ? { channel: "chromium", args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-zero-copy"] }
    : {});
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: WIDTH <= 430 ? 844 : 900 },
    reducedMotion: MOTION === "reduce" ? "reduce" : "no-preference",
  });
  await page.addInitScript(HOOK);
  if (CPU > 1 && !WEBKIT) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  }
  page.setDefaultTimeout(6000);

  /* One step: do it, let every transition it started finish, and judge what
     was recorded. `names` are the areas that must animate on both sides. */
  const step = async (label, action, { names = [], also = [], moved = [], ran = [], cls = 0.01, none = false, settle = 0 } = {}) => {
    await page.evaluate(() => { window.__vt = []; window.__ls = []; window.__lf = []; window.__moved = []; window.__ran = []; window.__pressed = performance.now(); });
    try {
      await action();
    } catch (e) {
      /* A control that is not there is a finding, not a crash: the walk goes
         on and the step says what it could not press. */
      console.log(`FAIL  ${label.padEnd(40)} could not act: ${String(e.message).split("\n")[0].slice(0, 90)}`);
      failures += 1;
      results.push({ label, problems: ["could not act"] });
      return;
    }
    if (!none && !MOTION_OFF) {
      /* Wait for a transition to START before waiting for it to finish. A move
         whose chunk is still downloading starts late — the reader is the
         largest chunk here — and a fixed pause judged the step before it had
         begun, then blamed the next step for it. */
      await page.waitForFunction(() => window.__vt.length > 0, null, { timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(80);
    await page.evaluate(() => Promise.race([window.__last, new Promise((r) => setTimeout(r, 2500))]));
    await page.waitForTimeout(250 + settle);
    const got = await page.evaluate(() => {
      /* The long frames that overlapped the movement itself, not the ones
         spent building the next screen before its first animated frame. */
      const windows = window.__vt.filter((v) => v.from).map((v) => [v.from, v.to ?? v.from + 1000]);
      if (!windows.length && window.__moved.length) windows.push([window.__pressed, window.__pressed + 500]);
      /* A frame that STARTED before the movement and ran into it is the one in
         which the next screen was built — the page holds its old picture for
         it, and nothing moves late because of it. Counted apart. */
      const during = window.__lf.filter((f) => windows.some(([a, b]) => f.at >= a && f.at < b)).map((f) => f.ms);
      const building = window.__lf.filter((f) => windows.some(([a]) => f.at < a && f.end > a)).map((f) => f.ms);
      return { vt: window.__vt, ls: window.__ls, lf: during, build: building, moved: window.__moved, ran: window.__ran, path: location.pathname };
    });
    const problems = [];
    const anims = got.vt.flatMap((v) => v.anims);
    if (MOTION_OFF) {
      if (got.vt.length) problems.push(`a ${got.vt.map((v) => v.kind).join(",")} transition ran with motion off`);
      if (got.moved.length) problems.push(`${[...new Set(got.moved)].map((m) => "." + m).join(", ")} moved with motion off`);
      for (const r of ran) if (got.ran.includes(r)) problems.push(`${r} transitioned with motion off`);
    } else if (!none) {
      if (!got.vt.length) problems.push("no transition started");
      for (const n of names) {
        if (!anims.includes(`::view-transition-old(${n})`)) problems.push(`no old ${n}`);
        if (!anims.includes(`::view-transition-new(${n})`)) problems.push(`no new ${n}`);
      }
      for (const p of also) if (!anims.includes(p)) problems.push(`${p} did not run`);
      if (got.vt.some((v) => v.skeleton)) problems.push("photographed a skeleton");
      if (got.vt.some((v) => v.error)) problems.push(`transition ${got.vt.find((v) => v.error).error}`);
    }
    if (!MOTION_OFF) for (const m of moved) if (!got.moved.includes(m)) problems.push(`.${m} did not move`);
    if (!MOTION_OFF) for (const r of ran) if (!got.ran.includes(r)) problems.push(`${r} did not transition`);
    if (FRAMES && got.lf.length) problems.push(`long frames while moving: ${got.lf.join(", ")}ms`);
    const shift = got.ls.reduce((a, e) => a + e.v, 0);
    if (shift > cls) problems.push(`layout shift ${shift.toFixed(3)} (${[...new Set(got.ls.flatMap((e) => e.src))].join(", ")})`);
    const kinds = got.vt.map((v) => v.kind).join(",") || "—";
    const line = `${problems.length ? "FAIL" : "ok  "}  ${label.padEnd(40)} ${kinds.padEnd(12)} ${got.path}` +
      (got.lf.length ? `  long while moving ${got.lf.join(",")}ms` : "") +
      (got.build.length ? `  building ${got.build.join(",")}ms` : "") + (problems.length ? `\n        ${problems.join("; ")}` : "");
    console.log(line);
    if (problems.length) failures += 1;
    results.push({ label, problems, kinds, anims });
  };

  const click = (sel, opts) => () => page.locator(sel, opts).first().click();
  /* Each section starts from a known address, so a step that fails cannot
     strand every step after it somewhere else. The first move of every section
     is still a real click, because a click is what goes through the transition
     layer and an address bar is not. */
  const start = async (path, ready) => {
    await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}uid=student_one`, { timeout: 45000 });
    await page.locator(ready).first().waitFor({ timeout: 25000 });
    await page.waitForTimeout(900);
  };

  /* ---- Deck → Module → Library → Paper → Back → Back → Back ---- */
  await start("/", ".mod");
  /* The card the module opens out of is the heading it opens into: one name
     across the two screens, old on the deck's card and new on the heading. */
  await step("Deck → Module", click('.mod[data-code="M1"]'),
    { names: ["wg-content", "wg-mcard"], also: ["::view-transition-group(wg-mcard)"] });
  await step("Lessons → Library", click(".tabs button", { hasText: "Library" }),
    { names: ["wg-tabpanel"], also: ["::view-transition-group(wg-card)"], moved: ["tab-pill"] });
  /* The test paper is added under import.meta.env.DEV only (papersFor), so a
     production build of the harness has no paper to open and no chapter chips
     over an empty list. Those steps are skipped there, and said to be. */
  const paper = await page.locator('section[aria-labelledby="lsec-papers"] .item').count().catch(() => 0);
  if (paper) {
    await step("Library: a chapter chip", click('.fchip[aria-pressed="false"]'), { none: true, moved: ["libwrap"] });
    await step("Library: All again", click(".fchip", { hasText: "All" }), { none: true, moved: ["libwrap"] });
    await step("Library → paper", click('section[aria-labelledby="lsec-papers"] .item'), { names: ["wg-content"] });
    /* The panel's own flag, not its buttons: the buttons are in the shell's
       markup from the start, and the handler behind them is attached when the
       paper's text arrives. WebKit got there first and pressed a button
       nothing was listening to yet. */
    await page.locator(".rdr[data-panel]").waitFor({ timeout: 45000 }).catch(() => {});
    await step("Paper: Marks → Pages", click('#view [data-v="pages"]'), { none: true, moved: ["tab-pill", "body"] });
    await step("Paper: Pages → Marks", click('#view [data-v="marks"]'), { none: true, moved: ["tab-pill", "body"] });
    await step("Back → Library", () => page.goBack(), { names: ["wg-content"] });
  } else {
    console.log("skip  Library chips, the paper and its Back   no paper in this build (the test paper is DEV-only)");
  }
  await step("Back → Lessons", () => page.goBack(), { names: ["wg-tabpanel"], moved: ["tab-pill"] });
  await step("Back → Deck", () => page.goBack(),
    { names: ["wg-content", "wg-mcard"], also: ["::view-transition-group(wg-mcard)"] });

  /* ---- Deck → Ready Room → … → Deck ---- */
  await start("/", ".rrpill");
  await step("Deck → Ready Room", click(".rrpill"), { names: ["wg-content"], also: ["::view-transition-old(wg-topbar)"] });
  await page.locator(".rr .rr-row").first().waitFor({ timeout: 15000 }).catch(() => {});
  /* A DIFFERENT row each time: pressing the one already open changes nothing,
     and nothing is correctly what animates. */
  /* A NARROW ROOM TAKES TURNS: at 900px and under the rail and the pane share
     the screen one at a time, and at 1180px and under so do the list and a
     question. The walk goes back where a student would have to, and each of
     those backs is a move that has to animate too. */
  const STACK_PANE = WIDTH <= 900;
  const STACK_THREAD = WIDTH <= 1180;
  const back = (label, name) => step(label, click(".rr-backbtn:visible"), { names: [name] });
  await step("Room: another module", click(".rr-row", { hasText: "Module 2" }), { names: ["wg-pane"] });
  if (STACK_PANE) await back("Room: back to the rail", "wg-pane");
  /* Back up the rail to the module the room seed fills, so the question steps
     below have questions to move between. */
  await step("Room: back to Module 1", click(".rr-row", { hasText: "Module 1" }), { names: ["wg-pane"] });
  await page.locator(".rr-frow").first().waitFor({ timeout: 8000 }).catch(() => {});
  await step("Room: another question", () => page.locator(".rr-frow[aria-current=\"false\"] .rr-fopen").first().click(), { names: ["wg-detail"] });
  await step("Room: next question", click('button[aria-label="Next question"]'), { names: ["wg-detail"] });
  /* Fill the pane only exists where the list and a question sit side by side. */
  /* THE ONE MOVE THAT IS A LAYOUT CHANGE ON PURPOSE. The brief's fix for the
     room's biggest jump is to interpolate the grid's tracks, so the question
     column's edge travels — and the frames of that travel that land more than
     500ms after the press are counted as layout shift by the browser, which
     cannot tell a movement from a jump. The shift is not judged here; what is
     judged is that the track transitioned at all, and each step waits for the
     movement to finish so none of it is counted against the next one. */
  if (!STACK_THREAD) {
    const fill = { none: true, ran: ["rr-tbody:grid-template-columns", "rr-feed:opacity"], cls: Infinity, settle: 600 };
    await step("Room: Fill the pane", click(".rr-wide"), fill);
    await step("Room: Show the list", click(".rr-wide"), fill);
  }
  if (STACK_THREAD) await back("Room: back to the list", "wg-detail");
  await step("Room: a filter chip", click('.rr-chip[aria-pressed="false"]'), { none: true, moved: ["rr-feed"] });
  await step("Room: All again", click(".rr-chip", { hasText: "All" }), { none: true, moved: ["rr-feed"] });
  await step("Room: Ask", click(".rr-chips .rr-ask"), { names: ["wg-detail"] });
  await step("Room: Cancel", click(".rr-askform button", { hasText: "Cancel" }), { names: ["wg-detail"] });
  if (STACK_PANE) {
    await back("Room: question → list", "wg-detail");
    await back("Room: list → rail", "wg-pane");
  }
  await step("Room: Squadron", click(".rr-row", { hasText: "JT Squadron" }), { names: ["wg-pane"] });
  await step("Chat: attachment sheet opens", click(".rr-plus"), { none: true, ran: ["rr-sheetwrap:opacity"] });
  await step("Chat: attachment sheet closes", click(".rr-plus"), { none: true, ran: ["rr-sheetwrap:opacity"] });
  if (STACK_PANE) await back("Room: chat → rail", "wg-pane");
  await step("Room: Right seat", click(".rr-lnk", { hasText: "See all" }), { names: ["wg-pane"] });
  if (STACK_PANE) await back("Room: seats → rail", "wg-pane");
  await step("Room → Deck", click(".rr-home"), { names: ["wg-content"], also: ["::view-transition-new(wg-topbar)"] });

  /* ---- Module → Quiz → a question → End exam → Back to exam → Module ---- */
  await start("/m/m1", ".chead");
  await page.locator(".chead").first().click();
  await page.waitForTimeout(500);
  await step("Module → Quiz", click(".kids .item", { hasText: "quiz" }), { names: ["wg-content"], also: ["::view-transition-new(root)"] });
  await step("Quiz: next question", click(".question__foot .btn--primary"), { none: true, moved: ["question__text"] });
  /* WHAT EACH ENGINE CAN DO WITH A DIALOG. Holding a closing one on screen
     long enough to fade needs `overlay`, which Chromium alone has, and WebKit
     does not transition a ::backdrop either — so there the dialog rises in and
     both it and its dimmed backdrop cut on the way out, which is what they did
     before any of this. Each engine is asked for what it has. */
  await step("Quiz: End exam opens", click(".exam-bar .btn", { hasText: "End exam" }),
    { none: true, ran: WEBKIT ? ["exam-dialog:opacity"] : ["exam-dialog:opacity", "exam-dialog::backdrop:opacity"] });
  await step("Quiz: Back to exam closes", click(".exam-dialog .btn", { hasText: "Back to exam" }),
    { none: true, ran: WEBKIT ? [] : ["exam-dialog:opacity", "exam-dialog::backdrop:opacity"] });
  await step("Quiz → Module", click(".up"), { names: ["wg-content"], also: ["::view-transition-new(root)"] });

  /* ---- Module → Lesson → Up Next lesson → breadcrumb ---- */
  await start("/m/m1", ".chead");
  await page.locator(".chead").first().click();
  await page.waitForTimeout(500);
  await step("Module → Lesson", click(".kids .item[data-lesson]"), { names: ["wg-content"] });
  await step("Lesson: Notes → Comments", click(".ltab", { hasText: "Comments" }), { none: true, moved: ["tab-pill", "ltab-body"] });
  await step("Lesson: Comments → Notes", click(".ltab", { hasText: "Notes" }), { none: true, moved: ["tab-pill", "ltab-body"] });
  await step("Lesson → next in its list", click(".sdlist .sditem:not([aria-current])"), { names: ["wg-tabpanel", "wg-player"] });
  await step("Lesson → breadcrumb", click(".up"), { names: ["wg-content"] });

  /* ---- Avatar → Bookmarks → Licence → Preferences → Appearance ----
     Settings used to be the first stop here. It is gone: Bookmarks took its
     row in the profile menu and /settings resolves to /bookmarks. */
  await start("/", ".avbtn");
  await step("Avatar: the menu opens", click(".avbtn"), { none: true, ran: ["menu:opacity"] });
  await step("Menu → Bookmarks", click('[role="menuitem"]', { hasText: "Bookmarks" }), { names: ["wg-content"] });
  await step("Bookmarks → a folder", click(".bm-open-f"), { names: ["wg-content"] });
  await step("Folder → Bookmarks", click(".bm-back"), { names: ["wg-content"] });
  await step("Avatar: the menu opens again", click(".avbtn"), { none: true, ran: ["menu:opacity"] });
  await step("Bookmarks → Licence", click('[role="menuitem"]'), { names: ["wg-content"] });
  await step("Licence → Preferences", click('[role="tab"]', { hasText: "Preferences" }), { names: ["wg-tabpanel"], moved: ["tab-pill"] });
  await step("Preferences → Appearance", click('[role="tab"]', { hasText: "Appearance" }), { names: ["wg-tabpanel"], moved: ["tab-pill"] });

  await browser.close();
  console.log(`\n${results.length - failures} of ${results.length} steps clean (${VARIANT}, ${LIVERY}, ${WIDTH}px${MOTION ? `, ${MOTION}` : ""}${CPU > 1 ? `, ${CPU}x CPU` : ""}${GPU ? ", GPU" : ""}${WEBKIT ? ", WebKit" : ""})`);
  if (!REPORT && failures) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
