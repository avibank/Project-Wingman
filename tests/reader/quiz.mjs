/* The chapter quiz, sat end to end.
 *
 * It lives in the reader suite because it arrived with the reader's brief, and
 * it stays in its own file because it is not a reader test at all: it never
 * opens a paper, and it survives every rebuild of the reader's chrome
 * untouched. `src/lib/quiz.js` holds the rules; this proves the screen obeys
 * them, in order, because the phases only mean anything in order.
 */
import { group, it, expect, withPage, shot, SURFACES, URL_BASE } from "../harness/run.mjs";

const laptop = SURFACES[0];

group("the quiz · a paper you sit", () => {
  const quizUrl = (uid = "student_one") => `${URL_BASE}/m/m1/M1.01/quiz?uid=${uid}`;

  /* One sitting, all the way through, because the phases only mean anything in
     order: nothing is marked until you hand it in, and the review only exists
     once you have. */
  async function sit(page, { leaveBlank = 1 } = {}) {
    await page.goto(quizUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".mscreen", { timeout: 20_000 });
    await page.click('button:has-text("Start")');
    await page.waitForSelector(".quiz.exam .opt", { timeout: 15_000 });
    const n = await page.locator(".nav-sq").count();
    for (let i = 0; i < n - leaveBlank; i++) {
      await page.evaluate((k) => {
        [...document.querySelectorAll(".nav-sq")][k].click();
      }, i);
      await page.waitForTimeout(90);
      await page.evaluate((k) => {
        document.querySelectorAll(".opt")[k % 3].click();
      }, i);
      await page.waitForTimeout(90);
    }
    return n;
  }

  it("nothing is marked while the paper is open", async () => {
    await withPage(laptop, async (page) => {
      await sit(page, { leaveBlank: 6 });
      const leaked = await page.evaluate(() => ({
        marks: document.querySelectorAll(".opt[data-mark]").length,
        score: /\b\d+ of \d+\b/.test(document.querySelector(".quiz-head")?.innerText || ""),
      }));
      expect(leaked.marks).toBe(0, "an option was marked right or wrong before hand-in");
      expect(leaked.score).toBeFalsy("a score was shown while the paper was open");
    });
  });

  it("the header says how far in you are, without a bar", async () => {
    await withPage(laptop, async (page) => {
      await sit(page, { leaveBlank: 5 });
      const head = await page.locator(".quiz-head").innerText();
      expect(head).toContain("answered");
      expect(await page.locator(".quiz.exam progress, .quiz.exam .q-seg").count()).toBe(0,
        "a progress bar came back — the navigator already says this");
    });
  });

  it("hand-in names what is blank and what was flagged, and does not ask if you are sure", async () => {
    await withPage(laptop, async (page) => {
      const n = await sit(page, { leaveBlank: 1 });
      await page.evaluate(() => document.querySelector(".q-flag").click());
      await page.evaluate((k) => { [...document.querySelectorAll(".nav-sq")][k - 1].click(); }, n);
      await page.waitForTimeout(300);
      await page.click('.q-btn:has-text("Hand it in")');
      await page.waitForTimeout(600);
      const body = await page.locator(".quiz-body").innerText();
      expect(body).toContain("no answer yet");
      expect(body).toContain("Still blank");
      expect(body).notToContain("Are you sure");
    });
  });

  it("going through it shows where the questions came from, and the ones you got right", async () => {
    await withPage(laptop, async (page) => {
      const n = await sit(page, { leaveBlank: 0 });
      expect(n).toBeAtLeast(4);
      await page.evaluate((k) => { [...document.querySelectorAll(".nav-sq")][k - 1].click(); }, n);
      await page.waitForTimeout(300);
      await page.click('.q-btn:has-text("Hand it in")');
      await page.waitForTimeout(500);
      await page.evaluate(() => [...document.querySelectorAll(".q-btn")]
        .filter((b) => /Hand it in/.test(b.textContent)).pop()?.click());
      await page.waitForTimeout(1500);
      await page.evaluate(() => [...document.querySelectorAll(".q-btn")]
        .find((b) => /Go through/.test(b.textContent))?.click());
      await page.waitForTimeout(900);

      const body = await page.locator(".quiz-body").innerText();
      /* The lessons the misses came from, by name rather than by id. */
      expect(body).toContain("Where these came from");
      expect(body).notToContain("M1.01.");
      /* And the other half of what you want to know: which of the right ones
         were guesses. */
      expect(await page.locator(".q-got").count()).toBeAtLeast(1, "no way to see the ones you got right");
      /* Every question is accounted for, right and wrong. */
      const marks = await page.evaluate(() => ({
        right: document.querySelectorAll('.q-rev[data-mark="right"]').length,
        wrong: document.querySelectorAll('.q-rev[data-mark="wrong"]').length,
      }));
      expect(marks.right + marks.wrong).toBe(n, `only ${marks.right + marks.wrong} of ${n} questions are in the review`);
    });
  });

  it("you can sit just the ones you missed", async () => {
    await withPage(laptop, async (page) => {
      const n = await sit(page, { leaveBlank: 0 });
      await page.evaluate((k) => { [...document.querySelectorAll(".nav-sq")][k - 1].click(); }, n);
      await page.waitForTimeout(300);
      await page.click('.q-btn:has-text("Hand it in")');
      await page.waitForTimeout(500);
      await page.evaluate(() => [...document.querySelectorAll(".q-btn")]
        .filter((b) => /Hand it in/.test(b.textContent)).pop()?.click());
      await page.waitForTimeout(1500);
      await page.evaluate(() => [...document.querySelectorAll(".q-btn")]
        .find((b) => /Go through/.test(b.textContent))?.click());
      await page.waitForTimeout(900);

      const missed = await page.evaluate(() => document.querySelectorAll('.q-rev[data-mark="wrong"]').length);
      expect(missed).toBeAtLeast(1, "the fixture answers were all right — nothing to retake");
      await page.click('.q-btn:has-text("I missed")');
      await page.waitForTimeout(1200);
      const head = await page.locator(".quiz-head").innerText();
      expect(head).toContain("the ones you missed");
      /* Its own paper, with only those questions on it. */
      expect(await page.locator(".nav-sq").count()).toBe(missed);
      /* And it is labelled a retake, so it cannot look like it moves the score. */
      expect(await page.locator(".q-retake").count()).toBeAtLeast(1);
    });
  });
});
