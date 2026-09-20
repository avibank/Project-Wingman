/* =============================================================================
   THE EXAM SCREEN, ACROSS EVERY LIVERY, EVERY FINISH, NIGHT AND DAY.
   -----------------------------------------------------------------------------
   The port brief's own checklist, run rather than eyeballed: six liveries ×
   three finishes × night and day, each at the three layouts the screen has —
   and the layouts switch on the CONTAINER, not the window, so the sizes below
   are chosen to put `.exam-frame` either side of 900px and 560px.

   Then every control in the brief's table, the six result cases against three
   different bars, and the screen with motion turned off.

   Contrast is NOT measured here. It is measured on the tokens themselves, in
   `npm run check:exam`, where all thirty-six palettes can be resolved without
   a browser and where a gradient behind a panel cannot make a reading lie.

     npm run harness, then:  npm run test:exam
     EXAM_SHOTS=all keeps a screenshot of every state rather than a sample.
   ========================================================================= */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { seedOf, allowanceFor, clock } from "../src/lib/quiz.js";
import { shuffleOptions } from "../src/lib/retention.js";
import { lightOverride } from "../src/lib/finishEngine.js";
import { loadContent } from "../src/lib/contentLoader.js";
import fixture from "../src/content/test-content.json" with { type: "json" };

const BASE = process.env.EXAM_BASE || "http://127.0.0.1:5190";
const LIVERIES = (process.env.EXAM_LIVERIES || "sky,amber,tarmac,beacon,runway,skydrol").split(",");
const FINISHES = [null, "aurora", "manual"];
const VARIANTS = ["night", "day"];
/* Window sizes chosen for the CONTAINER they leave the exam: wide enough for
   the two-column layout, between the two breakpoints, and a phone. */
const SIZES = [[1440, 900, "desktop"], [860, 1000, "tablet"], [390, 844, "phone"]];
const SHOTS = "tests/screens/exam";
const ALL_SHOTS = process.env.EXAM_SHOTS === "all";
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch/;

const CHAPTER = "M1.01";
const QUIZ_URL = `${BASE}/m/m1/${CHAPTER}/quiz?uid=student_one`;

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}  (${problems.length} problems)`);
  const kinds = new Map();
  for (const p of problems) {
    const kind = p.replace(/^[^:]*: /, "").replace(/\d+(\.\d+)?px/g, "Npx").replace(/\d+%/g, "N%");
    if (!kinds.has(kind)) kinds.set(kind, { count: 0, first: p });
    kinds.get(kind).count += 1;
  }
  for (const [kind, { count, first }] of kinds) console.log(`        ${count} × ${kind}\n            e.g. ${first}`);
};

/* The result screen counts up over a second and fills the line over another,
   so a fixed wait is a race with an animation — measured losing it at 1500ms
   on a busy machine, with the line still climbing through 63% of 75%. Wait
   for the number to arrive and the width to stop moving instead. */
const settledResult = async (page, pct) => {
  await page.waitForFunction((want) => document.querySelector(".result__big")?.textContent === `${want}%`,
    pct, { timeout: 8000 });
  /* Not "has it stopped moving": the ease crawls the last pixel and a
     stillness test passes while the line is still a percent short. Wait for
     the width it is going to. */
  await page.waitForFunction((want) => {
    const el = document.querySelector(".meter__fill");
    if (!el) return false;
    const track = el.parentElement.getBoundingClientRect().width;
    return Math.abs((el.getBoundingClientRect().width / track) * 100 - want) < 0.6;
  }, pct, { timeout: 8000, polling: 100 });
};

const prefs = (patch) => fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ uid: "student_one", patch }),
});

/* ---------------------------------------------------------------- the audit */
const audit = (page, expect) => page.evaluate((expect) => {
  const out = [];
  const q = (s) => document.querySelector(s);
  const shown = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  const box = (el) => el.getBoundingClientRect();

  const frame = q(".exam-frame");
  if (!frame) return ["the exam did not render"];
  const doc = document.scrollingElement;
  if (doc.scrollWidth > innerWidth + 1) out.push(`the page scrolls sideways by ${doc.scrollWidth - innerWidth}px`);
  for (const el of document.querySelectorAll(".exam, .exam-bar, .question, .navigator, .result, .result__row")) {
    if (shown(el) && el.scrollWidth > el.clientWidth + 1) out.push(`${el.className.split(" ")[0]} scrolls sideways by ${el.scrollWidth - el.clientWidth}px`);
  }

  /* The layout is the container's, not the window's. */
  const w = Math.round(box(frame).width);
  const mode = w > 900 ? "desktop" : w > 560 ? "tablet" : "phone";
  if (mode !== expect.mode) out.push(`the frame is ${w}px, which is ${mode} rather than ${expect.mode}`);
  const card = q(".question");
  const nav = q(".navigator");
  if (card && nav) {
    const beside = box(nav).left >= box(card).right - 1;
    if (mode === "desktop" && !beside) out.push("the navigator is not beside the card");
    if (mode !== "desktop" && beside) out.push("the navigator is still beside the card");
    if (mode !== "desktop" && box(nav).top > box(card).top) out.push("the navigator is under the card rather than above it");
  }
  const cell = q(".qcell");
  if (cell) {
    const h = Math.round(box(cell).height);
    const want = mode === "phone" ? 38 : mode === "tablet" ? 42 : Math.round(box(cell).width);
    if (Math.abs(h - want) > 1) out.push(`a grid cell is ${h}px tall, not ${want}px`);
    const perRow = [...document.querySelectorAll(".qcell")].filter((c) => Math.abs(box(c).top - box(cell).top) < 2).length;
    const wantRow = mode === "desktop" ? 4 : 8;
    if (perRow !== wantRow) out.push(`${perRow} cells to a row, not ${wantRow}`);
  }
  const label = q(".exam-timer__label");
  if (label && shown(label) !== (mode !== "phone")) out.push(`TIME LEFT is ${shown(label) ? "shown" : "hidden"} on ${mode}`);

  /* §12's floor, kept as a TARGET rather than as a size. The reference draws a
     35px button; the app requires 44px of finger. Both: the button is the
     design's height and carries a transparent 44px hit area centred on it. */
  for (const b of document.querySelectorAll(".exam-frame .btn")) {
    if (!shown(b)) continue;
    const h = box(b).height;
    /* The design's own range: 35 in a card's footer, 30 in the bar on a
       phone. What this is really asking is that none of them has been pushed
       back up to the 44px floor, which is the target's job, not the size's. */
    if (h < 29 || h > 39) out.push(`a ${b.className.split(" ")[0]} button is ${Math.round(h)}px tall, outside the design's 30–37`);
    const target = getComputedStyle(b, "::after").height;
    if (target !== "44px") out.push(`that button's hit area is ${target}, not 44px`);
  }
  for (const b of document.querySelectorAll(".exam-frame button:not(.btn):not(.qcell)")) {
    if (shown(b) && box(b).height < 43.5) out.push(`a ${b.className.split(" ")[0]} button is under the tap floor`);
  }

  const cs = getComputedStyle(frame);
  for (const t of ["--accent", "--accent-fill", "--accent-ink", "--accent-soft",
    "--on-accent", "--line-strong", "--flag", "--radius", "--radius-sm"]) {
    if (!cs.getPropertyValue(t).trim()) out.push(`${t} resolves to nothing`);
  }

  /* THE MATTE FINISH, WHICH IS THE WHOLE POINT OF THIS SCREEN'S LOOK. The
     ground is flat and hue-traced, the scenery behind it is off whatever
     finish the student wears, and the accent is capped. Colours are read as
     painted rather than as declared: `oklch(from …)` only proves itself
     resolved. */
  if (document.documentElement.dataset.screen !== "exam") out.push("the screen is not flagged as the exam");
  const scenery = document.querySelector(".deck-light");
  if (scenery && getComputedStyle(scenery).display !== "none") out.push("the finish's scenery is showing behind the paper");
  const paint = (el, prop) => getComputedStyle(el)[prop];
  const L = (v) => { const m = /^(?:oklch|oklab)\(([\d.]+)/.exec(String(v)); return m ? +m[1] : null; };
  const groundL = L(paint(document.body, "backgroundColor"));
  const wantGround = expect.variant === "day" ? 0.968 : 0.165;
  if (groundL === null || Math.abs(groundL - wantGround) > 0.02) {
    out.push(`the ground is ${paint(document.body, "backgroundColor")}, not the matte ${wantGround}`);
  }
  if (/\/\s*0?\.\d+\)/.test(paint(q(".exam-bar"), "backgroundColor"))) out.push("the bar is still translucent glass");

  /* The route line: two pixels along the bottom of the bar, and nothing like
     the module screen's own `.route`, which is a padded row with a rule. */
  const route = q(".exam-bar .route");
  if (!route) out.push("the bar has no route line");
  else {
    const rb = box(route), bb = box(q(".exam-bar"));
    if (Math.round(rb.height) !== 2) out.push(`the route line is ${Math.round(rb.height)}px tall, not 2px`);
    if (Math.abs(rb.bottom - bb.bottom) > 2) out.push("the route line is not along the bottom of the bar");
  }

  /* An answered cell is the raised surface with an accent tick, never a block
     of accent. */
  /* An answered cell that is not also the one you are on: the current cell
     keeps the panel and takes the accent outline instead, which is the
     design. */
  const done = document.querySelector(".qcell.is-answered:not(.is-current)");
  if (done) {
    const bg = paint(done, "backgroundColor");
    const wantRaised = expect.variant === "day" ? 0.95 : 0.245;
    if (L(bg) === null || Math.abs(L(bg) - wantRaised) > 0.02) out.push(`an answered cell is ${bg}, not the raised surface`);
    const tick = getComputedStyle(done, "::before").backgroundColor;
    if (!tick || tick === "rgba(0, 0, 0, 0)") out.push("an answered cell has no tick under its number");
  }
  /* THE FLAG NEVER FOLLOWS THE LIVERY. Same red on Beacon as on Sky. */
  const flag = cs.getPropertyValue("--flag").trim();
  if (!/oklch\(\.\d+ \.2\d* 27\)/.test(flag)) out.push(`the flag is ${flag}`);

  const day = Boolean(q(".app")?.classList.contains("theme-light"));
  if (day !== (expect.variant === "day")) out.push(`the app is ${day ? "day" : "night"}, not ${expect.variant}`);

  /* THE SCREEN'S OWN TYPE, NOT THE PAGE'S. `.mscreen .lbody p` is one element
     more specific than `.exam-frame .question__text`, so while the paper sat
     inside that wrapper every paragraph on it took the lesson page's body size
     — the question at 17px where the design says 21, and the navigator's label
     at 17px where it says 11. A token check cannot see this; a measurement
     can. */
  /* The reference demo's own figures, adopted wholesale. */
  const type = [
    [".question__text", mode === "phone" ? 18 : 20],
    [".navigator__title", 11],
    [".option__text", 16],
    [".exam-timer__value", mode === "phone" ? 17 : 19],
    [".qcell", mode === "phone" ? 13 : 14],
  ];
  for (const [sel, want] of type) {
    const el = q(sel);
    if (!el) { out.push(`${sel} is missing`); continue; }
    const got = Math.round(parseFloat(getComputedStyle(el).fontSize));
    if (got !== want) out.push(`${sel} is ${got}px, not ${want}px`);
  }

  if (!q(".exam-bar__name")?.textContent.trim()) out.push("the exam bar has no quiz name");
  if (!q(".question__text")?.textContent.trim()) out.push("the question card is empty");
  if (document.querySelectorAll(".option").length < 2) out.push("the question has fewer than two answers");
  return out;
}, expect);

/* An attempt with a chosen number of right answers, written where the screen
   reads it. The option order is the component's own: seeded from the attempt,
   so the stored answer means the same sentence on the way back in. */
/* The same adapter the app uses, so the ids, the quiz id and the question
   order here are the ones the screen will read rather than a second opinion. */
const chapter = loadContent(fixture).modules[0].chapters.find((c) => c.id === CHAPTER);
const attemptWith = (right) => {
  const startedAt = new Date().toISOString();
  const draft = { startedAt };
  const seed = seedOf(draft);
  const answers = chapter.questions.map((qn, i) => {
    const shuffled = shuffleOptions(qn, seed + i * 17);
    return i < right ? shuffled.correct : (shuffled.correct + 1) % shuffled.options.length;
  });
  return {
    quizId: chapter.quizId, lessonIds: chapter.questions.map((qn) => qn.lessonId),
    answers, flagged: answers.map(() => false), at: 0,
    left: allowanceFor(answers.length), submittedAt: null, startedAt,
  };
};

const browser = await chromium.launch();
const problems = [];
const errors = [];
const acts = [];
let states = 0;
const expect = (what, cond, detail = "") => { if (!cond) acts.push(detail ? `${what} — ${detail}` : what); };

try {
  mkdirSync(SHOTS, { recursive: true });

  /* ------------------------------------------------- every livery and finish */
  for (const variant of VARIANTS) {
    for (const livery of LIVERIES) {
      for (const finish of FINISHES) {
        await prefs({ "pw-livery": livery, "pw-variant-pin": variant, "pw-finish": finish });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const tag = `${variant} ${livery} ${finish || "standard"}`;
        page.on("pageerror", (e) => errors.push(`${tag}: ${String(e).slice(0, 160)}`));
        page.on("console", (m) => {
          if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`${tag}: ${m.text().slice(0, 160)}`);
        });
        await page.goto(QUIZ_URL);
        await page.locator(".exam-frame .question__text").waitFor({ timeout: 15000 });
        /* One answer in and a step on, so every state the grid can be in is on
           screen to be audited: answered, current, and the rest. */
        await page.locator(".option").first().click();
        await page.locator(".question__foot .btn--primary").click();
        await page.waitForTimeout(250);
        /* A finish may overrule the light: Aurora is a night sky, so day is
           not day under it. The screen is asked for what the app will
           actually be wearing, not for what was pinned. */
        const lit = lightOverride(finish) ? "night" : variant;
        for (const [width, height, mode] of SIZES) {
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(220);
          states += 1;
          for (const p of await audit(page, { variant: lit, mode })) problems.push(`${tag} ${mode}: ${p}`);
          if (ALL_SHOTS || (finish === null && (livery === "sky" || livery === "beacon") && mode !== "tablet")) {
            await page.screenshot({ path: `${SHOTS}/${variant}-${livery}-${finish || "standard"}-${mode}.png` });
          }
        }
        /* 360 is the narrowest phone anybody brings, and the brief asks for it
           by name: nothing may scroll sideways there. */
        await page.setViewportSize({ width: 360, height: 780 });
        await page.waitForTimeout(200);
        const wide = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
        if (wide > 1) problems.push(`${tag} 360: the page scrolls sideways by ${wide}px`);
        await page.close();
      }
    }
  }
  report(`every livery, finish and layout (${states} states)`, problems);

  /* ------------------------------------------------------------ the controls */
  await prefs({ "pw-livery": "sky", "pw-variant-pin": "night", "pw-finish": null, "pw-minimums": 75 });
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (e) => errors.push(`controls: ${String(e).slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`controls: ${m.text().slice(0, 160)}`); });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(QUIZ_URL);
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    const cells = page.locator(".qcell");
    const settle = (ms = 220) => page.waitForTimeout(ms);

    expect("Previous is disabled on question 1", await page.locator(".question__foot .btn").first().isDisabled());
    await page.locator(".option").nth(1).click();
    await settle();
    expect("an answer fills its grid box", (await cells.first().getAttribute("class")).includes("is-answered"));
    expect("and the count moves", (await page.locator(".navigator__title span").textContent()) === "1/8");
    await page.locator(".option").nth(2).click();
    await settle();
    expect("a second answer replaces the first rather than clearing it",
      (await page.locator(".option input:checked").count()) === 1
      && (await cells.first().getAttribute("class")).includes("is-answered"));

    await page.locator(".btn--flag").click();
    await settle();
    expect("Flag turns the button on", (await page.locator(".btn--flag").getAttribute("aria-pressed")) === "true");
    expect("flags the grid box", (await cells.first().getAttribute("class")).includes("is-flagged"));
    expect("and puts the flag in the header", (await page.locator(".question__flagged").count()) === 1);
    await page.locator(".btn--flag").click();
    await settle();
    expect("and pressing it again takes all three off",
      (await page.locator(".question__flagged").count()) === 0
      && !(await cells.first().getAttribute("class")).includes("is-flagged"));

    await page.locator(".question__foot .btn--primary").click();
    await settle();
    expect("Next moves on", (await page.locator(".question__num b").textContent()) === "2");
    expect("and Previous is live now", !(await page.locator(".question__foot .btn").first().isDisabled()));
    await page.locator(".question__foot .btn").first().click();
    await settle();
    expect("Previous goes back", (await page.locator(".question__num b").textContent()) === "1");
    await cells.nth(5).click();
    await settle();
    expect("a grid box jumps to its question", (await page.locator(".question__num b").textContent()) === "6");
    await cells.nth(7).click();
    await settle();
    expect("the last question offers Review rather than Next",
      (await page.locator(".question__foot .btn--primary").textContent()).includes("Review"));

    await page.locator(".question__foot .btn--primary").click();
    await settle();
    expect("Review opens the dialog", await page.locator(".exam-dialog").evaluate((d) => d.open));
    expect("the dialog counts what is answered and what is not",
      (await page.locator(".exam-dialog .review-list li").allTextContents()).join("|") === "Answered 1|Not answered 7|Flagged 0");
    await page.keyboard.press("Escape");
    await settle();
    expect("Esc closes it", !(await page.locator(".exam-dialog").evaluate((d) => d.open)));
    await page.locator(".exam-bar .btn", { hasText: "End exam" }).click();
    await settle();
    await page.locator(".exam-dialog .btn", { hasText: "Back to exam" }).click();
    await settle();
    expect("Back to exam closes it and changes nothing",
      !(await page.locator(".exam-dialog").evaluate((d) => d.open))
      && (await page.locator(".navigator__title span").textContent()) === "1/8");

    await page.locator(".exam-bar .btn", { hasText: "End exam" }).click();
    await page.locator(".exam-dialog .btn", { hasText: "End and mark" }).click();
    await page.locator(".result").waitFor({ timeout: 5000 });
    await settledResult(page, 0).catch(() => {});
    /* One answer, and it was a guess: a paper marked at nothing is still a
       marked paper, and it says so in words rather than leaving the screen
       blank. */
    expect("End and mark marks the paper",
      /%$/.test(await page.locator(".result__big").textContent())
      && (await page.locator(".result__head").textContent()).length > 4);
    expect("the clock goes with the paper", (await page.locator(".exam-timer").count()) === 0);
    expect("and so does End exam", (await page.locator(".exam-bar .btn").count()) === 0);
    const foot = page.locator(".result__foot .btn", { hasText: /Try again|Retake/ });
    expect("a paper under the pass mark offers Try again", (await foot.textContent()) === "Try again");

    /* One step further in: the explanation, the lesson a miss came from, and a
       paper of only the misses. It is a screen of its own behind one button,
       so the result keeps the shape the design gave it. */
    await page.locator(".result__foot .btn", { hasText: "Go through the paper" }).click();
    await settle(400);
    expect("Go through the paper opens it", (await page.locator(".quiz-name").textContent()) === "Going through it");
    expect("it explains what was missed", (await page.locator(".q-rev-explain").count()) > 0);
    expect("names the lesson each miss came from", (await page.locator(".q-weak-row").count()) > 0);
    expect("and offers the way back to that lesson", (await page.locator(".q-rev-lesson").count()) > 0);
    await page.locator(".quiz-head .quiz-leave").click();
    await settle(300);
    expect("Back returns to the result", (await page.locator(".result__big").count()) === 1);

    await foot.click();
    await settle(400);
    expect("Try again starts a fresh paper",
      (await page.locator(".navigator__title span").textContent()) === "0/8"
      && (await page.locator(".question__num b").textContent()) === "1"
      && (await page.locator(".exam-timer__value").textContent()) === "20:00");

    /* AND THE SCREEN FLAG COMES OFF WITH THE QUIZ. It re-grounds the whole
       document while the paper is open; left behind, every screen after it
       would wear the exam's matte and lose its finish. */
    expect("the exam flags the document while it is open",
      (await page.evaluate(() => document.documentElement.dataset.screen)) === "exam");
    /* LEAVING IS TWO STEPS NOW, EVERYWHERE. The arrow raises the end-exam
       dialog rather than going on its own (R4, conflict 5), so every exit
       from an open paper says what is unanswered first. */
    await page.locator(".up").click();
    await page.locator("dialog[open] button", { hasText: /Leave it for now/i }).click({ timeout: 8000 });
    /* `.mtabs`, not `.tabs`. The module screen's strip was renamed when that
       screen was ported to its reference build; this line waited for a class
       that had stopped existing, so the walk timed out on its last step and
       read as a fault in the exam. */
    await page.locator(".mscreen .mtabs").first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
    expect("and takes the flag off on the way out",
      (await page.evaluate(() => document.documentElement.dataset.screen)) === undefined);
    expect("so the finish's scenery comes back",
      (await page.evaluate(() => { const s = document.querySelector(".deck-light"); return !s || getComputedStyle(s).display !== "none"; })));
    await page.close();
  }

  /* R4 — THE PAPER IS LOCKED, MEASURED RATHER THAN READ OFF THE SOURCE.
     exam-port.check.js asks its three locked questions inside `.exam-page`,
     and until that element existed all three asked an empty set and answered
     PASS while the app bar sat fully drawn over an open paper with the Ready
     Room pill and the profile menu both clickable. These are the same three
     questions asked of a real browser. */
  {
    /* ITS OWN CONTEXT. The pages above share one, so by the time this runs a
       paper has been sat and the Library's quiz row reads a score instead of
       "Take it" — which is how a label-matched click turned into a 15-second
       timeout that looked like a fault in the lock. The row is selected by
       what it IS, not by what it currently says, and the context is fresh so
       no earlier step's localStorage reaches it. */
    const lockCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await lockCtx.newPage();
    /* ARRIVE THE WAY A STUDENT DOES — by CLICKING from the module into the
       quiz, not by loading the quiz's address. Two goto()s are two documents,
       so the Back between them is a cross-document navigation that no script
       can intercept; and a goBack() from a first page is about:blank. Either
       way a Back test that starts on the quiz proves nothing. Clicking pushes
       a history entry inside one document, which is the case that matters and
       the only one a student produces. */
    await page.goto(`${BASE}/m/m1?uid=student_one`);
    await page.locator(".mscreen .mtabs").first().waitFor({ timeout: 15000 });
    await page.locator(".mtabs button", { hasText: /Library/i }).first().click();
    await page.locator('section[aria-labelledby="lsec-quizzes"] .lrow').first().click({ timeout: 15000 });
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    /* The row clicked is whichever quiz the Library lists first, which is not
       necessarily CHAPTER. Come back to THIS paper's address, not to the
       constant — going back to a different chapter's quiz measures a paper
       nobody opened and reads as the attempt having been lost. */
    const thisPaper = BASE + await page.evaluate(() => location.pathname + location.search);
    const bar = () => page.evaluate(() => {
      const t = document.querySelector(".topbar");
      return {
        text: (t?.innerText || "").replace(/\s+/g, " ").trim(),
        pill: !!document.querySelector(".rrpill"),
        profile: !!document.querySelector(".avbtn"),
        links: document.querySelectorAll(".exam-page a[href]").length,
        page: !!document.querySelector(".exam-page"),
      };
    });
    const open = await bar();
    expect("the exam has a page for the port check to ask in", open.page);
    expect("no Ready Room pill over an open paper", !open.pill);
    expect("no profile menu over an open paper", !open.profile);
    expect("no links anywhere on the exam page", open.links === 0);
    expect("and the bar says what is happening instead", /EXAM IN PROGRESS/i.test(open.text));

    /* Back asks rather than abandons. The pop has already happened by then, so
       what this proves is that the address came back and the dialog opened. */
    /* One answer, so that "the paper is where it was left" measures something. */
    /* THE LABEL, NOT THE INPUT. The radio is visually hidden and its box can
       be nothing, so `click({force:true})` on it lands wherever that box is
       and React's onChange never fires — the paper read 0/8 with an answer
       apparently given. A student clicks the option; so does this. */
    await page.locator(".options .option").first().click();
    await page.waitForTimeout(400);
    expect("the answer registered before anything else is tested",
      (await page.locator(".navigator__title span").textContent()) === "1/8",
      await page.locator(".navigator__title span").textContent());

    await page.goBack();
    await page.waitForTimeout(600);
    expect("and survives the Back", (await page.locator(".navigator__title span").textContent()) === "1/8",
      await page.locator(".navigator__title span").textContent());
    await page.waitForTimeout(600);
    const stayed = (await page.evaluate(() => document.documentElement.dataset.screen)) === "exam";
    const asked = (await page.locator("dialog[open].exam-dialog").count()) === 1;
    expect("browser Back stays on the paper", stayed);
    expect("and opens the end-exam dialog instead of leaving", asked);
    /* GUARDED, so that a Back which DOES abandon the paper fails by name here
       rather than by a thirty-second timeout on the next click — a walk that
       only crashes reads as a broken walk, not as a caught bug. */
    if (asked) {
      await page.locator("dialog button", { hasText: /Back to exam/i }).click();
      await page.waitForTimeout(300);
    } else {
      await page.goto(thisPaper);
      await page.locator(".question__text").waitFor({ timeout: 15000 });
    }

    /* THE ARROW ASKS, AND LEAVING KEEPS THE PAPER. Conflict 5, decided: the
       arrow stays because an attempt survives leaving and the clock stops
       with it, but it goes through the same dialog everything else does. */
    await page.locator(".up").click();
    await page.waitForTimeout(500);
    const askedByArrow = (await page.locator("dialog[open].exam-dialog").count()) === 1;
    expect("the up arrow asks instead of leaving quietly", askedByArrow);
    if (askedByArrow) {
      const choices = await page.locator("dialog button").allInnerTexts();
      expect("and offers three honest choices",
        choices.join("|") === "Back to exam|Leave it for now|End and mark", choices.join("|"));
      await page.locator("dialog button", { hasText: /Leave it for now/i }).click();
      await page.waitForTimeout(1200);
      expect("leaving puts the bar back and marks nothing",
        (await page.evaluate(() => document.documentElement.dataset.screen)) === undefined);
      await page.goto(thisPaper);
      await page.locator(".question__text").waitFor({ timeout: 15000 });
      const back = {
        url: await page.evaluate(() => location.pathname),
        nav: await page.locator(".navigator__title span").textContent(),
        result: await page.locator(".result").count(),
        clock: await page.locator(".exam-timer__value").textContent(),
      };
      expect("and the paper is where it was left, unmarked",
        back.nav === "1/8" && back.result === 0, JSON.stringify(back));
    }

    /* The half that would be worse than the bug: a lock that never releases. */
    await page.locator("dialog").evaluate((d) => d.close()).catch(() => {});
    await page.locator(".question__foot .btn--primary").click();
    await page.waitForTimeout(200);
    await page.locator("button", { hasText: /^End exam$/ }).first().click();
    await page.waitForTimeout(300);
    await page.locator("dialog button", { hasText: /End and mark/i }).click();
    await page.locator(".result").waitFor({ timeout: 8000 });
    const done = await bar();
    expect("the result gives the bar back", done.pill && done.profile);
    await page.close();
    await lockCtx.close();
  }

  /* The clock runs out on its own, and the paper hands itself in. */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const seeded = { ...attemptWith(0), left: 2 };
    await page.addInitScript(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [`wingman.attempt.${chapter.quizId}`, JSON.stringify(seeded)]);
    await page.goto(QUIZ_URL);
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    expect("the clock comes back where it was left", (await page.locator(".exam-timer__value").textContent()) === "00:02");
    expect("and its last minute is marked", (await page.locator(".exam-timer").getAttribute("class")).includes("is-low"));
    await page.locator(".result").waitFor({ timeout: 8000 });
    expect("00:00 hands the paper in by itself", (await page.locator(".result").count()) === 1);
    await page.close();
  }

  /* ------------------------------------------------------- the six results */
  const CASES = [
    { right: 5, bar: 75, says: "So close. Go again", foot: "Try again" },
    { right: 3, bar: 75, says: "Not yet. Keep at it", foot: "Try again" },
    { right: 8, bar: 75, says: "Every one right", foot: "Retake" },
    { right: 6, bar: 85, says: "Passed. Keep climbing to your bar", foot: "Retake" },
    { right: 6, bar: 75, says: "Passed, right on your bar", foot: "Retake" },
    { right: 7, bar: 75, says: "Passed, above your bar", foot: "Retake" },
    { right: 8, bar: 95, says: "Every one right", foot: "Retake" },
    { right: 7, bar: 95, says: "Passed. Keep climbing to your bar", foot: "Retake" },
    { right: 7, bar: 85, says: "Passed, above your bar", foot: "Retake" },
  ];
  for (const c of CASES) {
    await prefs({ "pw-minimums": c.bar });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (e) => errors.push(`result ${c.right}/${c.bar}: ${String(e).slice(0, 160)}`));
    await page.addInitScript(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [`wingman.attempt.${chapter.quizId}`, JSON.stringify(attemptWith(c.right))]);
    await page.goto(QUIZ_URL);
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    await page.locator(".exam-bar .btn", { hasText: "End exam" }).click();
    await page.locator(".exam-dialog .btn", { hasText: "End and mark" }).click();
    await page.locator(".result").waitFor({ timeout: 5000 });
    const at = `${c.right} of 8 against a bar of ${c.bar}`;
    const pct = Math.round((c.right / 8) * 100);
    await settledResult(page, pct).catch(() => {});
    expect(`${at} counts up to ${pct}%`, (await page.locator(".result__big").textContent()) === `${pct}%`);
    expect(`${at} says "${c.says}"`, (await page.locator(".result__head").textContent()).includes(c.says));
    /* KEEPING THE MISSES IS THE FIRST CONTROL WHEN THERE ARE ANY. It saves
       every question this sitting got wrong into Bookmarks in one press, and it
       is not drawn at all on a clean paper — a button that would save nothing. */
    expect(`${at} offers ${c.foot}, beside the way into the paper`,
      (await page.locator(".result__foot .btn").allTextContents()).join("|")
        === (c.right < 8 ? `Save the ones I missed|Go through the paper|${c.foot}` : `Go through the paper|${c.foot}`));
    expect(`${at} fills the line to ${pct}%`,
      Math.abs(await page.locator(".meter__fill").evaluate((el, w) => {
        const track = el.parentElement.getBoundingClientRect().width;
        return (el.getBoundingClientRect().width / track) * 100 - w;
      }, pct)) < 2);
    expect(`${at} marks the pass mark, and the bar when it differs`,
      (await page.locator(".mark").count()) === (c.bar === 75 ? 1 : 2));
    expect(`${at} puts no number on a marker`,
      (await page.locator(".mark").allTextContents()).every((t) => !/\d/.test(t)));
    expect(`${at} lists the ${8 - c.right} it missed`,
      (await page.locator(".result__list.review > .result__row").count()) === 8 - c.right);
    expect(`${at} folds the right ones away unless nothing was missed`,
      (await page.locator(".result details").evaluate((d) => d.open).catch(() => c.right === 0)) === (c.right === 8));
    if (c.right < 8) {
      const row = page.locator(".result__list.review > .result__row").first();
      expect(`${at} shows the pick struck through and the right answer after it`,
        (await row.locator("s.ans--wrong").count()) === 1 && (await row.locator(".ans--right").count()) === 1);
    }
    /* THE ROWS RISE IN ONE BY ONE AND THEY ALL ARRIVE, and the fold is where
       that goes wrong. A closed <details> skips its children's animation
       frames, so rows inside it sit at the first keyframe — nothing, because
       `backwards` — until it opens. With the design's delay they then waited
       out the 1.1s the result had already spent, and a student who opened the
       fold got a list of blank rows for a second and a half. Inside the fold
       the stagger counts from the moment it opens. */
    if (c.right > 0 && c.right < 8) {
      const fold = page.locator(".result details");
      await fold.locator("summary").click();
      expect(`${at} the tick row opens the ones you got right`, await fold.evaluate((d) => d.open));
      const shown = await page.waitForFunction(
        () => [...document.querySelectorAll("details .result__row")]
          .every((el) => Number(getComputedStyle(el).opacity) > 0.99),
        null, { timeout: 900 },
      ).then(() => true).catch(() => false);
      expect(`${at} and they are on screen within the moment, not after the old delay`, shown);
      await fold.locator("summary").click();
      expect(`${at} and the same row shuts it again`, !(await fold.evaluate((d) => d.open)));
    }
    await page.locator(".result__list.review > .result__row").last()
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
      .catch(() => {});
    const faded = await page.locator(".result__list.review > .result__row").evaluateAll(
      (els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length);
    expect(`${at} leaves every missed row on screen when the animation is over`, faded === 0);
    if (c.right === CASES[0].right && c.bar === 75) {
      await page.screenshot({ path: `${SHOTS}/result-${c.right}-bar${c.bar}.png` });
      /* A PAPER OF ONLY THE MISSES, and it is a drill rather than a second
         sitting: its own quiz id, so it cannot write a score over the one
         already recorded, and its own full clock. */
      await page.locator(".result__foot .btn", { hasText: "Go through the paper" }).click();
      await page.locator(".quiz-name").waitFor();
      const misses = await page.locator('.q-rev[data-mark="wrong"]').count();
      await page.locator(".quiz-foot .q-btn", { hasText: "Just the" }).click();
      await page.locator(".exam-frame .question__text").waitFor({ timeout: 8000 });
      await page.waitForTimeout(300);
      expect(`just the ${misses} missed is a paper of exactly those`,
        (await page.locator(".qcell").count()) === misses
        && (await page.locator(".exam-bar__name").textContent()).includes("the ones you missed"));
      /* Its own allowance, for its own length: three questions is three
         questions' worth of clock, not the eight-question paper's. */
      expect(`with a clock of its own length (${clock(allowanceFor(misses))})`,
        (await page.locator(".exam-timer__value").textContent()) === clock(allowanceFor(misses)));
      expect("and the module's back link still above it", (await page.locator(".up").count()) === 1);
      await page.screenshot({ path: `${SHOTS}/review-and-retake.png` });
    }
    await page.close();
  }
  /* A question left blank is a dash, not a sentence about the student. */
  {
    await prefs({ "pw-minimums": 75 });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const blank = attemptWith(0);
    blank.answers = blank.answers.map((v, i) => (i === 0 ? null : v));
    await page.addInitScript(([key, value]) => {
      localStorage.clear(); localStorage.setItem(key, value);
    }, [`wingman.attempt.${chapter.quizId}`, JSON.stringify(blank)]);
    await page.goto(QUIZ_URL);
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    await page.locator(".exam-bar .btn", { hasText: "End exam" }).click();
    await page.locator(".exam-dialog .btn", { hasText: "End and mark" }).click();
    await page.locator(".result").waitFor({ timeout: 5000 });
    await page.waitForTimeout(900);
    const first = page.locator(".result__list.review > .result__row").first();
    expect("a question with no answer shows a dash", (await first.locator(".ans--blank").textContent()) === "—");
    await page.close();
  }
  report("every control does what the brief says", acts);

  /* ------------------------------------------------------- motion turned off */
  {
    await prefs({ "pw-reduce-motion": true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(([key, value]) => {
      localStorage.clear(); localStorage.setItem(key, value);
    }, [`wingman.attempt.${chapter.quizId}`, JSON.stringify(attemptWith(4))]);
    await page.goto(QUIZ_URL);
    await page.locator(".question__text").waitFor({ timeout: 15000 });
    await page.locator(".exam-bar .btn", { hasText: "End exam" }).click();
    await page.locator(".exam-dialog .btn", { hasText: "End and mark" }).click();
    await page.locator(".result").waitFor({ timeout: 5000 });
    await page.waitForTimeout(150);
    const calm = [];
    /* Everything at once: the number is already counted, the line already
       filled, and every row is on screen rather than waiting its turn. */
    if ((await page.locator(".result__big").textContent()) !== "50%") calm.push("the percentage is still counting up");
    const rows = await page.locator(".result__row").evaluateAll((els) => els.map((el) => ({
      opacity: getComputedStyle(el).opacity, anim: getComputedStyle(el).animationName,
    })));
    for (const r of rows) {
      if (Number(r.opacity) < 0.99) calm.push(`a review row is at ${r.opacity} opacity`);
      if (r.anim !== "none") calm.push(`a review row is running ${r.anim}`);
    }
    const fill = await page.locator(".meter__fill").evaluate((el) => getComputedStyle(el).transitionDuration);
    if (!/^0s/.test(fill)) calm.push(`the score line still animates over ${fill}`);
    report("with motion off, everything arrives at once", calm);
    await prefs({ "pw-reduce-motion": false });
    await page.close();
  }

  report("no console errors and no exceptions", errors);
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
