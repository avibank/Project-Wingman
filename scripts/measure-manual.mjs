/* =============================================================================
   MEASURE THE REAL MANUAL.
   -----------------------------------------------------------------------------
   The reader's numbers in REPORT.md were measured on the 44MB, 1012-page file
   that is actually in the Library, not on the 14-page dev paper — because
   every fault that mattered (1012 viewports fetched up front, ranging silently
   disabled, 3036 nodes read on every scroll) only appears at that size.

   So they have to be re-measurable, or the next change quietly loses them.
   This fetches the real row, hands it to the harness, proxies storage through
   to the real project so the ranged requests are real, and times first paint
   and bytes over the wire.

     node --env-file=.env.local scripts/measure-manual.mjs

   It reads. It writes nothing, to the database or to storage.
   ========================================================================= */
import { chromium } from "playwright";
import { startHarness, URL_BASE } from "../tests/harness/run.mjs";

const SB = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SB || !KEY) {
  console.error("Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — run with --env-file=.env.local");
  process.exit(1);
}

const res = await fetch(
  `${SB}/rest/v1/papers?select=*&order=bytes.desc&limit=1`,
  { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } },
);
const [row] = await res.json();
if (!row) { console.error("no papers in the project"); process.exit(1); }

console.log(`${row.title.trim().slice(0, 60)}`);
console.log(`${row.pages} pages · ${(row.bytes / 1e6).toFixed(1)}MB · ${row.linearized ? "linearized" : "NOT linearized"}`);
console.log(`manifest: ${row.manifest?.boxes?.length ?? 0} page boxes\n`);

/* papers_for's own shape — file_path, which the client turns into a URL. */
process.env.HARNESS_REAL_PAPER = JSON.stringify([{
  id: row.id, module_code: row.module_code, chapter_id: row.chapter_id,
  title: row.title, file_path: row.file_path, pages: row.pages, bytes: row.bytes,
  version: row.version, status: row.status, linearized: row.linearized,
  manifest: row.manifest, visibility: row.visibility ?? "module", owner_id: row.owner_id ?? null,
}]);
process.env.HARNESS_STORAGE_ORIGIN = SB;

const server = await startHarness();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  let bytes = 0, ranged = 0, requests = 0;
  const big = [];
  page.on("response", async (r) => {
    if (!r.url().includes("/storage/")) return;
    requests++;
    if (r.status() === 206) ranged++;
    const len = Number(r.headers()["content-length"] || 0);
    bytes += len;
    if (len > 1e6) big.push(`${r.status()} ${(len / 1e6).toFixed(1)}MB  range=${r.request().headers().range || "none"}  ${r.url().split("/").pop().slice(0, 40)}`);
  });

  const t0 = Date.now();
  await page.goto(`${URL_BASE}/m/m1/paper/${encodeURIComponent(row.id)}?uid=student_one`,
    { waitUntil: "domcontentloaded" });

  await page.waitForSelector(".rdr-page.is-placeholder", { timeout: 30_000 });
  const laidOut = Date.now() - t0;
  const slots = await page.$$eval(".rdr-page, .rdr-gap", (n) => n.length);
  const height = await page.evaluate(() => document.querySelector(".rdr-stack").getBoundingClientRect().height);

  await page.waitForSelector(".rdr-page:not(.is-placeholder) canvas[data-on]", { timeout: 60_000 });
  const drawn = Date.now() - t0;

  /* Frame times while scrolling — the lag was 2626ms average and no amount of
     reading the code found it. */
  await page.evaluate(() => {
    window.__f = []; let last = performance.now();
    const tick = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(160);
  }
  const frames = await page.evaluate(() => {
    const f = window.__f.slice(2);
    return { avg: f.reduce((a, b) => a + b, 0) / f.length, worst: Math.max(...f), n: f.length };
  });
  const canvases = await page.$$eval("canvas", (n) => n.length);
  const at = await page.$eval(".pgpill", (n) => n.textContent);

  console.log(`page slots laid out    ${laidOut}ms   (${slots} slots, ${Math.round(height)}px of scroll)`);
  console.log(`first page drawn       ${drawn}ms`);
  console.log(`over the wire          ${(bytes / 1e6).toFixed(2)}MB in ${requests} requests, ${ranged} of them ranged`);
  console.log(`scrolled to page       ${at}`);
  console.log(`canvases alive         ${canvases}`);
  console.log(`frame time             ${frames.avg.toFixed(1)}ms avg · ${frames.worst.toFixed(0)}ms worst (${frames.n} frames)`);

  const bad = [];
  if (drawn > 8000) bad.push(`first page took ${drawn}ms`);
  if (bytes / 1e6 > 12) bad.push(`${(bytes / 1e6).toFixed(1)}MB pulled for one page`);
  if (canvases > 40) bad.push(`${canvases} canvases alive`);
  if (frames.avg > 60) bad.push(`${frames.avg.toFixed(0)}ms average frame`);
  /* And a look at it, because a number can be right while the screen is not. */
  await page.screenshot({ path: "tests/screens/real-manual.png" });
  console.log("\nscreen: tests/screens/real-manual.png");
  if (big.length) console.log(`\nresponses over 1MB:\n  ${big.join("\n  ")}`);
  console.log(bad.length ? `\nREGRESSED: ${bad.join(" · ")}` : "\nWithin the numbers in REPORT.md.");
  process.exitCode = bad.length ? 1 : 0;
} finally {
  await browser.close();
  server.kill("SIGTERM");
}
