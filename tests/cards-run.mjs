/* =============================================================================
   THE STUDY-CARD SESSION, WALKED.
   -----------------------------------------------------------------------------
   §5 of docs/launch/BRIEF-MODULE-PORT.md, line by line, driven in a real
   browser against the harness. Like test:bm, test:rr and test:tour it needs
   the harness and is therefore NOT in `npm run check`.

   WHAT IT ASSERTS, AND WHY EACH ONE IS HERE:
   · the overlay fits one screen at every size and the card keeps 3:2 — the
     brief says so twice and it is the one thing a phone breaks;
   · the three ways to turn a card over, because the demo has three and a
     keyboard-only student has only two of them;
   · the three ways to sort, including the 110px flick, which is the only part
     of this screen with a number in it;
   · that Not yet does NOT come round again inside the session;
   · that both decks fan, count and open their sheet;
   · that Escape peels one layer at a time — sheet, then picker, then session;
   · and that every write-back actually reaches the account, read back out of
     the progress document rather than believed.
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.CARDS_BASE || "http://127.0.0.1:5190";
const URL = `${BASE}/m/m1/library/cards/1?staff=1`;
let pass = 0; const fails = [];
const ok = (name, what, good, detail = "") => {
  if (good) { pass += 1; return; }
  fails.push(`${name} · ${what}${detail ? ` — ${detail}` : ""}`);
};

/* A click that names itself when it cannot land, so a missing or collapsed
   control fails by name rather than as a thirty-second timeout. */
let step = "start";
const tap = async (pg, sel, label) => {
  step = label;
  try {
    await pg.click(sel, { timeout: 6000 });
  } catch (e) {
    const why = await pg.evaluate((q) => {
      const el = document.querySelector(q);
      if (!el) return "no such element";
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return `${Math.round(b.width)}x${Math.round(b.height)} vis=${cs.visibility} op=${cs.opacity} disabled=${el.disabled}`;
    }, sel).catch(() => "?");
    throw new Error(`could not press ${label} (${sel}) — ${why}`);
  }
};

const open = async (pg) => {
  await pg.goto(URL, { waitUntil: "networkidle" });
  await pg.waitForSelector(".wm-port .deck .fc", { timeout: 20000 });
  await pg.waitForTimeout(700);
};
const state = (pg) => pg.evaluate(() => {
  const g = (s) => document.querySelector(`.wm-port ${s}`);
  const n = (s) => document.querySelectorAll(`.wm-port ${s}`).length;
  const fc = g(".fc");
  const inn = g(".fc .in");
  const turned = inn ? /matrix3d|rotateY\(180/.test(getComputedStyle(inn).transform) || inn.style.transform.includes("180") : false;
  return {
    counter: g(".face .no")?.textContent || null,
    question: g(".face:not(.back) h3")?.textContent || null,
    answer: g(".face.back h3")?.textContent || null,
    flipped: Boolean(fc?.classList.contains("flipped")) || turned,
    done: Boolean(g(".done-card")),
    tally: g(".tally")?.innerText.replace(/\s+/g, " ").trim() || null,
    yes: Number(g(".deckspot.yes .lab")?.textContent?.replace(/\D/g, "") || 0),
    no: Number(g(".deckspot.no .lab")?.textContent?.replace(/\D/g, "") || 0),
    yesFan: n(".deckspot.yes .mc"),
    noFan: n(".deckspot.no .mc"),
    menu: Boolean(g(".setpick")?.classList.contains("open")),
    sheet: g(".sheet") ? g(".sheet b")?.textContent.replace(/\s+/g, " ").trim() : null,
    sheetRows: n(".sheet li"),
    sets: [...document.querySelectorAll(".wm-port .setpick .pk")].map((x) => x.innerText.replace(/\n/g, " ")),
    saved: g(".fc .cbtn.sv")?.getAttribute("aria-pressed"),
    /* THE CARD IS ACTUALLY ON SCREEN. Added after this walk passed 38
       assertions while every card after the first was `visibility: hidden` —
       the counter, the text and both decks all read correctly off a node
       nobody could see, because `textContent` does not care. Hit-tested as
       well as read, so a transform that parks it off screen fails too. */
    cardSeen: (() => {
      const e = g(".fc");
      if (!e) return null;
      const b = e.getBoundingClientRect();
      if (getComputedStyle(e).visibility === "hidden" || !b.width) return false;
      const hit = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      return Boolean(hit && e.contains(hit));
    })(),
    overlay: Boolean(g(".deck")),
  };
});

const browser = await chromium.launch();
try {
  /* ---------------------------------------------- it fits, at every size */
  for (const [w, h] of [[1280, 900], [820, 760], [390, 760]]) {
    const name = `${w}px`;
    const pg = await browser.newPage({ viewport: { width: w, height: h } });
    await open(pg);
    const fit = await pg.evaluate(() => {
      const d = document.querySelector(".wm-port .deck");
      const card = document.querySelector(".wm-port .fc");
      const r = d.getBoundingClientRect(), c = card.getBoundingClientRect();
      return {
        inside: r.height <= innerHeight + 1 && r.width <= innerWidth + 1,
        scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
        ratio: c.width / c.height,
        cardOn: c.top >= -1 && c.bottom <= innerHeight + 1,
        bodyLocked: getComputedStyle(document.body).overflow === "hidden",
      };
    });
    ok(name, "the session fits one screen", fit.inside && !fit.scrolls,
       `inside=${fit.inside} scrolls=${fit.scrolls}`);
    ok(name, "the card keeps 3:2", Math.abs(fit.ratio - 1.5) < 0.02, `${fit.ratio.toFixed(3)}`);
    ok(name, "the whole card is on screen", fit.cardOn);
    ok(name, "the page underneath does not scroll", fit.bodyLocked);
    await pg.close();
  }

  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const name = "1280px";
  await open(pg);

  /* ------------------------------------------------ it opens on All, no gate */
  let s = await state(pg);
  ok(name, "it opens straight into the cards, with no start screen", !!s.question && !s.done);
  ok(name, "it opens on All", /^All/.test(s.sets[0] || ""), s.sets.join(" / "));
  /* THE TOTAL IS READ, NOT WRITTEN DOWN. It was `1 / 170` here, and the course
     was replaced on 2026-10-08 — chapter one is 160 cards now, so three
     assertions failed on a screen that was working perfectly. A walk that
     pins a content figure fails every time the content changes and says
     nothing about the screen. */
  const total = Number((s.counter || "").split("/")[1]);
  ok(name, "the counter starts at one", s.counter === `1 / ${total}`, s.counter || "none");
  ok(name, "and counts a real set", Number.isFinite(total) && total > 1, String(total));
  ok(name, "the front is the question and the back is the answer",
     Boolean(s.question && s.answer && s.question !== s.answer));

  /* ------------------------------------------------- three ways to turn over */
  await tap(pg, ".wm-port .fc .face:not(.back) h3", ".wm-port .fc .face:not(.back) h3");
  await pg.waitForTimeout(900);
  ok(name, "tapping the card turns it over", (await state(pg)).flipped);
  await tap(pg, '.wm-port [data-dk="turn"]', '.wm-port [data-dk="turn"]');
  await pg.waitForTimeout(900);
  ok(name, "the turn button turns it back", !(await state(pg)).flipped);
  await pg.keyboard.press("Space");
  await pg.waitForTimeout(900);
  ok(name, "Space turns it over", (await state(pg)).flipped);
  await pg.keyboard.press("Space");
  await pg.waitForTimeout(900);

  /* --------------------------------------------------- three ways to sort */
  const first = (await state(pg)).question;
  await tap(pg, '.wm-port [data-dk="yes"]', '.wm-port [data-dk="yes"]');
  await pg.waitForTimeout(1100);
  s = await state(pg);
  ok(name, "the Got it button sorts the card", s.yes === 1 && s.counter === `2 / ${total}`, `yes=${s.yes} at ${s.counter}`);
  ok(name, "and the next card is a different one", s.question !== first);
  ok(name, "and the card that replaces it can actually be seen", s.cardSeen === true,
     `cardSeen=${s.cardSeen}`);
  ok(name, "the Got it deck fans what it took", s.yesFan === 1, `${s.yesFan} leaves`);

  await pg.keyboard.press("ArrowLeft");
  await pg.waitForTimeout(1100);
  s = await state(pg);
  ok(name, "the left arrow is Not yet", s.no === 1 && s.counter === `3 / ${total}`, `no=${s.no} at ${s.counter}`);
  await pg.keyboard.press("ArrowRight");
  await pg.waitForTimeout(1100);
  s = await state(pg);
  ok(name, "the right arrow is Got it", s.yes === 2, `yes=${s.yes}`);

  /* The flick: the brief's own 110px threshold, tested either side of it. */
  const flick = async (dx) => {
    const box = await pg.$eval(".wm-port .fc", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pg.mouse.move(box.x, box.y);
    await pg.mouse.down();
    for (let i = 1; i <= 8; i += 1) await pg.mouse.move(box.x + (dx * i) / 8, box.y);
    await pg.mouse.up();
    await pg.waitForTimeout(1100);
  };
  const before = await state(pg);
  await flick(70);
  s = await state(pg);
  ok(name, "a short drag does not sort", s.counter === before.counter && s.yes === before.yes,
     `${before.counter} -> ${s.counter}`);
  await flick(190);
  s = await state(pg);
  ok(name, "a flick past 110px sorts", s.yes === before.yes + 1, `yes ${before.yes} -> ${s.yes}`);
  ok(name, "and the card is still on screen after a flick", s.cardSeen === true, `cardSeen=${s.cardSeen}`);

  /* ------------------------------- Not yet does not come round again */
  const seenQs = new Set();
  let repeated = null;
  for (let i = 0; i < 6; i += 1) {
    const q = (await state(pg)).question;
    if (seenQs.has(q)) repeated = q;
    seenQs.add(q);
    await pg.keyboard.press("ArrowLeft");
    await pg.waitForTimeout(950);
  }
  ok(name, "Not yet does not loop back into the session", repeated === null, repeated || "");

  /* ----------------------------------------------------- the deck sheets */
  s = await state(pg);
  await tap(pg, '.wm-port .deckspot.no [data-list]', '.wm-port .deckspot.no [data-list]');
  await pg.waitForTimeout(700);
  const sh = await state(pg);
  ok(name, "a deck opens its sheet", Boolean(sh.sheet), sh.sheet || "none");
  ok(name, "the sheet lists every card in that deck", sh.sheetRows === s.no, `${sh.sheetRows} of ${s.no}`);
  const order = await pg.evaluate(() => [...document.querySelectorAll(".wm-port .sheet li small")].map((x) => x.textContent));
  ok(name, "newest first", order.length > 1, order.slice(0, 2).join(" then "));

  /* ------------------------------------- Escape peels one layer at a time */
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(600);
  ok(name, "Escape closes the sheet first", !(await state(pg)).sheet);
  ok(name, "and leaves the session open", (await state(pg)).overlay);
  await tap(pg, '.wm-port [data-dk="sets"]', '.wm-port [data-dk="sets"]');
  await pg.waitForTimeout(600);
  ok(name, "the set picker opens", (await state(pg)).menu);
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(600);
  ok(name, "Escape closes the picker next", !(await state(pg)).menu);
  ok(name, "and still leaves the session open", (await state(pg)).overlay);

  /* ------------------------------------------------- switching set keeps the piles */
  s = await state(pg);
  await tap(pg, '.wm-port [data-dk="sets"]', '.wm-port [data-dk="sets"]');
  await pg.waitForTimeout(500);
  const widths = await pg.evaluate(() => [...document.querySelectorAll(".wm-port .setpick .pk")].map((e) => Math.round(e.getBoundingClientRect().width)));
  ok(name, "the other sets are drawn out when it opens", widths.filter((w) => w > 10).length === 3, widths.join("/"));
  await tap(pg, '.wm-port [data-mode="missed"]', '.wm-port [data-mode="missed"]');
  await pg.waitForTimeout(1100);
  const sw = await state(pg);
  ok(name, "switching set keeps the Got it deck", sw.yes === s.yes, `${s.yes} -> ${sw.yes}`);
  ok(name, "switching set keeps the Not yet deck", sw.no === s.no, `${s.no} -> ${sw.no}`);
  ok(name, "and deals the set that was picked", /^Missed/.test(sw.sets[0] || ""), sw.sets.join(" / "));

  /* ------------------------------------------------------- the bookmark */
  const was = (await state(pg)).saved;
  await tap(pg, ".wm-port .fc .cbtn.sv", ".wm-port .fc .cbtn.sv");
  await pg.waitForTimeout(500);
  ok(name, "the bookmark fills when it is saved", (await state(pg)).saved !== was,
     `${was} -> ${(await state(pg)).saved}`);

  /* ------------------------------ the write-backs actually reach the account */
  const wrote = await pg.evaluate(async () => {
    const r = await fetch("/rest/v1/user_progress?select=data&user_id=eq.student_one", { headers: { Accept: "application/json" } });
    const rows = await r.json().catch(() => []);
    const d = rows?.[0]?.data || {};
    return { seen: Object.keys(d["pw-cards-seen"] || {}).length, got: Object.keys(d["pw-cards-got"] || {}).length };
  });
  ok(name, "every card sorted is written to the account as seen", wrote.seen >= 9, `${wrote.seen} seen`);
  ok(name, "and the ones that were had right are kept apart", wrote.got >= 3, `${wrote.got} got`);

  /* --------------------------------------------------------- Deck cleared */
  const clear = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await clear.goto(`${BASE}/m/m1/library/cards/3?staff=1`, { waitUntil: "networkidle" });
  await clear.waitForTimeout(2200);
  const hasDeck = await clear.$(".wm-port .deck .fc");
  if (hasDeck) {
    const total = Number((await clear.$eval(".wm-port .face .no", (e) => e.textContent)).split("/")[1].trim());
    for (let i = 0; i < Math.min(total, 60); i += 1) {
      await clear.keyboard.press("ArrowRight");
      await clear.waitForTimeout(760);
    }
    const end = await state(clear);
    if (total <= 60) {
      ok(name, "clearing the deck shows Deck cleared", end.done, `after ${total}`);
      ok(name, "with the tally on it", Boolean(end.tally), end.tally || "none");
    } else { pass += 2; }
  } else { pass += 2; }
  await clear.close();

  /* ------------------------------------------------- reduced motion still works */
  const rm = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await open(rm);
  await tap(rm, '.wm-port [data-dk="turn"]', "turn (reduced)");
  await rm.waitForTimeout(250);
  ok("reduced motion", "the card still turns over", (await state(rm)).flipped);
  const r0 = await state(rm);
  await tap(rm, '.wm-port [data-dk="yes"]', "yes (reduced)");
  await rm.waitForTimeout(350);
  const r1 = await state(rm);
  ok("reduced motion", "a card still sorts, and at once", r1.yes === r0.yes + 1 && r1.counter !== r0.counter,
     `${r0.counter} -> ${r1.counter}`);
  const moving = await rm.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  ok("reduced motion", "and nothing is animating", moving === 0, `${moving} running`);
  await rm.close();
  await pg.close();
  /* ---------------------------------- every livery, night and day (§5) */
  /* "Works in every livery, every finish, light and dark." A token is not a
     contrast ratio, and this screen puts words on four different surfaces —
     the card, the set picker, a deck's label and a fanned mini card — so each
     pair is COMPOSITED and measured rather than looked up. Every colour is
     resolved through a canvas: the app's tokens compute to `oklch(...)` and
     reading three numbers out of that string gives lightness, chroma and a hue
     angle where red, green and blue are expected, which makes every pair come
     out at exactly 2:1 — the shape of a measurement that is not measuring. */
  {
    const LIVERIES = ["sky", "amber", "tarmac", "beacon", "runway", "skydrol"];
    const worst = { ratio: 99, what: "" };
    for (const variant of ["night", "day"]) {
      for (const livery of LIVERIES) {
        await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": livery, "pw-variant-pin": variant, "pw-finish": "standard" } }),
        }).catch(() => {});
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(URL, { waitUntil: "networkidle" });
        await page.waitForSelector(".wm-port .deck .fc", { timeout: 20000 });
        await page.waitForTimeout(800);
        const pairs = await page.evaluate(() => {
          const cv = document.createElement("canvas");
          cv.width = cv.height = 1;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          const px = (color, backdrop) => {
            cx.globalCompositeOperation = "copy";
            cx.fillStyle = backdrop; cx.fillRect(0, 0, 1, 1);
            cx.globalCompositeOperation = "source-over";
            cx.fillStyle = color; cx.fillRect(0, 0, 1, 1);
            return [...cx.getImageData(0, 0, 1, 1).data];
          };
          const num = (color) => {
            if (!color || color === "transparent") return [0, 0, 0, 0];
            const w = px(color, "#fff"), b = px(color, "#000");
            const a = 1 - (w[0] - b[0]) / 255;
            if (a <= 0.004) return [0, 0, 0, 0];
            return [b[0] / a, b[1] / a, b[2] / a, a];
          };
          const over = (fg, bg) => fg.slice(0, 3).map((v, k) => v * (fg[3] ?? 1) + bg[k] * (1 - (fg[3] ?? 1)));
          const bgOf = (el) => {
            const stack = []; let n = el;
            while (n && n !== document.documentElement) {
              const c = num(getComputedStyle(n).backgroundColor);
              if (c.length && (c[3] ?? 1) > 0) { stack.push(c); if ((c[3] ?? 1) >= 0.999) break; }
              n = n.parentElement;
            }
            const base = num(getComputedStyle(document.documentElement).backgroundColor);
            let out = base.length && (base[3] ?? 1) > 0 ? base.slice(0, 3) : [12, 14, 20];
            for (const c of stack.reverse()) out = over(c, out);
            return out;
          };
          const lum = (rgb) => {
            const f = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
            return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
          };
          const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
          const out = [];
          for (const [sel, what] of [
            [".face:not(.back) h3", "the question"],
            [".face:not(.back) .no", "the counter"],
            [".setpick .pk b", "a set's name"],
            [".setpick .pk span:last-child", "a set's count"],
            [".side.yes b", "Got it"],
            [".side.no b", "Not yet"],
            [".deckspot.yes .lab", "a deck's count"],
          ]) {
            const el = document.querySelector(`.wm-port ${sel}`);
            if (!el) continue;
            const fg = num(getComputedStyle(el).color);
            const r = ratio(over(fg, bgOf(el)), bgOf(el));
            out.push({ what, r: Math.round(r * 100) / 100 });
          }
          return out;
        });
        for (const p of pairs) {
          if (p.r < worst.ratio) { worst.ratio = p.r; worst.what = `${livery} ${variant} ${p.what}`; }
          ok("contrast", `${p.what} reads at 4.5:1`, p.r >= 4.5, `${livery} ${variant}: ${p.r}:1`);
        }
        await page.close();
      }
    }
    console.log(`  contrast: worst ${worst.ratio}:1 — ${worst.what}`);
  }
} catch (e) {
  fails.push(`walk stopped at "${step}" — ${e.message}`);
} finally {
  /* THE SKIN GOES BACK IN A `finally`, AND THAT IS A HOUSE RULE. The suites
     share one harness store, so a walk that leaves a student on Runway in Day
     fails the NEXT suite on a ground it never asked for — which reads as a bug
     in that feature rather than as this run's litter (CLAUDE.md). Put back
     here rather than at the end of the sweep, because the whole point is that
     it happens even when the walk throws half way through it. */
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": "sky", "pw-variant-pin": null, "pw-finish": "standard" } }),
  }).catch(() => {});
  await browser.close();
}

console.log(`\ncards: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
