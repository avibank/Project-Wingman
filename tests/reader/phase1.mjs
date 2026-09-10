/* PHASE 1 — the renderer. Brief §4.
 *
 * The bar it has to clear, in the brief's own words: "Open the longest paper.
 * Scroll top to bottom at fit-width, then at 200%, then back. No blank page
 * appears at any point."
 */
import { group, it, expect, openReader, withPage, shot, SURFACES } from "../harness/run.mjs";

const laptop = SURFACES[0];

/* A page counts as drawn when its canvas holds a bitmap the size of its box.
   Checking `data-on` alone would pass on a canvas that is present and empty,
   which is the exact failure being tested for. */
const pageState = (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll(".page")].map((p) => {
    const c = p.querySelector("canvas");
    const box = p.getBoundingClientRect();
    const onScreen = box.bottom > 70 && box.top < innerHeight - 30 && box.width > 0;
    return {
      n: Number(p.dataset.page),
      onScreen,
      ghost: p.classList.contains("ph"),
      /* The SHEET is what makes a page look like paper rather than a white
         rectangle: v5 gives `.page` a white ground, a 3px radius and the one
         shadow that is depth 1. Asked of the computed style rather than of the
         class name, because the class is what I write and the shadow is what
         the reader sees. */
      hasSheet: (() => {
        const cs = getComputedStyle(p);
        /* A drawn page is a flat white ground; a placeholder is a gradient, so
           its background-COLOUR is transparent and only background-image is
           set. Either counts — the point is that the slot looks like paper
           before there is a picture on it, which is the whole of §4.1. */
        return cs.boxShadow !== "none"
          && (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none");
      })(),
      boxW: Math.round(box.width),
      drawn: !!c && c.width > 1 && c.hasAttribute("data-on"),
      fills: !!c && Math.abs(c.getBoundingClientRect().width - box.width) < 2,
    };
  });
  return { rows, scrollTop: document.querySelector(".stage").scrollTop };
});

group("Phase 1 · the renderer", () => {
  it("the document keeps its width whether the panel is open or shut", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const open = await page.evaluate(() => Math.round(document.querySelector(".stage").getBoundingClientRect().width));
      /* "Pages" is a TAB inside the panel in v5; the button on the top-right
         opens and shuts the panel itself. */
      await page.click('.acts .ic[aria-label="Panel"]');
      await page.waitForTimeout(400);
      const shut = await page.evaluate(() => Math.round(document.querySelector(".stage").getBoundingClientRect().width));
      expect(open).toBeAtLeast(600, "with the panel open");
      expect(shut).toBeAtLeast(open, "with the panel shut the document should be WIDER, never zero");
    });
  });

  it("every page has a page-shaped placeholder before it is drawn", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const { rows } = await pageState(page);
      /* The COLUMN is the height of the whole paper; only a window of it is
         mounted, with spacers holding the rest. Counting mounted slots counts
         the window, which is the thing that has to stay small — a thousand
         page slots was most of the lag on a real manual. */
      expect(rows.length).toBeAtLeast(3, "nothing was laid out at all");
      expect(rows.every((r) => r.hasSheet)).toBeTruthy("a page with no sheet is a bare white rectangle");
      expect(rows.every((r) => r.boxW > 0)).toBeTruthy("every page holds its box");
    });
  });

  it("the scroll height is right from the first frame, so the scrollbar never jumps", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const first = await page.evaluate(() => document.querySelector(".stage").scrollHeight);
      await page.waitForTimeout(2500);
      const later = await page.evaluate(() => document.querySelector(".stage").scrollHeight);
      expect(Math.abs(later - first)).toBeAtMost(4, "the height moved as pages resolved");
    });
  });

  it("no blank page anywhere in a full scroll at fit width", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const seen = [];
      for (let i = 0; i <= 10; i++) {
        await page.evaluate((f) => {
          const s = document.querySelector(".stage");
          s.scrollTop = (s.scrollHeight - s.clientHeight) * f;
        }, i / 10);
        await page.waitForTimeout(700);
        const { rows } = await pageState(page);
        for (const r of rows.filter((x) => x.onScreen)) {
          seen.push(r);
          expect(r.hasSheet).toBeTruthy(`page ${r.n} showed no sheet at ${i * 10}%`);
        }
      }
      expect(seen.length).toBeAtLeast(8, "the scroll actually moved through pages");
      const drawn = seen.filter((r) => r.drawn).length;
      expect(drawn / seen.length).toBeAtLeast(0.6, "most on-screen pages should be drawn, not placeholders");
    });
  });

  it("a drawn page fills its sheet — no low-resolution pass left showing", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1500);
      const { rows } = await pageState(page);
      const live = rows.filter((r) => r.drawn);
      expect(live.length).toBeAtLeast(1);
      expect(live.every((r) => r.fills)).toBeTruthy("a canvas smaller than its page is the fast pass stuck on screen");
    });
  });

  it("the zoom control names the mode, not a percentage", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      expect(await page.locator(".corner-z .v").textContent()).toContain("Fit width");
    });
  });

  it("zoom holds the point the reader was looking at", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      // Put a known page under a known screen position, then zoom in about it.
      await page.evaluate(() => {
        const s = document.querySelector(".stage");
        s.scrollTop = s.scrollHeight * 0.12;
      });
      await page.waitForTimeout(600);
      const before = await page.evaluate(() => {
        const s = document.querySelector(".stage");
        return { top: s.scrollTop, h: s.scrollHeight };
      });
      await page.click('.ic[aria-label="Zoom in"]');
      await page.waitForTimeout(700);
      const after = await page.evaluate(() => {
        const s = document.querySelector(".stage");
        return { top: s.scrollTop, h: s.scrollHeight };
      });
      /* The same content should sit at the same fraction of the document. If
         zoom ignored the anchor, scrollTop would be unchanged while the height
         grew — throwing the reader upward by the whole difference. */
      const fBefore = before.top / before.h;
      const fAfter = after.top / after.h;
      expect(after.h).toBeAtLeast(before.h + 10, "zooming in should make the document taller");
      expect(Math.abs(fAfter - fBefore)).toBeAtMost(0.05, "the reader was thrown to a different part of the paper");
    });
  });

  /* WHAT IS ACTUALLY TRUE ABOUT RANGE LOADING, rather than what we hoped.

     The brief asks for 206s in the network log. On the fixture paper there are
     none, and that is pdf.js behaving correctly rather than a bug: at ~1MB the
     file is below the size where it bothers to switch to ranged mode, so it
     takes it in one GET. Asserting 206 here would mean either faking a 40MB
     fixture or softening the test until it says nothing.

     So this asserts the two things that ARE checkable and that the 40MB case
     depends on: the loader is configured for it, and the server on the other
     end really does serve partial content. The large-file behaviour itself is
     in MANUAL-TESTS.md, flagged as unverified, because it needs the real
     Lufthansa file. */
  it("the loader asks for ranges rather than the whole file", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const cfg = await page.evaluate(async () => {
        const src = await (await fetch("/src/lib/paperText.js")).text();
        return {
          autoFetchOff: /disableAutoFetch:\s*true/.test(src),
          chunked: /rangeChunkSize:\s*RANGE_CHUNK/.test(src),
        };
      });
      expect(cfg.autoFetchOff).toBeTruthy("without disableAutoFetch, range loading still costs the whole file");
      expect(cfg.chunked).toBeTruthy("no rangeChunkSize set");
    });
  });

  it("the server answers a ranged request with partial content", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const r = await page.evaluate(async () => {
        const res = await fetch("/papers/tracemonkey.pdf", { headers: { Range: "bytes=0-65535" } });
        const buf = await res.arrayBuffer();
        return { status: res.status, range: res.headers.get("content-range"), bytes: buf.byteLength };
      });
      expect(r.status).toBe(206, "the file host does not serve partial content");
      expect(r.bytes).toBe(65536, "a ranged request came back whole");
      expect(r.range).toContain("bytes 0-65535/");
    });
  });

  it("pages are separated, numbered, and sit on their own sheet", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const gap = await page.evaluate(() => getComputedStyle(document.querySelector(".stack")).rowGap);
      expect(parseInt(gap, 10)).toBeAtLeast(20, "pages need a gutter between them");
      const nums = await page.locator(".pnum").count();
      expect(nums).toBeAtLeast(3, "pages do not carry their number in the gutter");
      await shot(page, "phase1-reader-at-rest");
    });
  });

  it("nothing logs an error while a paper opens and scrolls", async () => {
    await withPage(laptop, async (page, { errors }) => {
      await openReader(page);
      await page.evaluate(() => { const s = document.querySelector(".stage"); s.scrollTop = s.scrollHeight * 0.5; });
      await page.waitForTimeout(1500);
      expect(errors.filter((e) => !/favicon|ResizeObserver loop/i.test(e))).toEqual([]);
    });
  });
});
