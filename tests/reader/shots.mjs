/* Screenshot every surface, at every breakpoint, in both lights.
   §15b.3 — and the point is to LOOK at them, not to archive them. */
import { chromium, webkit } from "playwright";
import { startHarness, SURFACES, readerUrl, SHOTS } from "../harness/run.mjs";
import { mkdirSync } from "node:fs";

const only = process.argv[2];
const server = await startHarness();
mkdirSync(SHOTS, { recursive: true });

try {
  for (const s of SURFACES) {
    if (only && s.id !== only) continue;
    const engine = s.engine === "webkit" ? webkit : chromium;
    const browser = await engine.launch();
    for (const variant of ["night", "day"]) {
      const ctx = await browser.newContext({
        viewport: { width: s.width, height: s.height },
        hasTouch: s.touch, deviceScaleFactor: 2,
      });
      await ctx.setExtraHTTPHeaders({ "x-harness-store": `shot-${s.id}-${variant}` });
      const page = await ctx.newPage();
      /* The variant is an ACCOUNT preference, read back through
         user_progress — not localStorage. Seeding it in the fixture is the
         only way to screenshot both lights honestly. */
      await ctx.request.post("http://127.0.0.1:5190/rest/v1/rpc/merge_progress", {
        data: { uid: "student_one", patch: { "pw-variant-pin": variant } },
        headers: { "content-type": "application/json", "x-harness-store": `shot-${s.id}-${variant}` },
      });
      await page.goto(readerUrl(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".rdr-page:not(.is-placeholder) canvas[data-on]", { timeout: 25_000 });
      await page.waitForTimeout(1200);

      /* Nudge the pointer first. A screenshot is not somebody sitting still,
         and the chrome now fades after a couple of seconds of stillness — so
         every shot came out in the idle state, which is not what these are
         for. */
      const shot = async (name) => {
        await page.mouse.move(420, 400);
        await page.waitForTimeout(240);
        return page.screenshot({ path: `${SHOTS}/${s.id}-${variant}-${name}.png` });
      };
      await shot("rest");

      // The tray, with a marking tool in hand.
      await page.click('.tool[aria-label="Highlighter"]').catch(() => {});
      await page.waitForTimeout(500);
      await shot("tray");

      // The panel, opened rather than toggled — it starts open on a laptop.
      await page.evaluate(() => {
        const p = document.querySelector(".rdr");
        if (p.dataset.panel === "none") document.querySelector('.ib[aria-label="Pages"]').click();
      });
      await page.waitForTimeout(600);
      await page.click('.bar-panel .segs button:nth-child(3)').catch(() => {});   // Marks
      await page.waitForTimeout(500);
      await shot("panel-marks");

      await ctx.close();
      console.log(`  ${s.id} · ${variant}`);
    }
    await browser.close();
  }
} finally { server.kill("SIGTERM"); }
console.log(`\nScreens in ${SHOTS}/`);
