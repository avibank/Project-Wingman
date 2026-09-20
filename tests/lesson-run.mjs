/* =============================================================================
   THE LESSON PAGE, DRIVEN. §3 of the launch handoff, step by step.
   -----------------------------------------------------------------------------
   scripts/check-lesson.mjs holds the pure rules; this drives the screen in a
   real browser, because most of §3 is about what a control DOES and none of
   that is visible in the source:

     · the player bar carries play, time, the scrubber, Stamp, Ask and
       fullscreen — and no CC and no overflow menu
     · Stamp and Ask each pause the video and open the floating bar; the Ask
       one is violet from the first keystroke
     · the bar drags, grows as you type, saves on the tick and discards on the X
     · a saved note leaves a rectangle on the scrubber; an Ask leaves a violet
       diamond AND reaches the module's threads; the right seat's question is teal
     · hovering a mark shows what it says
     · the Logbook filters, seeks, deletes and exports a real file
     · two columns at 1280, stacked at 800 with Up next above the Logbook and
       collapsible there

     npm run harness, then:  npm run test:lesson
     LS_BASE overrides the harness; LS_WIDTHS narrows the widths.

   THE RIGHT SEAT IS SEEDED THROUGH THE HARNESS (HARNESS_SEAT), because a seat
   is a live session rather than a fixture row. Without somebody in it the
   third chip must not exist at all, and that is its own assertion.

   THE CLIP IS FETCHED FROM THE INTERNET (the fixture points at Blender's open
   movies on archive.org), so on a machine with no network the <video> never
   gets a duration and cannot be seeked. The steps that need a SECOND — putting
   a note at 2:47 rather than at 0:00 — say so and skip rather than measuring a
   dead element and calling it a failure; everything else still runs, and the
   position rules they would have covered are pure and live in
   scripts/check-lesson.mjs. With network, the whole walk runs.
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.LS_BASE || "http://127.0.0.1:5190";
const LESSON = `${BASE}/m/m1/M1.01/lesson/M1.01.1`;
const WIDTHS = (process.env.LS_WIDTHS || "1280x900,800x900,390x844")
  .split(",").map((s) => s.split("x").map(Number));
/* WHO IS IN THE SEAT IS ASKED OF THE HARNESS, not of this process's own
   environment. HARNESS_SEAT is set when the harness STARTS; running the walk
   without it against a harness that has one made the walk assert an empty seat
   at a screen that correctly showed a full one. One source, and it is the
   server the browser is talking to. */
let SEAT = null;
const SEAT_THREAD = "T-lesson-walk-seat";
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch|Download the React DevTools/;

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}`);
  for (const p of problems.slice(0, 8)) console.log(`        ${p}`);
  if (problems.length > 8) console.log(`        …and ${problems.length - 8} more`);
};

/* A CLEAN SLATE BEFORE EVERY RUN. The harness keeps its store in memory for
   as long as it is up, so the notes and questions one run writes are still
   there for the next — and the second run then measures the first run's
   leftovers. Notes live on the account through merge_progress; questions are
   rows in lesson_threads, and only the ones this walk wrote are removed. */
const whoIsSeated = async () => {
  const r = await fetch(`${BASE}/rest/v1/rpc/my_seat`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_me: "student_one" }),
  }).then((x) => x.json()).catch(() => []);
  return (Array.isArray(r) ? r : [])[0]?.partner_id || null;
};

const reset = async () => {
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-notes": [], "pw-seen-notes": [] } }),
  });
  await fetch(`${BASE}/rest/v1/lesson_threads?author_id=eq.student_one`, { method: "DELETE" });
  await fetch(`${BASE}/rest/v1/lesson_threads?id=eq.${SEAT_THREAD}`, { method: "DELETE" });
  /* The right seat's own question on this lesson. The walk writes it rather
     than assuming one: a seat is a live session, so there is no fixture that
     can have a partner in it, and the thing under test is what a partner's
     PUBLIC question looks like here — teal, named, and not yours to delete. */
  if (SEAT) {
    await fetch(`${BASE}/rest/v1/lesson_threads`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: SEAT_THREAD, module_id: "M1", lesson_id: "M1.01.1",
                             t: 137, body: "Why is this step before the other one?", author_id: SEAT }),
    });
  }
};

/* Everything here waits on what the step actually produced rather than on a
   duration — a sleep long enough for a slow machine is a test that takes
   minutes, and one short enough to be quick is a test that flakes. */
const openLesson = async (page) => {
  await page.goto(LESSON, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lesson .lesson-name", { timeout: 20000 });
  await page.waitForSelector(".lgbook", { timeout: 20000 });
};

/* Can this browser actually play the clip? Everything that needs a moment
   other than zero needs a media element that has loaded. */
const clipPlays = async (page) => {
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const v = document.querySelector("video");
    return !!(v && v.readyState > 0 && v.duration > 1);
  });
};

/* Seek by pressing the track, which is what a student does, and confirm the
   element moved rather than trusting the press. */
const seekTo = async (page, frac) => {
  const t = await page.locator(".scrub").boundingBox();
  await page.mouse.click(t.x + t.width * frac, t.y + t.height / 2);
  await page.waitForFunction(
    (f) => { const v = document.querySelector("video"); return v && Math.abs(v.currentTime / v.duration - f) < 0.05; },
    frac, { timeout: 4000 });
};

const run = async () => {
  SEAT = await whoIsSeated();
  await reset();
  const browser = await chromium.launch();

  /* ---------------------------------------------------- 1 · the player bar */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text()); });
    await openLesson(page);

    const problems = [];
    const has = async (label) => (await page.locator(`.pctl-row [aria-label="${label}"]`).count()) > 0;
    for (const label of ["Play", "Stamp this moment", "Ask about this moment", "Full screen"]) {
      if (!await has(label)) problems.push(`the bar has no "${label}"`);
    }
    if (!await page.locator(".pctl .scrub").count()) problems.push("the bar has no scrubber");
    if (!await page.locator(".pctl-row .ptime").count()) problems.push("the bar has no time");
    /* §3: "There is no CC and no ⋯ menu." Both by what they would be called. */
    const banned = await page.locator('.pctl-row [aria-label*="aption" i], .pctl-row [aria-label*="ubtitle" i], .pctl-row [aria-label*="More" i]').count();
    if (banned) problems.push(`${banned} control(s) the design removed are still in the bar`);
    /* The order §3 gives: Stamp, then Ask, then fullscreen. */
    const order = await page.locator(".pctl-row button").evaluateAll(
      (bs) => bs.map((b) => b.getAttribute("aria-label")));
    const i = (s) => order.findIndex((l) => l === s);
    if (!(i("Stamp this moment") < i("Ask about this moment") && i("Ask about this moment") < i("Full screen"))) {
      problems.push(`bar order is ${order.filter(Boolean).join(" · ")}`);
    }
    /* §3 — the title and the sign-off stamp, on one line. `.title-row` is the
       reference's name for it (12-lesson-page.css); it was `.titlerow`.

       SAVE IS NOT ON THIS ROW ANY MORE. There were two bookmark buttons on the
       lesson — one here beside the sign-off and one in the player's control
       bar — and the design has one, in the bar, on the thing it acts on. So
       what is asserted is that the row holds the title and the seal, and that
       the bar holds the bookmark, which the order check above already walks. */
    const row = await page.locator(".title-row").evaluate((el) => ({
      title: !!el.querySelector(".lesson-name"),
      seal: !!el.querySelector(".signoff, .stamp, [class*=signoff]"),
      kids: [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)),
    }));
    if (!row.title || !row.seal) problems.push("the title row is missing the title or the sign-off");
    if (new Set(row.kids).size > 1 && Math.max(...row.kids) - Math.min(...row.kids) > 14) {
      problems.push(`the title row is not one line: tops ${row.kids.join(",")}`);
    }
    report("the player bar and the title row are the design's", problems);
    if (errs.length) report("no console errors on the lesson", errs);
    else console.log("ok    no console errors on the lesson");
    await page.close();
  }

  /* --------------------------------------- 2 · stamping, asking, the marks */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openLesson(page);
    const problems = [];

    const rowsBefore = await page.locator(".lg-entry").count();
    const live = await clipPlays(page);

    /* SEEK SOMEWHERE NOTHING IS MARKED FIRST. Marks closer together than a
       finger merge into one target (§8), so stamping the second another mark
       is already on adds a row and no element — which is right, and would
       make "a new mark appeared" measure as a failure. 28% is clear of all
       three seeded notes. */
    if (live) await seekTo(page, 0.28);
    const marksBefore = await page.locator(".scrub-mark").count();

    /* Stamp: pauses, opens the bar, grows as you type, saves on the tick. */
    await page.locator('[aria-label="Stamp this moment"]').click();
    await page.waitForSelector(".nbar");
    if (await page.locator('.nbar[data-kind="ask"]').count()) problems.push("the stamp bar opened violet");
    const playingAfterOpen = await page.locator(".player-layer.is-playing, .player-layer[data-playing='1']").count();
    if (playingAfterOpen) problems.push("stamping did not pause the video");

    const field = page.locator(".nbar-field");
    const h1 = await field.evaluate((el) => el.getBoundingClientRect().height);
    await field.fill("One line.\nTwo lines.\nThree lines.\nFour lines.");
    const h2 = await field.evaluate((el) => el.getBoundingClientRect().height);
    if (!(h2 > h1 + 8)) problems.push(`the bar does not grow as you type: ${h1} then ${h2}`);

    /* The whole bar drags, from the handle. */
    const before = await page.locator(".nbar").evaluate((el) => el.getBoundingClientRect().left);
    const handle = page.locator(".nbar-handle");
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 120, hb.y + hb.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    const after = await page.locator(".nbar").evaluate((el) => el.getBoundingClientRect().left);
    if (Math.abs(after - before) < 20) problems.push(`the bar did not drag: ${before} then ${after}`);

    await page.locator('.nbar-round[aria-label="Save this note"]').click();
    await page.waitForSelector(".nbar", { state: "detached" });
    if (await page.locator(".lg-entry").count() !== rowsBefore + 1) problems.push("a saved note did not reach the logbook");
    if (live && await page.locator(".scrub-mark").count() !== marksBefore + 1) {
      problems.push("a saved note did not reach the scrubber");
    }

    /* Ask: violet, and it reaches the module's threads. From a DIFFERENT
       second than the note above — at the same one the two merge into a single
       mark, which is §8's rule and is tested on its own below. */
    if (live) await seekTo(page, 0.62);
    const comments = await page.locator('[role="tab"]:has-text("Comments") small').textContent().catch(() => "0");
    await page.locator('[aria-label="Ask about this moment"]').click();
    await page.waitForSelector('.nbar[data-kind="ask"]');
    const violet = await page.locator(".nbar-handle").evaluate((el) => getComputedStyle(el).color);
    const askTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ask").trim());
    if (!violet.includes("295")) problems.push(`the Ask bar's chip is ${violet}, not the --ask violet (${askTok})`);
    await page.locator(".nbar-field").fill("Why is this step before the other one?");
    await page.locator('.nbar-round[aria-label="Ask the module"]').click();
    await page.waitForSelector(".nbar", { state: "detached" });

    const diamond = await page.locator('.scrub-mark[data-kind="ask"]').count();
    if (!diamond) {
      problems.push("an Ask left no diamond on the scrubber");
    } else {
      const shape = await page.locator('.scrub-mark[data-kind="ask"]').first().evaluate((el) => {
        const st = getComputedStyle(el);
        return { bg: st.backgroundColor, rot: st.transform.includes("0.707") };
      });
      if (!shape.rot) problems.push("the Ask mark is not a diamond");
      if (!shape.bg.includes("295")) problems.push(`the Ask mark is ${shape.bg}, not violet`);
    }
    const after2 = await page.locator('[role="tab"]:has-text("Comments") small').textContent().catch(() => "0");
    if (Number(after2) !== Number(comments) + 1) problems.push(`the Ask did not reach the module's threads: ${comments} then ${after2}`);

    /* Hovering shows what the mark says. */
    const hit = page.locator('.scrub-hit[data-kind="ask"]').first();
    await hit.hover();
    /* The tip fades in over --wg-fade-in; reading it in the same frame reads
       the start of the animation, which is 0 whether it works or not. */
    await page.waitForFunction(
      () => Number(getComputedStyle(document.querySelector('.scrub-hit[data-kind="ask"] .scrub-tip')).opacity) > 0.9,
      null, { timeout: 3000 }).catch(() => {});
    const tip = await hit.locator(".scrub-tip").evaluate((el) => ({
      o: Number(getComputedStyle(el).opacity), t: el.textContent,
    }));
    if (tip.o < 0.9) problems.push(`hovering a mark shows nothing (opacity ${tip.o})`);
    if (live && !/Why is this step/.test(tip.t)) problems.push(`the tip says "${tip.t}"`);
    if (!/\d:\d\d/.test(tip.t)) problems.push(`the tip carries no moment: "${tip.t}"`);

    /* §8 — TWO MARKS CLOSER THAN A FINGER MERGE, AND THE PUBLIC ONE WINS.
       A question stamped onto a second that already carries a note has to
       leave the diamond there: a cluster draws one shape, and the note is in
       the list below either way while the question is not visible anywhere
       else on the bar. */
    if (live) {
      const asksBefore = await page.locator('.scrub-mark[data-kind="ask"]').count();
      await seekTo(page, 0.28);
      await page.locator('[aria-label="Ask about this moment"]').click();
      await page.waitForSelector('.nbar[data-kind="ask"]');
      await page.locator(".nbar-field").fill("And this one lands on the note.");
      await page.locator('.nbar-round[aria-label="Ask the module"]').click();
      await page.waitForSelector(".nbar", { state: "detached" });
      if (await page.locator('.scrub-mark[data-kind="ask"]').count() !== asksBefore + 1) {
        const kinds = await page.locator(".scrub-mark").evaluateAll((els) => els.map((e) => e.dataset.kind));
        problems.push(`a question on a noted second did not take the mark: ${kinds.join(",")}`);
      }
    }

    /* The X discards, and nothing is left behind. */
    const rowsNow = await page.locator(".lg-entry").count();
    await page.locator('[aria-label="Stamp this moment"]').click();
    await page.waitForSelector(".nbar");
    await page.locator('.nbar-round[aria-label="Discard this note"]').click();
    await page.waitForSelector(".nbar", { state: "detached" });
    if (await page.locator(".lg-entry").count() !== rowsNow) problems.push("a discarded note was saved anyway");

    report("stamping and asking do what §3 says", problems);
    if (!live) console.log("skip  the steps that need a moment other than 0:00  (the clip did not load)");
    await page.close();
  }

  /* ------------------------------------------------------- 3 · the logbook */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openLesson(page);
    const problems = [];

    /* Nobody in the seat: the chip named after them must not exist. A filter
       for a person who is not there is a control that can never do anything,
       and this app treats that as a launch blocker. */
    const wantChips = SEAT ? 3 : 2;
    if (await page.locator(".lg-chip").count() !== wantChips) {
      const chips = await page.locator(".lg-chip").allTextContents();
      problems.push(`${SEAT ? "with somebody in the seat" : "with an empty right seat"} the chips are ${chips.join(" · ")}`);
    }

    /* Pressing a stamp seeks the video to that moment. Only meaningful on a
       row whose moment is not 0:00 — the clock reads 0:00 already. */
    if (await clipPlays(page)) {
      const rows = await page.locator(".lg-entry .lg-st").evaluateAll(
        (els) => els.map((e) => e.getAttribute("aria-label")));
      const k = rows.findIndex((l) => l && !/0:00$/.test(l));
      if (k < 0) problems.push("no logbook row sits at a moment other than 0:00");
      else {
        await page.locator(".lg-entry .lg-st").nth(k).click();
        const want = rows[k].replace("Play from ", "");
        await page.waitForFunction(
          (w) => document.querySelector(".ptime").textContent.trim().startsWith(w),
          want, { timeout: 4000 }).catch(async () => {
            problems.push(`pressing "${rows[k]}" left the clock at ${await page.locator(".ptime").textContent()}`);
          });
      }
    }

    /* Mine keeps yours; deleting removes one. */
    await page.locator('.lg-chip:has-text("Mine")').click();
    const mine = await page.locator(".lg-entry").count();
    if (!mine) problems.push("Mine hides your own rows");
    await page.locator(".lg-entry").first().hover();
    await page.locator(".lg-entry .lg-del").first().click();
    await page.waitForTimeout(250);
    if (await page.locator(".lg-entry").count() !== mine - 1) problems.push("the bin removed nothing");

    /* Export produces a real file. */
    const dl = page.waitForEvent("download", { timeout: 5000 });
    await page.locator(".logcard .link").click();
    const file = await dl.catch(() => null);
    if (!file) problems.push("Export downloaded nothing");
    else if (!/logbook\.txt$/.test(file.suggestedFilename())) {
      problems.push(`Export named the file ${file.suggestedFilename()}`);
    }
    report("the logbook seeks, filters, deletes and exports", problems);
    await page.close();
  }

  /* ----------------------------------------------------- 4 · the right seat */
  if (SEAT) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openLesson(page);
    const problems = [];
    await page.waitForSelector('.lg-chip:has-text("right seat")', { timeout: 10000 }).catch(() => {});
    if (await page.locator('.lg-chip:has-text("right seat")').count() !== 1) {
      problems.push("with somebody in the seat there is no chip for them");
    }
    const teal = await page.locator('.scrub-mark[data-kind="seat"]').count();
    if (!teal) problems.push("the right seat's question left no mark");
    else {
      const tok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--copilot").trim());
      const bg = await page.locator('.scrub-mark[data-kind="seat"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      /* Compared as NUMBERS. The token is authored ".580 .130 190" and the
         browser returns "0.58 0.13 190" — the same colour, spelled twice. */
      const nums = (v) => (v.match(/[\d.]+/g) || []).map(Number).map((n) => Math.round(n * 1000) / 1000);
      if (String(nums(bg)) !== String(nums(tok))) problems.push(`the seat's mark is ${bg}, not --copilot ${tok}`);
    }
    await page.locator('.lg-chip:has-text("right seat")').click();
    await page.waitForTimeout(200);
    const kinds = await page.locator(".lg-entry").evaluateAll((els) => els.map((e) => e.dataset.kind));
    if (!kinds.length || kinds.some((k) => k !== "seat")) problems.push(`their filter shows ${kinds.join(",") || "nothing"}`);
    /* Their row is not yours to delete. */
    if (await page.locator(".lg-entry .lg-del").count()) problems.push("the right seat's row offers a bin");
    report("the right seat is named, teal, and not editable", problems);
    await page.close();
  } else {
    console.log("skip  the right seat  (HARNESS_SEAT=u_two npm run harness)");
  }

  /* ---------------------------------------------------------- 5 · the layout */
  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await openLesson(page);
    const problems = [];
    const box = (sel) => page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
    });
    const [side, panel, player] = await Promise.all([box(".lesson .next"), box(".lesson .logcard"), box(".lesson .player")]);
    if (w >= 861) {
      /* Two columns: Up next beside the player, not under it. */
      if (side.x <= player.x + 10) problems.push(`${w}px: Up next is not a second column (x ${side.x} vs ${player.x})`);
      if (side.y > panel.y) problems.push(`${w}px: Up next starts below the Logbook`);
      const collapses = await page.locator(".next-h").evaluate((el) => {
        const had = el.getAttribute("data-hides");
        el.setAttribute("data-hides", "1");
        const shown = getComputedStyle(el.querySelector(".tog")).display !== "none";
        if (had === null) el.removeAttribute("data-hides"); else el.setAttribute("data-hides", had);
        return shown;
      });
      if (collapses) problems.push(`${w}px: Up next offers to collapse in two-column`);
    } else {
      /* Stacked, Up next above the Logbook, and collapsible. */
      if (Math.abs(side.x - panel.x) > 2) problems.push(`${w}px: still two columns`);
      if (side.y >= panel.y) problems.push(`${w}px: Up next is not above the Logbook`);
      /* THE TOGGLE IS OFFERED ONLY WHERE COLLAPSING WOULD HIDE SOMETHING, and
         this fixture's chapters hold two lessons — the one playing and the one
         next — so nothing is ever hidden and the toggle correctly never shows.
         The rule under test is the BREAKPOINT, so the flag is set here and the
         toggle asked whether it appears. Marking it is what the page does when
         a chapter is longer than two. */
      const collapses = await page.locator(".next-h").evaluate((el) => {
        const had = el.getAttribute("data-hides");
        el.setAttribute("data-hides", "1");
        const shown = getComputedStyle(el.querySelector(".tog")).display !== "none";
        if (had === null) el.removeAttribute("data-hides"); else el.setAttribute("data-hides", had);
        return shown;
      });
      if (!collapses) problems.push(`${w}px: Up next does not offer to collapse`);
    }
    /* Nothing sideways, at any width. */
    const over = await page.evaluate(() => {
      const bad = [];
      const root = document.querySelector(".lesson");
      const rb = root.getBoundingClientRect();
      root.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        if (r.right > rb.right + 1.5 || r.left < rb.left - 1.5) bad.push(el.className || el.tagName);
      });
      return [...new Set(bad)].slice(0, 5);
    });
    for (const c of over) problems.push(`${w}px: ${c} overflows sideways`);
    report(`the layout at ${w}px`, problems);
    await page.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exitCode = failures ? 1 : 0;
};

run().catch((e) => { console.error(e); process.exit(1); });
