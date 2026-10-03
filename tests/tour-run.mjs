/* =============================================================================
   THE WALKTHROUGH, WALKED — every step, at a desktop width and a phone's.
   -----------------------------------------------------------------------------
   CLAUDE.md has claimed since 2026-09-21 that "all twenty-five steps light
   their target at 1440 and at 390, every one of them fully on screen, and the
   card covers none of any of them". That was true, and it was measured by
   hand, which means nothing was holding it: the timing that decides all three
   lives in Guide.jsx, and on 2026-10-03 it was more than halved for the
   owner's "snappy rather than floaty". A claim nobody re-measures is a claim
   that quietly stops being true, so this walks it.

   WHAT IT ASSERTS, per step and per width:
     · the light lands on something — 23 of the 25 steps name a target, and a
       step whose selector stops matching would otherwise simply dim the
       screen and look deliberate;
     · what it lights is FULLY on screen, not half under an edge;
     · the card does not cover what the step is pointing at;
     · and the step stops moving inside its ceiling.

   TIME-TO-REST IS LOGIC PLUS EASING, so headless measures it honestly. Frame
   COST is not measured here and must not be: the headless shell rasterises in
   software, which is why test:vt asks for a GPU and a production build before
   it believes a frame number.

   Run: npm run harness, then npm run test:tour.
   TOUR_BASE picks the harness; TOUR_WIDTHS a comma-separated list.
   ========================================================================= */
import { chromium } from "playwright";
import { STEPS } from "../src/demo/steps.js";

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

const WANT_LIT = STEPS.filter((s) => s.find).length;

/* In the page: press Next, then wait until the dim, the ring, the card and
   every scroller have all stopped changing. */
const stepAndRest = async (page) => page.evaluate(async () => {
  const sig = () => {
    const panels = [...document.querySelectorAll(".dg-panel")].map((e) => e.style.transform).join("|");
    const g = document.querySelector(".dg-ring");
    const ring = g ? `${g.style.transform}${g.style.width}${g.style.height}${g.style.opacity}` : "";
    const scrolls = `${window.scrollY}/${[...document.querySelectorAll("*")].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join(",")}`;
    const c = document.querySelector(".dg-card");
    const cs = c ? getComputedStyle(c).transform + getComputedStyle(c).opacity : "";
    return panels + ring + scrolls + cs;
  };
  const btn = [...document.querySelectorAll(".dg button")].find((b) => /next|finish/i.test(b.textContent));
  if (!btn) return null;
  const t0 = performance.now();
  let last = t0;
  let prev = sig();
  btn.click();
  await new Promise((res) => {
    const tick = () => {
      const now = performance.now();
      const s = sig();
      if (s !== prev) { prev = s; last = now; }
      if (now - last > 200 && now - t0 > 240) return res();
      if (now - t0 > 7000) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const g = document.querySelector(".dg-ring");
  const c = document.querySelector(".dg-card");
  const r = g ? g.getBoundingClientRect() : null;
  const cr = c ? c.getBoundingClientRect() : null;
  const over = (a, b) => (a && b
    ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    : 0);
  return {
    rest: Math.round(last - t0),
    kicker: (c?.innerText || "").split("\n")[0].slice(0, 26),
    lit: Boolean(r && r.width > 6 && r.height > 6 && getComputedStyle(g).opacity !== "0"),
    rect: r && { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
    onScreen: Boolean(r && r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1),
    covered: Math.round(over(r, cr)),
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
});

const browser = await chromium.launch();
const all = [];
try {
  for (const width of WIDTHS) {
    const name = `${width}px`;
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "networkidle" });
    await page.waitForSelector(".dg-card", { timeout: 20000 });
    await page.waitForTimeout(1200);

    let lit = 0;
    const times = [];
    for (let n = 0; n < STEPS.length - 1; n += 1) {
      const r = await stepAndRest(page);
      if (!r) { fails.push(`${name} · ran out of steps at ${n + 1} of ${STEPS.length}`); break; }
      times.push(r.rest);
      all.push(r.rest);
      if (r.lit) {
        lit += 1;
        ok(name, `step ${n + 2} lights something fully on screen`, r.onScreen,
           `${r.kicker}: ${JSON.stringify(r.rect)} in ${r.vw}×${r.vh}`);
        ok(name, `step ${n + 2}'s card does not cover what it points at`, r.covered === 0,
           `${r.kicker}: ${r.covered}px² covered`);
      }
      ok(name, `step ${n + 2} stops moving`, r.rest < CEILING, `${r.kicker}: ${r.rest}ms`);
      await page.waitForTimeout(80);
    }
    /* EVERY ONE OF THEM, not most. Step 1 is never measured — it is the one
       you arrive on — and it is also one of the two that light nothing on
       purpose (the welcome and the farewell), so every step that names a
       target falls inside the walk and every one of them has to land. */
    ok(name, "every step that names a target lights one", lit >= WANT_LIT,
       `lit ${lit} of ${WANT_LIT} expected`);
    const s = [...times].sort((a, b) => a - b);
    console.log(`  ${name}: median ${s[Math.floor(s.length / 2)]}ms · p90 ${s[Math.floor(s.length * 0.9)]}ms · worst ${s.at(-1)}ms`);
    await page.close();
  }

  /* SMOOTH AIR MEANS NO MOTION, NOT LESS — the one rule a faster tutorial
     must not quietly take with it. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}/?tour&uid=student_one`, { waitUntil: "networkidle" });
    await page.waitForSelector(".dg-card", { timeout: 20000 });
    await page.waitForTimeout(800);
    const moved = await page.evaluate(() => {
      const el = document.querySelector(".dg-card");
      const dim = document.querySelector(".dg-panel");
      return [el, dim].filter(Boolean).map((e) => {
        const s = getComputedStyle(e);
        return `${s.transitionDuration}|${s.animationDuration}`;
      });
    });
    ok("reduced motion", "nothing on the tutorial eases",
       moved.every((m) => /^(0s|0s,\s*0s)\|0s$/.test(m.replace(/\s+/g, " ").trim())
                       || m.split("|").every((v) => v.split(",").every((x) => x.trim() === "0s"))),
       moved.join(" · "));
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
