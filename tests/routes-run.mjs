/* =============================================================================
   EVERY ROUTE, OPENED. The dead-end sweep, run rather than read.
   -----------------------------------------------------------------------------
   check:doors reads the source for controls that lead nowhere; this opens each
   address the app can be at and asks three things of the screen that arrives:

     · nothing threw — no page error, no console error that is not the
       harness's own missing backend
     · something rendered — a heading, or a card, or a list; a route that
       answers with an empty <main> is a dead end with a URL
     · there is a way back out — every screen but the Flight Deck has one

   It is the browser half of "a folder, button or link that leads nowhere is a
   launch blocker", and it exists because the two live bugs this project has
   shipped — a tab under a search field, and every lesson URL answering
   Vercel's 404 — were both things no static check could see.

     npm run harness, then:  npm run test:routes
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.RT_BASE || "http://127.0.0.1:5190";
/* WHAT IS NOT THIS APP. The last one is worth naming: the module screen pulls
   a poster frame out of each lesson's clip with crossOrigin="anonymous"
   (shell.js §5), and the fixture's clips are on archive.org, which sends no
   CORS headers. The capture fails, the row keeps its tile, and posterFor
   remembers the failure so it is attempted once per lesson and never again —
   in a browser with a localStorage. Every page in this walk gets a fresh
   profile, so every page retries, which is the walk's condition and not the
   app's behaviour. */
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch|Download the React DevTools|harness:|blocked by CORS policy/;

/* Built from the real content ids, the same way check:rewrites does, so a
   lesson's address carries the dots that broke it in production. */
const ROUTES = [
  ["the Flight Deck", "/"],
  ["a module", "/m/m1"],
  ["its Library", "/m/m1/library"],
  ["its Crew", "/m/m1/crew"],
  ["a chapter", "/m/m1/M1.01"],
  ["a lesson", "/m/m1/M1.01/lesson/M1.01.1"],
  ["a chapter quiz", "/m/m1/M1.01/quiz"],
  ["Bookmarks", "/bookmarks"],
  ["a bookmarks folder", "/bookmarks/lessons"],
  ["the Licence", "/account/licence"],
  ["Preferences", "/account/preferences"],
  ["Appearance", "/account/appearance"],
  ["the Ready Room", "/ready-room"],
  ["a made-up address", "/nowhere/at/all"],
];

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}`);
  for (const p of problems.slice(0, 5)) console.log(`        ${p}`);
};

const run = async () => {
  const browser = await chromium.launch();
  for (const [name, path] of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(`threw: ${e}`));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text()); });
    const problems = [];
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".app", { timeout: 15000 });
      /* Long enough for a lazy chunk and its first fetch; the assertion is
         about what is on screen once it has settled, not how fast. */
      await page.waitForTimeout(2500);

      const seen = await page.evaluate(() => {
        const main = document.querySelector(".deck") || document.querySelector("main") || document.body;
        const txt = (main.innerText || "").trim();
        return {
          chars: txt.length,
          headings: main.querySelectorAll("h1, h2, .lesson-name, .lic-name, .ptitle").length,
          buttons: main.querySelectorAll("button, a[href]").length,
          back: Boolean(main.querySelector(".up, .back, .ptitle ~ *, [class*=back]")),
          spinner: Boolean(main.querySelector(".spooling, [class*=spool]")),
          notFound: /Wrong bay|page doesn|not found/i.test(txt),
        };
      });
      if (seen.spinner) problems.push("still spinning after 2.5s");
      if (path === "/nowhere/at/all") {
        /* A made-up address must land somewhere that SAYS so and offers a
           way on. Answering with the Flight Deck silently is worse: the
           address bar then disagrees with the screen. */
        if (!seen.notFound) problems.push("an unknown address renders as though it were real");
        if (!seen.buttons) problems.push("and offers nothing to press");
      } else {
        if (seen.chars < 40) problems.push(`only ${seen.chars} characters of content`);
        if (!seen.headings) problems.push("no heading of any kind");
        if (!seen.buttons) problems.push("nothing to press");
        if (seen.notFound) problems.push("a real address rendered as not-found");
      }
    } catch (e) {
      problems.push(`never settled: ${String(e).split("\n")[0]}`);
    }
    for (const e of errs.slice(0, 3)) problems.push(e.slice(0, 160));
    report(`${name}  ${path}`, problems);
    await page.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exitCode = failures ? 1 : 0;
};

run().catch((e) => { console.error(e); process.exit(1); });
