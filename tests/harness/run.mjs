/* =============================================================================
   THE RUNNER.
   -----------------------------------------------------------------------------
   Playwright's own test runner hangs in this environment — no output at all,
   for minutes, with browsers that launch fine and a dev server already
   answering 200. The library underneath it works perfectly, so the suite drives
   that directly and brings its own three-function runner.

   What is kept, because it is what the brief actually asks for: real Chromium
   and real WebKit, real viewports at all three breakpoints, real PointerEvents
   with pointerType and pressure, real network interception so an assertion can
   read the bytes that crossed the wire, and screenshots.

   What is lost: a pretty HTML report, retries, and trace viewer. Recorded in
   REPORT.md as a deviation.
   ========================================================================= */
import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";

export const URL_BASE = "http://127.0.0.1:5190";
export const SHOTS = "tests/screens";

/* ------------------------------------------------------------- the runner - */
const groups = [];
let current = null;
export function group(name, fn) { current = { name, tests: [] }; groups.push(current); fn(); current = null; }
export function it(name, fn) { (current?.tests ?? []).push({ name, fn }); }

export function expect(actual) {
  return {
    toBe(want, why = "") {
      if (actual !== want) throw new Error(`expected ${JSON.stringify(want)}, got ${JSON.stringify(actual)}${why ? ` — ${why}` : ""}`);
    },
    toEqual(want, why = "") {
      const a = JSON.stringify(actual), b = JSON.stringify(want);
      if (a !== b) throw new Error(`expected ${b}, got ${a}${why ? ` — ${why}` : ""}`);
    },
    toBeTruthy(why = "") { if (!actual) throw new Error(`expected something truthy, got ${JSON.stringify(actual)}${why ? ` — ${why}` : ""}`); },
    toBeFalsy(why = "") { if (actual) throw new Error(`expected something falsy, got ${JSON.stringify(actual)}${why ? ` — ${why}` : ""}`); },
    toContain(bit, why = "") {
      const has = Array.isArray(actual) ? actual.includes(bit) : String(actual).includes(bit);
      if (!has) throw new Error(`expected ${JSON.stringify(actual)?.slice(0, 160)} to contain ${JSON.stringify(bit)}${why ? ` — ${why}` : ""}`);
    },
    notToContain(bit, why = "") {
      const has = Array.isArray(actual) ? actual.includes(bit) : String(actual).includes(bit);
      if (has) throw new Error(`expected NOT to contain ${JSON.stringify(bit)}${why ? ` — ${why}` : ""}`);
    },
    toBeAtLeast(n, why = "") { if (!(actual >= n)) throw new Error(`expected at least ${n}, got ${actual}${why ? ` — ${why}` : ""}`); },
    toBeAtMost(n, why = "") { if (!(actual <= n)) throw new Error(`expected at most ${n}, got ${actual}${why ? ` — ${why}` : ""}`); },
    toBeNear(n, tol, why = "") { if (Math.abs(actual - n) > tol) throw new Error(`expected ${n}±${tol}, got ${actual}${why ? ` — ${why}` : ""}`); },
  };
}

/* -------------------------------------------------------------- the server - */
export async function startHarness() {
  const server = spawn("./node_modules/.bin/vite", ["--config", "tests/harness/vite.config.js"],
    { stdio: ["ignore", "ignore", "pipe"] });
  server.stderr.on("data", (d) => { const s = String(d); if (/error/i.test(s)) process.stderr.write(`[harness] ${s}`); });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(URL_BASE, { signal: AbortSignal.timeout(1500) })).ok) return server; } catch { /* not yet */ }
    await wait(400);
  }
  server.kill();
  throw new Error(`harness never came up at ${URL_BASE}`);
}

/* ------------------------------------------------------------ the contexts - */
/* THREE PLATFORMS, NOT THREE WIDTHS. v5 branches on what the pointer can do,
   so the surfaces have to differ in capability and not only in size — a 1194px
   window on a Mac is `desktop` and a 1194px iPad is `tablet`, and testing both
   at 1194 with the same pointer would prove nothing. `isMobile` is what makes
   WebKit answer `pointer:coarse` and drop `hover:hover`; `hasTouch` alone only
   adds touch points, which is why the iPad surfaces carry both.

   `expect` is the platform the reader should choose. A surface whose id says
   iPad and whose reader says desktop is the bug this list exists to catch. */
export const SURFACES = [
  { id: "laptop", engine: "chromium", width: 1440, height: 900, touch: false, mobile: false, expect: "desktop" },
  { id: "ipad-landscape", engine: "webkit", width: 1194, height: 834, touch: true, mobile: true, expect: "tablet" },
  { id: "ipad-portrait", engine: "webkit", width: 834, height: 1194, touch: true, mobile: true, expect: "tablet" },
  { id: "phone", engine: "webkit", width: 390, height: 844, touch: true, mobile: true, expect: "phone" },
];

export async function withPage(surface, fn, { uid = "student_one", staff = false } = {}) {
  const engine = surface.engine === "webkit" ? webkit : chromium;
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    viewport: { width: surface.width, height: surface.height },
    hasTouch: surface.touch,
    isMobile: surface.engine === "webkit" ? !!surface.mobile : false,
    deviceScaleFactor: 2,
  });
  /* Each context gets its own fixture store, so one test's marks never leak
     into another's counts. */
  await ctx.setExtraHTTPHeaders({ "x-harness-store": `${surface.id}-${uid}-${Date.now()}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  try { return await fn(page, { errors, ctx, browser, uid, staff }); }
  finally { await browser.close(); }
}

export const readerUrl = (uid = "student_one", staff = false, extra = "") =>
  `${URL_BASE}/m/m1/paper/M1.DEV?uid=${uid}${staff ? "&staff=1" : ""}${extra}`;

export async function openReader(page, { uid = "student_one", staff = false, extra = "" } = {}) {
  await page.goto(readerUrl(uid, staff, extra), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rdr", { timeout: 25_000 });
  /* 25s was enough when this suite took 150 seconds end to end. On a loaded
     machine it takes 2000, every step is proportionally slower, and a wait for
     a real pdf.js raster starts timing out — on a DIFFERENT test each run,
     which is the signature of a budget rather than a bug. Raised so a slow
     machine reports a slow pass instead of a random failure. */
  await page.waitForSelector(".page:not(.ph) canvas[data-on]", { timeout: 90_000 });
  return page;
}

export async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/* ---------------------------------------------------------------- driving - */
export async function run(only = null) {
  const server = await startHarness();
  console.log(`harness up at ${URL_BASE}\n`);
  let pass = 0; const fails = [];
  const t0 = Date.now();
  try {
    for (const g of groups) {
      if (only && !g.name.toLowerCase().includes(only.toLowerCase())) continue;
      console.log(`\n${g.name}`);
      for (const t of g.tests) {
        const started = Date.now();
        try {
          await t.fn();
          pass++;
          console.log(`  ok   ${t.name}  ${Date.now() - started}ms`);
        } catch (e) {
          fails.push({ group: g.name, name: t.name, err: e.message });
          console.log(`  FAIL ${t.name}\n         ${e.message.split("\n")[0]}`);
        }
      }
    }
  } finally { server.kill("SIGTERM"); }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nreader: ${pass} passed, ${fails.length} failed  (${secs}s)`);
  mkdirSync("tests", { recursive: true });
  writeFileSync("tests/last-run.json", JSON.stringify({ pass, fails, secs }, null, 2));
  if (fails.length) {
    console.log("\nFailures:");
    for (const f of fails) console.log(`  ${f.group} · ${f.name}\n    ${f.err}`);
    process.exit(1);
  }
}
