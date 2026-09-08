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
      await page.waitForSelector(".pp:not(.pp-ghost) canvas[data-on]", { timeout: 25_000 });
      await page.waitForTimeout(1200);

      const shot = async (name) => page.screenshot({ path: `${SHOTS}/${s.id}-${variant}-${name}.png` });
      await shot("rest");

      // The tray, with a marking tool in hand.
      await page.click('.ptoolbtn[aria-label="Highlight"]').catch(() => {});
      await page.waitForTimeout(500);
      await shot("tray");

      // The panel, opened rather than toggled — it starts open on a laptop.
      await page.evaluate(() => {
        const p = document.querySelector(".paper");
        if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
      });
      await page.waitForTimeout(600);
      await page.click('.prail-tabs button:nth-child(3)').catch(() => {});   // Marks
      await page.waitForTimeout(500);
      await shot("panel-marks");

      await ctx.close();
      console.log(`  ${s.id} · ${variant}`);
    }
    await browser.close();
  }
} finally { server.kill("SIGTERM"); }
console.log(`\nScreens in ${SHOTS}/`);
