/* =============================================================================
   A FAILED DOWNLOAD MENDS ITSELF (src/lib/recover.js).
   -----------------------------------------------------------------------------
   Each download the owner's phone lost on 2026-09-21 is failed on purpose,
   and the page is checked for what a student would see afterwards:

     · nothing fails               → one fetch, no reload (the guard that
                                     matters: a healthy page judged broken
                                     would reload on every visit)
     · the stylesheet fails once   → fetched again, styled, no reload
     · it arrives cut short once   → fetched again, whole, and reported
     · the stylesheet always fails → one reload, then left alone (no loop)
     · the course fails once       → the course arrives anyway
     · the course always fails     → one reload at most, and the Flight Deck
                                     still draws from data.js

   Against the production harness, which serves the built files:
     npm run harness:prod
     RECOVER_BASE=http://127.0.0.1:5191 npm run test:recover
     RECOVER_BROWSER=webkit npm run test:recover
   ========================================================================= */
import { chromium, webkit } from "playwright";

const BASE = process.env.RECOVER_BASE || "http://127.0.0.1:5191";
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : `  ${detail}`}`);
};

/* RECOVER_BROWSER=webkit walks it in Safari's engine, which is what the
   owner's phone runs. */
const browser = await (process.env.RECOVER_BROWSER === "webkit" ? webkit : chromium).launch();

/* A page whose requests matching `re` fail `times` times (Infinity: always).
   Counts document loads, which is what a reload is. */
async function withFailing(re, times) {
  const cx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await cx.newPage();
  let failed = 0;
  let loads = 0;
  const seen = [];
  pg.on("load", () => { loads++; });   // a document load; the app's own history moves are not reloads
  await pg.route(re, (route) => {
    seen.push(route.request().url());
    if (failed < times) { failed++; return route.abort("failed"); }
    return route.continue();
  });
  return { cx, pg, seen, loads: () => loads, failed: () => failed };
}

const styled = (pg) => pg.evaluate(() => {
  /* The app's own stylesheet, with its rules in: a failed one is an empty
     sheet, not a missing one, and the inline styles some components carry
     keep a failed page looking half right. */
  return [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => { try { return /\/assets\/index-/.test(l.href) && l.sheet && l.sheet.cssRules.length > 100; } catch { return false; } });
});
const deckText = (pg) => pg.evaluate(() => (document.querySelector(".deck")?.innerText || "").replace(/\s+/g, " "));

/* 0 · nothing fails: nothing is fetched twice and nothing reloads. The one
   that matters most — a healthy page judged broken would reload every visit. */
{
  const t = await withFailing(/\/assets\/index-[^/]+\.css/, 0);
  await t.pg.goto(`${BASE}/?uid=student_one`);
  await t.pg.waitForTimeout(4000);
  ok("a healthy page fetches its stylesheet once", t.seen.length === 1, t.seen.join(" | "));
  ok("and the marker is its last rule", await t.pg.evaluate(() => {
    const l = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) => /\/assets\/index-/.test(x.href));
    const rules = l?.sheet?.cssRules;
    return Boolean(rules && rules[rules.length - 1].selectorText === "#pw-sheet-end");
  }));
  ok("and does not reload", t.loads() === 1, `loads ${t.loads()}`);
  ok("and is styled", await styled(t.pg));
  await t.cx.close();
}

/* 1 · the stylesheet fails once */
{
  const t = await withFailing(/\/assets\/index-[^/]+\.css/, 1);
  await t.pg.goto(`${BASE}/?uid=student_one`);
  await t.pg.waitForTimeout(4000);
  ok("a stylesheet that failed once is fetched again", t.failed() === 1 && t.seen.some((u) => /[?&]r=/.test(u)), t.seen.join(" | "));
  ok("and the page is styled", await styled(t.pg));
  ok("without a reload", t.loads() === 1, `loads ${t.loads()}`);
  await t.cx.close();
}

/* 1b · the stylesheet arrives cut short once: it loads, it has rules, and
   most of them are missing — what Safari kept serving the owner's phone */
{
  const cx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await cx.newPage();
  let n = 0;
  let loads = 0;
  const seen = [];
  pg.on("load", () => { loads++; });
  await pg.route(/\/assets\/index-[^/]+\.css/, async (route) => {
    seen.push(route.request().url());
    if (n++ > 0) return route.continue();
    const res = await route.fetch();
    const body = await res.text();
    return route.fulfill({ response: res, body: body.slice(0, Math.floor(body.length * 0.4)) });
  });
  await pg.goto(`${BASE}/?uid=student_one`);
  await pg.waitForTimeout(4000);
  ok("a stylesheet that arrived cut short is fetched again", seen.length === 2 && /[?&]r=/.test(seen[1]), seen.join(" | "));
  ok("and the page is whole", await styled(pg));
  ok("without a reload", loads === 1, `loads ${loads}`);
  ok("and it is reported", await pg.evaluate(async () => {
    const r = await fetch("/rest/v1/reports?target_id=eq.stylesheet&select=reason");
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.some((x) => /cut short/.test(x.reason || ""));
  }));
  await cx.close();
}

/* 2 · the stylesheet always fails */
{
  const t = await withFailing(/\/assets\/index-[^/]+\.css/, Infinity);
  await t.pg.goto(`${BASE}/?uid=student_one`);
  await t.pg.waitForTimeout(12000);
  ok("a stylesheet that never loads reloads the page once, and only once", t.loads() === 2, `loads ${t.loads()}`);
  await t.cx.close();
}

/* 3 · the course fails once */
{
  const t = await withFailing(/\/assets\/test-content-[^/]+\.js/, 1);
  await t.pg.goto(`${BASE}/?uid=student_one`);
  await t.pg.waitForTimeout(9000);
  const text = await deckText(t.pg);
  ok("a course that failed once arrives anyway", /Rotary Wing Aerodynamics/.test(text), text.slice(0, 160));
  ok("with one reload at most", t.loads() <= 2, `loads ${t.loads()}`);
  await t.cx.close();
}

/* 4 · the course always fails */
{
  const t = await withFailing(/\/assets\/test-content-[^/]+\.js/, Infinity);
  await t.pg.goto(`${BASE}/?uid=student_one`);
  await t.pg.waitForTimeout(20000);
  const text = await deckText(t.pg);
  ok("a course that never loads reloads once at most", t.loads() <= 2, `loads ${t.loads()}`);
  ok("and the Flight Deck still draws its modules", /Module 13d/.test(text), text.slice(0, 160));
  await t.cx.close();
}

await browser.close();
console.log(`\nrecover: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
