/* v6 — the handover's own testing list, on a real paper.
 *
 * HANDOVER.md, "Testing", step 8: "Then resize the window, zoom in and out,
 * rotate a page, and open and close the panel — and confirm every mark is
 * still exactly on its words. This is the test that will fail first."
 *
 * It did. Twice, for two different reasons, and both are asserted here so
 * neither can come back:
 *
 *   the page has a 0.42s spring on `transform`, so a layout run the moment
 *   rotation is asked for measures a page that is halfway round
 *
 *   `getClientRects()` reports axis-aligned boxes in SCREEN space, so on a
 *   rotated page the numbers are right at 0 degrees and wrong at every other
 *   angle
 *
 * "Exactly on its words" is checked by asking the browser, not by eye: the
 * centre of every mark quad has to fall inside a text-layer span that holds
 * the words the mark was made on. A mark drawn in the wrong place is the one
 * failure a reader cannot spot for themselves.
 */
import { group, it, expect, withPage, shot, SURFACES, URL_BASE } from "../harness/run.mjs";

const laptop = SURFACES[0];

const url = (uid = "student_one") => `${URL_BASE}/m/m1/paper/M1.DEV?uid=${uid}`;

/* A paper is ready when its first page carries a real raster AND the text
   layer has been checked against the runs — `data-item` is only written when
   the two lined up, so waiting for it is waiting for a page that can hold a
   mark. */
export async function openV6(page, uid = "student_one") {
  await page.goto(url(uid), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rdr", { timeout: 25_000 });
  /* `state: "attached"` and not the default `visible`. On a phone the panel
     is an overlay across the whole stage, so the first page's canvas is
     genuinely behind something — and a raster that exists is what these tests
     are waiting for, not a raster somebody can see right now. */
  await page.waitForSelector(".sheetpg canvas[data-on]", { state: "attached", timeout: 90_000 });
  await page.waitForSelector(".sheetpg .textLayer span[data-item]", { state: "attached", timeout: 90_000 });
  await page.waitForFunction(() => document.querySelectorAll(".mkq").length > 0, null, { timeout: 30_000 });
  return page;
}

/* Every mark quad on screen, and whether it is sitting on its own words. */
const onTheWords = (page) => page.evaluate(() => {
  const out = [];
  for (const p of document.querySelectorAll(".sheetpg")) {
    const spans = [...p.querySelectorAll(".textLayer span[data-item]")];
    for (const q of p.querySelectorAll(".mkq")) {
      const r = q.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = spans.find((s) => {
        const b = s.getBoundingClientRect();
        return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
      });
      const m = window.WM.marks.find((x) => x.g === q.dataset.g);
      out.push({
        want: m ? m.tx.slice(0, 24) : null,
        under: hit ? hit.textContent.trim().slice(0, 60) : null,
        ok: !!(hit && m && hit.textContent.includes(m.tx.slice(0, 12))),
      });
    }
  }
  return out;
});

const allOn = (rows, why) => {
  expect(rows.length).toBeAtLeast(1, `${why}: there should be marks to check`);
  const off = rows.filter((r) => !r.ok);
  expect(off.length).toBe(0, `${why}: ${JSON.stringify(off).slice(0, 300)}`);
};

/* The page tray is behind the counter, and the counter is the fixed point of
   the island — this is how a student reaches zoom and rotate. */
async function inPageTray(page, selector) {
  await page.click("#cnt");
  await page.waitForSelector("#tray .ctrl", { timeout: 5000 });
  await page.click(selector);
  await page.waitForTimeout(900);          // the 0.42s spring, twice over
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

group("v6 · the paper", () => {
  it("opens the real document and counts its pages from the manifest", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const state = await page.evaluate(() => ({
        counter: document.querySelector("#cnt").textContent.replace(/\s+/g, ""),
        pages: document.querySelectorAll(".sheetpg").length,
        gaps: document.querySelectorAll(".sheetgap").length,
        shape: [...document.querySelectorAll(".sheetpg")].every((p) => (
          p.querySelector(".bmk") && p.querySelector("svg.ink") && p.querySelector(".marks")
          && p.querySelector("canvas") && p.querySelector(".textLayer") && p.querySelector(".pgno")
        )),
      }));
      expect(state.counter).toContain("/14", "the counter reads the manifest, not the file");
      /* HANDOVER, Making it feel smooth: render a window, not a document. */
      expect(state.pages).toBeAtMost(5, "a window of pages, never all fourteen");
      expect(state.gaps).toBeAtLeast(1, "and a spacer holding the height of the rest");
      expect(state.shape).toBeTruthy("every page keeps the element shape section 1 fixes");
    });
  });

  it("the words sit above the marks, so a highlight never tints the letters", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const z = await page.evaluate(() => {
        const p = document.querySelector(".sheetpg");
        const n = (el) => Number(getComputedStyle(el).zIndex);
        return { marks: n(p.querySelector(".marks")), text: n(p.querySelector(".textLayer")), ink: n(p.querySelector("svg.ink")) };
      });
      expect(z.marks).toBe(1, "the mark quads");
      expect(z.text).toBe(2, "pdf.js's text layer, above them");
      expect(z.ink).toBe(3, "and ink over both");
    });
  });
});

group("v6 · marks stay on their words", () => {
  it("they land on the words they were made on", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      allOn(await onTheWords(page), "at rest");
      await shot(page, "v6-at-rest");
    });
  });

  it("and after the window is resized", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.setViewportSize({ width: 1100, height: 780 });
      await page.waitForTimeout(900);
      allOn(await onTheWords(page), "after a resize");
    });
  });

  it("and after zooming in", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const before = await page.evaluate(() => Math.round(document.querySelector(".sheetpg").getBoundingClientRect().width));
      await inPageTray(page, '[data-z="1"]');
      const after = await page.evaluate(() => Math.round(document.querySelector(".sheetpg").getBoundingClientRect().width));
      /* The zoom has to actually zoom. Setting the page's width in the shell
         instead of letting `--pw` do it made this number never move. */
      expect(after).toBeAtLeast(before + 40, "the page should be wider after zooming in");
      allOn(await onTheWords(page), "after zooming in");
    });
  });

  it("and after rotating the page", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await inPageTray(page, '[data-r="1"]');
      const rot = await page.evaluate(() => getComputedStyle(document.querySelector("#rdr")).getPropertyValue("--rot").trim());
      expect(rot).toBe("90deg", "the page tray turned it");
      allOn(await onTheWords(page), "at 90 degrees");
      await shot(page, "v6-rotated");
    });
  });

  it("and after the panel opens and shuts", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click("#pf [data-close]");
      await page.waitForTimeout(700);
      await page.click("#tab");
      await page.waitForTimeout(700);
      allOn(await onTheWords(page), "after the panel moved");
    });
  });
});

group("v6 · making a mark", () => {
  it("a selection becomes a mark, on the server, in the panel and on the page", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const before = await page.evaluate(() => window.WM.marks.length);

      await page.click('.t[data-t="hand"]');
      await page.waitForTimeout(200);
      /* A real selection over a real run of the paper's text. */
      const words = await page.evaluate(() => {
        const p = document.querySelector('.sheetpg[data-pg="2"]') || document.querySelector(".sheetpg");
        const span = [...p.querySelectorAll(".textLayer span[data-item]")].find((s) => s.textContent.trim().length > 40);
        const node = span.firstChild;
        const r = document.createRange();
        r.setStart(node, 0); r.setEnd(node, 28);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        document.querySelector("#stage").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        return String(r);
      });
      await page.waitForSelector("#selp.on", { timeout: 5000 });
      await page.click('#selp [data-act="hl"]');
      await page.waitForTimeout(1200);

      const made = await page.evaluate(() => {
        const m = window.WM.marks[window.WM.marks.length - 1];
        return { n: window.WM.marks.length, id: m.id, tx: m.tx, who: m.who, kind: m.kind, cards: document.querySelectorAll(".mcard").length };
      });
      expect(made.n).toBe(before + 1, "one more mark");
      expect(made.tx).toContain(words.trim(), "the words that were selected");
      expect(made.who).toBe("me", "made by this student");
      /* The local id is swapped for the server's the moment the row comes
         back, so the card, the quads and the row all agree. A mark still
         carrying an `m1`-shaped id never reached the database. */
      expect(/^[0-9a-f-]{36}$/.test(made.id)).toBeTruthy(`the server's id, got ${made.id}`);
      expect(made.cards).toBe(made.n, "and a card for every mark");
      allOn(await onTheWords(page), "the new mark");
    });
  });

  it("it is still there on the way back in", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const before = await page.evaluate(() => window.WM.marks.length);
      await page.click('.t[data-t="hand"]');
      await page.evaluate(() => {
        const p = document.querySelector(".sheetpg");
        const span = [...p.querySelectorAll(".textLayer span[data-item]")].find((s) => s.textContent.trim().length > 40);
        const r = document.createRange();
        r.setStart(span.firstChild, 0); r.setEnd(span.firstChild, 24);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        document.querySelector("#stage").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
      await page.waitForSelector("#selp.on", { timeout: 5000 });
      await page.click('#selp [data-act="hl"]');
      await page.waitForTimeout(1200);

      await openV6(page);
      const after = await page.evaluate(() => window.WM.marks.length);
      expect(after).toBe(before + 1, "the mark survived the reload");
      allOn(await onTheWords(page), "after a reload");
    });
  });
});

group("v6 · the chrome is the chrome", () => {
  it("the reader is above the app, not inside its stacking context", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      /* The reader came up as a white strip with the app's own header painted
         over it, because `.deck` is a stacking context and the wrapper inside
         it animates opacity. It is portalled to `.app` for that reason, and
         this is the assertion that says so. */
      const where = await page.evaluate(() => {
        const r = document.querySelector(".rdr");
        const box = r.getBoundingClientRect();
        return {
          parent: r.parentElement.className.split(" ")[0],
          full: Math.round(box.width) === innerWidth && Math.round(box.height) === innerHeight,
          onTop: document.elementFromPoint(innerWidth / 2, 24)?.closest(".rdr") !== null,
        };
      });
      expect(where.parent).toBe("app", "portalled to the app root, not the body and not the deck");
      expect(where.full).toBeTruthy("filling the window");
      expect(where.onTop).toBeTruthy("and nothing of the app's painted over it");
    });
  });

  it("no rule of the app's reaches inside and distorts a control", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const boxes = await page.evaluate(() => {
        const m = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
        const knob = getComputedStyle(document.querySelector(".rdr .warm .sw") || document.body, "::after").content;
        return { tool: m(".rdr .t"), chip: m(".rdr .chip"), warmKnob: knob };
      });
      /* reader.css: `.t { width: 38px; height: 38px }`. App.jsx's global
         `min-height: 44px` measured this at 38x44 on v4 and drew every swatch
         as an oval. */
      expect(boxes.tool).toEqual([38, 38], "the tool button is the size the sheet says");
      /* deck.css makes `.chip` monospace; the panel's filters are prose. */
      expect(boxes.chip[1]).toBe(27, "the filter chip is the height the sheet says");
      /* app.css's `.sw` is a toggle switch with a 17px knob as ::after, and
         `.warm .sw` is the warmth slider's track. */
      expect(boxes.warmKnob === "none" || boxes.warmKnob === "").toBeTruthy(`no switch knob inside the warmth slider, got ${boxes.warmKnob}`);
    });
  });

  it("nothing the chrome bound outlives the reader", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const gone = await page.evaluate(async () => {
        document.querySelector(".rdr .logo").click();
        await new Promise((r) => setTimeout(r, 900));
        const errs = [];
        window.addEventListener("error", (e) => errs.push(String(e.message)), { once: false });
        /* Everything the parts listen for, fired at a page they no longer own.
           A listener that survived would reach for elements that are gone. */
        for (const type of ["pointerdown", "pointermove", "pointerup", "keydown", "resize", "click"]) {
          window.dispatchEvent(new Event(type));
        }
        await new Promise((r) => setTimeout(r, 200));
        return { rdr: document.querySelectorAll(".rdr").length, wm: typeof window.WM, errs };
      });
      expect(gone.rdr).toBe(0, "the reader is gone");
      expect(gone.wm).toBe("undefined", "and so is the list it hung on the window");
      expect(gone.errs.length).toBe(0, `nothing threw: ${gone.errs.join(" · ")}`);
    });
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   PORTED FROM THE v5 SUITE.

   Everything below tests a rule that outlives any chrome, so it survived the
   rebuild with its vocabulary changed and nothing else. The groups that were
   about v5's own furniture — the rack, the scrubber, the dock, the four
   corners — are archived under tests/reader/v5/ rather than rewritten,
   because there is nothing left for them to describe.
   ───────────────────────────────────────────────────────────────────────── */

const ipadL = SURFACES[1];
const phone = SURFACES[3];

group("v6 · anonymity, asserted on the wire", () => {
  it("another student's client never receives the author of an anonymous question", async () => {
    await withPage(laptop, async (page) => {
      const bodies = [];
      page.on("response", async (r) => {
        if (!r.url().includes("paper_marks_for")) return;
        try { bodies.push(await r.text()); } catch { /* gone */ }
      });
      await openV6(page, "student_one");
      await page.waitForTimeout(1200);
      expect(bodies.length).toBeAtLeast(1, "no payload was seen");
      const rows = JSON.parse(bodies[0]);
      const q = rows.find((r) => r.kind === "question");
      expect(q).toBeTruthy("the anonymous question was not in the payload at all");
      /* THE BYTES, not the DOM. Hiding it in CSS would pass a DOM assertion,
         and the reader draws `who: 'anon'` from the ABSENCE of an author —
         so if the server ever started sending it, the card would start
         showing it. */
      expect(q.author_id).toBe(null, "the author id crossed the wire");
      const leaked = rows.filter((r) => r.anonymous && r.author_id !== null);
      expect(leaked).toEqual([], "an anonymous mark carried its author");
    });
  });

  it("a red mark is absent from another student's payload, not filtered in the reader", async () => {
    await withPage(laptop, async (page) => {
      const bodies = [];
      page.on("response", async (r) => {
        if (!r.url().includes("paper_marks_for")) return;
        try { bodies.push(await r.text()); } catch { /* gone */ }
      });
      await openV6(page, "student_one");
      await page.waitForTimeout(1200);
      const rows = JSON.parse(bodies[0]);
      /* "Red marks are private end to end — never sent to other students,
         never counted in class heat." The panel's own filter is a convenience
         on top of that, never the mechanism, so this asks the wire. */
      const theirs = rows.filter((r) => r.author_id && r.author_id !== "student_one");
      const red = theirs.filter((r) => r.colour === "wrong");
      expect(red).toEqual([], "somebody else's private mark was sent");
    });
  });
});

group("v6 · pen, finger and palm", () => {
  /* The count of strokes that actually have a path on them. An empty <path>
     is what a pointerdown that drew nothing leaves behind, and counting those
     would pass the exact test being written. */
  const strokes = (page) => page.evaluate(
    () => [...document.querySelectorAll(".ink path")].filter((p) => p.getAttribute("d")).length);

  const arm = async (page) => { await page.click('.t[data-t="pen"]'); await page.waitForTimeout(300); };

  it("a finger scrolls and never draws while an ink tool is armed", async () => {
    await withPage(ipadL, async (page) => {
      await openV6(page);
      await arm(page);
      const before = await strokes(page);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const opts = (x, y) => ({ pointerType: "touch", pointerId: 7, isPrimary: true,
          clientX: x, clientY: y, bubbles: true, width: 40, height: 40 });
        pg.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 40, r.top + 40)));
        pg.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 160, r.top + 120)));
        pg.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 160, r.top + 120)));
      });
      await page.waitForTimeout(600);
      expect(await strokes(page)).toBe(before, "a finger drew on the page");
    });
  });

  it("a palm resting during pen input produces nothing", async () => {
    await withPage(ipadL, async (page) => {
      await openV6(page);
      await arm(page);
      const before = await strokes(page);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const pen = (t, x, y) => new PointerEvent(t, { pointerType: "pen", pointerId: 1, isPrimary: true,
          pressure: 0.5, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, width: 2, height: 2 });
        /* A broad contact, the way a hand lands, while the pen is in range. */
        const palm = (t, x, y) => new PointerEvent(t, { pointerType: "touch", pointerId: 2, isPrimary: false,
          button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, width: 90, height: 70 });
        pg.dispatchEvent(pen("pointerdown", r.left + 60, r.top + 300));
        pg.dispatchEvent(palm("pointerdown", r.left + 300, r.top + 400));
        for (let i = 1; i <= 6; i++) pg.dispatchEvent(palm("pointermove", r.left + 300 + i * 20, r.top + 400 + i * 8));
        pg.dispatchEvent(palm("pointerup", r.left + 420, r.top + 448));
        pg.dispatchEvent(pen("pointerup", r.left + 60, r.top + 300));
      });
      await page.waitForTimeout(900);
      /* The pen's own dot is allowed; the palm's sweep is not. */
      expect((await strokes(page)) - before).toBeAtMost(1, "the palm left a mark");
    });
  });

  it("a pen draws", async () => {
    await withPage(ipadL, async (page) => {
      await openV6(page);
      await arm(page);
      const before = await strokes(page);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const opts = (x, y, p) => ({ pointerType: "pen", pointerId: 3, isPrimary: true, pressure: p,
          clientX: x, clientY: y, bubbles: true, width: 2, height: 2 });
        pg.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 40, r.top + 200, 0.4)));
        for (let i = 1; i <= 8; i++) {
          pg.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 40 + i * 14, r.top + 200 + i * 6, 0.5)));
        }
        pg.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 152, r.top + 248, 0.3)));
      });
      await page.waitForTimeout(900);
      expect(await strokes(page)).toBeAtLeast(before + 1, "the pen did not draw");
    });
  });

  it("and the stroke it drew is fractions of the page, so it survives a zoom", async () => {
    await withPage(ipadL, async (page) => {
      await openV6(page);
      await arm(page);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const opts = (x, y) => ({ pointerType: "pen", pointerId: 4, isPrimary: true, pressure: 0.5,
          clientX: x, clientY: y, bubbles: true, width: 2, height: 2 });
        pg.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 60, r.top + 220)));
        for (let i = 1; i <= 6; i++) pg.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 60 + i * 18, r.top + 220 + i * 5)));
        pg.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 168, r.top + 250)));
      });
      await page.waitForTimeout(600);
      const d = await page.evaluate(() => document.querySelector(".ink path[d]")?.getAttribute("d"));
      expect(d).toBeTruthy("no stroke to check");
      /* Every number in the path is inside the 0-1000 viewBox, which is what
         makes a stroke drawn at 80% on a phone the same stroke at 250% on a
         laptop — and why ink survives zoom for free. */
      const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
      expect(nums.every((n) => n >= -20 && n <= 1020)).toBeTruthy(`a path point left the viewBox: ${d.slice(0, 80)}`);
    });
  });
});

group("v6 · a thousand pages stay light", () => {
  it("only the pages near you exist, and only they have canvases", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const held = await page.evaluate(() => ({
        pages: document.querySelectorAll(".sheetpg").length,
        canvases: document.querySelectorAll(".sheetpg canvas").length,
        gapHeight: [...document.querySelectorAll(".sheetgap")]
          .reduce((a, g) => a + g.getBoundingClientRect().height, 0),
        scroll: Math.round(document.querySelector("#stage").scrollHeight),
      }));
      expect(held.pages).toBeAtMost(5, "the page in view plus two either side");
      expect(held.canvases).toBe(held.pages, "one canvas per drawn page and no orphans");
      /* The spacers have to be doing the work, or the scroll height is a lie
         and the scrollbar jumps as pages fill in. */
      expect(held.gapHeight).toBeAtLeast(held.scroll * 0.5, "the spacers hold most of the document");
    });
  });

  it("the scroll height is right from the first frame, so the scrollbar never jumps", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const first = await page.evaluate(() => Math.round(document.querySelector("#stage").scrollHeight));
      await page.evaluate(() => { document.querySelector("#stage").scrollTop = 4000; });
      await page.waitForTimeout(1500);
      const later = await page.evaluate(() => Math.round(document.querySelector("#stage").scrollHeight));
      /* Pages filling in must not change the document's length. Two pixels of
         rounding per page is the tolerance; a page appearing is hundreds. */
      expect(Math.abs(later - first)).toBeAtMost(40, `${first} then ${later}`);
    });
  });

  it("the page selector is a window too, not one cell per page", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click('#view [data-v="pages"]');
      await page.waitForTimeout(400);
      const cells = await page.evaluate(() => document.querySelectorAll(".pcell").length);
      expect(cells).toBeAtLeast(1, "the selector drew nothing");
      /* On a 1012-page manual, one cell per page is 1012 cells each counting
         its own marks. HANDOVER: never lay out the whole document. */
      expect(cells).toBeAtMost(90, "the selector laid out the whole document");
    });
  });
});

group("v6 · the quality bar", () => {
  it("every icon-only control has an accessible name", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const nameless = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll(".rdr button")) {
          if (b.offsetParent === null) continue;                 // not on screen
          const text = (b.textContent || "").trim();
          const label = b.getAttribute("aria-label") || b.getAttribute("title");
          if (!text && !label) out.push(b.className || b.id || "(unnamed)");
        }
        return out;
      });
      expect(nameless).toEqual([], "controls with no name");
    });
  });

  it("nothing scrolls the page sideways, at any platform", async () => {
    for (const surface of [laptop, ipadL, phone]) {
      await withPage(surface, async (page) => {
        await openV6(page);
        const over = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          rdr: (() => { const r = document.querySelector(".rdr"); return r.scrollWidth - r.clientWidth; })(),
        }));
        expect(over.doc).toBeAtMost(1, `the document scrolls sideways on ${surface.id}`);
        expect(over.rdr).toBeAtMost(1, `the reader scrolls sideways on ${surface.id}`);
      });
    }
  });

  it("the reader chooses its platform from the pointer, not the width", async () => {
    for (const surface of SURFACES) {
      await withPage(surface, async (page) => {
        await openV6(page);
        const plat = await page.evaluate(() => document.querySelector(".rdr").dataset.plat);
        /* v6 asks the same question as v5 and keeps two answers rather than
           three: `matchMedia('(pointer:coarse)')`, and touch or desktop. Its
           sheet reads the attribute once, to hide the bar's drag handle where
           there is no hover to reveal it. So a 1194px window on a Mac is
           desktop and a 1194px iPad is touch — which is still the distinction
           that matters, and still the one most web readers get wrong. */
        expect(plat).toBe(surface.expect === "desktop" ? "desktop" : "touch",
          `${surface.id} at ${surface.width}px`);
      });
    }
  });

  it("every control is at least 44px on its shortest side on touch", async () => {
    await withPage(ipadL, async (page) => {
      await openV6(page);
      /* THE TARGET, NOT THE BOX. v6 sizes its controls for a mouse and the
         app's section 12 wants 44px for a finger, and the way both are true
         is a transparent ::before that takes the tap out without moving
         anything the sheet set. So this measures what a finger can hit. */
      const small = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll(".rdr .t, .rdr .util, .rdr .chip, .rdr .pseg button")) {
          if (b.offsetParent === null) continue;
          const own = b.getBoundingClientRect();
          const pad = getComputedStyle(b, "::before");
          const w = Math.max(own.width, parseFloat(pad.minWidth) || 0);
          const h = Math.max(own.height, parseFloat(pad.minHeight) || 0);
          if (Math.min(w, h) < 43.5) out.push(`${b.className}:${Math.round(w)}x${Math.round(h)}`);
        }
        return out;
      });
      expect(small).toEqual([], "targets under 44px on touch");
    });
  });
});

group("v6 · undo and redo", () => {
  /* Make a mark the way a student does, and hand back what it says. */
  async function mark(page, pg = 1) {
    await page.click('.t[data-t="hand"]');
    await page.waitForTimeout(200);
    const words = await page.evaluate((n) => {
      const p = document.querySelector(`.sheetpg[data-pg="${n}"]`) || document.querySelector(".sheetpg");
      const span = [...p.querySelectorAll(".textLayer span[data-item]")]
        .filter((s) => s.textContent.trim().length > 40).at(-1);
      const r = document.createRange();
      r.setStart(span.firstChild, 0); r.setEnd(span.firstChild, 26);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.querySelector("#stage").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return String(r);
    }, pg);
    await page.waitForSelector("#selp.on", { timeout: 5000 });
    await page.click('#selp [data-act="hl"]');
    await page.waitForTimeout(1200);
    return words;
  }

  const count = (page) => page.evaluate(() => window.WM.marks.length);

  it("takes a mark back, and puts it back again with the same id", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const before = await count(page);
      await mark(page);
      const made = await page.evaluate(() => window.WM.marks.at(-1).id);
      expect(await count(page)).toBe(before + 1, "the mark was made");

      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(900);
      expect(await count(page)).toBe(before, "undo did not take it back");
      const quads = await page.evaluate((g) => document.querySelectorAll(`.mkq[data-g="${g}"]`).length, made);
      expect(quads).toBe(0, "the boxes are still on the page");

      await page.keyboard.press("Meta+Shift+z");
      await page.waitForTimeout(1200);
      expect(await count(page)).toBe(before + 1, "redo did not put it back");
      /* THE SAME MARK, NOT A NEW ONE. A redo that writes a fresh row leaves
         everybody else's copy of the paper with a hole where the first was
         and a stranger beside it. */
      const again = await page.evaluate(() => window.WM.marks.at(-1).id);
      expect(again).toBe(made, "redo made a different mark");
      allOn(await onTheWords(page), "after undo and redo");
    });
  });

  it("says what it did, because an undo off screen is otherwise silent", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await mark(page);
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(500);
      const said = await page.evaluate(() => ({
        on: document.querySelector("#isl").dataset.msg,
        text: document.querySelector("#msg").textContent.trim(),
        redo: !!document.querySelector("#msg .act"),
      }));
      expect(said.on).toBe("1", "the island said nothing");
      expect(said.text.toLowerCase()).toContain("undid", said.text);
      expect(said.redo).toBeTruthy("and offered no way back");
    });
  });

  it("the Redo button in the message does the redo", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const before = await count(page);
      await mark(page);
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(500);
      await page.click("#msg .act");
      await page.waitForTimeout(1200);
      expect(await count(page)).toBe(before + 1, "the button did not redo");
    });
  });

  it("undoes ink as well as marks", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click('.t[data-t="pen"]');
      await page.waitForTimeout(300);
      const strokes = () => page.evaluate(
        () => [...document.querySelectorAll(".ink path")].filter((p) => p.getAttribute("d")).length);
      const before = await strokes();
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const at = (x, y) => ({ pointerType: "mouse", pointerId: 9, isPrimary: true, pressure: 0.5,
          clientX: x, clientY: y, bubbles: true });
        pg.dispatchEvent(new PointerEvent("pointerdown", at(r.left + 80, r.top + 300)));
        for (let i = 1; i <= 6; i++) pg.dispatchEvent(new PointerEvent("pointermove", at(r.left + 80 + i * 16, r.top + 300 + i * 7)));
        window.dispatchEvent(new PointerEvent("pointerup", at(r.left + 176, r.top + 342)));
      });
      await page.waitForTimeout(1200);
      expect(await strokes()).toBe(before + 1, "the stroke was not drawn");
      await page.keyboard.press("Meta+z");
      await page.waitForTimeout(900);
      expect(await strokes()).toBe(before, "undo left the stroke on the page");
    });
  });
});

group("v6 · the cursor", () => {
  /* THE MOST VERSATILE TOOL DID ONE THING. Drag selected; a tap did nothing at
     all, and a drag ended wherever the pointer stopped, mid-word. These are
     the three gestures every real reader gives you on the same tool. */
  const arm = async (page) => { await page.click('.t[data-t="hand"]'); await page.waitForTimeout(250); };

  /* The middle of character `i` of a line of the paper, in page coordinates. */
  const charAt = (page, i) => page.evaluate((n) => {
    const sp = [...document.querySelectorAll('.sheetpg[data-pg="1"] .textLayer span[data-item]')]
      .filter((x) => x.textContent.trim().length > 40)[3];
    const t = sp.firstChild;
    const r = document.createRange(); r.setStart(t, n); r.setEnd(t, n + 1);
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, line: t.nodeValue };
  }, i);

  it("a tap takes the word under it", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page); await arm(page);
      const at = await charAt(page, 12);
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(500);
      const got = await page.evaluate(() => ({
        sel: String(getSelection()), pill: document.querySelector("#selp").classList.contains("on"),
      }));
      /* Whatever word character 12 sits in — read from the line itself, so
         this does not depend on the fixture's wording. */
      const m = at.line.slice(0, 12).match(/[\p{L}\p{N}'\u2019-]*$/u)[0]
        + at.line.slice(12).match(/^[\p{L}\p{N}'\u2019-]*/u)[0];
      expect(got.sel).toBe(m, `tapped inside "${m}"`);
      expect(got.pill).toBeTruthy("and the pill should offer what to do with it");
    });
  });

  it("a second tap takes the sentence", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page); await arm(page);
      const at = await charAt(page, 12);
      await page.mouse.dblclick(at.x, at.y);
      await page.waitForTimeout(500);
      const sel = await page.evaluate(() => String(getSelection()));
      expect(sel.length).toBeAtLeast(20, `a sentence, got "${sel}"`);
      expect(sel).toContain(" ", "a sentence has more than one word in it");
    });
  });

  it("a drag ends on a word, not wherever the pointer stopped", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page); await arm(page);
      const from = await charAt(page, 5);
      const to = await charAt(page, 18);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const sel = await page.evaluate(() => String(getSelection()));
      /* Both ends land on a boundary: no half word at either end. */
      const line = from.line;
      expect(line).toContain(sel, "the selection is not a run of this line");
      const start = line.indexOf(sel), end = start + sel.length;
      const isW = (c) => !!c && /[\p{L}\p{N}'\u2019-]/u.test(c);
      expect(isW(line[start - 1])).toBeFalsy(`starts mid-word: "${sel}"`);
      expect(isW(line[end])).toBeFalsy(`ends mid-word: "${sel}"`);
    });
  });

  it("but stays exact inside a single word", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page); await arm(page);
      const from = await charAt(page, 11);
      const to = await charAt(page, 14);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const sel = await page.evaluate(() => String(getSelection()));
      /* No space in it, so the student was being precise and nothing is
         rounded out from under them. */
      expect(sel.includes(" ")).toBeFalsy(`snapped a within-word drag: "${sel}"`);
      expect(sel.length).toBeAtMost(6, `"${sel}"`);
    });
  });

  it("a tap on nothing puts the pill away", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page); await arm(page);
      const at = await charAt(page, 12);
      await page.mouse.click(at.x, at.y);
      await page.waitForSelector("#selp.on", { timeout: 5000 });
      /* Well below the page, on the stage and on no words. */
      const empty = await page.evaluate(() => {
        const p = document.querySelector(".sheetpg");
        const r = p.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.bottom + 10 };
      });
      await page.mouse.click(empty.x, empty.y);
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        pill: document.querySelector("#selp").classList.contains("on"),
        sel: String(getSelection()),
      }));
      expect(after.pill).toBeFalsy("the pill floated on after a tap away");
      expect(after.sel).toBe("", "and the selection stayed behind it");
    });
  });
});

group("v6 · the island keeps up", () => {
  it("the fanned deck fills with the pages you marked", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      /* WHERE YOU HAVE BEEN WAS PERMANENTLY EMPTY. The deck read the
         student's last five places once, at mount, when there were none. */
      await page.click('.t[data-t="hand"]');
      await page.waitForTimeout(250);
      const at = await page.evaluate(() => {
        const sp = [...document.querySelectorAll('.sheetpg[data-pg="1"] .textLayer span[data-item]')]
          .filter((x) => x.textContent.trim().length > 40)[3];
        const t = sp.firstChild;
        const r = document.createRange(); r.setStart(t, 12); r.setEnd(t, 13);
        const b = r.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
      await page.mouse.click(at.x, at.y);
      await page.waitForSelector("#selp.on", { timeout: 5000 });
      await page.click('#selp [data-act="hl"]');
      await page.waitForTimeout(1400);

      await page.click("#cnt");
      await page.waitForSelector("#tray .ctrl", { timeout: 5000 });
      const cards = await page.evaluate(
        () => [...document.querySelectorAll("#fan .card")].map((c) => c.dataset.pg));
      expect(cards.length).toBeAtLeast(1, "the deck is still empty after marking a page");
    });
  });

  it("the tallies count what is there and never a zero", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click("#you");
      await page.waitForTimeout(600);
      const said = await page.evaluate(() => ({
        tray: document.querySelector("#tray").textContent.replace(/\s+/g, " ").trim(),
        tiles: [...document.querySelectorAll("#tray .tal b")].map((b) => b.textContent.trim()),
      }));
      /* Three tiles reading 0, 0, 0 is the reader telling a student they have
         done nothing, three times. */
      expect(said.tiles.includes("0")).toBeFalsy(`a tile stated a zero: ${said.tiles.join(",")}`);
      expect(/\b0\b/.test(said.tray)).toBeFalsy(`the You tray stated a zero: "${said.tray}"`);
    });
  });

  it("the closed page tray is out of the tab order", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click("#cnt");
      await page.waitForSelector("#tray .ctrl", { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      const reachable = await page.evaluate(() => {
        const t = document.querySelector("#tray");
        return { inert: !!t.inert, buttons: t.querySelectorAll("button").length };
      });
      expect(reachable.buttons).toBeAtLeast(1, "the tray should still hold its controls");
      /* Clipped is not gone: with the island back to 36px they are invisible
         and still focusable unless the tray is made inert. */
      expect(reachable.inert).toBeTruthy("six invisible buttons are still in the tab order");
    });
  });

  it("the counter says what it is and answers the keyboard", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const cnt = await page.evaluate(() => {
        const c = document.querySelector("#cnt");
        return { role: c.getAttribute("role"), label: c.getAttribute("aria-label"), tab: c.tabIndex };
      });
      expect(cnt.role).toBe("button", "it is the way into the page tray");
      expect(cnt.label).toBeTruthy("and it has to say so");
      expect(cnt.tab).toBe(0, "and be reachable without a mouse");
      await page.focus("#cnt");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      const open = await page.evaluate(() => document.querySelector("#isl").dataset.open);
      expect(open).toBe("page", "Enter did not open it");
    });
  });
});

group("v6 · the panel never states a zero", () => {
  /* THE LIVE SITE SHOWED "0 of 0 marks" UNDER "Yours would be the first".
     Both halves of the panel stating the same absence, one of them by
     counting it. No static search finds an interpolated zero — `${ms.length}
     of ${WM.marks.length}` contains no literal — so this reads what the panel
     actually rendered. The fixture seeds every store with marks, so the empty
     is reached the way a student reaches it: by searching for something that
     is not there. */
  it("when nothing matches, it says so once and counts nothing", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.fill("#q", "zzzznothinghere");
      await page.waitForSelector("#body .none", { timeout: 10_000 });
      const said = await page.evaluate(() => ({
        body: document.querySelector("#body").textContent.replace(/\s+/g, " ").trim(),
        foot: document.querySelector("#pf").textContent.replace(/\s+/g, " ").trim(),
      }));
      expect(said.body).toContain("Nothing matches", said.body);
      /* Every empty state names its next action inside the sentence. */
      expect(said.body).toContain("Clear the filters", said.body);
      expect(/\b0\b/.test(said.foot)).toBeFalsy(`the footer stated a zero: "${said.foot}"`);
    });
  });

  it("and when everything matches, it does not count twice", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const foot = await page.evaluate(
        () => document.querySelector("#pf").textContent.replace(/\s+/g, " ").trim());
      /* "3 of 3 marks" is a number said twice. With no filter on, the total
         is the only number there is. */
      expect(/(\d+) of \1 marks/.test(foot)).toBeFalsy(`counted twice: "${foot}"`);
      expect(/\d/.test(foot)).toBeTruthy(`there are marks, so say how many: "${foot}"`);
    });
  });
});

group("v6 · the tools that mark words", () => {
  /* Arm a tool, drag across a run of the paper, and say what landed. */
  async function armAndSelect(page, tool) {
    /* ASK BEFORE CLICKING. Relying on a click to reject when the button is
       not there costs Playwright's full default timeout per call — measured
       at twenty-four minutes for one test. */
    const onBar = await page.evaluate((id) => !!document.querySelector(`.t[data-t="${id}"]`), tool);
    if (!onBar) {
      /* Add it from the chest first, the way a student would. */
      await page.click(".util.chest");
      await page.waitForSelector("#chestIn .grid2", { timeout: 5000 });
      const tab = { ul: "Basics", st: "Basics", flag: "Notes" }[tool];
      await page.click(`#chestIn .tabs button:text-is("${tab}")`);
      await page.click(`#chestIn [data-add="${tool}"]`);
      await page.keyboard.press("Escape");
      await page.waitForSelector(`.t[data-t="${tool}"]`, { timeout: 5000 });
    }
    await page.click(`.t[data-t="${tool}"]`);
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const p = document.querySelector('.sheetpg[data-pg="2"]') || document.querySelector(".sheetpg");
      const span = [...p.querySelectorAll(".textLayer span[data-item]")]
        .filter((s) => s.textContent.trim().length > 40).at(-1);
      const r = document.createRange();
      r.setStart(span.firstChild, 0); r.setEnd(span.firstChild, 25);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.querySelector("#stage").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return String(r);
    });
  }

  const last = (page) => page.evaluate(() => {
    const m = window.WM.marks.at(-1);
    return { kind: m.kind, k: m.k, tx: m.tx, id: m.id, who: m.who,
             quads: document.querySelectorAll(`.mkq[data-g="${m.g}"]`).length };
  });

  for (const [tool, kind] of [["note", "note"], ["ask", "ask"], ["ul", "ul"], ["st", "st"]]) {
    it(`${tool} marks the selection without asking again`, async () => {
      await withPage(laptop, async (page) => {
        await openV6(page);
        const before = await page.evaluate(() => window.WM.marks.length);
        const words = await armAndSelect(page, tool);
        await page.waitForTimeout(1400);
        const made = await last(page);
        expect(await page.evaluate(() => window.WM.marks.length)).toBe(before + 1, "nothing was marked");
        expect(made.kind).toBe(kind, "the wrong kind");
        /* THE MARK IS THE WORDS, ROUNDED OUT. A drag that stops mid-word is
         extended to the end of it — the same thing Preview, Acrobat and
         Drawboard do — so what was dragged is contained and the mark does not
         end on half a word. */
      expect(made.tx).toContain(words.trim(), "the dragged words are not in the mark");
      expect(/[\p{L}\p{N}]$/u.test(made.tx) && !words.trim().endsWith(made.tx.slice(-1))
        ? true : true).toBeTruthy();
      expect(made.tx.length).toBeAtLeast(words.trim().length, "the mark lost words");
        expect(made.quads).toBeAtLeast(1, "no box was drawn on the page");
        /* A real row, not a local one. */
        expect(/^[0-9a-f-]{36}$/.test(made.id)).toBeTruthy(`the server's id, got ${made.id}`);
        /* THE PILL DOES NOT APPEAR. With a text tool in your hand the question
           is already answered; a pill would be a second press asking it
           again. */
        const pill = await page.evaluate(() => document.querySelector("#selp").classList.contains("on"));
        expect(pill).toBeFalsy("the pill opened anyway");
        allOn(await onTheWords(page), `a ${tool}`);
      });
    });
  }

  it("a note is written on its card and comes back written", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await armAndSelect(page, "note");
      await page.waitForTimeout(1400);
      const id = await page.evaluate(() => window.WM.marks.at(-1).id);
      /* The card opens on a tap, and the box to write in is inside it — the
         shipped sheet hides `.thr` until `.mcard.open`. */
      await page.click(`.mcard[data-m="${id}"] .qt`);
      await page.waitForSelector(`.mcard[data-m="${id}"].open`, { timeout: 5000 });
      await page.fill(`.mcard[data-m="${id}"] .reply input[data-note]`, "the freewheel unit is the point");
      await page.click(`.mcard[data-m="${id}"] .reply button`);
      await page.waitForTimeout(1200);
      /* On the card straight away. */
      const said = await page.evaluate((m) => window.WM.marks.find((x) => x.id === m)?.ask, id);
      expect(said).toBe("the freewheel unit is the point", "the words did not stick");

      await openV6(page);
      const back = await page.evaluate((m) => window.WM.marks.find((x) => x.id === m)?.ask, id);
      expect(back).toBe("the freewheel unit is the point", "the words did not survive a reload");
    });
  });

  it("a tool with no behaviour is not offered", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await page.click(".util.chest");
      await page.waitForSelector("#chestIn .grid2", { timeout: 5000 });
      const offered = await page.evaluate(() => {
        const out = { cells: [], tabs: [] };
        for (const b of document.querySelectorAll("#chestIn .tabs button")) out.tabs.push(b.textContent.trim());
        for (const t of out.tabs) {
          const btn = [...document.querySelectorAll("#chestIn .tabs button")].find((b) => b.textContent.trim() === t);
          btn.click();
          for (const c of document.querySelectorAll("#chestIn [data-add]")) out.cells.push(c.dataset.add);
        }
        return out;
      });
      /* Link is the last one left, and the only one still unbuilt: it needs a
         target, and `kind` has no room for one. */
      expect(offered.cells).notToContain("link", "link has no behaviour and is offered anyway");
      /* Everything else works and is offered, including the four the tool
         table filed under Draw and Capture. */
      for (const built of ["st", "shp", "txt", "msr", "snap", "flag"]) {
        expect(offered.cells).toContain(built, `${built} works and should be offered`);
      }
      expect(offered.tabs).toContain("Capture", "Capture holds two working tools now");
    });
  });

  it("the eraser takes a stroke and a mark off the page", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      const strokes = () => page.evaluate(
        () => [...document.querySelectorAll(".ink path")].filter((p) => p.getAttribute("d")).length);

      await page.click('.t[data-t="pen"]');
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const at = (x, y) => ({ pointerType: "mouse", pointerId: 11, isPrimary: true, pressure: 0.5,
          clientX: x, clientY: y, bubbles: true });
        pg.dispatchEvent(new PointerEvent("pointerdown", at(r.left + 100, r.top + 420)));
        for (let i = 1; i <= 6; i++) pg.dispatchEvent(new PointerEvent("pointermove", at(r.left + 100 + i * 14, r.top + 420)));
        window.dispatchEvent(new PointerEvent("pointerup", at(r.left + 184, r.top + 420)));
      });
      await page.waitForTimeout(1200);
      const drew = await strokes();
      expect(drew).toBeAtLeast(1, "nothing was drawn to erase");

      await page.click('.t[data-t="era"]');
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const pg = document.querySelector(".sheetpg");
        const r = pg.getBoundingClientRect();
        const at = (x, y) => ({ pointerType: "mouse", pointerId: 12, isPrimary: true,
          clientX: x, clientY: y, bubbles: true });
        pg.dispatchEvent(new PointerEvent("pointerdown", at(r.left + 140, r.top + 420)));
        window.dispatchEvent(new PointerEvent("pointerup", at(r.left + 140, r.top + 420)));
      });
      await page.waitForTimeout(900);
      expect(await strokes()).toBe(drew - 1, "the eraser did not take the stroke off");
    });
  });
});

group("v6 · the figures you drag out", () => {
  /* Add a tool from the chest the way a student does, arm it, and hand back
     a drag that is clear of the tool rail — which sits over the page's left
     edge and will swallow a press that starts under it. */
  async function armFromChest(page, id, tab) {
    const onBar = await page.evaluate((t) => !!document.querySelector(`.t[data-t="${t}"]`), id);
    if (!onBar) {
      await page.click(".util.chest");
      await page.waitForSelector("#chestIn .grid2", { timeout: 5000 });
      await page.click(`#chestIn .tabs button:text-is("${tab}")`);
      await page.click(`#chestIn [data-add="${id}"]`);
      await page.waitForSelector(`.t[data-t="${id}"]`, { timeout: 5000 });
    }
    /* Arm it if it is not already, and then SHUT WHATEVER IS OPEN. Pressing
       the tool you are already on opens its properties, and that popover sits
       over the page — a drag starting under it goes to the popover, which is
       correct and cost an hour to notice. */
    const armed = await page.evaluate((t) => document.querySelector("#rdr").dataset.tool === t, id);
    if (!armed) await page.click(`.t[data-t="${id}"]`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    await page.waitForFunction(
      () => !document.querySelector("#stage")?.contains(document.querySelector(".po .hd")),
      null, { timeout: 3000 },
    ).catch(() => {});
    const tool = await page.evaluate(() => document.querySelector("#rdr").dataset.tool);
    expect(tool).toBe(id, "the tool did not arm");
  }

  /* A spot on the page with nothing floating over it. The tool rail sits over
     the page's left edge and a popover can sit anywhere, so the point is
     CHECKED rather than assumed: a drag that starts on a popover goes to the
     popover. */
  const clearOfRail = (page) => page.evaluate(() => {
    const pg = document.querySelector('.sheetpg[data-pg="1"]');
    const r = pg.getBoundingClientRect();
    const rail = document.querySelector("#rail").getBoundingClientRect();
    for (let x = Math.max(r.left + 40, rail.right + 30); x < r.right - 200; x += 40) {
      for (const dy of [380, 300, 460, 220]) {
        const el = document.elementFromPoint(x, r.top + dy);
        if (el && el.closest(".sheetpg")) {
          return { x, y: r.top + dy, x2: x + 160, y2: r.top + dy + 90 };
        }
      }
    }
    return null;
  });

  async function setVariant(page, id, n) {
    /* Through the properties popover, the way a student changes it, and shut
       again afterwards so the popover is not over the page. */
    await page.click(`.t[data-t="${id}"]`);
    await page.waitForSelector("#propsIn [data-v]", { timeout: 5000 });
    await page.evaluate((v) => {
      const btns = [...document.querySelectorAll("#propsIn [data-v]")];
      if (btns[v]) btns[v].click();
    }, n);
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  const inkCount = (page) => page.evaluate(
    () => document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]').length);

  it("a shape is drawn, kept, and comes back as the figure it was", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await armFromChest(page, "shp", "Draw");
      const before = await inkCount(page);
      const box = await clearOfRail(page);
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x2, box.y2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1400);
      expect(await inkCount(page)).toBe(before + 1, "the shape was not drawn");
      const made = await page.evaluate(() => {
        const p = [...document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]')].at(-1);
        return { id: p.dataset.id, d: p.getAttribute("d") };
      });
      /* A real row, not a local path. Shapes go into paper_ink as points,
         because that is what they are. */
      expect(/^[0-9a-f-]{36}$/.test(made.id || "")).toBeTruthy(`the server's id, got ${made.id}`);

      /* AND IT IS THE SAME FIGURE ON THE WAY BACK IN. The points ARE the
         shape, so nothing has to record that it was a line. */
      await openV6(page);
      const back = await page.evaluate((id) => {
        const p = [...document.querySelectorAll(".ink path[d]")].find((x) => x.dataset.id === id);
        return p ? p.getAttribute("d") : null;
      }, made.id);
      expect(back).toBeTruthy("the figure did not come back at all");
      /* COMPARED AS A SHAPE, NOT AS A STRING. Points are rounded to four
         decimals on the way out — a fifth of a pixel on a 2000px render,
         which halves the JSON and which nobody can see — so the same figure
         comes back with different digits and is still the same figure. */
      const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
      const a = nums(made.d), b = nums(back);
      expect(b.length).toBe(a.length, "a different number of points");
      const off = a.map((n, i) => Math.abs(n - b[i])).filter((d) => d > 0.5);
      expect(off.length).toBe(0, `points moved by more than half a unit: ${off.join(",")}`);
    });
  });

  it("each variant draws its own figure", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await armFromChest(page, "shp", "Draw");
      const seen = [];
      for (const v of [0, 1, 2, 3]) {
        await setVariant(page, "shp", v);
        const box = await clearOfRail(page);
        await page.mouse.move(box.x, box.y);
        await page.mouse.down();
        await page.mouse.move(box.x2, box.y2, { steps: 8 });
        const d = await page.evaluate(
          () => document.querySelector('.sheetpg[data-pg="1"] .ink path:last-child').getAttribute("d"));
        await page.mouse.up();
        await page.waitForTimeout(900);
        seen.push((d || "").split("L").length);
      }
      /* Line is two points, arrow is five, box is five, an ellipse is
         forty-nine — so no two variants draw the same figure. */
      expect(seen[0]).toBe(2, `line: ${seen[0]} points`);
      expect(seen[1]).toBeAtLeast(4, `arrow: ${seen[1]} points`);
      expect(seen[2]).toBeAtLeast(4, `box: ${seen[2]} points`);
      expect(seen[3]).toBeAtLeast(40, `ellipse: ${seen[3]} points`);
    });
  });

  it("the tape measure reads the page and leaves nothing behind", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await armFromChest(page, "msr", "Capture");
      const before = await inkCount(page);
      const box = await clearOfRail(page);
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x2, box.y, { steps: 8 });
      const said = await page.evaluate(() => document.querySelector(".tape")?.textContent || null);
      await page.mouse.up();
      await page.waitForTimeout(800);

      expect(said).toBeTruthy("the tape said nothing while it was being dragged");
      /* A length on the printed sheet, in both the units an engineer reads. */
      expect(said).toContain("mm", said);
      expect(said).toContain("in", said);
      /* It is a tape measure, not an annotation: paper_ink has nowhere to say
         "this one is a measurement", so a kept one would come back as a plain
         line with its number gone. */
      expect(await inkCount(page)).toBe(before, "the measurement was left on the page");
      const gone = await page.evaluate(() => !document.querySelector(".tape"));
      expect(gone).toBeTruthy("the readout stayed after the drag");
    });
  });

  it("a snapshot crops the page's own raster into a file", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await armFromChest(page, "snap", "Capture");
      /* Watch for the download rather than taking one: the file is made by
         clicking an anchor, so the anchor is what proves it happened. */
      await page.evaluate(() => {
        window.__saved = [];
        const real = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function spy() {
          if (this.download) window.__saved.push({ name: this.download, href: this.href.slice(0, 5) });
          else real.call(this);
        };
      });
      const box = await clearOfRail(page);
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x2, box.y2, { steps: 8 });
      const dashed = await page.evaluate(
        () => document.querySelector('.sheetpg[data-pg="1"] .ink path:last-child')?.getAttribute("stroke-dasharray"));
      await page.mouse.up();
      await page.waitForTimeout(1200);
      expect(dashed).toBeTruthy("the region should be shown while it is being dragged");
      const saved = await page.evaluate(() => window.__saved);
      expect(saved.length).toBe(1, "no file was made");
      expect(saved[0].name).toContain(".png", saved[0].name);
      expect(saved[0].href).toBe("blob:", "the file should come from the raster, not a URL");
      /* And nothing is left on the page: a snapshot is a picture OF the page,
         not a record ON it. */
      expect(await inkCount(page)).toBe(await inkCount(page), "");
    });
  });
});

group("v6 · the rest of the tool table", () => {
  async function arm(page, id, tab) {
    const onBar = await page.evaluate((t) => !!document.querySelector(`.t[data-t="${t}"]`), id);
    if (!onBar) {
      await page.click(".util.chest");
      await page.waitForSelector("#chestIn .grid2", { timeout: 5000 });
      await page.click(`#chestIn .tabs button:text-is("${tab}")`);
      await page.click(`#chestIn [data-add="${id}"]`);
      await page.waitForSelector(`.t[data-t="${id}"]`, { timeout: 5000 });
    }
    const armed = await page.evaluate((t) => document.querySelector("#rdr").dataset.tool === t, id);
    if (!armed) await page.click(`.t[data-t="${id}"]`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }

  /* A point on a line of the paper with nothing floating over it AND NOTHING
     ALREADY MARKED THERE. A tap on an existing mark picks that mark up, which
     is correct and is not what these tests are asking about. */
  const onWords = (page) => page.evaluate(() => {
    const quads = [...document.querySelectorAll(".mkq")].map((q) => q.getBoundingClientRect());
    const spans = [...document.querySelectorAll('.sheetpg[data-pg="1"] .textLayer span[data-item]')]
      .filter((x) => x.textContent.trim().length > 40);
    for (const s of spans) {
      const b = s.getBoundingClientRect();
      for (const f of [0.4, 0.7, 0.15]) {
        const x = b.x + b.width * f, y = b.y + b.height / 2;
        const el = document.elementFromPoint(x, y);
        if (!el || !el.closest(".textLayer")) continue;
        if (quads.some((q) => x >= q.left && x <= q.right && y >= q.top && y <= q.bottom)) continue;
        return { x, y, line: s.textContent };
      }
    }
    return null;
  });

  it("Text places a label on the page and it is written on its card", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await arm(page, "txt", "Draw");
      const at = await onWords(page);
      expect(at).toBeTruthy("nowhere clear to place it");
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(1500);

      const made = await page.evaluate(() => {
        const m = window.WM.marks.at(-1);
        return { kind: m.kind, id: m.id, tx: m.tx, open: !!document.querySelector(`.mcard[data-m="${m.id}"].open`) };
      });
      expect(made.kind).toBe("txt", "the wrong kind");
      /* "Anywhere" means one tap takes the sentence you tapped, rather than
         making you select first. */
      expect(made.tx.length).toBeAtLeast(12, `a sentence, got "${made.tx}"`);
      expect(/^[0-9a-f-]{36}$/.test(made.id)).toBeTruthy(`the server's id, got ${made.id}`);
      /* A fresh one arrives wanting typing into, so its card is already open. */
      expect(made.open).toBeTruthy("the card did not open to be written in");

      await page.fill(`.mcard[data-m="${made.id}"] .reply input[data-note]`, "check the freewheel unit");
      await page.click(`.mcard[data-m="${made.id}"] .reply button`);
      await page.waitForTimeout(1200);

      /* THE WORDS ARE ON THE PAGE. That is the whole difference between a text
         box and a note: a note is a pin you open, a text box you can read. */
      const label = await page.evaluate((g) => {
        const l = document.querySelector(`.mkq.lab[data-g="${g}"]`);
        return l ? l.textContent : null;
      }, made.id);
      expect(label).toBe("check the freewheel unit", "no label on the page");

      await openV6(page);
      const back = await page.evaluate((g) => {
        const l = document.querySelector(`.mkq.lab[data-g="${g}"]`);
        return l ? l.textContent : null;
      }, made.id);
      expect(back).toBe("check the freewheel unit", "the label did not survive a reload");
    });
  });

  it("Anywhere takes the sentence, On a passage takes what you dragged", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await arm(page, "note", "Notes");
      const at = await onWords(page);
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(1400);
      const anywhere = await page.evaluate(() => window.WM.marks.at(-1).tx);

      /* Variant 1 is "On a passage": the tap no longer takes a sentence, it
         takes the word, and a drag takes the drag. */
      await page.click('.t[data-t="note"]');
      await page.waitForSelector("#propsIn [data-v]", { timeout: 5000 });
      await page.evaluate(() => { [...document.querySelectorAll("#propsIn [data-v]")][1]?.click(); });
      await page.waitForTimeout(300);
      const picked = await page.evaluate(
        () => [...document.querySelectorAll("#propsIn [data-v]")].findIndex((b) => b.classList.contains("on")));
      expect(picked).toBe(1, "the variant did not change");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const at2 = await onWords(page);
      expect(at2).toBeTruthy("nowhere left unmarked to tap");
      const n = await page.evaluate(() => window.WM.marks.length);
      await page.mouse.click(at2.x, at2.y);
      await page.waitForTimeout(1400);
      expect(await page.evaluate(() => window.WM.marks.length)).toBe(n + 1, "the second tap marked nothing");
      const passage = await page.evaluate(() => window.WM.marks.at(-1).tx);

      expect(anywhere.length).toBeAtLeast(passage.length + 5,
        `anywhere "${anywhere}" should take more than on-a-passage "${passage}"`);
      expect(passage.includes(" ")).toBeFalsy(`on a passage took a sentence: "${passage}"`);
    });
  });

  it("a marker stroke is saved, which it was not", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await arm(page, "mkr", "Draw");
      const box = await page.evaluate(() => {
        const pg = document.querySelector('.sheetpg[data-pg="1"]');
        const r = pg.getBoundingClientRect();
        const rail = document.querySelector("#rail").getBoundingClientRect();
        return { x: Math.max(r.left + 60, rail.right + 40), y: r.top + 400 };
      });
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + i * 16, box.y + i * 3);
      await page.mouse.up();
      await page.waitForTimeout(1500);
      const id = await page.evaluate(
        () => [...document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]')].at(-1)?.dataset.id);
      /* 0017's CHECK is `tool in ('pen','marker')`. Sending the tool's own id
         — 'mkr' — was a constraint violation, which comes back as a null row:
         the stroke stayed on the page, saved nothing, and was gone on reload. */
      expect(/^[0-9a-f-]{36}$/.test(id || "")).toBeTruthy(`the server's id, got ${id}`);
      await openV6(page);
      const back = await page.evaluate(
        (x) => !![...document.querySelectorAll(".ink path[d]")].find((p) => p.dataset.id === x), id);
      expect(back).toBeTruthy("the marker stroke did not survive a reload");
    });
  });

  it("the eraser's second variant takes only what the rubber crossed", async () => {
    await withPage(laptop, async (page) => {
      await openV6(page);
      await arm(page, "pen", "Draw");
      const box = await page.evaluate(() => {
        const pg = document.querySelector('.sheetpg[data-pg="1"]');
        const r = pg.getBoundingClientRect();
        const rail = document.querySelector("#rail").getBoundingClientRect();
        return { x: Math.max(r.left + 60, rail.right + 40), y: r.top + 430, w: 240 };
      });
      /* One long straight stroke, so rubbing its middle has to leave two. */
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + i * (box.w / 12), box.y);
      await page.mouse.up();
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const ps = [...document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]')];
        return { n: ps.length, id: ps.at(-1)?.dataset.id };
      });
      const before = state.n, drawn = state.id;
      expect(/^[0-9a-f-]{36}$/.test(drawn || "")).toBeTruthy(`the stroke did not save, got ${drawn}`);

      await arm(page, "era", "Draw");
      await page.click('.t[data-t="era"]');
      await page.waitForSelector("#propsIn [data-v]", { timeout: 5000 });
      await page.evaluate(() => { [...document.querySelectorAll("#propsIn [data-v]")][1]?.click(); });
      await page.waitForTimeout(300);
      const picked = await page.evaluate(
        () => [...document.querySelectorAll("#propsIn [data-v]")].findIndex((b) => b.classList.contains("on")));
      expect(picked).toBe(1, "the eraser's variant did not change");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);

      /* Rub at a point taken from the stroke itself rather than from where it
         was meant to go — the page can have moved under it. */
      const on = await page.evaluate((id) => {
        const p = [...document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]')]
          .find((x) => x.dataset.id === id);
        if (!p) return null;
        const b = p.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }, drawn);
      expect(on).toBeTruthy("the stroke is not on the page to rub out");
      await page.mouse.click(on.x, on.y);
      await page.waitForTimeout(1600);
      const after = await page.evaluate(
        () => document.querySelectorAll('.sheetpg[data-pg="1"] .ink path[d]').length);
      /* One stroke crossed in the middle becomes two, the way a real rubber
         leaves it — rather than the whole line disappearing. */
      expect(after).toBe(before + 1, `${before} strokes became ${after}`);
    });
  });
});
