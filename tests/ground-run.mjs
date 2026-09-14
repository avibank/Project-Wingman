/* =============================================================================
   The Back on the ground specs, driven through the Playwright library.
   -----------------------------------------------------------------------------
   tests/ground.spec.js is the pack's form of these four checks, for
   `npx playwright test`. Playwright's own test runner hangs in this environment
   with no output at all — tests/harness/run.mjs records the same thing — so
   this runs the identical audits through the library, which works.

     npm run dev, then:  BOG_BASE=http://localhost:5173 npm run test:ground
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.BOG_BASE || "http://localhost:5173";
const HARNESS = `${BASE}/?bog=1`;
const LIVES = ["day one", "quiet", "connected", "hub"];
const WIDTHS = [1040, 820, 390];
const CHAPTERS = [2, 5, 12];

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}`);
  problems.slice(0, 12).forEach((p) => console.log(`        ${p}`));
};

// The pack's audit, unchanged.
const audit = (page) => page.evaluate(() => {
  const problems = [];
  document.querySelectorAll(".bogh-stage").forEach((stage) => {
    const sb = stage.getBoundingClientRect();
    const where = stage.dataset.w + " " + stage.dataset.surf;

    stage.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if (r.left < sb.left - 1 || r.right > sb.right + 1) {
        problems.push(`${where}: overflow-x on .${el.className || el.tagName}`);
      }
    });

    const route = stage.querySelector(".bog-route");
    if (route) {
      const rb = route.getBoundingClientRect();
      if (route.clientHeight < 60) problems.push(`${where}: route collapsed`);
      route.querySelectorAll(".bog-mark").forEach((m) => {
        const r = m.getBoundingClientRect();
        if (r.top < rb.top - 2) problems.push(`${where}: marker above the route`);
        if (r.bottom > rb.bottom + 2) problems.push(`${where}: marker below the route`);
        if (r.left < rb.left - 2 || r.right > rb.right + 2) problems.push(`${where}: marker outside sideways`);
      });
    }

    stage.querySelectorAll(".bog-cards > .bog-card").forEach((c) => {
      if (c.getBoundingClientRect().height < 60) problems.push(`${where}: card too short`);
      c.querySelectorAll(".bog-lead,.bog-why,.bog-nm,.bog-title,.bog-t,.bog-lbl").forEach((t) => {
        if (t.scrollWidth > t.clientWidth + 2) problems.push(`${where}: clipped "${t.textContent.slice(0, 24)}"`);
      });
      const body = c.querySelector(".bog-body");
      const foot = c.querySelector(".bog-foot");
      if (body && foot && body.getBoundingClientRect().bottom > foot.getBoundingClientRect().top + 1) {
        problems.push(`${where}: body over footer`);
      }
    });

    if (stage.querySelectorAll(".bog > .bog-body, .bog > .bog-foot").length) {
      problems.push(`${where}: card part outside a card`);
    }
  });
  return [...new Set(problems)];
});

const browser = await chromium.launch();
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(HARNESS);
  await page.locator(".bogh").waitFor();
  return { page, errors };
};

try {
  {
    const { page, errors } = await open();
    await page.locator("[data-all]").click();
    const problems = [];
    for (const life of LIVES) {
      await page.locator(`[data-life="${life}"]`).click();
      for (const ch of CHAPTERS) {
        await page.locator("#bogh-ch").fill(String(ch));
        await page.waitForTimeout(120);
        for (const p of await audit(page)) problems.push(`${life}, ${ch} chapters: ${p}`);
      }
    }
    report(`every state lays out cleanly (${LIVES.length * CHAPTERS.length * WIDTHS.length * 8} states)`, problems);
    report("no console errors and no exceptions", errors);
    await page.close();
  }

  {
    const { page } = await open();
    await page.locator('[data-life="hub"]').click();
    const problems = [];
    for (const w of WIDTHS) {
      await page.locator(`[data-width="${w}"]`).click();
      const plus = page.locator(".bog-add .bog-face").first();
      if (!(await plus.count())) continue;
      await plus.click();
      await page.waitForTimeout(300);
      const box = page.locator(".bog-pop-in");
      if (!(await box.isVisible())) { problems.push(`no pop at ${w}`); continue; }
      const r = await box.boundingBox();
      const vp = page.viewportSize();
      if (r.x < 4) problems.push(`pop off the left at ${w}`);
      if (r.y < 4) problems.push(`pop off the top at ${w}`);
      if (r.x + r.width > vp.width - 4) problems.push(`pop off the right at ${w}`);
      if (r.width <= 150) problems.push(`pop too narrow at ${w}`);
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(150);
      if (!(await box.isVisible())) problems.push(`a scroll dismissed the pop at ${w}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      if (await page.locator(".bog-pop-in").count()) problems.push(`Escape left the pop open at ${w}`);
    }
    report("the squadron list pops and stays on screen", problems);
    await page.close();
  }

  {
    const { page } = await open();
    await page.locator('[data-life="hub"]').click();
    await page.locator('[data-width="1040"]').click();
    const stack = page.locator(".bog-av[data-count]").first();
    if (!(await stack.count())) {
      console.log("skip  a stack on the route opens in place (no stack at this width)");
    } else {
      await stack.click();
      await page.waitForTimeout(250);
      const problems = await page.evaluate(() => {
        const pod = document.querySelector(".bog-fanpod");
        if (!pod) return ["no stack opened"];
        const card = pod.closest(".bog-route").getBoundingClientRect();
        const b = pod.getBoundingClientRect();
        const out = [];
        if (b.left < card.left - 2) out.push("stack off the left of the card");
        if (b.right > card.right + 2) out.push("stack off the right of the card");
        return out;
      });
      report("a stack on the route opens in place and stays inside its card", problems);
    }
    await page.close();
  }

  {
    const { page } = await open();
    await page.locator('[data-surf-index="7"]').click();
    const problems = [];
    if (await page.locator(".bog-cards").count()) problems.push("cards rendered");
    if (await page.locator(".bog-route").count()) problems.push("route rendered");
    report("with every surface off the section renders nothing", problems);
    await page.close();
  }
} finally {
  await browser.close();
}

process.exitCode = failures ? 1 : 0;
