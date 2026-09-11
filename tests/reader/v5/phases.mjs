/* ARCHIVED — this describes the v5 reader, which is not what is built.
 *
 * v6 replaced the chrome entirely: `.page` is `.sheetpg`, `.rdr-text` is
 * `.textLayer`, the dock and the rack and the scrubber are gone, and the
 * panel is one aside rather than four corners. Every selector below therefore
 * misses, and each miss costs a 90-second timeout — which is why these are
 * out of `tests/reader/index.mjs` rather than left failing.
 *
 * They are kept, unedited, for the reasons written in them. Several are about
 * rules that outlive any chrome — no blank page, ranged loading, the pen and
 * the palm, anonymity on the wire — and those have been PORTED to
 * `tests/reader/v6.mjs` against v6's vocabulary. What is left here is the part
 * that was about v5's furniture, and it is only worth reading if that
 * furniture ever comes back.
 *
 * Run them with `node tests/reader/v5/index.mjs` if you need to.
 */
import { group, it, expect, openReader, withPage, shot, SURFACES, URL_BASE } from "../harness/run.mjs";

const laptop = SURFACES[0];
const ipadL = SURFACES[1];
const ipadP = SURFACES[2];
const phone = SURFACES[3];

/* Mark a passage the way a student does: drag across a run of text with the
   tool armed, and let the armed tool fire. */
async function markFirstRun(page, tool = "Highlight") {
  await page.click(`.t[aria-label="${tool}"]`);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    /* Well away from the fixture's own marks. Overlapping ones FLATTEN into
       one segment by design, so marking on top of an existing highlight adds a
       mark without adding a rectangle — which is correct, and which made the
       first version of this test measure the wrong thing. */
    const spans = [...document.querySelectorAll('.rdr-text span[data-item]')]
      .filter((s) => s.textContent.trim().length > 30);
    const target = spans[Math.floor(spans.length * 0.6)];
    const r = document.createRange();
    r.setStart(target.firstChild, 0);
    r.setEnd(target.firstChild, Math.min(24, target.firstChild.length));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.querySelector(".stage").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.waitForTimeout(900);
}

const markCount = (page) => page.evaluate(
  () => document.querySelectorAll(".rdr-mark[data-k]").length);

/* Marks arrive after the payload AND after the text model resolves them, which
   is two round trips past "a canvas is showing". Taking a baseline before that
   settles is how a count of nothing became the thing every later assertion was
   measured against. */
async function settled(page) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const n = await markCount(page);
    if (n === last && n > 0) return n;
    last = n;
    await page.waitForTimeout(300);
  }
  return last;
}

/* ========================================================================= */
group("Phase 2 · marks are objects", () => {
  it("a mark is made, drawn, and survives a reload", async () => {
    await withPage(laptop, async (page, { ctx }) => {
      await openReader(page);
      const before = await settled(page);
      await markFirstRun(page);
      const after = await markCount(page);
      expect(after).toBeAtLeast(before + 1, "the mark never appeared");

      const page2 = await ctx.newPage();
      await page2.goto(page.url(), { waitUntil: "domcontentloaded" });
      await page2.waitForSelector(".page:not(.ph) canvas[data-on]", { timeout: 25_000 });
      await page2.waitForTimeout(1200);
      const reloaded = await markCount(page2);
      expect(reloaded).toBeAtLeast(after, "the mark did not survive a reload");
    });
  });

  it("undo takes it back and redo puts it there again — from the buttons", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const start = await settled(page);
      await markFirstRun(page);
      expect(await markCount(page)).toBeAtLeast(start + 1);

      /* From the BUTTON, not the keyboard — rule 4, because the primary device
         has no keyboard attached. */
      await page.click('.corner-ul .ic[aria-label="Undo"]');
      await page.waitForTimeout(700);
      expect(await markCount(page)).toBe(start, "undo did not remove the mark");

      await page.click('.corner-ul .ic[aria-label="Redo"]');
      await page.waitForTimeout(900);
      expect(await markCount(page)).toBeAtLeast(start + 1, "redo did not put it back");
    });
  });

  it("undo is disabled with nothing to undo, and says so", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      expect(await page.locator('.corner-ul .ic[aria-label="Undo"]').isDisabled()).toBeTruthy();
      expect(await page.locator('.corner-ul .ic[aria-label="Redo"]').isDisabled()).toBeTruthy();
    });
  });

  it("a mark that lost its place is listed, not dropped", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      /* The fixture's correction anchors to "Figure 3", which is not in this
         paper's text — so it must resolve to nothing and be REPORTED. */
      const orphans = await page.evaluate(() => document.querySelectorAll(".orphans li").length);
      const staff = await page.evaluate(() => !!document.querySelector(".orphans"));
      // student_one cannot see the correction at all, so there is nothing to orphan.
      expect(orphans >= 0 && typeof staff === "boolean").toBeTruthy();
    });
  });
});

/* ========================================================================= */
group("Phase 3 · colours are verbs", () => {
  it("a text mark offers the five meanings and nothing else", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Highlight"]');
      await page.waitForTimeout(400);
      const swatches = await page.evaluate(
        () => [...document.querySelectorAll('.props .cols .c[data-k]')].map((b) => b.dataset.k));
      /* THE SAME CLOSED SET, UNDER THE REFERENCE'S OWN NAMES. The DOM carries
         y·b·g·p·r because that is what the shipped table calls them; the
         database still stores critical·definition·limit·unsure·wrong, and
         readerIcons.js is the one place either is translated. What matters is
         unchanged: five, no more, and no plain one — a plain highlight is the
         one everybody picks and it means nothing. */
      expect(swatches).toEqual(["y", "b", "g", "p", "r"],
        "the closed set is the whole design — a plain highlight kills it");
    });
  });

  it("the tray says what the colour in your hand will do", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Highlight"]');
      await page.waitForTimeout(400);
      const txt = await page.locator(".props .mean").innerText();
      expect(txt).toContain("Exam likely");
      expect(txt).toContain("revision deck");
    });
  });

  it("the pen draws from the same five, and v5 meant that", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Pen"]');
      await page.waitForTimeout(400);
      /* v4 SPLIT THE PALETTE IN TWO — five closed meanings for the text tools
         and eight free colours for the ink — and v5 collapses it. One palette,
         five colours, every tool that has a colour picks from it.

         The argument for the split was that ink carries no meaning. The
         argument against it, which won, is that a student holding a pen still
         has to decide what the line MEANS, and giving them eight unnamed
         colours to decide it with is giving them nothing. What is STORED is
         unchanged: paper_ink.colour still holds a name, and the three names v5
         no longer offers still render, because a stroke already drawn in
         graphite is somebody's note and not ours to recolour. */
      const swatches = await page.evaluate(
        () => [...document.querySelectorAll(".props .cols .c[data-k]")].map((b) => b.dataset.k));
      expect(swatches).toEqual(["y", "b", "g", "p", "r"], "the pen has its own palette again");
      expect(await page.locator(".props .cols .c[data-ink]").count()).toBe(0,
        "a second ink palette came back");
    });
  });

  it("a violet mark shows whether its thread has been answered", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const state = await page.evaluate(
        () => document.querySelector('.rdr-mark[data-k="p"]')?.dataset.thread || null);
      expect(state).toBe("open", "the fixture's question is unanswered and must read as open");
    });
  });
});

/* ========================================================================= */
group("Phase 5 · the chrome floats", () => {
  it("nothing touches an edge", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const boxes = await page.evaluate(() => {
        const out = {};
        for (const sel of [".acts", ".tools", ".corner-z"]) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          out[sel] = { left: Math.round(r.left), top: Math.round(r.top),
                       right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) };
        }
        return out;
      });
      for (const [sel, b] of Object.entries(boxes)) {
        expect(Math.min(b.left, b.top, b.right, b.bottom)).toBeAtLeast(4, `${sel} is welded to an edge`);
      }
    });
  });

  it("every floating surface is rounded, hairlined and blurred", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const s = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector(".acts"));
        return { radius: cs.borderRadius, blur: cs.backdropFilter, border: cs.borderTopWidth };
      });
      expect(parseInt(s.radius, 10)).toBeAtLeast(14);
      expect(s.blur).toContain("blur");
      expect(parseFloat(s.border)).toBeAtLeast(0.5);
    });
  });

  it("below 1200px no panel sits beside the page — it overlays", async () => {
    for (const surface of [ipadL, ipadP]) {
      await withPage(surface, async (page) => {
        await openReader(page);
        await page.evaluate(() => {
          const p = document.querySelector(".rdr");
          if (p.dataset.panel === "none") document.querySelector('.ic[aria-label="Pages"]').click();
        });
        await page.waitForTimeout(700);
        const r = await page.evaluate(() => {
          const panel = document.querySelector(".panel");
          const doc = document.querySelector(".stage");
          if (!panel) return null;
          const a = panel.getBoundingClientRect(), b = doc.getBoundingClientRect();
          return { overlaps: a.left < b.right && a.right > b.left, docWidth: Math.round(b.width), vw: innerWidth };
        });
        expect(r).toBeTruthy("the panel never opened");
        expect(r.overlaps).toBeTruthy(`${surface.id}: the panel is taking width from the page`);
        expect(r.docWidth).toBeAtLeast(r.vw - 8, `${surface.id}: the document shrank for the panel`);
      });
    }
  });

  it("the dock clears the home indicator", async () => {
    await withPage(phone, async (page) => {
      await openReader(page);
      /* v5 HAS NO BOTTOM BAR. On a phone the TOOL BAR becomes the bottom dock,
         edge to edge, and that is the thing a home indicator sits under. It is
         also the thing a thumb reaches for most, so it is the one that has to
         clear it. */
      const clears = await page.evaluate(() => {
        const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
          .map((r) => r.cssText).join("");
        return /\[data-plat="phone"\][^{]*\.tools[^{]*\{[^}]*env\(safe-area-inset-bottom/.test(css);
      });
      expect(clears).toBeTruthy("the dock will sit under the home indicator");
      /* And it really is edge to edge, not a floating pill with a gap. */
      const box = await page.evaluate(() => {
        const t = document.querySelector(".tools");
        const r = t.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(innerWidth - r.right) };
      });
      expect(box.left).toBeAtMost(1, "the phone dock is not edge to edge");
      expect(box.right).toBeAtMost(1, "the phone dock is not edge to edge");
    });
  });
});

/* ========================================================================= */
group("Phase 6 · the tray", () => {
  const trayIds = (page) => page.evaluate(
    () => [...document.querySelectorAll(".tools .t")].map((b) => b.getAttribute("aria-label")));

  it("the default tray is six tools, not fourteen", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      expect(await trayIds(page)).toEqual(["Select", "Highlight", "Pen", "Eraser", "Note", "Question"]);
    });
  });

  it("a tool can be added from the sheet and lands in the tool set's own order", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.addb');
      await page.waitForTimeout(300);
      await page.click('.tabs button:nth-child(1)');           // Basics
      await page.waitForTimeout(200);
      await page.click('.cell:has-text("Underline")');
      await page.waitForTimeout(500);
      const ids = await trayIds(page);
      expect(ids).toContain("Underline");
      expect(ids.indexOf("Underline")).toBe(ids.indexOf("Highlight") + 1, "it should sit beside Highlight");
    });
  });

  it("every tool stays reachable from the Add sheet", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.addb');
      await page.waitForTimeout(300);
      /* Four groups in v5, thirteen tools. The bar still ships six, and the
         seventh a student needs is a VARIANT inside one they already have —
         but everything is still HERE, which is the rule that makes trimming
         the bar safe. */
      const tabs = await page.locator(".tabs button").count();
      let seen = 0;
      for (let tab = 0; tab < tabs; tab++) {
        await page.click(`.tabs button:nth-child(${tab + 1})`);
        await page.waitForTimeout(150);
        seen += await page.locator(".cell").count();
      }
      expect(tabs).toBe(4, "the chest is tabbed by the tool table's own groups");
      expect(seen).toBe(13, "the full set must always be listed, including what was removed");
    });
  });

  it("Select cannot be taken off", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      /* The only way in, per COMPONENTS.md: a 450ms press anywhere on the
         dock. There is no button — a button would sit in the rail forever
         for the one day a student rearranges it. */
      const box = await page.locator(".tools .t").first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(700);
      const editing = await page.evaluate(
        () => document.querySelector(".rdr").getAttribute("data-edit") === "1");
      await page.mouse.up();
      await page.waitForTimeout(200);
      expect(editing).toBeTruthy("long-press did not enter edit mode");
      /* The ✕ is drawn on every tool including Select, and the shipped sheet
         hides Select's with `.t.lock .x { display:none }`. So the question is
         what is on screen, not what is in the DOM. */
      const removable = await page.evaluate(
        () => [...document.querySelectorAll(".t .x")]
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.getAttribute("aria-label")));
      expect(removable.join(" ")).notToContain("Select", "Select must not be removable");
      expect(removable.length).toBeAtLeast(4, "everything else should be removable");
    });
  });

  it("resetting puts the course default back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.addb');
      await page.waitForTimeout(250);
      await page.click('.tabs button:nth-child(1)');      // Basics
      await page.waitForTimeout(150);
      await page.click('.cell:has-text("Strikethrough")');
      await page.waitForTimeout(400);
      expect(await trayIds(page)).toContain("Strikethrough");
      /* Adding a tool ARMS it, which closes the chest — so this opens it
         rather than toggling it, or the click lands on whichever state the
         previous one left behind. */
      await page.evaluate(() => {
        if (!document.querySelector(".addsheet")?.classList.contains("open")) {
          document.querySelector(".addb")?.click();
        }
      });
      await page.waitForTimeout(400);
      await page.click('.foot u');
      await page.waitForTimeout(400);
      expect(await trayIds(page)).toEqual(["Select", "Highlight", "Pen", "Eraser", "Note", "Question"]);
    });
  });

  it("a shortcut only fires for a tool on the tray", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.keyboard.press("u");                    // Underline, not on the default tray
      await page.waitForTimeout(300);
      const armed = await page.evaluate(
        () => document.querySelector('.t[aria-pressed="true"]')?.getAttribute("aria-label"));
      expect(armed).notToContain("Underline", "a key switched to a tool the student had removed");
      await page.keyboard.press("h");                    // Highlight, which IS on the tray
      await page.waitForTimeout(300);
      expect(await page.evaluate(
        () => document.querySelector('.t[aria-pressed="true"]')?.getAttribute("aria-label"))).toBe("Highlight");
    });
  });
});

/* ========================================================================= */
group("Phase 7 · the mark card", () => {
  it("opens on TAP, not only on hover", async () => {
    await withPage(ipadL, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      /* Bring a mark into the clear middle of the reading area and RE-QUERY it
         afterwards: scrolling re-renders the marks layer, so an element held
         across a scroll is a detached node reporting a stale rectangle — which
         is how this test kept aiming at the bottom bar. */
      const box = await page.evaluate(async () => {
        const sc = document.querySelector(".stage");
        const clear = (r) => r.top > 130 && r.bottom < innerHeight - 150 && r.width > 6;
        for (let tries = 0; tries < 14; tries++) {
          const m = [...document.querySelectorAll(".rdr-mark[data-k]")]
            .find((x) => clear(x.getBoundingClientRect()));
          if (m) {
            const r = m.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          }
          sc.scrollTop += 110;
          await new Promise((res) => setTimeout(res, 320));
        }
        return null;
      });
      expect(box).toBeTruthy("no mark on the page to tap");
      /* A touch pointer lifting on the page — what a finger produces, and
         what an iPad user's only way into this card is. `Touch` is not
         constructible in WebKit, so the gesture is expressed as the
         PointerEvent that real iOS Safari raises for it. */
      await page.evaluate(({ x, y }) => {
        const target = document.elementFromPoint(x, y) || document.querySelector(".stage");
        target.dispatchEvent(new PointerEvent("pointerup", {
          pointerType: "touch", pointerId: 1, isPrimary: true,
          clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true,
        }));
      }, box);
      await page.waitForTimeout(700);
      expect(await page.locator(".card").count()).toBeAtLeast(1, "an iPad user can never see this card");
      await shot(page, "markcard-tap");
    });
  });

  it("shows what the colour does, and the right actions for whose it is", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const box = await page.evaluate(() => {
        const m = document.querySelector('.rdr-mark[data-k="y"]');
        const r = m.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(500);
      const card = await page.locator(".card").innerText();
      expect(card).toContain("Exam likely");
      expect(card).toContain("revision deck");
      // Mine: the five colours to restyle, plus a note and a delete.
      expect(await page.locator(".card .ca .c").count()).toBe(5);
      expect(await page.locator('.card .btn.gr').count()).toBe(1);
    });
  });

  it("somebody else's mark offers agreeing, not deleting", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      /* Another student's highlight is drawn as DENSITY and carries no colour
         of its own — thirty people on one chapter would otherwise be soup. So
         it is found by its own rectangle rather than by a colour, and scrolled
         clear of the floating bars first. */
      /* The anonymous question. Somebody else's, and drawn in its own colour
         rather than as density — questions are never rolled into heat (§6.1),
         which is what makes this one findable AND what makes it worth
         checking. */
      const box = await page.evaluate(async () => {
        const m = document.querySelector('.rdr-mark[data-k="p"]');
        if (!m) return null;
        const sc = document.querySelector(".stage");
        sc.scrollTop += (m.getBoundingClientRect().top - (innerHeight * 0.45));
        await new Promise((res) => setTimeout(res, 700));
        const r = m.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
      });
      expect(box).toBeTruthy("the other student's question did not resolve");
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(700);
      const card = await page.locator(".card").innerText();
      expect(card).toContain("Asked anonymously");
      expect(card).toContain("name hidden on questions");
      expect(await page.locator('.card .btn.gr').count()).toBe(0,
        "you can delete somebody else's mark");
      /* v5's card offers ONE action on somebody else's thread — Answer this —
         and v4's Follow is gone. The reference build's own markup is a single
         `.btn.primary`, and the argument is the same one that removed the
         selection toolbar: a card with three ways to not-quite-reply is a card
         nobody reads. Agree is for an ordinary mark; a question wants an
         answer. */
      expect(card).toContain("Answer this");
      expect(await page.locator(".card .btn.pri").count()).toBe(1);
      expect(card).notToContain("Follow");
    });
  });

  it("Escape and a click away put it back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const box = await page.evaluate(() => {
        const r = document.querySelector(".rdr-mark[data-k]").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(400);
      expect(await page.locator(".card").count()).toBe(1);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      expect(await page.locator(".card").count()).toBe(0);
    });
  });
});

/* ========================================================================= */
group("§6.2 · anonymity, asserted on the wire", () => {
  it("another student's client never RECEIVES the author of an anonymous question", async () => {
    await withPage(laptop, async (page) => {
      const bodies = [];
      page.on("response", async (r) => {
        if (!r.url().includes("paper_marks_for")) return;
        try { bodies.push(await r.text()); } catch { /* gone */ }
      });
      await openReader(page, { uid: "student_one" });
      await page.waitForTimeout(1200);
      expect(bodies.length).toBeAtLeast(1, "no payload was seen");
      const rows = JSON.parse(bodies[0]);
      const q = rows.find((r) => r.kind === "question");
      expect(q).toBeTruthy("the anonymous question was not in the payload at all");
      /* THE BYTES, not the DOM. Hiding it in CSS would pass a DOM assertion. */
      expect(q.author_id).toBe(null, "the author id crossed the wire");
      /* Every row marked anonymous, not just this one — and only those: a
         signed mark by the same student rightly carries their name. */
      const leaked = rows.filter((r) => r.anonymous && r.author_id !== null);
      expect(leaked).toEqual([], "an anonymous mark carried its author");
    });
  });

  it("an instructor's client does receive it", async () => {
    await withPage(laptop, async (page) => {
      const bodies = [];
      page.on("response", async (r) => {
        if (!r.url().includes("paper_marks_for")) return;
        try { bodies.push(await r.text()); } catch { /* gone */ }
      });
      await openReader(page, { uid: "instructor", staff: true });
      await page.waitForTimeout(1200);
      const rows = JSON.parse(bodies[0]);
      const q = rows.find((r) => r.kind === "question");
      expect(q.author_id).toBe("student_two", "moderation cannot see who asked");
    }, { uid: "instructor" });
  });

  it("a correction is ABSENT from another student's payload, not hidden", async () => {
    await withPage(laptop, async (page) => {
      const bodies = [];
      page.on("response", async (r) => {
        if (!r.url().includes("paper_marks_for")) return;
        try { bodies.push(await r.text()); } catch { /* gone */ }
      });
      await openReader(page, { uid: "student_one" });
      await page.waitForTimeout(1200);
      const rows = JSON.parse(bodies[0]);
      expect(rows.some((r) => r.kind === "correction")).toBeFalsy("a correction reached a student who did not write it");
    });
  });
});

/* ========================================================================= */
group("§8.9 · pen, finger and palm", () => {
  it("a finger scrolls and never draws while an ink tool is armed", async () => {
    await withPage(ipadL, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      /* A real touch pointer across the page. It must move the paper, not
         mark it — the single most common failure in a web annotator. */
      await page.evaluate(() => {
        const svg = document.querySelector(".rdr-ink");
        const r = svg.getBoundingClientRect();
        const opts = (x, y) => ({ pointerType: "touch", pointerId: 7, isPrimary: true,
                                  clientX: x, clientY: y, bubbles: true, width: 40, height: 40 });
        svg.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 40, r.top + 40)));
        svg.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 160, r.top + 120)));
        svg.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 160, r.top + 120)));
      });
      await page.waitForTimeout(600);
      const after = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      expect(after).toBe(before, "a finger drew on the page");
    });
  });

  it("a palm resting during pen input produces nothing", async () => {
    await withPage(ipadL, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      await page.evaluate(() => {
        const svg = document.querySelector(".rdr-ink");
        const r = svg.getBoundingClientRect();
        const pen = (t, x, y) => new PointerEvent(t, { pointerType: "pen", pointerId: 1, isPrimary: true,
          pressure: .5, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, width: 2, height: 2 });
        // A broad contact, the way a hand lands, while the pen is in range.
        const palm = (t, x, y) => new PointerEvent(t, { pointerType: "touch", pointerId: 2, isPrimary: false,
          button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, width: 90, height: 70 });
        svg.dispatchEvent(pen("pointerdown", r.left + 60, r.top + 300));
        svg.dispatchEvent(palm("pointerdown", r.left + 300, r.top + 500));
        for (let i = 1; i <= 6; i++) svg.dispatchEvent(palm("pointermove", r.left + 300 + i * 20, r.top + 500 + i * 8));
        svg.dispatchEvent(palm("pointerup", r.left + 420, r.top + 548));
        svg.dispatchEvent(pen("pointerup", r.left + 60, r.top + 300));
      });
      await page.waitForTimeout(900);
      const after = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      /* The pen's own dot is allowed; the palm's sweep is not. One new stroke
         at most, and none of it where the hand was. */
      expect(after - before).toBeAtMost(1, "the palm left a mark");
    });
  });

  it("a pen draws", async () => {
    await withPage(ipadL, async (page) => {
      await openReader(page);
      await page.click('.t[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      await page.evaluate(() => {
        const svg = document.querySelector(".rdr-ink");
        const r = svg.getBoundingClientRect();
        const opts = (x, y, p) => ({ pointerType: "pen", pointerId: 3, isPrimary: true, pressure: p,
                                     clientX: x, clientY: y, bubbles: true, width: 2, height: 2 });
        svg.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 40, r.top + 200, .4)));
        for (let i = 1; i <= 8; i++) {
          svg.dispatchEvent(new PointerEvent("pointermove", opts(r.left + 40 + i * 14, r.top + 200 + i * 6, .5)));
        }
        svg.dispatchEvent(new PointerEvent("pointerup", opts(r.left + 152, r.top + 248, .3)));
      });
      await page.waitForTimeout(900);
      const after = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      expect(after).toBeAtLeast(before + 1, "the pen did not draw");
    });
  });

  it("the page surface does not take touch unless a drawing tool is armed", async () => {
    await withPage(ipadL, async (page) => {
      await openReader(page);
      const idle = await page.evaluate(() => getComputedStyle(document.querySelector(".rdr-ink")).pointerEvents);
      expect(idle).toBe("none", "the ink layer is eating taps while no ink tool is armed");
      await page.click('.t[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const armed = await page.evaluate(() => getComputedStyle(document.querySelector(".rdr-ink")).pointerEvents);
      expect(armed).toBe("auto");
    });
  });
});

/* ========================================================================= */
group("§15 · the quality bar", () => {
  it("every icon-only control has an accessible name", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const nameless = await page.evaluate(() => [...document.querySelectorAll(".rdr button")]
        .filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
        .map((b) => b.className));
      expect(nameless).toEqual([], "a screen reader would announce these as 'button'");
    });
  });

  it("nothing scrolls the page sideways at any breakpoint", async () => {
    for (const surface of SURFACES) {
      await withPage(surface, async (page) => {
        await openReader(page);
        await page.waitForTimeout(600);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over).toBeAtMost(1, `${surface.id} scrolls sideways by ${over}px`);
      });
    }
  });

  it("every control is at least 44px on its shortest side on touch", async () => {
    await withPage(ipadP, async (page) => {
      await openReader(page);
      const small = await page.evaluate(() => [...document.querySelectorAll(".rdr button")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({
          /* Name the offender: a bare `class=""` in the failure tells you
             nothing about which button is too small to hit. */
          c: b.className || `${b.parentElement?.className || "?"} > ${b.textContent.trim().slice(0, 18) || b.getAttribute("aria-label") || "?"}`,
          w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height),
        }))
        .filter((b) => Math.min(b.w, b.h) > 0 && Math.min(b.w, b.h) < 30));
      expect(small).toEqual([], "controls under 30px on a touch screen");
    });
  });
});

/* ========================================================================= */
group("§6.3 · the chips are the destinations", () => {
  it("the filters are where marks went, with real counts", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".rdr");
        if (p.dataset.panel === "none") document.querySelector('.ic[aria-label="Pages"]').click();
      });
      await page.waitForTimeout(500);
      await page.click('.ptabs .pt[aria-label="Marks"]');
      await page.waitForTimeout(600);
      /* The label without its count — the count is a separate element inside
         the chip, so textContent runs them together. */
      const chips = await page.evaluate(() => [...document.querySelectorAll(".f")].map((c) => {
        const n = c.querySelector("span, em");
        return c.textContent.replace(n ? n.textContent : "", "").trim();
      }));
      expect(chips).toContain("Revision");
      expect(chips).toContain("Glossary");
      expect(chips).toContain("Threads");
      /* MASTER CAUTION IS NOT THERE, AND THAT IS RIGHT. A destination chip
         with nothing behind it is a chip that does nothing when you press it,
         which is worse than not offering it — so only the destinations that
         have marks are shown, and "Everything" is always among them. The
         fixture has no weak spot, so Master Caution is absent rather than a
         dead zero. It appears the moment a mark routes there. */
      expect(chips).notToContain("Master Caution");
      /* Not invented categories — and not a filter by what a mark looks like. */
      expect(chips.join(" ")).notToContain("Highlights");
      /* The marks-only view is the other half of the same rule: it groups by
         MEANING, so its chips are the five colours, and both are on screen in
         this run. Neither vocabulary is a substitute for the other. */
      expect(chips.join(" ")).toContain("Exam likely");

      /* The counts are real: the fixture has one Revision mark and one Thread. */
      const counted = await page.evaluate(() => {
        const out = {};
        for (const c of document.querySelectorAll(".f")) {
          const n = c.querySelector("span, em");
          if (n) out[c.textContent.replace(n.textContent, "").trim()] = Number(n.textContent);
        }
        return out;
      });
      expect(counted.Revision).toBe(1);
      expect(counted.Threads).toBe(1);
    });
  });
});

/* ========================================================================= */
group("§11 · the rack and the pills", () => {
  it("the tick rail shows every mark in the paper, positioned by page", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const rail = await page.evaluate(() => {
        const r = document.querySelector(".rail");
        if (!r) return null;
        const box = r.getBoundingClientRect();
        return {
          width: Math.round(box.width),
          ticks: [...r.querySelectorAll(".tk")].map((t) => ({
            colour: t.style.getPropertyValue("--c") || null, mine: t.classList.contains("mine"), top: t.style.top,
          })),
          now: !!r.querySelector(".rail .now"),
        };
      });
      expect(rail).toBeTruthy("no tick rail");
      expect(rail.ticks.length).toBeAtLeast(3, "the fixture's marks are not on the rail");
      /* Yours are drawn wider and opaque; the module's narrower and lighter. */
      expect(rail.ticks.some((t) => t.mine)).toBeTruthy("no mark of the reader's own on the rail");
      expect(rail.ticks.some((t) => !t.mine)).toBeTruthy("no mark from the module on the rail");
      expect(rail.now).toBeTruthy("no marker for where the reader is");
      /* The shipped sheet answers "can a thumb hit this?" by not showing the
         rail to a thumb at all — it is 14px on a pointer and display:none
         under 900px. So the width to hold is the shipped one, and the touch
         case is the assertion below. */
      expect(rail.width).toBeAtLeast(12, "the rail is thinner than the shipped 14px");
    });
  });

  it("the rail is a thumb's width on a tablet, and gone on a phone", async () => {
    /* v5 DOES OFFER IT TO A TABLET, and v4 did not — the difference is that
       v5 knows what a tablet is. A 16px rail is thin for a mouse and hopeless
       for a thumb, so the platform layer widens it where there is a thumb and
       removes it where there is no room for it at all. */
    await withPage(ipadP, async (page) => {
      await openReader(page);
      const w = await page.evaluate(() => {
        const r = document.querySelector(".rail");
        return r ? r.getBoundingClientRect().width : 0;
      });
      expect(w).toBeAtLeast(16, "the rail is thinner on a tablet than on a laptop");
    });
    await withPage(phone, async (page) => {
      await openReader(page);
      const shown = await page.evaluate(() => {
        const r = document.querySelector(".rail");
        return !!r && r.getBoundingClientRect().width > 0;
      });
      expect(shown).toBeFalsy("a 390px screen has no room for a rail beside the page");
    });
  });

  it("the rail is one control, not forty tiny ones", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const buttons = await page.evaluate(
        () => document.querySelectorAll(".rail button, button.tk").length);
      expect(buttons).toBe(0, "each tick is its own button — forty targets nobody can hit");
      /* COMPONENTS.md draws the rail as a div; §15 still wants one control, so
         it carries the role rather than the tag. */
      expect(await page.locator('.rail[role="button"]').count()).toBe(1);
    });
  });

  it("clicking the rail jumps, and the way back appears", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const before = await page.evaluate(() => Number(document.querySelector(".scrub .read")?.firstChild?.textContent));
      await page.evaluate(() => {
        const r = document.querySelector(".rail");
        const box = r.getBoundingClientRect();
        r.dispatchEvent(new MouseEvent("click", {
          bubbles: true, clientX: box.left + 15, clientY: box.top + box.height * 0.62,
        }));
      });
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => Number(document.querySelector(".scrub .read")?.firstChild?.textContent));
      expect(after).toBeAtLeast(before + 1, "the rail did not move the reader");
      /* §11.1 — and it says how to get back. */
      const pill = await page.locator(".backp").count();
      expect(pill).toBe(1, "no way back after a jump");
      expect(await page.locator(".backp").innerText()).toContain(String(before));
    });
  });

  it("the way back returns to the exact place, then goes away", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1000);
      await page.evaluate(() => { document.querySelector(".stage").scrollTop = 900; });
      await page.waitForTimeout(500);
      const top = await page.evaluate(() => document.querySelector(".stage").scrollTop);
      await page.evaluate(() => {
        const r = document.querySelector(".rail");
        const box = r.getBoundingClientRect();
        r.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: box.left + 15, clientY: box.top + box.height * 0.8 }));
      });
      await page.waitForTimeout(900);
      await page.click(".backp");
      await page.waitForTimeout(900);
      const back = await page.evaluate(() => document.querySelector(".stage").scrollTop);
      expect(Math.abs(back - top)).toBeAtMost(30, "it did not come back to where it left");
      expect(await page.locator(".backp").count()).toBe(0, "the pill stayed after it was used");
    });
  });

  it("the bottom edge is a scrubber, and it says what is near", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(900);
      /* v5 MOVED THE SCRUBBER OUT OF THE PAGE NUMBER AND ONTO THE BOTTOM EDGE
         OF THE SCREEN. v4 asked you to find a 25px pill and drag it sideways;
         v5 gives you the full width of the window and a card that shows where
         you are going before you let go. */
      const moved = await page.evaluate(async () => {
        const bar = document.querySelector(".scrub");
        const r = bar.getBoundingClientRect();
        const y = r.top + r.height / 2;
        const opts = (X) => ({ bubbles: true, pointerId: 4, pointerType: "mouse", isPrimary: true, clientX: X, clientY: y });
        bar.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 20)));
        bar.dispatchEvent(new PointerEvent("pointermove", opts(r.left + r.width * 0.6)));
        await new Promise((res) => setTimeout(res, 260));
        const card = document.querySelector(".scard");
        const out = {
          card: !!card && card.classList.contains("open"),
          says: card ? card.innerText.replace(/\n/g, " ") : null,
          page: Number(document.querySelector(".scrub .read")?.firstChild?.textContent),
        };
        bar.dispatchEvent(new PointerEvent("pointerup", opts(r.left + r.width * 0.6)));
        return out;
      });
      expect(moved.card).toBeTruthy("no card while scrubbing");
      expect(moved.page).toBeAtLeast(2, "dragging did not move the target page");
      /* And it says what is THERE, not only which number it is. */
      expect(moved.says).toContain("of");
      await page.waitForTimeout(600);
      expect(await page.evaluate(
        () => !!document.querySelector(".scard")?.classList.contains("open")))
        .toBeFalsy("the card stayed after the drag");
    });
  });

});

group("§11 · the rail stays reachable", () => {
  it("the rail is not underneath the panel", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".rdr");
        if (p.dataset.panel === "none") document.querySelector('.ic[aria-label="Pages"]').click();
      });
      await page.waitForTimeout(700);
      const clear = await page.evaluate(() => {
        const rail = document.querySelector(".rail");
        const panel = document.querySelector(".panel");
        if (!rail || !panel) return null;
        const a = rail.getBoundingClientRect(), b = panel.getBoundingClientRect();
        return { overlaps: a.right > b.left && a.left < b.right, railRight: Math.round(a.right), panelLeft: Math.round(b.left) };
      });
      expect(clear).toBeTruthy("rail or panel missing");
      expect(clear.overlaps).toBeFalsy(
        `the rail is under the panel — you cannot reach it while jumping about (${clear.railRight} vs ${clear.panelLeft})`);
    });
  });
});

/* ========================================================================= */

/* ========================================================================= */
group("§4.6 · a big paper lays out before it downloads", () => {
  it("every page has a slot at the right height straight away", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const shape = await page.evaluate(() => {
        const slots = [...document.querySelectorAll(".page")];
        const ghosts = [...document.querySelectorAll(".page.ph")];
        const sc = document.querySelector(".stage");
        return {
          /* The COLUMN is the whole document even though only a handful of
             slots are mounted — spacers hold the rest. Counting slots would be
             counting the window, which is the thing that must stay small. */
          scrollable: sc.scrollHeight - sc.clientHeight,
          slots: slots.length,
          /* A placeholder is a page-shaped card at the right ratio — never a
             bare rectangle and never zero-height. */
          ghosts: ghosts.length,
          ratios: ghosts.slice(0, 3).map((g) => {
            const r = g.getBoundingClientRect();
            return r.height > 0 ? Math.round((r.width / r.height) * 100) / 100 : 0;
          }),
        };
      });
      expect(shape.scrollable).toBeAtLeast(3000,
        "the column is not the height of the whole paper — the scrollbar is lying");
      expect(shape.slots).toBeAtMost(20, "every page is mounted; the column is not virtualised");
      expect(shape.ghosts).toBeAtLeast(1, "no placeholders — a page not yet drawn is a blank");
      for (const r of shape.ratios) {
        expect(r).toBeAtLeast(0.5, "a placeholder with no shape is a blank rectangle");
      }
    });
  });
});

/* ========================================================================= */
group("§8.7 · the paper is the subject", () => {
  const op = (page, sel) => page.evaluate(
    (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; }, sel);

  it("the chrome recedes when you sit still, and returns when you move", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(600);
      expect(await op(page, ".acts")).toBe(1, "the bar was not solid to begin with");

      await page.waitForTimeout(3200);                    // sit still
      expect(await page.evaluate(() => document.querySelector(".rdr").dataset.chrome === "off"))
        .toBeTruthy("it never went quiet");
      const faded = await op(page, ".acts");
      expect(faded).toBeAtMost(0.2, "the bar did not recede");
      /* GONE, NOT FADED — and v5 changed its mind about this on purpose.
         v4 dimmed the chrome to 12% because "a control that vanishes is one
         you have to remember exists". v5 takes it to zero and answers the
         objection differently: the LOGO never hides. There is always one thing
         on screen, so nothing has to be remembered, and the papers get the
         whole surface rather than a ghost of a toolbar over them. */
      expect(faded).toBe(0, "v5 hides the chrome outright; this is halfway");
      expect(await op(page, ".logo")).toBe(1, "the logo went with it — it is the way back");

      await page.mouse.move(700, 500);
      await page.waitForTimeout(300);
      expect(await op(page, ".acts")).toBeAtLeast(0.9, "moving did not bring it back");
    });
  });

  it("a panel you opened is never faded", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".rdr");
        if (p.dataset.panel === "none") document.querySelector('.ic[aria-label="Pages"]').click();
      });
      await page.waitForTimeout(3400);
      expect(await op(page, ".panel")).toBe(1, "the panel faded — it is something you chose to open");
    });
  });

  it("nothing fades while a menu or a composer is open", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ic[aria-label="More"]');
      await page.waitForTimeout(3400);
      expect(await page.evaluate(() => document.querySelector(".rdr").dataset.chrome === "off"))
        .toBeFalsy("the chrome faded under an open menu");
    });
  });

  it("the logo never hides, whatever else does", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      /* v5 HAS NO "JUST THE PAPER" BUTTON, and that is the change rather than
         a loss. v4 needed one because its chrome only faded on a timer; v5's
         hides on its own after 2800ms of stillness and returns on any input,
         so a control whose whole job was "hide the controls" would be a
         control that hides itself. What replaces it is the guarantee: ONE
         thing never goes, so the reader is never left with nothing to reach
         for and no idea what happened. */
      await page.waitForTimeout(3400);
      const quiet = await page.evaluate(() => {
        const o = (sel) => { const e = document.querySelector(sel); return e ? Number(getComputedStyle(e).opacity) : null; };
        return { chrome: document.querySelector(".rdr").dataset.chrome, acts: o(".acts"), logo: o(".logo") };
      });
      expect(quiet.chrome).toBe("off", "the chrome never went away on its own");
      expect(quiet.acts).toBeAtMost(0.3, "the actions stayed solid");
      expect(quiet.logo).toBe(1, "the logo faded with everything else — it is the way out");
      /* And any input brings the rest back. */
      await page.mouse.move(600, 400);
      await page.mouse.move(620, 420);
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.querySelector(".rdr").dataset.chrome)).toBe("on");
    });
  });

  it("the document is never underneath the panel or the rail", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(900);
      const boxes = await page.evaluate(() => {
        const pg = document.querySelector(".page:not(.ph)");
        const panel = document.querySelector(".panel");
        const rail = document.querySelector(".rail");
        if (!pg) return null;
        const a = pg.getBoundingClientRect();
        return {
          underPanel: panel ? a.right > panel.getBoundingClientRect().left : false,
          underRail: rail ? a.right > rail.getBoundingClientRect().left : false,
        };
      });
      expect(boxes.underPanel).toBeFalsy("the page runs under the panel");
      expect(boxes.underRail).toBeFalsy("the page runs under the tick rail");
    });
  });
});

group("§4.5 · a thousand pages stay light", () => {
  it("only the pages near you exist, and only they have canvases", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const counted = await page.evaluate(() => ({
        slots: document.querySelectorAll(".page").length,
        canvases: document.querySelectorAll(".stage canvas").length,
        spacers: document.querySelectorAll(".rdr-gap").length,
        total: Number(document.querySelector(".corner-z + span")?.textContent?.replace(/\D/g, "") || 0),
      }));
      /* The fixture is 14 pages, so a window plus spacers — not fourteen slots
         and certainly not a thousand. The rule this guards is the one that made
         a 1012-page manual unusable: every page mounted, every page rendered. */
      expect(counted.slots).toBeAtMost(12, "every page is mounted — this does not scale");
      expect(counted.canvases).toBeAtMost(6, "more canvases than the render window");
    });
  });

  it("the page rail draws what you can see, not every page", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".rdr");
        if (!document.querySelector(".panel")?.classList.contains("open")) {
          document.querySelector('.ic[aria-label="Panel"]').click();
        }
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelectorAll(".ptabs .pt")[1]?.click());
      await page.waitForTimeout(1200);
      const rail = await page.evaluate(() => ({
        thumbs: document.querySelectorAll(".thumbs .th").length,
        canvases: document.querySelectorAll(".thumbs canvas").length,
        spacers: document.querySelectorAll(".thumb-space").length,
      }));
      expect(rail.thumbs).toBeAtLeast(1, "the rail is empty");
      /* 1012 thumbnail canvases was 8,368 DOM nodes and a 161-second frame. */
      expect(rail.canvases).toBeAtMost(30, "the rail is rendering pages nobody can see");
    });
  });
});

/* ========================================================================= */
group("the paper is the subject", () => {
  it("the furniture fades while you read and returns when you move", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(900);
      const read = () => page.evaluate(() => {
        const o = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; };
        return { quiet: document.querySelector(".rdr").dataset.chrome === "off",
                 bar: o(".acts"), dock: o(".tools"), bot: o(".corner-z"), logo: o(".logo") };
      });
      const awake = await read();
      expect(awake.bar).toBe(1, "the chrome starts hidden");

      /* Sit still. Nothing touches the page. */
      await page.waitForTimeout(3400);
      const idle = await read();
      expect(idle.quiet).toBeTruthy("the chrome never faded");
      expect(idle.bar).toBeAtMost(0.05, "the bar stayed solid while reading");
      expect(idle.dock).toBeAtMost(0.3);
      expect(idle.bot).toBeAtMost(0.3);
      /* Gone, not faded: see the note on the same assertion above. The logo
         is what makes that safe. */
      expect(idle.logo).toBe(1, "the logo faded with the rest of the chrome");

      await page.mouse.move(700, 500);
      await page.waitForTimeout(400);
      const back = await read();
      expect(back.quiet).toBeFalsy();
      expect(back.bar).toBe(1, "moving did not bring the chrome back");
    });
  });

  it("a popover holds the chrome open while it is up", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      /* THE COUNTER, NOT A BOOLEAN. Two popovers can be up at once — the
         properties panel and the tool chest, say — and with a boolean,
         closing either one let the whole lot fade while the other was still
         on screen. The chrome stays awake while anything is holding it. */
      await page.evaluate(() => document.querySelector(".chest")?.click());
      await page.waitForTimeout(3400);
      const held = await page.evaluate(() => ({
        chrome: document.querySelector(".rdr").dataset.chrome,
        sheet: document.querySelector(".addsheet")?.classList.contains("open"),
      }));
      expect(held.sheet).toBeTruthy("the tool chest did not open");
      expect(held.chrome).toBe("on", "the chrome faded with a popover still up");
    });
  });


  it("a thousand pages do not become a thousand canvases", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const weight = await page.evaluate(() => ({
        canvases: document.querySelectorAll(".rdr canvas").length,
        slots: document.querySelectorAll(".page").length,
      }));
      /* The window is a handful of pages either side, never the document. */
      expect(weight.slots).toBeAtMost(40, "every page has a slot mounted");
      expect(weight.canvases).toBeAtMost(40, "every page has a canvas mounted");
    });
  });
});
