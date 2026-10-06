/* =============================================================================
   THE TOUR, WALKED — every step, at a desktop width and a phone's.
   -----------------------------------------------------------------------------
   Rewritten for the rebuilt tour (2026-10-06). It replaces the walk of the old
   twenty-five-step guide, which asserted the same three things about `.dg-panel`
   — the four-panel dim that no longer exists. The reasons it exists have not
   changed:

   A claim nobody re-measures is a claim that quietly stops being true. These
   steps point at the app by NAME now (`data-tour="deck-route"`), not by a CSS
   selector, which removes one whole class of silent failure and adds another:
   a name nobody applied lights nothing and looks deliberate. So the first
   thing this does is check every name in the script against the running app.

   WHAT IT ASSERTS, per step and per width:
     · every `data-tour` name in the script resolves somewhere in the app;
     · the light lands on something — a step that names a target must light it;
     · what it lights is FULLY on screen, not half under an edge;
     · the card does not cover what the step is pointing at — except on a
       `whole: true` step, where the light IS the window and the card standing
       on it is the design;
     · a step that asks for a pane or a tab gets it: the Ready Room's three
       panes and the lesson's two tabs are the new mechanism and the one most
       able to do nothing at all without saying so;
     · and the step stops moving inside its ceiling.

   TIME-TO-REST IS LOGIC PLUS EASING, so headless measures it honestly. Frame
   COST is not measured here and must not be: the headless shell rasterises in
   software, which is why test:vt asks for a GPU and a production build before
   it believes a frame number.

   Run: npm run harness, then npm run test:tour.
   TOUR_BASE picks the harness; TOUR_WIDTHS a comma-separated list.
   ========================================================================= */
import { chromium } from "playwright";
import { TOUR_STEPS, TOUR_BETA_NOTE } from "../src/demo/tourSteps.js";

const BASE = process.env.TOUR_BASE || "http://127.0.0.1:5190";
const WIDTHS = (process.env.TOUR_WIDTHS || "1440,390").split(",").map(Number);
/* Generous on purpose: this is a guard against a step that never settles, not
   a stopwatch. The number that matters is the median, printed at the end. */
const CEILING = 2200;

let pass = 0;
const fails = [];
const ok = (name, what, good, detail = "") => {
  if (good) { pass += 1; return; }
  fails.push(`${name} · ${what}${detail ? ` — ${detail}` : ""}`);
};

const NAMES = [...new Set(TOUR_STEPS.map((s) => s.target).filter(Boolean))];
const WANT_LIT = TOUR_STEPS.filter((s) => s.target || s.whole).length;

/* In the page: press Next, then wait until the ring, the card and every
   scroller have all stopped changing. */
const stepAndRest = async (page, want) => page.evaluate(async (expect) => {
  const sig = () => {
    const g = document.querySelector(".dg-ring");
    const ring = g
      ? `${g.style.transform}${g.style.width}${g.style.height}${g.style.opacity}${g.className}`
      : "";
    const scrolls = `${window.scrollY}/${[...document.querySelectorAll("*")]
      .filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join(",")}`;
    const c = document.querySelector(".dg-card");
    const cs = c ? getComputedStyle(c).transform + getComputedStyle(c).opacity : "";
    return ring + scrolls + cs;
  };
  const btn = document.querySelector(".dg-acts .dg-next");
  if (!btn) return null;
  const t0 = performance.now();
  let last = t0;
  let prev = sig();
  let moved = false;
  btn.click();
  /* QUIET IS ONLY REST ONCE SOMETHING HAS MOVED. A step that changes page
     awaits a navigation, a pane and a lazy chunk before it touches the light,
     and nothing on screen changes while it does — so a detector that accepts
     200ms of quiet straight after the press returned before the step had
     started, and then read an unlit light and called the step dark. Three
     steps were reported dark that way and all three were fine. So: wait for
     the first change, THEN for 200ms of quiet. `rest` is still the moment of
     the last change, which is the number worth printing. */
  await new Promise((res) => {
    const tick = () => {
      const now = performance.now();
      const s = sig();
      if (s !== prev) { prev = s; last = now; moved = true; }
      if (moved && now - last > 200) return res();
      if (now - t0 > 7000) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  /* AND THEN THE STEP IS GIVEN TIME TO BE RIGHT, which is a different
     question from whether it has stopped moving. Two of these steps change to
     a screen that is a lazy chunk and then asks the database for a squadron
     list; the light and the pane are correct a few hundred milliseconds after
     everything on screen has gone still, so a single snapshot at rest called
     the Ready Room's first step wrong and the lesson's first step dark. Both
     were fine. `rest` above is still the motion measurement, untouched; this
     only decides WHEN to read the state the assertions are about. */
  const settled = await (async () => {
    const t1 = performance.now();
    const good = () => {
      const gg = document.querySelector(".dg-ring");
      const rr = gg ? gg.getBoundingClientRect() : null;
      const isLit = Boolean(rr && rr.width > 6 && rr.height > 6 && getComputedStyle(gg).opacity !== "0");
      if (expect.lit && !isLit) return false;
      if (expect.pane) {
        const kids = [...(document.querySelector(".rr-pane")?.children || [])].map((c) => String(c.className));
        if (!kids.some((c) => c.split(/\s+/).includes(expect.pane))) return false;
      }
      if (expect.tab) {
        const t = document.querySelector('.logcard [role="tab"][aria-selected="true"]');
        if (!t || t.textContent.trim().split(/\s+/)[0].toLowerCase() !== expect.tab) return false;
      }
      /* THE CARD STANDING CLEAR IS A PROPERTY OF THE SETTLED STEP, not of
         every frame on the way there. A page change eases now rather than
         snapping, so the light is mid-travel for about half a second after
         the rest detector above lets go, and reading the overlap then found
         148509 square pixels on a step whose final geometry is a clean 72px
         gap. Measured both ways. */
      /* The dim settles on the same .55s as the light, so like the overlap
         above it is a property of the step at rest. */
      {
        const dd = document.querySelector(".dg-dim");
        const gg3 = document.querySelector(".dg-ring");
        if (dd && gg3 && dd.children.length === 4) {
          const area = [...dd.children].reduce((n, e) => {
            const q = e.getBoundingClientRect();
            return n + Math.max(0, q.width) * Math.max(0, q.height);
          }, 0);
          const rr2 = gg3.getBoundingClientRect();
          const off = area + rr2.width * rr2.height - window.innerWidth * window.innerHeight;
          if (Math.abs(off) >= 400) return false;
        }
      }
      if (expect.clear) {
        const gg2 = document.querySelector(".dg-ring");
        const cc = document.querySelector(".dg-card");
        const a = gg2?.getBoundingClientRect(), bb = cc?.getBoundingClientRect();
        if (a && bb) {
          const ov = Math.max(0, Math.min(a.right, bb.right) - Math.max(a.left, bb.left))
                   * Math.max(0, Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top));
          if (ov > 0) return false;
        }
      }
      return true;
    };
    while (performance.now() - t1 < 1500) {
      if (good()) return Math.round(performance.now() - t1);
      await new Promise((res) => requestAnimationFrame(res));
    }
    return Math.round(performance.now() - t1);
  })();

  const g = document.querySelector(".dg-ring");
  const c = document.querySelector(".dg-card");
  const r = g ? g.getBoundingClientRect() : null;
  const cr = c ? c.getBoundingClientRect() : null;
  const over = (a, b) => (a && b
    ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    : 0);
  /* What the pane and tab steps are checked against. The selected tab is the
     one with aria-selected. The Ready Room's pane says which of the three it
     is by WHAT IT RENDERS — `rr-seatgrid`, `rr-chat` or `rr-threads` under
     `.rr-pane` — rather than by a heading, because all three headings are
     `.rr-phead` and a heading existing proves nothing about which pane won. */
  const tabEl = document.querySelector('.logcard [role="tab"][aria-selected="true"]');
  const paneKids = [...(document.querySelector(".rr-pane")?.children || [])].map((c) => String(c.className));
  return {
    rest: Math.round(last - t0),
    settled,
    kicker: (c?.innerText || "").split("\n")[0].slice(0, 26),
    whole: Boolean(g && /\bwhole\b/.test(g.className)),
    lit: Boolean(r && r.width > 6 && r.height > 6 && getComputedStyle(g).opacity !== "0"),
    rect: r && { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
    onScreen: Boolean(r && r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1),
    covered: Math.round(over(r, cr)),
    tab: tabEl ? tabEl.textContent.trim().split(/\s+/)[0].toLowerCase() : null,
    /* THE DIM IS FOUR PANELS AND THEY MUST TILE THE WINDOW. The dim used to
       be a `0 0 0 100vmax` layer of the ring's own box-shadow, which repaints
       the whole window on every frame the ring moves; it is four flat panels
       moved only by transform now, which is the compositor's job. The cost of
       that is a new way to be wrong — a panel aimed badly leaves an undimmed
       strip — so the four panels plus the hole are measured against the
       window on every step. */
    dimGap: (() => {
      const d = document.querySelector(".dg-dim");
      const g = document.querySelector(".dg-ring");
      if (!d || !g || d.children.length !== 4) return null;
      const area = [...d.children].reduce((n, e) => {
        const b = e.getBoundingClientRect();
        return n + Math.max(0, b.width) * Math.max(0, b.height);
      }, 0);
      const r = g.getBoundingClientRect();
      return Math.round(area + r.width * r.height - window.innerWidth * window.innerHeight);
    })(),
    rrPane: ["rr-seatgrid", "rr-chat", "rr-threads"].find((k) => paneKids.some((c) => c.split(/\s+/).includes(k))) || null,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}, want);

/* The beta note stands in front of step 1 and has its own button. */
const dismissBeta = async (page) => {
  if (!TOUR_BETA_NOTE) return;
  await page.waitForSelector(".dg-modal .dg-next", { timeout: 20000 });
  await page.click(".dg-modal .dg-next");
  await page.waitForSelector(".dg-card", { timeout: 20000 });
};

const browser = await chromium.launch();
const all = [];
try {
  for (const width of WIDTHS) {
    const name = `${width}px`;
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "networkidle" });
    await dismissBeta(page);
    await page.waitForTimeout(1200);

    let lit = 0;
    const dark = [];
    const times = [];
    /* How long after everything stopped moving the step became CORRECT —
       nearly always 0, and worth printing because the two steps that are not
       are the two that wait on a lazy screen. */
    const waits = [];
    for (let n = 0; n < TOUR_STEPS.length - 1; n += 1) {
      const step = TOUR_STEPS[n + 1];
      const want = {
        lit: Boolean(step.target || step.whole),
        pane: step.pane
          ? (step.pane.startsWith("right-seat") ? "rr-seatgrid"
            : step.pane.startsWith("squadron") ? "rr-chat" : "rr-threads")
          : null,
        tab: step.panelTab ? (step.panelTab === "logbook" ? "logbook" : "comments") : null,
        clear: Boolean(step.target) && !step.whole,
      };
      const r = await stepAndRest(page, want);
      if (!r) { fails.push(`${name} · ran out of steps at ${n + 1} of ${TOUR_STEPS.length}`); break; }
      times.push(r.rest);
      all.push(r.rest);
      waits.push(r.settled);
      if (!r.lit && (step.target || step.whole)) dark.push(`step ${n + 2} (${step.target || "whole"})`);
      if (r.lit) {
        lit += 1;
        /* A `whole` step's light IS the window, so it is on screen by
           construction and the card necessarily stands on it. Only a step
           pointing at ONE NAMED THING is asked these two — keyed off the
           script rather than off whether a light happens to have size, because
           the farewell step names nothing and its light is still shrinking out
           of the previous step's full-window frame when this is read. */
        if (step.target && !step.whole) {
          ok(name, `step ${n + 2} lights something fully on screen`, r.onScreen,
             `${r.kicker}: ${JSON.stringify(r.rect)} in ${r.vw}×${r.vh}`);
          ok(name, `step ${n + 2}'s card does not cover what it points at`, r.covered === 0,
             `${r.kicker}: ${r.covered}px² covered`);
        }
      }
      /* THE PANE AND THE TAB ACTUALLY CHANGED. Both travel as a CustomEvent
         to a page that may not be listening, and the engine deliberately
         resolves on the next frame either way so a page that ignores it
         cannot hang the tour — which means a missing listener is invisible
         from inside the tour and has to be caught from out here. */
      if (step.panelTab) {
        const want = step.panelTab === "logbook" ? "logbook" : "comments";
        ok(name, `step ${n + 2} switches the lesson to ${want}`, r.tab === want,
           `${r.kicker}: selected tab is ${r.tab ?? "none"}`);
      }
      if (step.pane) {
        ok(name, `step ${n + 2} opens the ${step.pane} pane`, r.rrPane === want.pane,
           `${r.kicker}: pane is ${r.rrPane ?? "none"}, wanted ${want.pane}`);
      }
      /* A couple of square pixels of rounding is fine; a strip is not. */
      ok(name, `step ${n + 2}'s dim covers the window`, r.dimGap === null || Math.abs(r.dimGap) < 400,
         `${r.kicker}: off by ${r.dimGap}px²`);
      ok(name, `step ${n + 2} stops moving`, r.rest < CEILING, `${r.kicker}: ${r.rest}ms`);
      await page.waitForTimeout(80);
    }
    /* EVERY ONE OF THEM, not most. Step 1 is never measured — it is the one
       you arrive on — so every step that names a target falls inside the walk
       and every one of them has to land. */
    ok(name, "every step that names a target lights one", dark.length === 0,
       `lit ${lit} of ${WANT_LIT}; dark: ${dark.join(", ") || "none"}`);
    const s = [...times].sort((a, b) => a - b);
    const w = [...waits].sort((a, b) => a - b);
    console.log(`  ${name}: median ${s[Math.floor(s.length / 2)]}ms · p90 ${s[Math.floor(s.length * 0.9)]}ms · worst ${s.at(-1)}ms`
      + `  ·  after rest: ${w.filter((x) => x > 16).length} of ${waits.length} steps waited, worst ${w.at(-1) ?? 0}ms`);
    await page.close();
  }

  /* EVERY NAME IN THE SCRIPT IS A NAME IN THE APP. The script addresses the
     app by `data-tour`, so a typo, or an element that lost its attribute in a
     tidy-up, is a step that dims the screen and points at nothing. This walks
     each step's own route once and looks for the name there, which is the only
     place it could be. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "networkidle" });
    await dismissBeta(page);
    for (const nm of NAMES) {
      const step = TOUR_STEPS.find((s) => s.target === nm);
      await page.evaluate(([to, pane, tab]) => {
        history.pushState({}, "", to);
        dispatchEvent(new PopStateEvent("popstate"));
        if (pane) dispatchEvent(new CustomEvent("wm-tour:pane", { detail: pane }));
        if (tab) dispatchEvent(new CustomEvent("wm-tour:panel-tab", { detail: tab }));
      }, [step.route, step.pane || null, step.panelTab || null]);
      /* ATTACHED, NOT VISIBLE. This asserts that the NAME is applied, which
         is the thing a tidy-up can silently drop; whether it happens to be
         scrolled into view on arrival is the walk above's business, and three
         of the deck's social cards are below the fold on arrival. */
      const found = await page.waitForSelector(`[data-tour="${nm}"]`, { timeout: 8000, state: "attached" })
        .then(() => true).catch(() => false);
      ok("names", `data-tour="${nm}" exists on ${step.route}`, found);
    }
    await page.close();
  }

  /* THE CARD IS A NEW SURFACE, SO ITS WORDS ARE MEASURED ON EVERY LIVERY.
     Every colour on it is one of the app's tokens, which is the handoff's own
     rule — but a token is not a contrast ratio, and this card floats over a
     dimmed screen rather than sitting on `--panel`, so the pair has to be
     composited rather than looked up. Six liveries x night and day, both
     surfaces (the step card and the beta note), nine text pairs each.
     Floor 4.5:1, because the only thing on this card above 18.66px bold is
     the title and holding it to the same number costs nothing. */
  {
    const LIVERIES = ["sky", "amber", "tarmac", "beacon", "runway", "skydrol"];
    const worst = { ratio: 99, what: "" };
    for (const variant of ["night", "day"]) {
      for (const livery of LIVERIES) {
        await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": livery, "pw-variant-pin": variant, "pw-finish": "standard" } }),
        });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".dg-modal .dg-next", { timeout: 20000 });
        const read = () => page.evaluate(() => {
          /* EVERY COLOUR IS RESOLVED THROUGH A CANVAS, not parsed. This app's
             tokens are OKLCH and `getComputedStyle` hands back `oklch(...)`
             verbatim in Chromium, so reading three numbers out of the string
             gave lightness, chroma and a hue angle where red, green and blue
             were expected — and every pair on every livery came out at exactly
             2:1, which is the shape of a measurement that is not measuring.
             A canvas rasterises any CSS colour to sRGB; filling once over
             white and once over black recovers the alpha as well. */
          const cv = document.createElement("canvas");
          cv.width = cv.height = 1;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          const px = (color, backdrop) => {
            cx.globalCompositeOperation = "copy";
            cx.fillStyle = backdrop; cx.fillRect(0, 0, 1, 1);
            cx.globalCompositeOperation = "source-over";
            cx.fillStyle = color; cx.fillRect(0, 0, 1, 1);
            return [...cx.getImageData(0, 0, 1, 1).data];
          };
          const num = (color) => {
            if (!color || color === "transparent") return [0, 0, 0, 0];
            const w = px(color, "#fff"), b = px(color, "#000");
            const a = 1 - (w[0] - b[0]) / 255;
            if (a <= 0.004) return [0, 0, 0, 0];
            return [b[0] / a, b[1] / a, b[2] / a, a];
          };
          /* The first ancestor that paints something, alpha-composited on the
             way down — the card is translucent over a dimmed page, so its own
             declared background is not what a word is read against. */
          const over = (fg, bg) => fg.slice(0, 3).map((v, k) => v * (fg[3] ?? 1) + bg[k] * (1 - (fg[3] ?? 1)));
          const bgOf = (el) => {
            let stack = [], n = el;
            while (n && n !== document.documentElement) {
              const c = num(getComputedStyle(n).backgroundColor);
              if (c.length && (c[3] ?? 1) > 0) { stack.push(c); if ((c[3] ?? 1) >= 0.999) break; }
              n = n.parentElement;
            }
            const base = num(getComputedStyle(document.documentElement).backgroundColor);
            let out = base.length && (base[3] ?? 1) > 0 ? base.slice(0, 3) : [12, 14, 20];
            for (const c of stack.reverse()) out = over(c, out);
            return out;
          };
          const lum = (rgb) => {
            const f = rgb.map((v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
            return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
          };
          const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
          const out = [];
          for (const sel of [".dg-kicker", ".dg-count", ".dg-title", ".dg-text", ".dg-skip", ".dg-back", ".dg-next", ".dg-box h3", ".dg-box p", ".dg-cls"]) {
            const el = document.querySelector(sel);
            if (!el || !el.getClientRects().length) continue;
            const fg = over(num(getComputedStyle(el).color), bgOf(el));
            out.push([sel, Math.round(ratio(fg, bgOf(el)) * 100) / 100]);
          }
          return out;
        });
        const note = await read();
        await page.click(".dg-modal .dg-next");
        await page.waitForSelector(".dg-card", { timeout: 20000 });
        /* One step in, not none: the first step's kicker is a section name
           with no "2 of 3" after it, so `.dg-count` does not exist yet and a
           reading taken there measured nine pairs while claiming ten. */
        await page.waitForTimeout(400);
        await page.click(".dg-acts .dg-next");
        await page.waitForTimeout(700);
        const card = await read();
        for (const [sel, r] of [...note, ...card]) {
          const what = `${livery} ${variant} ${sel}`;
          ok("contrast", `${what} reads at 4.5:1`, r >= 4.5, `${r}:1`);
          if (r < worst.ratio) { worst.ratio = r; worst.what = what; }
        }
        await page.close();
      }
    }
    /* Put the skin back. test:bm learned this the hard way: a walk that leaves
       its livery behind makes the next suite fail on a ground it never asked
       for, which reads as a bug in that suite. */
    await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": "sky", "pw-variant-pin": "night", "pw-finish": "standard" } }),
    });
    console.log(`  contrast: worst ${worst.ratio}:1 — ${worst.what}`);
  }

  /* SMOOTH AIR MEANS NO MOTION, NOT LESS — the one rule a faster tutorial
     must not quietly take with it. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "networkidle" });
    await dismissBeta(page);
    await page.waitForTimeout(800);
    const moved = await page.evaluate(() => {
      const el = document.querySelector(".dg-card");
      const ring = document.querySelector(".dg-ring");
      return [el, ring].filter(Boolean).map((e) => {
        const s = getComputedStyle(e);
        return `${s.transitionDuration}|${s.animationDuration}`;
      });
    });
    /* A MICROSECOND IS NOT MOTION. The app's own reduced-motion reset leaves
       `animation-duration: 1e-06s` on elements rather than `0s`, which is a
       millionth of a second and nothing a person can see. The rule being held
       here is "no motion"; the test for it is a duration under a millisecond,
       not a string match on "0s". */
    const seconds = (v) => Number(String(v).trim().replace(/s$/, "")) || 0;
    const still = (m) => m.split("|").every((v) => v.split(",").every((x) => seconds(x) <= 0.001));
    ok("reduced motion", "nothing on the tutorial eases", moved.every(still), moved.join(" · "));
    await page.close();
  }
} finally {
  await browser.close();
}

const s = [...all].sort((a, b) => a - b);
console.log(`\ntour: ${pass} passed, ${fails.length} failed`);
console.log(`      ${all.length} steps walked · median ${s[Math.floor(s.length / 2)]}ms to rest · worst ${s.at(-1)}ms`);
for (const f of fails.slice(0, 14)) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
