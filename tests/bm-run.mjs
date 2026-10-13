/* =============================================================================
   BOOKMARKS, ACROSS EVERY LIVERY, BOTH LIGHTINGS, THREE FINISHES, FOUR WIDTHS.
   -----------------------------------------------------------------------------
   The brief's own checks, run rather than eyeballed:

     R10 · every control does something and every screen has a way back —
           the whole walk-through list, each step checked by what it leaves on
           screen rather than by the click not throwing.
     R11 · all 6 liveries × Light/Dark × Standard/Aurora/Manual render with no
           extra CSS; body text at 4.5:1, large text at 3:1, nothing under
           13px, every target at least 44px. MEASURED — the contrast is read
           off the painted pixels through a canvas, not computed from the
           tokens, so color-mix() and translucent panels are measured as they
           actually land.
     R12 · with Smooth Air on, nothing animates and everything still works.

     RUN IT AGAINST THE PRODUCTION HARNESS. 672 states are 3,400 page loads,
     and the dev server stops answering somewhere past two thousand of them —
     it transforms every module on every load, watches the tree this walk
     writes screenshots into, and keeps the store in its own memory, so a
     restart empties it mid-run. None of that is the app. The prod harness
     serves static files:

       npm run harness:prod
       BM_BASE=http://127.0.0.1:5191 npm run test:bm

     `npm run harness` works too, for a narrowed run:
       BM_LIVERIES=sky BM_WIDTHS=1440x900 npm run test:bm

     BM_LIVERIES / BM_FINISHES / BM_WIDTHS narrow it; BM_SHOTS=all keeps every
     screenshot.
   ========================================================================= */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
/* THE SAME FILTER THE APP USES, so a state asks for what a student will
   actually be wearing. See the note on `lit` in the sweep below. */
import { lightOverride, offeredFinish } from "../src/lib/finishEngine.js";

const BASE = process.env.BM_BASE || "http://127.0.0.1:5190";
const LIVERIES = (process.env.BM_LIVERIES || "sky,amber,tarmac,beacon,runway,skydrol").split(",");
const VARIANTS = ["night", "day"];
const FINISHES = (process.env.BM_FINISHES || "standard,aurora,manual").split(",");
const WIDTHS = (process.env.BM_WIDTHS || "1440x900,1180x820,820x1180,390x844")
  .split(",").map((s) => s.split("x").map(Number));
const SHOTS = "tests/screens/bm";
const ALL_SHOTS = process.env.BM_SHOTS === "all";
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch|Download the React DevTools/;

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}  (${problems.length} problems)`);
  const kinds = new Map();
  for (const p of problems) {
    const kind = p.replace(/^[^:]*: /, "").replace(/[\d.]+px/g, "Npx").replace(/[\d.]+:1/g, "N:1");
    if (!kinds.has(kind)) kinds.set(kind, { count: 0, first: p });
    kinds.get(kind).count += 1;
  }
  for (const [kind, { count, first }] of kinds) console.log(`        ${count} × ${kind}\n            e.g. ${first}`);
};

const setSkin = (patch) => fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ uid: "student_one", patch }),
});

/* WHAT THIS COURSE CAN FILL, ASKED RATHER THAN ASSUMED.
   ---------------------------------------------------------------------------
   This seed used to name its own content: five question ids out of M1's first
   chapter, four cards out of its second, two videos, two pages, and two more
   questions out of M2's THIRD chapter — fifteen rows, asserted as fifteen.
   Every one of those five numbers was a fact about a course that has since
   been replaced three times, and on 2026-10-13 the walk could not get past
   its own first assertion: M2 has no chapters at all any more, so it built
   thirteen rows and threw.

   Raising the number to thirteen would have been the wrong fix twice over.
   The count was never the point, and three deeper facts had changed with it:

     · NO MODULE HAS ANY LESSONS. A video row whose lesson id is unknown is
       not merely unshown — `content.lesson` answers null, and only null
       prunes, so Bookmarks DELETES it from the server. Measured: eleven rows
       seeded, ten survived, the video gone.
     · PAPERS ARE OFF for launch, so `KINDS` drops 'page' and the app offers
       THREE folders, not four. The walk asserted four and clicked a "Pages"
       folder that is not rendered.
     · ONLY ONE MODULE HAS CONTENT, so there is nothing to file under a second
       one and the module filter cannot be exercised with real ids.

   So the fixture is derived, the way test:exam's was after it broke the same
   way: the module is the first one with a quiz, the cards come from the first
   chapter that has any, the second module is whichever other one has a quiz
   if any does, and a video row is seeded only if the document really contains
   a lesson. What cannot be filled is NAMED in the output rather than being
   quietly asserted against. Add lessons back, or turn papers on, and those
   folders come under test again with no edit here. */
const DOC = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url), "utf8"));

const chaptersWith = (m, pred) => (m.chapters || [])
  .map((c, n) => ({ c, n })).filter(({ c }) => pred(c));
const hasQuiz = (c) => (c.quiz?.questions || []).length > 0;

const FIX = (() => {
  const mods = DOC?.modules || [];
  const quizMods = mods.filter((m) => chaptersWith(m, hasQuiz).length > 0);
  const mod = quizMods[0];
  if (!mod) throw new Error("the course document has no module with a quiz — the content did not load");
  const qCh = chaptersWith(mod, hasQuiz)[0];
  const cardCh = chaptersWith(mod, (c) => (c.cards || []).length > 0)[0]
    || chaptersWith(mod, hasQuiz)[1] || qCh;
  const other = quizMods.find((m) => m.id !== mod.id) || null;
  const otherCh = other ? chaptersWith(other, hasQuiz)[0] : null;
  let lesson = null;
  for (const m of mods) {
    for (const [n, c] of (m.chapters || []).entries()) {
      const l = (c.lessons || [])[0];
      if (l && !lesson) lesson = { id: l.id, chapter: n + 1, moduleId: m.id };
    }
  }
  /* A CHAPTER THE SEED DOES NOT TOUCH, for the tests that need a question
     starting UNSAVED — pressing the bookmark on a seeded one would be testing
     a remove. This was the literal `M1.03`, a chapter id that stopped existing
     two content replacements ago. */
  const quizChs = chaptersWith(mod, hasQuiz);
  const freeCh = quizChs.find((x) => x.n !== qCh.n && x.n !== cardCh.n) || quizChs.at(-1);
  return { mod, qCh, cardCh, other, otherCh, lesson, freeCh };
})();

const MOD = FIX.mod.id;
/* Which folders the APP offers, and which the seed could fill. Both are set
   once, after seeding, by asking the running app rather than re-deriving a
   flag here — so a walk and the screen it walks cannot disagree. */
let OFFERED = [];
let FILLED = new Set();

/* A filled account, written over the same wire the app writes over, with
   something in every folder this course is capable of filling. */
async function seedSaves() {
  await fetch(`${BASE}/rest/v1/saves?user_id=eq.student_one`, { method: "DELETE" });
  const ids = (x) => (x ? (x.c.quiz?.questions || []).map((q) => q.id) : []);
  const cardIds = (x) => (x ? (x.c.cards || []).map((c) => c.id) : []);
  const stamp = (i) => new Date(Date.now() - i * 1000).toISOString();

  const rows = [
    ...ids(FIX.qCh).slice(0, 5).map((id, i) => ({
      module_id: MOD, kind: "question", ref_id: id, chapter: FIX.qCh.n + 1, created_at: stamp(i) })),
    /* Cards come from the chapter's OWN card set when it has one, and from its
       quiz otherwise, which is the same fallback `content.cardSet()` makes. */
    ...(cardIds(FIX.cardCh).length ? cardIds(FIX.cardCh) : ids(FIX.cardCh)).slice(0, 4).map((id, i) => ({
      module_id: MOD, kind: "card", ref_id: id, chapter: FIX.cardCh.n + 1, created_at: stamp(i) })),
    /* A page row is written whether or not papers are on: the row survives
       either way (it is filtered in the UI, not pruned), so seeding it keeps
       the Pages folder under test the moment the flag turns on. */
    { module_id: MOD, kind: "page", ref_id: `${MOD}.DEV`, chapter: null, page: 7 },
    { module_id: MOD, kind: "page", ref_id: `${MOD}.DEV`, chapter: null, page: 11 },
  ];
  if (FIX.lesson) {
    rows.push({ module_id: FIX.lesson.moduleId, kind: "video",
                ref_id: FIX.lesson.id, chapter: FIX.lesson.chapter, at_seconds: 372 });
  }
  /* A question id identifies the question, not the module — `saves_one_per_thing`
     is (user_id, kind, ref_id, page) — so a second module's rows have to carry
     that module's OWN question ids. Filing the first module's ids under the
     second made that chapter's paper show every bookmark already pressed. */
  if (FIX.otherCh) {
    rows.push(...ids(FIX.otherCh).slice(0, 2).map((id) => ({
      module_id: FIX.other.id, kind: "question", ref_id: id, chapter: FIX.otherCh.n + 1 })));
  }

  for (const r of rows) {
    await fetch(`${BASE}/rest/v1/saves?on_conflict=user_id,kind,ref_id,page`, {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({ id: crypto.randomUUID(), user_id: "student_one", ...r }),
    });
  }

  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  /* How many of them are THIS module's, which is what the flight bag counts —
     it is "this module's saves" and nothing else. Page rows are in the number
     only when the app shows that folder, and a video only when the lesson is
     real enough to survive pruning. */
  const mine = rows.filter((r) => r.module_id === MOD && r.kind !== "page"
    && (r.kind !== "video" || Boolean(FIX.lesson)));
  const minePages = rows.filter((r) => r.module_id === MOD && r.kind === "page").length;
  if (!byKind.question || !byKind.card) {
    throw new Error(`the seed built ${JSON.stringify(byKind)} — the content did not load`);
  }
  return { rows: rows.length, byKind, mine: mine.length, minePages };
}

/* WHICH FOLDERS THE APP OFFERS. Read off the home screen once, because the
   app filters `KINDS` by the papers flag and a second copy of that rule here
   is a second thing to go stale. Also records which of them the seed actually
   filled, by reading the count the folder itself prints. */
async function readFolders(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
  await page.locator(".bm-folders .bm-folder").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);        // content load, then pruning
  const names = (await page.locator(".bm-fname").allTextContents())
    .map((s) => s.replace(/\d+$/, "").trim());
  const plays = await page.locator(".bm-fplay").count();
  const filled = [];
  for (const n of names) {
    const c = await page.locator(".bm-folder", { hasText: n }).locator(".bm-count").first().textContent().catch(() => "");
    if ((c || "").trim()) filled.push(n);
  }
  await ctx.close();
  return { names, filled, plays };
}

const SLUG = { Questions: "questions", "Study cards": "cards", Videos: "videos", Pages: "pages" };

/* The audit reports its numbers on a #measure line; everywhere but the skin
   sweep, which files them, those are not problems. */
const only = (lines) => lines.filter((l) => !l.startsWith("#measure"));

/* ---------------------------------------------------------------- the audit
   What must hold on every Bookmarks surface, in every skin and at every width. */
const audit = (page, expect) => page.evaluate((expect) => {
  const out = [];
  const shown = (el) => !!el && getComputedStyle(el).display !== "none"
    && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0;

  /* THE PAINTED COLOUR, not the declared one. The canvas resolves whatever the
     engine computed — oklch, color-mix, color(srgb …) — to the bytes it will
     actually draw, which is the only number worth measuring. */
  const cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (css) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000"; cx.fillStyle = css;
    const m = /^rgba?\(([^)]+)\)$/.exec(cx.fillStyle) || null;
    if (m) { const p = m[1].split(",").map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const overlay = (fg, bg) => fg.slice(0, 3).map((v, i) => bg[i] + (v - bg[i]) * fg[3]);
  /* What the words are painted ON. The element's OWN background first — a
     filled button carries the accent itself, and measuring only its ancestors
     read --ground text against the --ground page and called every primary
     button 1.00:1 — then every ancestor that paints, composited down to the
     page ground: a panel at 0.8 alpha over a raised block over the ground. */
  const behind = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0.004) { stack.push(c); if (c[3] >= 0.999) break; }
    }
    const ground = rgba(getComputedStyle(document.querySelector(".app") || document.body).backgroundColor);
    let base = ground[3] >= 0.999 ? ground.slice(0, 3)
      : ((expect.lit ?? expect.variant) === "day" ? [255, 255, 255] : [12, 14, 20]);
    for (const c of stack.reverse()) base = overlay(c, base);
    return base;
  };
  /* A background IMAGE cannot be read out of the cascade — the video cover's
     tile is a gradient, and compositing text against the transparent colour
     behind it would produce a number that is not what anybody sees. Those are
     counted and reported rather than measured, so a gradient can never hide a
     contrast failure by silently passing. */
  const hits = (a, b) => {
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    return p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
  };
  const painted = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (getComputedStyle(n).backgroundImage !== "none") return true;
      /* A tile drawn UNDER this one rather than behind it: the video cover's
         caption is a sibling of its artwork, not a child, so walking parents
         alone measured white type against the cover's own background and
         called it 1.06:1. */
      for (const sib of n.parentElement?.children || []) {
        if (sib !== n && getComputedStyle(sib).backgroundImage !== "none" && hits(sib, el)) return true;
      }
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] >= 0.999) return false;
    }
    return false;
  };
  const contrast = (el) => {
    const fg = rgba(getComputedStyle(el).color);
    const bg = behind(el);
    const on = overlay(fg, bg);
    const a = lum(on), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  const doc = document.scrollingElement;
  if (doc.scrollWidth > innerWidth + 1) out.push(`the page scrolls sideways by ${doc.scrollWidth - innerWidth}px`);

  const root = document.querySelector(".bm.bm-page") || document.querySelector(".bm-bagcell");
  if (!root) return ["nothing from Bookmarks rendered"];

  /* A FINISH CAN FORCE THE LIGHTING, AND AN UNOFFERED ONE CANNOT. This read
     `expect.finish !== "aurora"` — the rule that Aurora has no Day, which
     App.jsx still honours for a finish it still offers. Aurora is withdrawn,
     so `offeredFinish` reads it back as Standard and Day is obeyed; naming
     the finish here failed 120 states for the app doing exactly that. The
     caller computes the lighting with the app's own `lightOverride` and
     `offeredFinish` and passes it in, so this stays right whichever finishes
     are offered. */
  const day = Boolean(document.querySelector(".app")?.classList.contains("theme-light"));
  const wantDay = (expect.lit ?? expect.variant) === "day";
  if (day !== wantDay) out.push(`the app is ${day ? "day" : "night"}, not ${wantDay ? "day" : "night"}`);

  /* R11 · the tokens the stylesheet maps onto must all resolve. An unmapped one
     silently falls back to the pack's own guess, which is a fixed colour in
     every livery — the exact failure the mapping exists to prevent. */
  const cs = getComputedStyle(root);
  for (const t of ["--bm-accent", "--bm-fill", "--bm-on-accent", "--bm-miss", "--bm-sheet", "--bm-wall", "--bm-mono", "--bm-topbar"]) {
    if (!cs.getPropertyValue(t).trim()) out.push(`${t} is not set`);
  }

  /* Nothing runs off the side, and nothing that CAN scroll does. On a box with
     overflow:visible, scrollWidth counts children that hang outside without
     scrolling anything — the card pad's arrows sit either side of it by
     design — so only a box that would actually scroll is asked. */
  for (const sel of [".bm-folders", ".bm-list", ".bm-vgrid", ".bm-pad", ".bm-sheet", ".bm-head", ".bm-lib-section"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el) || getComputedStyle(el).overflowX === "visible") continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${sel} scrolls sideways by ${el.scrollWidth - el.clientWidth}px`);
    }
  }
  for (const el of root.querySelectorAll(".bm-folder, .bm-row, .bm-vcard, .bm-btn, .bm-pill, .bm-lrow, .bm-pc")) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1) { out.push(`.${el.classList[0]} runs off the side of the screen`); break; }
  }

  /* §12 — every control at least 44px on its shortest side, and no text under
     13px. Both are the app's own floors, and the pack was drawn against a
     different one. The pad's arrows are excused nothing: they are buttons. */
  for (const el of root.querySelectorAll("button, a[href]")) {
    if (!shown(el)) continue;
    /* A control held at opacity 0 until its card is hovered is not a control
       yet — the folder's play button rests at scale(.85) and 0 opacity on a
       pointer device, which measures 39px while it cannot be pressed. It is
       checked at the size it is REVEALED at, further down. */
    if (Number(getComputedStyle(el).opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 43.5) {
      out.push(`${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 24) || el.className} is ${Math.round(Math.min(r.width, r.height))}px on its shortest side`);
      break;
    }
  }
  for (const el of root.querySelectorAll("*")) {
    if (!el.childNodes.length || !shown(el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12.5) { out.push(`"${el.textContent.trim().slice(0, 24)}" is ${size}px`); break; }
  }

  /* R11 · contrast, on the surface the words are actually painted on. */
  const LARGE = (el) => {
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    return px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
  };
  const worst = { body: [99, ""], large: [99, ""] };
  let overArt = 0;
  for (const el of root.querySelectorAll("h1, h2, p, span, b, div, button, a, li, summary")) {
    if (!shown(el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (painted(el)) { overArt += 1; continue; }
    const c = contrast(el);
    const band = LARGE(el) ? "large" : "body";
    if (c < worst[band][0]) worst[band] = [c, el.textContent.trim().slice(0, 30)];
  }
  if (worst.body[0] < 4.5) out.push(`body text "${worst.body[1]}" is ${worst.body[0].toFixed(2)}:1, under 4.5`);
  if (worst.large[0] < 3) out.push(`large text "${worst.large[1]}" is ${worst.large[0].toFixed(2)}:1, under 3`);
  /* THE NUMBERS ARE REPORTED WHETHER OR NOT THEY FAIL. "Measure. Don't eyeball
     it… Record the numbers" — a check that only speaks when it fails leaves
     nobody able to say how much headroom there was. Carried out as a line the
     runner picks off rather than as a property, because a property set on an
     array does not survive page.evaluate. */
  out.push(`#measure body=${worst.body[0].toFixed(2)} large=${worst.large[0].toFixed(2)} art=${overArt}`);

  /* R2 of the home screen: the folders FILL it. Four across on a desktop and a
     landscape tablet, 2×2 on a portrait tablet and a phone, and the grid
     reaching the bottom of the screen either way. */
  if (expect.view === "home" && expect.filled) {
    const grid = document.querySelector(".bm-folders");
    if (!grid) out.push("the folders did not render");
    else {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const want = innerWidth >= 1024 ? 4 : 2;
      if (cols !== want) out.push(`the folders are ${cols} across at ${innerWidth}px, not ${want}`);
      const gap = innerHeight - grid.getBoundingClientRect().bottom;
      if (gap > 140) out.push(`the folders stop ${Math.round(gap)}px short of the bottom of the screen`);
      /* AND DO NOT RUN PAST IT. "Fill the screen" cuts both ways: sized 34px
         taller than the room it had, the grid pushed every folder's NAME below
         the fold, and a folder you cannot read the name of is not a folder. */
      if (gap < -1) out.push(`the folders run ${Math.round(-gap)}px past the bottom of the screen`);
      for (const n of document.querySelectorAll(".bm-fname")) {
        const r = n.getBoundingClientRect();
        if (r.bottom > innerHeight + 1) { out.push(`a folder's name is ${Math.round(r.bottom - innerHeight)}px below the fold`); break; }
      }
      /* And the app's own fixed report pill does not sit on any of it. */
      const rpt = document.querySelector(".rpt");
      if (rpt && getComputedStyle(rpt).display !== "none") {
        const p = rpt.getBoundingClientRect();
        for (const el of document.querySelectorAll(".bm-fname, .bm-fplay, .bm-open-f")) {
          const r = el.getBoundingClientRect();
          if (p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top) {
            out.push(`the report pill covers .${el.classList[0]}`);
            break;
          }
        }
      }
    }
  }

  /* The play button, at the size it is actually pressed at. It hides itself on
     a pointer device until its folder is hovered or it takes focus, so it is
     measured with that state forced rather than at rest. */
  for (const el of document.querySelectorAll(".bm-fplay")) {
    if (!el.isConnected) continue;
    const was = el.style.cssText;
    /* The transition has to go first. Setting transform:none STARTS a 250ms
       transition from scale(.85), and the computed value read in the same tick
       is still 0.85 — so this measured the button mid-reveal and called a 46px
       control 39px. */
    el.style.transition = "none";
    el.style.opacity = "1"; el.style.transform = "none";
    void el.offsetWidth;
    const r = el.getBoundingClientRect();
    el.style.cssText = was;
    if (Math.min(r.width, r.height) < 43.5) {
      out.push(`the folder play button is ${Math.round(Math.min(r.width, r.height))}px once revealed`);
      break;
    }
  }

  /* R16 · A SURFACE THAT COVERS SOMETHING IS OPAQUE. --panel is .78 alpha here
     and --raised is .87, so a background set straight from either lets whatever
     is behind it read through — the card under the card, the sheet under the
     sheet. The fix paints --ground first and the panel colour over it, so the
     colour still comes from the tokens; this is what proves it landed. */
  for (const sel of [".bm-face", ".bm-list", ".bm-sheet", ".bm-switch-list", ".bm-slides"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el)) continue;
      const a = rgba(getComputedStyle(el).backgroundColor)[3];
      if (a < 0.999) { out.push(`${sel} is ${a.toFixed(2)} opaque, so what is behind it reads through`); break; }
    }
  }
  /* The bag's front wall cannot be layered that way — an SVG fill is one
     colour — so it carries a ground-coloured copy of its own path beneath it. */
  if (document.querySelector(".bm-bag.is-full") && !document.querySelector(".bm-bag .bg-frontbase")) {
    out.push("the flight bag's front wall has nothing solid under it");
  }

  /* R12 · Smooth Air means NO motion, not less. */
  if (expect.calm) {
    const moving = [];
    for (const el of document.querySelectorAll(".bm, .bm *")) {
      const s = getComputedStyle(el);
      const dur = (v) => Math.max(0, ...String(v).split(",").map((x) => (parseFloat(x) || 0) * (/ms/.test(x) ? 1 : 1000)));
      if (s.animationName !== "none" && dur(s.animationDuration) > 10) moving.push(`${el.className} animates ${s.animationName}`);
      if (moving.length) break;
    }
    for (const m of moving) out.push(m);
    if (document.querySelector(".bm-page") && !document.querySelector(".bm-page.is-calm")) out.push("the page is not marked calm");
  }
  return out;
}, expect);


const browser = await chromium.launch();
const problems = [];
const measured = [];
const errors = [];
let states = 0;
try {
  const SEED = await seedSaves();
  const folders = await readFolders(browser);
  OFFERED = folders.names;
  FILLED = new Set(folders.filled);
  console.log(`seeded ${SEED.rows} saves — ${Object.entries(SEED.byKind).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  console.log(`  folders offered: ${OFFERED.join(", ")}`);
  console.log(`  folders filled : ${[...FILLED].join(", ") || "none"}`);
  /* SAY WHAT COULD NOT BE TESTED, rather than asserting against it. */
  for (const n of OFFERED.filter((x) => !FILLED.has(x))) {
    const why = n === "Videos" ? "the course document contains no lessons, so a video row is pruned"
      : n === "Pages" ? "no page row survived"
      : "the course document has nothing of that kind";
    console.log(`  NOT COVERED  the ${n} folder is empty — ${why}`);
  }
  if (!OFFERED.includes("Pages")) {
    console.log("  NOT COVERED  the Pages folder is not offered — paper.viewer is off for launch");
  }
  if (!FIX.otherCh) {
    console.log(`  NOT COVERED  the module filter has one module with content (${MOD}) — nothing to file under a second`);
  }
  /* The count the app itself keeps: every seeded row, less the kinds it does
     not show (pages while papers are off) and the kinds it pruned (a video
     whose lesson the document does not have). */
  const countedTotal = (SEED.byKind.question || 0) + (SEED.byKind.card || 0)
    + (FIX.lesson ? (SEED.byKind.video || 0) : 0)
    + (OFFERED.includes("Pages") ? (SEED.byKind.page || 0) : 0);
  /* What the flight bag shows: this module's saves, pages among them only
     when the app offers that folder. */
  const bagCount = SEED.mine + (OFFERED.includes("Pages") ? SEED.minePages : 0);
  mkdirSync(SHOTS, { recursive: true });

  /* ------------------------------------------------- every skin, every width */
  for (const variant of VARIANTS) {
    for (const livery of LIVERIES) {
      for (const finish of FINISHES) {
        /* RESEEDED PER SKIN, not once at the top. The harness store lives in
           the dev server's memory, and a server that restarts mid-run — it
           watches the tree this walk writes its screenshots into — comes back
           with an empty one. A whole skin then failed on "no rows", which
           reads as a bug in the folder rather than as the floor moving. */
        await seedSaves();
        /* WHAT THE STUDENT WILL ACTUALLY BE WEARING, which is not what was
           asked for. Aurora IS a night sky and `lightOverride` still says so,
           but Aurora is NOT OFFERED (owner, 2026-10-04: "remove aurora") and
           App runs the stored finish through `offeredFinish` before anything
           paints — so a state asking for Aurora wears Standard, and Standard
           in Day is DAY. Asserting Aurora's forced night therefore failed 120
           states on a screen obeying its own rule, which is the same stale
           ask `test:exam` was carrying until 2026-10-10.

           Running the ask through the app's own filter is what keeps this
           honest, and it is why Aurora stays in FINISHES rather than being
           deleted: offering it again is one line in finishEngine.js, and
           these states start measuring the real sky with no edit here. */
        const lit = lightOverride(offeredFinish(finish)) ? "night" : variant;
        await setSkin({ "pw-livery": livery, "pw-variant-pin": variant, "pw-finish": finish });
        for (const [width, height] of WIDTHS) {
          /* A phone has no hover, and the folder's play button keys off that:
             `@media (hover:hover)` hides it until the card is pointed at, so on
             a real phone it is simply always there. Testing a phone width with
             a mouse would check a state no student is ever in. */
          const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 430 });
          /* THE HARNESS IS A DEV SERVER, and `load` waits for every module in
             the graph. After an edit Vite re-optimises its dependencies, and a
             navigation that lands in that window sat for the full 30s while the
             page was on screen and working. `domcontentloaded` plus the walk's
             own locator is the honest readiness signal: it waits for the thing
             it is about to press, not for the last byte of the module graph. */
          page.setDefaultNavigationTimeout(45000);
          const goto = page.goto.bind(page);
          page.goto = (url, opts) => goto(url, { waitUntil: "domcontentloaded", ...opts });
          page.on("pageerror", (e) => errors.push(`${variant} ${livery} ${finish} ${width}: ${String(e).slice(0, 160)}`));
          page.on("console", (m) => {
            if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`${variant} ${livery} ${finish} ${width}: ${m.text().slice(0, 160)}`);
          });
          const tag = `${variant} ${livery} ${finish} ${width}`;
          /* A locator that never arrives is a PROBLEM, reported with the state
             it happened in, rather than an exception that throws away the 600
             states after it. */
          const ready = async (sel, view) => {
            try { await page.locator(sel).first().waitFor({ timeout: 15000 }); return true; }
            catch { problems.push(`${tag} ${view}: ${sel} never arrived`); return false; }
          };
          const check = async (view, extra = {}) => {
            states += 1;
            /* AT REST, NOT MID-ENTRY. The page arrives on a 420ms grow, and a
               back link measured 1px into it is 43px rather than 44 — a
               failure of the stopwatch, not of the layout. */
            await page.waitForTimeout(160);
            await page.evaluate(() => Promise.all(document.getAnimations()
              .filter((a) => a.playState === "running" && a.effect?.getTiming?.().iterations !== Infinity)
              .map((a) => a.finished.catch(() => {}))));
            await page.waitForTimeout(80);
            for (const p of await audit(page, { variant, finish, lit, view, ...extra })) {
              if (p.startsWith("#measure")) { measured.push({ tag, view, line: p }); continue; }
              problems.push(`${tag} ${view}: ${p}`);
            }
            if (ALL_SHOTS || (livery === "sky" && finish === "standard" && (width === 1440 || width === 390))) {
              await page.screenshot({ path: `${SHOTS}/${variant}-${livery}-${finish}-${width}-${view}.png` });
            }
          };

          await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
          if (!(await ready(".bm-folders .bm-folder", "home"))) { await page.close(); continue; }
          await check("home", { filled: true });

          await page.goto(`${BASE}/bookmarks/questions?uid=student_one&m=${MOD}`);
          if (!(await ready(".bm-list .bm-row", "questions"))) { await page.close(); continue; }
          await check("questions");

          /* The videos grid is measured only when there is a card in it. With a
             course that has no lessons the folder is legitimately EMPTY, and
             the empty state is the screen a student actually meets — so that
             is what gets measured instead. It is also where the contrast bug
             this walk found on 2026-10-13 lived: `.bm-eg-cta` took the accent
             as a MARK and came in at 3.96:1 in Day. */
          await page.goto(`${BASE}/bookmarks/videos?uid=student_one&m=${MOD}`);
          if (FILLED.has("Videos")) {
            if (!(await ready(".bm-vgrid .bm-vcard", "videos"))) { await page.close(); continue; }
            await check("videos");
          } else {
            if (!(await ready(".bm-empty", "videos-empty"))) { await page.close(); continue; }
            await check("videos-empty");
          }

          /* BOOKMARKS' OWN CARD PAD, not the module's card set page. This
             measured /m/m1/library/cards/1, which shared `StudyPad` with
             Bookmarks until `library.batches` was turned on for everybody on
             2026-10-10 — that route is `CardSession` now, `.bm-pad` never
             arrives on it, and CardSession has its own 133-assertion suite
             (`test:cards`) that does not want it measured twice. The pad
             itself is unchanged and still Bookmarks', at its own address. */
          await page.goto(`${BASE}/bookmarks/cards?uid=student_one&m=${MOD}`);
          if (!(await ready(".bm-pad .bm-pc", "cards"))) { await page.close(); continue; }
          await check("cards");

          /* THE MANUAL FINISH DRAWS THE STRIP RATHER THAN LIGHTING IT, so the
             bag on that finish is PaperStrip's own ink drawing with the count
             inside it, not the instrument. Both read the same number from the
             same store, and this is where that is checked. */
          await page.goto(`${BASE}/?uid=student_one`);
          if (finish === "manual") {
            await page.locator(".deck .strip .cel").first().waitFor({ timeout: 15000 });
            const drawn = (await page.locator(".deck .strip svg text").allTextContents()).join(" ");
            /* THE NUMBER IS THE SEED'S, NOT THIRTEEN. This matched `\b13\b`,
               which was the old fifteen-row seed's module count; the strip was
               correctly drawing 9 and the walk called it wrong in 48 states. */
            if (!new RegExp(`\\b${bagCount}\\b`).test(drawn)) {
              problems.push(`${tag} bag: the drawn Manual bag does not show ${bagCount} (${drawn.trim()})`);
            }
          } else {
            await page.locator(".bm-bagcell .bm-bag.is-full").waitFor({ timeout: 15000 });
            await check("bag");
          }

          await page.close();
        }
      }
    }
  }
  report(`every skin lays out and measures cleanly (${states} states)`, problems);
  /* What the contrast actually came in at, across the lot. */
  {
    const num = (m, k) => Number(new RegExp(`${k}=([\\d.]+)`).exec(m.line)?.[1] ?? 99);
    const worstBody = measured.reduce((a, m) => (num(m, "body") < num(a, "body") ? m : a), measured[0]);
    const worstLarge = measured.reduce((a, m) => (num(m, "large") < num(a, "large") ? m : a), measured[0]);
    const art = measured.reduce((n, m) => n + num(m, "art"), 0);
    if (worstBody) {
      console.log(`      contrast · worst body text ${num(worstBody, "body").toFixed(2)}:1 of 4.5  (${worstBody.tag} ${worstBody.view})`);
      console.log(`      contrast · worst large text ${num(worstLarge, "large").toFixed(2)}:1 of 3  (${worstLarge.tag} ${worstLarge.view})`);
      console.log(`      contrast · ${art} labels sit on artwork and are not measured this way (the video tile)`);
    }
  }

  /* ------------------------------------------------------------ R10 · the walk
     Every control on the brief's list, on a desktop and again on a phone. */
  await setSkin({ "pw-livery": "sky", "pw-variant-pin": "night", "pw-finish": "standard" });
  const acts = [];
  const expect = (name, cond, detail = "") => { if (!cond) acts.push(`${name}${detail ? ` — ${detail}` : ""}`); };

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await seedSaves();
    const w = width === 390 ? "phone" : "desktop";
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultNavigationTimeout(45000);
    { const g = page.goto.bind(page); page.goto = (u, o) => g(u, { waitUntil: "domcontentloaded", ...o }); }
    page.on("pageerror", (e) => errors.push(`walk ${w}: ${String(e).slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`walk ${w}: ${m.text().slice(0, 160)}`); });
    const settle = (ms = 350) => page.waitForTimeout(ms);
    const at = () => new URL(page.url()).pathname + new URL(page.url()).search;
    /* THE READER IS THE LARGEST CHUNK THIS APP HAS. go() warms it before it
       transitions, so a cold first open is a fetch, not a frame — a fixed wait
       raced it and failed once in 672 states. Waited for rather than slept
       through. */
    const lands = async (re, ms = 12000) => {
      try { await page.waitForURL((u) => re.test(u.pathname + u.search), { timeout: ms }); } catch { /* reported by the caller */ }
      return re.test(at());
    };

    /* --- the two doors in --- */
    await page.goto(`${BASE}/?uid=student_one`);
    await page.locator(".bm-bagcell").waitFor({ timeout: 15000 });
    await page.locator(".bm-bagcell").click();
    expect(`${w}: the flight bag opens Bookmarks on the hero's module`, await lands(/^\/bookmarks\?m=M1/), at());

    await page.goto(`${BASE}/?uid=student_one`);
    await page.locator(".avbtn").click();
    await settle(200);
    expect(`${w}: the profile menu offers Bookmarks with a count`,
      (await page.locator('[role="menuitem"]', { hasText: "Bookmarks" }).count()) === 1
      && (await page.locator(".menu .mcount").first().textContent()).trim() === String(countedTotal));
    expect(`${w}: and Settings has gone from it`, (await page.locator('[role="menuitem"]', { hasText: "Settings" }).count()) === 0);
    await page.locator('[role="menuitem"]', { hasText: "Bookmarks" }).click();
    expect(`${w}: the menu row opens Bookmarks`, await lands(/^\/bookmarks/), at());

    /* --- the back link --- */
    await page.locator(".bm-back").click();
    expect(`${w}: the back link returns to the Flight Deck`, await lands(/^\/$/), at());

    /* --- the module picker --- */
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-switch-btn").waitFor({ timeout: 15000 });
    await page.locator(".bm-switch-btn").click();
    await settle(200);
    expect(`${w}: the module picker opens`, await page.locator(".bm-switch-list").isVisible());
    await page.keyboard.press("Escape");
    await settle(150);
    expect(`${w}: Esc closes it`, (await page.locator(".bm-switch-list").count()) === 0);
    await page.locator(".bm-switch-btn").click();
    await settle(150);
    await page.mouse.click(5, height - 5);
    await settle(150);
    expect(`${w}: a tap outside closes it`, (await page.locator(".bm-switch-list").count()) === 0);
    await page.locator(".bm-switch-btn").click();
    await settle(150);
    await page.locator(".bm-opt", { hasText: "Module 13e" }).click();
    const switched = await lands(/m=M2/);
    await settle(250);
    expect(`${w}: picking a module switches to it`, switched && (await page.locator(".bm-switch-btn").textContent()).includes("Module 13e"), at());

    /* --- each folder opens, and each play button does its own thing --- */
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-folders .bm-folder").first().waitFor({ timeout: 15000 });
    /* EVERY FOLDER THE APP OFFERS, which is three while papers are off and
       four when they are on. The literal four was the assertion that clicked
       a Pages folder `KINDS` does not render. */
    expect(`${w}: every folder the app offers is on the home screen`,
      (await page.locator(".bm-folder").count()) === OFFERED.length, `${OFFERED.length} offered`);
    for (const name of OFFERED) {
      const slug = SLUG[name];
      await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
      await page.locator(".bm-folders .bm-folder").first().waitFor({ timeout: 15000 });
      await page.locator(".bm-open-f", { hasText: name }).click();
      expect(`${w}: the ${name} folder opens its list`, await lands(new RegExp(`^/bookmarks/${slug}\\?m=${MOD}$`)), at());
      expect(`${w}: and offers a way back to Bookmarks`, (await page.locator(".bm-back").count()) === 1);
    }

    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-fplay").first().waitFor({ timeout: 15000 });
    expect(`${w}: every filled folder has a play button, and only those`,
      (await page.locator(".bm-fplay").count()) === FILLED.size, `${FILLED.size} filled`);
    await page.locator('.bm-fplay[aria-label="Practise these"]').click();
    await settle();
    expect(`${w}: Questions plays into the practice sheet`, await page.locator(".bm-sheet").first().isVisible());
    await page.keyboard.press("Escape");
    await settle(250);
    expect(`${w}: Esc closes the practice sheet`, (await page.locator(".bm-scrim").count()) === 0);
    await page.locator('.bm-fplay[aria-label="Test yourself"]').click();
    await settle();
    expect(`${w}: Study cards plays into the test pile`, await page.locator(".bm-deck .bm-pile").first().isVisible());
    await page.keyboard.press("Escape");
    await settle(250);
    expect(`${w}: Esc closes the test pile`, (await page.locator(".bm-scrim").count()) === 0);
    /* A play button belongs to a FILLED folder, so these two run only when
       there is something to resume or open. The lesson address is built from
       the fixture's own lesson rather than matched against `M1.0\d`, which
       was a chapter-id shape that stopped existing on 2026-10-08. */
    if (FILLED.has("Videos") && FIX.lesson) {
      await page.locator('.bm-fplay[aria-label="Resume"]').click();
      expect(`${w}: Videos resumes a part-watched lesson at the second it was saved at`,
        await lands(new RegExp(`/lesson/${FIX.lesson.id.replace(/\./g, "\\.")}\\?t=372$`)), at());
      await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
      await page.locator(".bm-fplay").first().waitFor({ timeout: 15000 });
    }
    if (FILLED.has("Pages")) {
      await page.locator('.bm-fplay[aria-label="Open newest page"]').click();
      expect(`${w}: Pages opens the newest page in the reader`,
        await lands(new RegExp(`/paper/${MOD}\\.DEV\\?page=`)), at());
    }

    /* --- the questions list --- */
    await page.goto(`${BASE}/bookmarks/questions?uid=student_one&m=${MOD}`);
    await page.locator(".bm-row").first().waitFor({ timeout: 15000 });
    const before = await page.locator(".bm-row").count();
    await page.locator(".bm-q-toggle").first().click();
    await settle(250);
    expect(`${w}: a question row expands to show its answer`,
      await page.locator(".bm-row.is-open .bm-o.is-right").first().isVisible());
    await page.locator(".bm-row").first().locator(".bm-save").click();
    await settle(400);
    expect(`${w}: unsaving takes the row off the list`, (await page.locator(".bm-row").count()) === before - 1);
    expect(`${w}: and offers Undo`, await page.locator(".bm-toast", { hasText: "Removed from Questions" }).isVisible());
    await page.locator(".bm-toast button", { hasText: "Undo" }).click();
    await settle(500);
    expect(`${w}: Undo puts it back`, (await page.locator(".bm-row").count()) === before);

    /* --- the study card pad --- */
    /* A FRESH PAD, BECAUSE IT OPENS WHERE YOU LEFT OFF. `StudyPad` starts at
       `firstUnseen`, and the "Test yourself" pile a few steps above marks
       cards as seen — so the pad opened at "4 / 4" and the two assertions
       that name a position failed. Making them flexible instead was the wrong
       fix twice: it still left the block order-dependent, and pressing
       ArrowLeft from the end then broke the unsave step after it. Clearing
       the seen set makes the state deterministic, which is what these
       assertions were always written against. */
    await setSkin({ "pw-cards-seen": {}, "pw-cards-got": {} });
    await page.goto(`${BASE}/bookmarks/cards?uid=student_one&m=${MOD}`);
    await page.locator(".bm-pad .bm-pc").first().waitFor({ timeout: 15000 });
    const padN = (await page.locator(".bm-pd-n").first().textContent().catch(() => "<none>")).trim();
    expect(`${w}: the pad says where it is`, /^1 \/ \d+$/.test(padN), padN);
    await page.locator(".bm-pad").focus();
    await page.keyboard.press("Space");
    await settle(250);
    expect(`${w}: space turns the card over`, (await page.locator(".bm-pc-in.is-flipped").count()) === 1);
    await page.keyboard.press("ArrowRight");
    await settle(250);
    const padN2 = (await page.locator(".bm-pd-n").first().textContent().catch(() => "<none>")).trim();
    expect(`${w}: an arrow moves to the next card`, padN2.startsWith("2 /"), padN2);
    const cards = await page.locator(".bm-pad .bm-pc").count();
    await page.locator(".bm-pd-mark").click();
    await settle(400);
    expect(`${w}: unsaving a card takes it out of the pad`, (await page.locator(".bm-pad .bm-pc").count()) === cards - 1);
    await page.locator(".bm-toast button", { hasText: "Undo" }).click();
    await settle(500);
    expect(`${w}: and Undo puts it back`, (await page.locator(".bm-pad .bm-pc").count()) === cards);
    await page.locator(".bm-pad-foot .bm-link").click();
    expect(`${w}: "Browse all card sets" reaches the Library`, await lands(/\/m\/m1\/library/), at());

    /* --- the pile, opened from Bookmarks' own play button --- */
    /* THE MODULE'S CARD SET PAGE IS NOT A BOOKMARKS SURFACE ANY MORE, and the
       block that used to be here drove it: it clicked a Library row reading
       "Chapter 1 cards", expected /library/cards/1 to draw `.bm-pad .bm-pc`,
       and counted eight of them. Every part of that is now wrong — the rows
       carry the documents' own names (CLAUDE.md: "THE NAMES ARE THE
       DOCUMENTS' OWN"), the route is `CardSession`, and the chapter has 105
       cards rather than 8. `test:cards` owns that screen in 133 assertions.
       What is kept is the pile, which is Bookmarks' own and is reached from
       its own door. */
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator('.bm-fplay[aria-label="Test yourself"]').waitFor({ timeout: 15000 });
    await page.locator('.bm-fplay[aria-label="Test yourself"]').click();
    await settle(400);
    expect(`${w}: Test yourself opens the pile`, await page.locator(".bm-deck .bm-pile").first().isVisible());
    await page.locator('.bm-x[aria-label="Close"]').click();
    await settle(300);
    expect(`${w}: the ✕ closes it`, (await page.locator(".bm-scrim").count()) === 0);

    /* --- videos and pages, each only if there is one to open --- */
    if (FILLED.has("Videos")) {
      await page.goto(`${BASE}/bookmarks/videos?uid=student_one&m=${MOD}`);
      await page.locator(".bm-vcard").first().waitFor({ timeout: 15000 });
      await page.locator(".bm-vthumb").first().click();
      expect(`${w}: a saved video opens at its second`, await lands(/\/lesson\/[^?]+\?t=\d+/), at());
    }
    if (FILLED.has("Pages")) {
      await page.goto(`${BASE}/bookmarks/pages?uid=student_one&m=${MOD}`);
      await page.locator(".bm-row").first().waitFor({ timeout: 15000 });
      await page.locator(".bm-pill", { hasText: "Open" }).first().click();
      expect(`${w}: a saved page opens in the reader at that page`, await lands(/\/paper\/[^?]+\?page=\d+/), at());
    }

    /* --- the practice sheet, all the way through --- */
    await page.goto(`${BASE}/bookmarks/questions?uid=student_one&m=${MOD}`);
    await page.locator(".bm-btn.is-primary").waitFor({ timeout: 15000 });
    await page.locator(".bm-btn.is-primary").click();
    await settle(400);
    const answers = await page.locator(".bm-sheet .bm-ans").count();
    expect(`${w}: the practice sheet offers the question's own options`, answers >= 2);
    await page.locator(".bm-sheet .bm-ans").first().click();
    await settle(300);
    expect(`${w}: answering marks it and offers the next`,
      (await page.locator(".bm-sheet .bm-ans.is-right").count()) === 1
      && (await page.locator(".bm-sheet button", { hasText: /Next|Finish/ }).count()) === 1);
    /* Answer, then advance — the sheet only offers Next once something is
       picked, and advancing first left the loop clicking a button that was not
       there yet. Bounded well past the seeded five. */
    for (let i = 0; i < 20; i++) {
      if (await page.locator(".bm-done").count()) break;
      const opts = page.locator(".bm-sheet .bm-ans:not([disabled])");
      if (await opts.count()) { await opts.first().click().catch(() => {}); await settle(200); }
      const next = page.locator(".bm-sheet button", { hasText: /Next|Finish/ });
      if (!(await next.count())) break;
      await next.click().catch(() => {}); await settle(220);
    }
    expect(`${w}: the run ends with encouragement and no score`,
      (await page.locator(".bm-done h2").count()) === 1
      && !/\d/.test(await page.locator(".bm-done").textContent()));
    expect(`${w}: and offers Go again and Done`,
      (await page.locator(".bm-done button", { hasText: "Go again" }).count()) === 1
      && (await page.locator(".bm-done button", { hasText: "Done" }).count()) === 1);
    /* Only if the run actually reached the end. Clicking a button that is not
       there threw and took the rest of the walk with it, reporting a timeout
       where the failure above had already said what was wrong. */
    if (await page.locator(".bm-done button", { hasText: "Done" }).count()) {
      await page.locator(".bm-done button", { hasText: "Done" }).click();
      await settle(300);
      expect(`${w}: Done closes the sheet`, (await page.locator(".bm-scrim").count()) === 0);
    } else {
      await page.keyboard.press("Escape");
      await settle(300);
    }

    /* --- the empty folders name a control that exists --- */
    await fetch(`${BASE}/rest/v1/saves?user_id=eq.student_one`, { method: "DELETE" });
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-empty-cover").first().waitFor({ timeout: 15000 });
    /* EMPTY IS A DESIGNED STATE. The same four folders fill the screen, each
       carrying its icon, one line saying how it gets filled, and a way in. */
    expect(`${w}: an empty Bookmarks still shows every folder it offers`,
      (await page.locator(".bm-folder").count()) === OFFERED.length
      && (await page.locator(".bm-empty-cover").count()) === OFFERED.length, `${OFFERED.length} offered`);
    /* The copy for each folder the app OFFERS. Pages is in the table because
       the folder comes back the moment papers do, and is skipped while it is
       not rendered rather than being deleted from here. */
    const COPY = {
      Questions: ["Bookmark a question while you take a quiz.", "Take a quiz"],
      "Study cards": ["Flip a chapter\u2019s cards and keep the ones worth another look.", "Open the card sets"],
      Videos: ["Bookmark a lesson at the moment that matters.", "Find a lesson"],
      Pages: ["Bookmark a page while you read the paper.", "Open the paper"],
    };
    for (const [name, [hint, cta]] of OFFERED.map((n) => [n, COPY[n]])) {
      const cover = page.locator(".bm-folder", { hasText: name }).locator(".bm-empty-cover");
      const said = (await cover.textContent().catch(() => "")).replace(/\s+/g, " ").trim();
      expect(`${w}: the empty ${name} folder says how it gets filled`, said.includes(hint), said);
      expect(`${w}: and offers "${cta}"`, said.includes(cta), said);
    }
    expect(`${w}: the subtitle reads "Not yet in", never "Nothing"`,
      /Not yet in/.test(await page.locator(".bm-sub").textContent())
      && !/Nothing/i.test(await page.locator(".bm-sub").textContent()));
    /* And every way in lands on a screen where that kind can actually be saved. */
    const WAY_IN = {
      Questions: /\/m\/m1\/[^/]+\/quiz$/,
      "Study cards": /\/m\/m1\/library$/,
      Videos: /\/m\/m1$/,
      Pages: /\/m\/m1\/library$/,
    };
    for (const [name, re] of OFFERED.map((n) => [n, WAY_IN[n]])) {
      await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
      await page.locator(".bm-empty-cover").first().waitFor({ timeout: 15000 });
      await page.locator(".bm-open-f", { hasText: name }).click();
      expect(`${w}: the empty ${name} folder's way in reaches a screen it can be saved on`, await lands(re), at());
    }
    for (const slug of OFFERED.map((n) => SLUG[n])) {
      await page.goto(`${BASE}/bookmarks/${slug}?uid=student_one&m=${MOD}`);
      await page.locator(".bm-empty").waitFor({ timeout: 15000 });
      const line = (await page.locator(".bm-empty").textContent()).replace(/\s+/g, " ").trim();
      expect(`${w}: the empty ${slug} folder names where to save one`, /^No .+ saved yet\. Tap\s*.* to keep it here\./.test(line), line);
    }
    await page.goto(`${BASE}/bookmarks/cards?uid=student_one&m=${MOD}`);
    await page.locator(".bm-empty .bm-link").waitFor({ timeout: 15000 });
    await page.locator(".bm-empty .bm-link").click();
    expect(`${w}: the Study cards empty line reaches the Library`, await lands(/\/m\/m1\/library/), at());

    /* --- nothing dead-ends --- */
    await page.goto(`${BASE}/bookmarks/nonsense?uid=student_one`);
    expect(`${w}: an unknown folder lands on Bookmarks`, await lands(/^\/bookmarks($|\?)/), at());
    await page.goto(`${BASE}/settings?uid=student_one`);
    expect(`${w}: /settings lands on Bookmarks`, await lands(/^\/bookmarks/), at());
    await page.goto(`${BASE}/saved?uid=student_one`);
    expect(`${w}: /saved lands on Bookmarks`, await lands(/^\/bookmarks/), at());
    /* A CARD SET THAT DOES NOT EXIST LANDS SOMEWHERE REAL. This expected a
       "Card set not found" heading with a link out, which is what the old
       `CardSetPage` drew; since `library.batches` went on for everybody the
       route is `CardSession`, and a chapter that is not there sends the
       student to the module screen instead. That satisfies the rule this
       assertion exists for — no dead end, and a way on from where you land —
       so it asserts the landing rather than the old wording. */
    await page.goto(`${BASE}/m/m1/library/cards/99?uid=student_one`);
    await settle(800);
    expect(`${w}: a card set that does not exist lands on a screen with a way on`,
      await lands(/^\/m\/m1$/), at());
    expect(`${w}: and that screen offers its own way back`,
      (await page.locator("a,button").filter({ hasText: "Flight Deck" }).count()) >= 1);

    await page.close();
  }
  report("every control does something and every screen has a way back", acts);

  /* ------------------------------------------------------- the launch sweep
     Five things from §5 that only a browser can answer, each one a way a
     bookmark can quietly become a lie. */
  await seedSaves();
  await setSkin({ "pw-livery": "sky", "pw-variant-pin": "night", "pw-finish": "standard" });
  const sweep = [];
  const want = (name, cond, detail = "") => { if (!cond) sweep.push(`${name}${detail ? ` — ${detail}` : ""}`); };
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    ctx.setDefaultNavigationTimeout(45000);
    const page = await ctx.newPage();
    { const g = page.goto.bind(page); page.goto = (u, o) => g(u, { waitUntil: "domcontentloaded", ...o }); }
    page.on("pageerror", (e) => errors.push(`sweep: ${String(e).slice(0, 160)}`));
    const settle = (ms = 400) => page.waitForTimeout(ms);

    /* 1 · offline. The store refuses rather than pretending, and says which. */
    /* A chapter the seed does not touch, because the seed saves the first
       chapter's first five questions — and a bookmark pressed on one of those
       would be testing a REMOVE. Derived, not named: this read `M1.03` until
       2026-10-13, and that chapter has not existed since 2026-10-08. */
    await page.goto(`${BASE}/m/m1/${FIX.freeCh.c.id}/quiz?uid=student_one`);
    await page.locator(".exam-save").waitFor({ timeout: 15000 });
    want("the question under test starts unsaved",
      (await page.locator(".exam-save").getAttribute("aria-pressed")) === "false");
    await ctx.setOffline(true);
    await page.locator(".exam-save").click();
    await settle(900);
    want("offline says so rather than showing a save that did not happen",
      /You're offline, so that didn't save\./.test(await page.locator(".bm-toast").textContent().catch(() => "")),
      await page.locator(".bm-toast").textContent().catch(() => "no toast"));
    want("and the bookmark goes back to unsaved",
      (await page.locator(".exam-save").getAttribute("aria-pressed")) === "false");
    await ctx.setOffline(false);

    /* 2 · a save made in one tab is there in another after a refresh. Live sync
       is backlog item 3; what must be true today is that it is on the SERVER. */
    const second = await ctx.newPage();
    await second.goto(`${BASE}/bookmarks/questions?uid=student_one&m=${MOD}`);
    await second.locator(".bm-row").first().waitFor({ timeout: 15000 });
    const firstCount = await second.locator(".bm-row").count();
    await page.locator(".exam-save").click();
    await settle(700);
    await second.reload();
    await second.locator(".bm-row").first().waitFor({ timeout: 15000 });
    want("a save made in one tab is in the other after a refresh",
      (await second.locator(".bm-row").count()) === firstCount + 1);
    await second.close();

    /* 3 · another student sees none of it. The scoping is the app's, so this is
       the check that the app actually applies it. */
    await page.goto(`${BASE}/bookmarks?uid=student_two`);
    await page.locator(".bm-folders").first().waitFor({ timeout: 15000 });
    /* Every folder the app offers is there — empty is a designed state now —
       so what proves it is that every one of them is EMPTY, and the count is
       gone. The number is the app's, not four: papers are off for launch. */
    want("a different student sees none of the first one's saves",
      (await page.locator(".bm-empty-cover").count()) === OFFERED.length
      && (await page.locator(".bm-fplay").count()) === 0
      && /Not yet in/.test(await page.locator(".bm-sub").textContent()));

    /* 4 · a question the author deleted disappears QUIETLY, and takes its save
       with it — and, far more importantly, a save whose content has not loaded
       yet does NOT. */
    await fetch(`${BASE}/rest/v1/saves?on_conflict=user_id,kind,ref_id,page`, {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({ id: crypto.randomUUID(), user_id: "student_one", module_id: "M1", kind: "question", ref_id: "q_deleted_by_author", chapter: 1 }),
    });
    await page.goto(`${BASE}/bookmarks/questions?uid=student_one&m=${MOD}`);
    await page.locator(".bm-row").first().waitFor({ timeout: 15000 });
    await settle(900);
    const left = await page.evaluate(async (base) =>
      (await (await fetch(`${base}/rest/v1/saves?user_id=eq.student_one&ref_id=eq.q_deleted_by_author&select=id`)).json()).length, BASE);
    want("a save whose question the author deleted is pruned quietly", left === 0, `${left} left`);
    want("and nothing on screen mentions it", !(await page.locator(".bm-list").textContent()).includes("q_deleted"));

    /* 4b · SIGNED OUT IS A SCREEN, NOT A WAIT. Every Bookmarks screen holds on
       the store being ready, and signed out initSaves never runs — so the page
       rendered an empty aria-busy section for ever, and /bookmarks was blank on
       the live site. There is nothing saved because there is nobody to have
       saved it, and the designed empty state says so. */
    await page.goto(`${BASE}/bookmarks?uid=none`);
    await page.locator(".bm-folders").waitFor({ timeout: 15000 }).catch(() => {});
    want("signed out, Bookmarks shows its folders rather than waiting for ever",
      (await page.locator(".bm-empty-cover").count()) === OFFERED.length
      && (await page.locator('.bm-page[aria-busy="true"]').count()) === 0,
      `covers=${await page.locator(".bm-empty-cover").count()} busy=${await page.locator('.bm-page[aria-busy="true"]').count()}`);

    /* 5 · keyboard only. Every control reachable, focus visible, Esc closes. */
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-folders .bm-folder").first().waitFor({ timeout: 15000 });
    let reached = 0, outlined = 0;
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const s = getComputedStyle(a);
        return { inBm: !!a.closest(".bm"), outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 };
      });
      if (info?.inBm) { reached += 1; if (info.outline) outlined += 1; }
    }
    want("every Bookmarks control is reachable by keyboard", reached >= 8, `${reached} reached`);
    want("and every focused one shows it", outlined === reached, `${outlined} of ${reached} outlined`);

    await page.close();
    await ctx.close();
  }
  report("the launch sweep", sweep);

  /* ------------------------------------------------------- R12 · Smooth Air */
  await seedSaves();
  await setSkin({ "pw-reduce-motion": true, "pw-livery": "sky", "pw-variant-pin": "night", "pw-finish": "standard" });
  {
    const calm = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultNavigationTimeout(45000);
    { const g = page.goto.bind(page); page.goto = (u, o) => g(u, { waitUntil: "domcontentloaded", ...o }); }
    page.on("pageerror", (e) => errors.push(`calm: ${String(e).slice(0, 160)}`));
    for (const [url, wait] of [
      [`${BASE}/bookmarks?uid=student_one&m=${MOD}`, ".bm-folders .bm-folder"],
      [`${BASE}/bookmarks/cards?uid=student_one&m=${MOD}`, ".bm-pad .bm-pc"],
      [`${BASE}/?uid=student_one`, ".bm-bagcell .bm-bag"],
    ]) {
      await page.goto(url);
      await page.locator(wait).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      for (const p of only(await audit(page, { variant: "night", view: "calm", calm: true }))) calm.push(`${url}: ${p}`);
    }
    /* And it still WORKS: the covers stay on the newest item rather than
       freezing mid-slide, and the pad still turns. */
    await page.goto(`${BASE}/bookmarks?uid=student_one&m=${MOD}`);
    await page.locator(".bm-folders .bm-folder").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    const onNewest = await page.evaluate(() =>
      [...document.querySelectorAll(".bm-cover")].every((c) => {
        const slides = c.querySelectorAll(".bm-slide");
        return !slides.length || slides[0].classList.contains("is-on") || getComputedStyle(slides[0]).opacity === "1";
      }));
    if (!onNewest) calm.push("a folder cover is not resting on its newest item");
    await page.close();
    report("Smooth Air stops every animation and breaks nothing", calm);
  }
  await setSkin({ "pw-reduce-motion": false });
} finally {
  /* PUT THE SKIN BACK. Every suite here drives the same harness store, and this
     one walks 30 of them — leaving a student pinned to Manual in Day made
     test:exam fail on a ground it had never asked for, which reads as a bug in
     the exam rather than as this run's litter. */
  await setSkin({ "pw-livery": "sky", "pw-variant-pin": null, "pw-finish": null, "pw-reduce-motion": false }).catch(() => {});
  await fetch(`${BASE}/rest/v1/saves?user_id=eq.student_one`, { method: "DELETE" }).catch(() => {});
  await browser.close();
}

if (errors.length) {
  failures += 1;
  console.log(`FAIL  the console is clean  (${errors.length} errors)`);
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(`        ${e}`);
} else {
  console.log("ok    the console is clean");
}

console.log(failures ? `\nbookmarks: ${failures} group(s) failed` : "\nbookmarks: every group passed");
process.exit(failures ? 1 : 0);
