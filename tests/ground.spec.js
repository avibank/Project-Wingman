import { test, expect } from "@playwright/test";

/* Runs against the hidden harness, not the deck.
   These are the checks that caught every layout bug during the design pass:
   288 states, and all of them have to come back clean. */

const HARNESS = "/?bog=1";
const LIVES = ["day one", "quiet", "connected", "hub"];
const WIDTHS = [1040, 820, 390];
const CHAPTERS = [2, 5, 12];

async function audit(page) {
  return page.evaluate(() => {
    const problems = [];
    document.querySelectorAll(".bogh-stage").forEach((stage) => {
      const sb = stage.getBoundingClientRect();
      const where = stage.dataset.w + " " + stage.dataset.surf;

      // nothing spills sideways out of the column
      stage.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        if (r.left < sb.left - 1 || r.right > sb.right + 1) {
          problems.push(`${where}: overflow-x on .${el.className || el.tagName}`);
        }
      });

      // faces stay inside the route box
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

      // cards: real height, nothing clipped, body never sits on the footer
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

      // card parts must never escape a card
      if (stage.querySelectorAll(".bog > .bog-body, .bog > .bog-foot").length) {
        problems.push(`${where}: card part outside a card`);
      }
    });
    return [...new Set(problems)];
  });
}

test("every state lays out cleanly", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(HARNESS);
  await page.locator("[data-all]").click();          // render every width x surface at once

  for (const life of LIVES) {
    await page.locator(`[data-life="${life}"]`).click();
    for (const ch of CHAPTERS) {
      await page.locator("#bogh-ch").fill(String(ch));
      await page.waitForTimeout(120);
      const problems = await audit(page);
      expect(problems, `${life}, ${ch} chapters`).toEqual([]);
    }
  }

  expect(errors).toEqual([]);
});

test("the squadron list pops and stays on screen", async ({ page }) => {
  await page.goto(HARNESS);
  await page.locator('[data-life="hub"]').click();

  for (const w of WIDTHS) {
    await page.locator(`[data-width="${w}"]`).click();
    const plus = page.locator(".bog-add .bog-face").first();
    if (!(await plus.count())) continue;
    await plus.click();
    await page.waitForTimeout(300);

    const box = page.locator(".bog-pop-in");
    await expect(box).toBeVisible();
    const r = await box.boundingBox();
    const vp = page.viewportSize();
    expect(r.x, `pop off the left at ${w}`).toBeGreaterThanOrEqual(4);
    expect(r.y, `pop off the top at ${w}`).toBeGreaterThanOrEqual(4);
    expect(r.x + r.width, `pop off the right at ${w}`).toBeLessThanOrEqual(vp.width - 4);
    expect(r.width, `pop too narrow at ${w}`).toBeGreaterThan(150);

    // a scroll must move it, not dismiss it
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(150);
    await expect(box).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
  }
});

test("a stack on the route opens in place and stays inside its card", async ({ page }) => {
  await page.goto(HARNESS);
  await page.locator('[data-life="hub"]').click();
  await page.locator('[data-width="1040"]').click();

  const stack = page.locator(".bog-av[data-count]").first();
  if (!(await stack.count())) test.skip();
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
  expect(problems).toEqual([]);
});

test("with every surface off the section renders nothing", async ({ page }) => {
  await page.goto(HARNESS);
  await page.locator('[data-surf-index="7"]').click();
  await expect(page.locator(".bog-cards")).toHaveCount(0);
  await expect(page.locator(".bog-route")).toHaveCount(0);
});
