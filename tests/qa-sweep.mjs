/* =============================================================================
   THE FOUR SWEEPS. Run: npm run qa            (harness on :5190 first)
   -----------------------------------------------------------------------------
   `npm run check` passed before the 20 Sep QA pass and every fault it found was
   still there. That is the whole reason this file exists: a suite of
   assertions can only fail on a rule somebody thought to write, and the faults
   that matter are the ones nobody thought of — a page that renders nothing, a
   control that does nothing, a field five pixels wide, a count that reads zero.
   So this one drives the real app and LOOKS, and reports what it saw rather
   than passing or failing a list.

   1 · ROUTES      every address routes.js can build, at three widths
   2 · CLICKS      every visible control, one at a time, from a fresh load
   3 · RESPONSIVE  four widths, measured rather than eyeballed
   4 · ZEROES      the rendered text of every screen, grepped for a zero count

   TWO THINGS THE 20 SEP PASS LEARNED THE HARD WAY, kept here:

   · INDEX BY ATTRIBUTE, NEVER BY nth(). A comma selector in Playwright orders
     its matches differently from a visibility-filtered querySelectorAll, and
     that alone produced 63 false failures. Every control is tagged in the page
     with its own index first, and clicked by that tag.
   · THE SIGNATURE HAS TO INCLUDE THE TOKENS AND THE STORAGE. Without them
     every theme, livery and finish button reads as dead — it changed a CSS
     variable and nothing else, which is exactly what it is supposed to do.

   AND ONE THE 21 SEP RUN LEARNED: THE STORE IS SHARED. A fresh browser context
   is a fresh browser, not a fresh student — every context reads the same
   harness store. "Not now" on the tour offer settled the tour, so every later
   load of the Flight Deck had two controls fewer than the inventory, and the
   last two indexes pointed at nothing: logged as "would not click", four of
   them, none real. So the store is reset before the inventory and before
   every click, and a click whose label differs from the inventory's says so
   instead of blaming the control.
   ========================================================================= */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://127.0.0.1:5190";
const SHOTS = "tools/qa";
const WIDTHS = [1440, 834, 390];
const BLANK = 120;            // characters of visible text under which a screen is blank

const ROUTES = [
  "/", "/modules", "/logbook", "/signin",
  "/m/m1", "/m/m1/library", "/m/m1/library/quizzes", "/m/m1/crew", "/m/m1/people",
  "/m/m1/M1.01", "/m/m1/M1.01/quiz", "/m/m1/M1.01/brief", "/m/m1/M1.01/comments",
  "/m/m1/M1.01/lesson/M1.01.1", "/m/m1/M1.01/q/1", "/m/m1/library/cards/1",
  "/m/m1/paper/M1.DEV", "/m/m1/review", "/m/m2", "/m/m3", "/m/m4",
  "/ready-room", "/ready-room/m1",
  "/bookmarks", "/bookmarks/questions", "/bookmarks/cards", "/bookmarks/videos", "/bookmarks/pages",
  "/account/licence", "/account/preferences", "/account/appearance",
  "/account/email", "/account/security",
  "/j/NOTAREALTOKEN", "/this-address-does-not-exist",
];

const sig = () => ({
  url: location.pathname + location.search,
  text: document.body.innerText.replace(/\s+/g, " ").trim(),
  nodes: document.querySelectorAll("*").length,
  cls: document.documentElement.className,
  data: JSON.stringify({ ...document.documentElement.dataset }),
  appCls: document.querySelector(".app")?.className || "",
  tokens: ["--accent", "--ground", "--panel", "--active", "--scale", "--font-scale"]
    .map((t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim()).join("|"),
  store: (() => { try { return JSON.stringify(Object.entries(localStorage).sort()); } catch { return ""; } })(),
  overlays: document.querySelectorAll("dialog[open], [role='dialog'], .sheet-scrim, .scrim.open").length,
  aria: [...document.querySelectorAll("[aria-pressed],[aria-selected],[aria-expanded],[aria-checked]")]
    .map((e) => `${e.getAttribute("aria-pressed") ?? ""}${e.getAttribute("aria-selected") ?? ""}${e.getAttribute("aria-expanded") ?? ""}${e.getAttribute("aria-checked") ?? ""}`).join(""),
});

/* Tagged in the page, by the page, so the index is the element's own. */
const tagControls = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const els = [...document.querySelectorAll('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"]')].filter(vis);
  els.forEach((el, i) => el.setAttribute("data-qa", String(i)));
  return els.map((el, i) => ({
    i,
    tag: el.tagName.toLowerCase(),
    cls: String(el.className).slice(0, 44),
    label: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 40),
    href: el.getAttribute("href") || null,
    w: Math.round(el.getBoundingClientRect().width),
    h: Math.round(el.getBoundingClientRect().height),
  }));
};

const overflows = () => {
  const out = [];
  const W = window.innerWidth;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    /* THE DOCUMENT SCROLLING IS THE FAULT, not an element sticking out.
       The first version flagged anything whose right edge passed the window
       and reported 105 of 105 loads — every one of them the Flight Deck's
       `div.spill`, an absolutely-positioned decoration that is SUPPOSED to
       run off the edge and is clipped by its parent. A test that fires on
       every screen is measuring itself. What matters to a thumb is whether
       the page can be dragged sideways, which is one number. */
    const cs0 = getComputedStyle(el);
    if (r.right > W + 1 && cs0.position === "static" && document.documentElement.scrollWidth > W) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} right=${Math.round(r.right)}`);
    }
    /* Text cut off inside a box that hides it. */
    const cs = getComputedStyle(el);
    if (el.children.length === 0 && el.textContent.trim()
        && /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) {
      out.push(`CLIPPED ${String(el.className).slice(0, 30)} "${el.textContent.trim().slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}`);
    }
  }
  /* A placeholder measured against the field it is in — the five-pixel search. */
  for (const f of document.querySelectorAll("input[placeholder]")) {
    const r = f.getBoundingClientRect();
    if (!r.width) continue;
    const span = document.createElement("span");
    span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(f).font}`;
    span.textContent = f.placeholder;
    document.body.appendChild(span);
    const need = span.getBoundingClientRect().width;
    span.remove();
    if (need > r.width - 8) out.push(`PLACEHOLDER "${f.placeholder}" needs ${Math.round(need)} has ${Math.round(r.width)}`);
  }
  /* Anything a thumb has to hit. */
  const small = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const a = getComputedStyle(el, "::after");
    const pw = parseFloat(a.width) || 0, ph = parseFloat(a.height) || 0;
    return Math.max(r.width, pw) < 24 || Math.max(r.height, ph) < 24;
  }).map((el) => `${String(el.className).slice(0, 26)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
  return { out, small, docScrolls: document.documentElement.scrollWidth > W };
};

const ZERO = /\b0 (quizzes|lessons|chapters|papers|saved|people|questions|answers|cards|marks)\b/gi;

const b = await chromium.launch();
mkdirSync(SHOTS, { recursive: true });
const report = { routes: [], clicks: [], responsive: [], zeroes: [] };

/* ---------------------------------------------------- 1 · the route sweep */
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    const errs = [], bad = [];
    const onErr = (e) => errs.push(String(e.message || e).slice(0, 110));
    const onCon = (m) => { if (m.type() === "error" && !/archive\.org|\.mp4|CORS/.test(m.text())) errs.push("console: " + m.text().slice(0, 100)); };
    const onRes = (res) => { if (res.status() >= 400 && !/favicon|archive\.org|\.mp4/.test(res.url())) bad.push(`${res.status()} ${res.url().split("/").pop().slice(0, 40)}`); };
    page.on("pageerror", onErr); page.on("console", onCon); page.on("response", onRes);
    await page.goto(BASE + r, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    const s = await page.evaluate(sig).catch(() => null);
    const o = await page.evaluate(overflows).catch(() => ({ out: [], small: [] }));
    const zeroes = (s?.text.match(ZERO) || []);
    report.routes.push({ w, route: r, landed: s?.url, len: s?.text.length ?? 0,
      blank: (s?.text.length ?? 0) < BLANK, overflow: o.docScrolls ? (o.out.length || 1) : 0, errs, bad, zeroes });
    if (zeroes.length) report.zeroes.push({ w, route: r, zeroes });
    if (w === 1440) await page.screenshot({ path: `${SHOTS}/${r.replace(/\W+/g, "_") || "home"}.png` }).catch(() => {});
    if (w !== 1440) report.responsive.push({ w, route: r, outside: o.out.slice(0, 4), small: [...new Set(o.small)].slice(0, 4) });
    page.off("pageerror", onErr); page.off("console", onCon); page.off("response", onRes);
  }
  await ctx.close();
}

/* ---------------------------------------------------- 2 · the click sweep */
const resetStore = () => fetch(`${BASE}/harness/reset`, { method: "POST" }).catch(() => {});
const CLICKABLE = ["/", "/m/m1", "/m/m1/library", "/m/m1/crew", "/bookmarks",
                   "/account/licence", "/account/preferences", "/account/appearance", "/ready-room"];
for (const route of CLICKABLE) {
  await resetStore();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  const controls = await page.evaluate(tagControls);
  await ctx.close();

  for (const c of controls) {
    await resetStore();
    const cx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const pg = await cx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e.message).slice(0, 90)));
    await pg.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(1500);
    const now = (await pg.evaluate(tagControls))[c.i];
    const shifted = now?.label !== c.label;
    const before = await pg.evaluate(sig);
    let clicked = true;
    try { await pg.locator(`[data-qa="${c.i}"]`).click({ timeout: 4000 }); }
    catch { clicked = false; }
    await pg.waitForTimeout(900);
    const after = await pg.evaluate(sig).catch(() => before);
    const moved = Object.keys(before).filter((k) => before[k] !== after[k]);
    report.clicks.push({ route, ...c, clicked, moved, errs, shifted });
    await cx.close();
  }
}

await b.close();
writeFileSync("tools/qa/report.json", JSON.stringify(report, null, 1));

/* ----------------------------------------------------------- what it saw */
const blanks = report.routes.filter((r) => r.blank);
const errs = report.routes.filter((r) => r.errs.length);
const bads = report.routes.filter((r) => r.bad.length);
const over = report.routes.filter((r) => r.overflow);
const dead = report.clicks.filter((c) => c.clicked && !c.shifted && c.moved.length === 0);
const broke = report.clicks.filter((c) => c.errs.length);
const unclick = report.clicks.filter((c) => !c.clicked && !c.shifted);
const shifted = report.clicks.filter((c) => c.shifted);
const small = [...new Set(report.responsive.flatMap((r) => r.small))];

console.log(`\nROUTES     ${report.routes.length} loads (${ROUTES.length} addresses × ${WIDTHS.length} widths)`);
console.log(`  blank (<${BLANK} chars)   ${blanks.length}${blanks.length ? "  " + blanks.map((b) => `${b.route}@${b.w}`).join(" ") : ""}`);
console.log(`  page/console errors    ${errs.length}${errs.length ? "  " + errs.slice(0, 4).map((e) => `${e.route}@${e.w}: ${e.errs[0]}`).join(" | ") : ""}`);
console.log(`  4xx/5xx                ${bads.length}${bads.length ? "  " + bads.slice(0, 4).map((e) => `${e.route}: ${e.bad[0]}`).join(" | ") : ""}`);
console.log(`  horizontal overflow    ${over.length}${over.length ? "  " + over.slice(0, 4).map((e) => `${e.route}@${e.w}`).join(" ") : ""}`);
console.log(`\nCLICKS     ${report.clicks.length} controls across ${CLICKABLE.length} screens`);
console.log(`  threw                  ${broke.length}${broke.length ? "  " + broke.slice(0, 3).map((c) => `${c.route} "${c.label}"`).join(" | ") : ""}`);
console.log(`  would not click        ${unclick.length}${unclick.length ? "  " + unclick.slice(0, 3).map((c) => `${c.route} "${c.label}"`).join(" | ") : ""}`);
console.log(`  page moved under it    ${shifted.length}${shifted.length ? "  " + shifted.slice(0, 3).map((c) => `${c.route} "${c.label}"`).join(" | ") + "   <- the sweep's fault, not the control's" : ""}`);
console.log(`  changed nothing        ${dead.length}   <- suspects, re-check each by hand`);
for (const c of dead.slice(0, 25)) console.log(`      ${c.route.padEnd(22)} ${c.tag} "${c.label}" .${c.cls.split(" ")[0]}`);
console.log(`\nRESPONSIVE controls under 24px: ${small.length}${small.length ? "\n      " + small.slice(0, 8).join("\n      ") : ""}`);
console.log(`\nZERO COUNTS  ${report.zeroes.length}${report.zeroes.length ? "  " + report.zeroes.map((z) => `${z.route}@${z.w}: ${z.zeroes.join(",")}`).join(" | ") : "  none, anywhere"}`);
console.log(`\nwritten: tools/qa/report.json and ${WIDTHS.length ? ROUTES.length : 0} screenshots in tools/qa/`);
