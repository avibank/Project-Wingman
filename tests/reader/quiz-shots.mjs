/* The quiz, at every breakpoint, in both lights, at every phase.
   Same method as the reader: screenshot it, look, fix what is wrong. */
import { chromium, webkit } from "playwright";
import { startHarness, SURFACES, URL_BASE, SHOTS } from "../harness/run.mjs";
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
        viewport: { width: s.width, height: s.height }, hasTouch: s.touch, deviceScaleFactor: 2,
      });
      const store = `quiz-${s.id}-${variant}`;
      await ctx.setExtraHTTPHeaders({ "x-harness-store": store });
      await ctx.request.post(`${URL_BASE}/rest/v1/rpc/merge_progress`, {
        data: { uid: "student_one", patch: { "pw-variant-pin": variant } },
        headers: { "content-type": "application/json", "x-harness-store": store },
      });
      const page = await ctx.newPage();
      const shot = (n) => page.screenshot({ path: `${SHOTS}/quiz-${s.id}-${variant}-${n}.png` });

      await page.goto(`${URL_BASE}/m/m1/M1.01/quiz?uid=student_one`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".mscreen", { timeout: 20_000 });
      await page.waitForTimeout(1200);
      await shot("cover");

      await page.click('button:has-text("Start")').catch(() => {});
      await page.waitForTimeout(900);
      await shot("paper");

      // Answer everything, leave one blank, and go to the hand-in screen.
      await page.evaluate(() => {
        const n = document.querySelectorAll(".nav-sq").length;
        for (let i = 0; i < n - 1; i++) {
          [...document.querySelectorAll(".nav-sq")][i].click();
          document.querySelectorAll(".opt")[i % 3].click();
        }
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelector(".q-flag")?.click());
      await page.waitForTimeout(300);
      /* Hand-in only appears on the LAST question, so go there first — the
         script used to stop one short and screenshot the paper twice. */
      await page.evaluate(() => {
        const sq = [...document.querySelectorAll(".nav-sq")];
        sq[sq.length - 1].click();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => [...document.querySelectorAll(".q-btn")].find((b) => /Hand it in/.test(b.textContent))?.click());
      await page.waitForTimeout(700);
      await shot("handin");

      await page.evaluate(() => [...document.querySelectorAll(".q-btn")].filter((b) => /Hand it in/.test(b.textContent)).pop()?.click());
      await page.waitForTimeout(1500);
      await shot("results");

      await page.evaluate(() => [...document.querySelectorAll(".q-btn")].find((b) => /Go through/.test(b.textContent))?.click());
      await page.waitForTimeout(900);
      await shot("review");

      await ctx.close();
      console.log(`  ${s.id} · ${variant}`);
    }
    await browser.close();
  }
} finally { server.kill("SIGTERM"); }
console.log(`\nQuiz screens in ${SHOTS}/`);
