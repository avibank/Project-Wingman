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
      await page.waitForSelector(".page canvas[data-on]", { timeout: 25_000 });
      await page.waitForTimeout(1200);

      /* Nudge the pointer first. A screenshot is not somebody sitting still,
         and the chrome now fades after a couple of seconds of stillness — so
         every shot came out in the idle state, which is not what these are
         for. */
      const shot = async (name) => {
        /* WAKE THE CHROME FIRST. v5 hides it after 2800ms of stillness, and a
           screenshot is not somebody sitting still — every shot came out in
           the idle state, which is not what these are for. */
        await page.evaluate(() => document.querySelector(".rdr")
          ?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 400, clientY: 400 })));
        await page.waitForTimeout(220);
        return page.screenshot({ path: `${SHOTS}/${s.id}-${variant}-${name}.png` });
      };
      /* The coach owns the first fourteen seconds of a first open. Put it away
         so the shots are of the reader rather than of three hint cards. */
      await page.evaluate(() => { try { localStorage.setItem("pw-reader-coached", "1"); } catch {} });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector(".page canvas[data-on]", { timeout: 25_000 });
      await page.waitForTimeout(900);
      await shot("rest");

      /* The bar with a marking tool in hand, which also opens its properties. */
      await page.evaluate(() => document.querySelector('.tools .t[data-tool="hl"]')?.click());
      await page.waitForTimeout(600);
      await shot("props");

      /* The tool chest, over the bar. */
      await page.evaluate(() => document.querySelector(".chest")?.click());
      await page.waitForTimeout(600);
      await shot("chest");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      /* The panel, opposite the bar — opened rather than toggled, because
         whether it starts open depends on the platform and a toggle would
         photograph whichever state it was not in. */
      await page.evaluate(() => {
        const btn = document.querySelector('.acts .ic[aria-label="Panel"]');
        if (!document.querySelector(".panel")?.classList.contains("open")) btn?.click();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelectorAll(".ptabs .pt")[0]?.click());
      await page.waitForTimeout(600);
      await shot("panel");

      /* Marks only — the whole screen becomes the list. */
      await page.evaluate(() => document.querySelector('.acts .ic[aria-label="Marks only"]')?.click());
      await page.waitForTimeout(800);
      await shot("marks-only");
      await page.evaluate(() => document.querySelector('.revh .ic')?.click());
      await page.waitForTimeout(500);

      await ctx.close();
      console.log(`  ${s.id} · ${variant}`);
    }
    await browser.close();
  }
} finally { server.kill("SIGTERM"); }
console.log(`\nScreens in ${SHOTS}/`);
