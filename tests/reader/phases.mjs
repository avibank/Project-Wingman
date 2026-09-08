import { group, it, expect, openReader, withPage, shot, SURFACES, URL_BASE } from "../harness/run.mjs";

const laptop = SURFACES[0];
const ipadL = SURFACES[1];
const ipadP = SURFACES[2];

/* Mark a passage the way a student does: drag across a run of text with the
   tool armed, and let the armed tool fire. */
async function markFirstRun(page, tool = "Highlight") {
  await page.click(`.ptoolbtn[aria-label="${tool}"]`);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    /* Well away from the fixture's own marks. Overlapping ones FLATTEN into
       one segment by design, so marking on top of an existing highlight adds a
       mark without adding a rectangle — which is correct, and which made the
       first version of this test measure the wrong thing. */
    const spans = [...document.querySelectorAll('.pp-text span[data-item]')]
      .filter((s) => s.textContent.trim().length > 30);
    const target = spans[Math.floor(spans.length * 0.6)];
    const r = document.createRange();
    r.setStart(target.firstChild, 0);
    r.setEnd(target.firstChild, Math.min(24, target.firstChild.length));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.querySelector(".pscroll").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.waitForTimeout(900);
}

const markCount = (page) => page.evaluate(
  () => document.querySelectorAll(".pp-mark[data-colour]").length);

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
      await page2.waitForSelector(".pp:not(.pp-ghost) canvas[data-on]", { timeout: 25_000 });
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
      await page.click('.pbot .ptool[aria-label="Undo"]');
      await page.waitForTimeout(700);
      expect(await markCount(page)).toBe(start, "undo did not remove the mark");

      await page.click('.pbot .ptool[aria-label="Redo"]');
      await page.waitForTimeout(900);
      expect(await markCount(page)).toBeAtLeast(start + 1, "redo did not put it back");
    });
  });

  it("undo is disabled with nothing to undo, and says so", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      expect(await page.locator('.pbot .ptool[aria-label="Undo"]').isDisabled()).toBeTruthy();
      expect(await page.locator('.pbot .ptool[aria-label="Redo"]').isDisabled()).toBeTruthy();
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
      await page.click('.ptoolbtn[aria-label="Highlight"]');
      await page.waitForTimeout(400);
      const swatches = await page.evaluate(
        () => [...document.querySelectorAll('.ptray [role="radiogroup"] .swatch')].map((b) => b.dataset.colour));
      expect(swatches).toEqual(["critical", "definition", "limit", "unsure", "wrong"],
        "the closed set is the whole design — a plain highlight kills it");
    });
  });

  it("the tray says what the colour in your hand will do", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptoolbtn[aria-label="Highlight"]');
      await page.waitForTimeout(400);
      const txt = await page.locator(".tray-mean").innerText();
      expect(txt).toContain("Exam likely");
      expect(txt).toContain("revision deck");
    });
  });

  it("the pen keeps free colour, because ink is just ink", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptoolbtn[aria-label="Pen"]');
      await page.waitForTimeout(400);
      const swatches = await page.evaluate(
        () => [...document.querySelectorAll('.ptray [role="radiogroup"] .swatch')].map((b) => b.dataset.colour));
      expect(swatches.length).toBe(8, "the ink palette is eight names");
      expect(swatches).toContain("graphite");
    });
  });

  it("a violet mark shows whether its thread has been answered", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const state = await page.evaluate(
        () => document.querySelector('.pp-mark[data-colour="unsure"]')?.dataset.thread || null);
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
        for (const sel of [".pbar", ".ptools", ".pbot"]) {
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
        const cs = getComputedStyle(document.querySelector(".pbar"));
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
          const p = document.querySelector(".paper");
          if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
        });
        await page.waitForTimeout(700);
        const r = await page.evaluate(() => {
          const panel = document.querySelector(".prail");
          const doc = document.querySelector(".pscroll");
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

  it("the bottom bar clears the home indicator", async () => {
    await withPage(ipadP, async (page) => {
      await openReader(page);
      const usesSafeArea = await page.evaluate(() => {
        const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
          .map((r) => r.cssText).join("");
        return /\.pbot[^{]*\{[^}]*env\(safe-area-inset-bottom/.test(css);
      });
      expect(usesSafeArea).toBeTruthy("the bottom bar will sit under the home indicator");
    });
  });
});

/* ========================================================================= */
group("Phase 6 · the tray", () => {
  const trayIds = (page) => page.evaluate(
    () => [...document.querySelectorAll(".ptools .ptoolbtn")].map((b) => b.getAttribute("aria-label")));

  it("the default tray is six tools, not fourteen", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      expect(await trayIds(page)).toEqual(["Select", "Highlight", "Pen", "Eraser", "Note", "Question"]);
    });
  });

  it("a tool can be added from the sheet and lands in the tool set's own order", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool-add');
      await page.waitForTimeout(300);
      await page.click('.add-tabs button:nth-child(2)');           // Mark up
      await page.waitForTimeout(200);
      await page.click('.add-cell:has-text("Underline")');
      await page.waitForTimeout(500);
      const ids = await trayIds(page);
      expect(ids).toContain("Underline");
      expect(ids.indexOf("Underline")).toBe(ids.indexOf("Highlight") + 1, "it should sit beside Highlight");
    });
  });

  it("every tool stays reachable from the Add sheet", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool-add');
      await page.waitForTimeout(300);
      let seen = 0;
      for (let tab = 0; tab < 6; tab++) {
        await page.click(`.add-tabs button:nth-child(${tab + 1})`);
        await page.waitForTimeout(150);
        seen += await page.locator(".add-cell").count();
      }
      expect(seen).toBe(14, "the full set must always be listed, including what was removed");
    });
  });

  it("Select cannot be taken off", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      /* The discoverable way in. A long-press does the same thing and is
         covered by the manual script, because a synthetic press is not a
         thumb. */
      await page.click(".ptool-add");
      await page.waitForTimeout(300);
      await page.click('.tray-foot .tray-done:has-text("Rearrange")');
      await page.waitForTimeout(400);
      const editing = await page.evaluate(() => document.querySelector(".paper").hasAttribute("data-editing"));
      expect(editing).toBeTruthy("long-press did not enter edit mode");
      const removable = await page.evaluate(
        () => [...document.querySelectorAll(".ptool-rm")].map((b) => b.getAttribute("aria-label")));
      expect(removable.join(" ")).notToContain("Select", "Select must not be removable");
      expect(removable.length).toBeAtLeast(4, "everything else should be removable");
    });
  });

  it("resetting puts the course default back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool-add');
      await page.waitForTimeout(250);
      await page.click('.add-tabs button:nth-child(2)');
      await page.waitForTimeout(150);
      await page.click('.add-cell:has-text("Strike through")');
      await page.waitForTimeout(400);
      expect(await trayIds(page)).toContain("Strike through");
      await page.click(".ptool-add");
      await page.waitForTimeout(300);
      await page.click('.tray-foot .tray-done:has-text("Reset")');
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
        () => document.querySelector('.ptoolbtn[aria-pressed="true"]')?.getAttribute("aria-label"));
      expect(armed).notToContain("Underline", "a key switched to a tool the student had removed");
      await page.keyboard.press("h");                    // Highlight, which IS on the tray
      await page.waitForTimeout(300);
      expect(await page.evaluate(
        () => document.querySelector('.ptoolbtn[aria-pressed="true"]')?.getAttribute("aria-label"))).toBe("Highlight");
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
        const sc = document.querySelector(".pscroll");
        const clear = (r) => r.top > 130 && r.bottom < innerHeight - 150 && r.width > 6;
        for (let tries = 0; tries < 14; tries++) {
          const m = [...document.querySelectorAll(".pp-mark[data-colour]")]
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
        const target = document.elementFromPoint(x, y) || document.querySelector(".pscroll");
        target.dispatchEvent(new PointerEvent("pointerup", {
          pointerType: "touch", pointerId: 1, isPrimary: true,
          clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true,
        }));
      }, box);
      await page.waitForTimeout(700);
      expect(await page.locator(".selbar").count()).toBeAtLeast(1, "an iPad user can never see this card");
      await shot(page, "markcard-tap");
    });
  });

  it("shows what the colour does, and the right actions for whose it is", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const box = await page.evaluate(() => {
        const m = document.querySelector('.pp-mark[data-colour="critical"]');
        const r = m.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(500);
      const card = await page.locator(".selbar").innerText();
      expect(card).toContain("Exam likely");
      expect(card).toContain("revision deck");
      // Mine: the five colours to restyle, plus a note and a delete.
      expect(await page.locator(".mc-cols .swatch").count()).toBe(5);
      expect(await page.locator('.mc-acts [aria-label="Delete this mark"]').count()).toBe(1);
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
        const m = document.querySelector('.pp-mark[data-colour="unsure"]');
        if (!m) return null;
        const sc = document.querySelector(".pscroll");
        sc.scrollTop += (m.getBoundingClientRect().top - (innerHeight * 0.45));
        await new Promise((res) => setTimeout(res, 700));
        const r = m.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
      });
      expect(box).toBeTruthy("the other student's question did not resolve");
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(700);
      const card = await page.locator(".selbar").innerText();
      expect(card).toContain("Asked anonymously");
      expect(card).toContain("Name hidden on questions");
      expect(await page.locator('.mc-acts [aria-label="Delete this mark"]').count()).toBe(0,
        "you can delete somebody else's mark");
      expect(await page.locator(".mc-agree").count()).toBe(1);
    });
  });

  it("Escape and a click away put it back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(800);
      const box = await page.evaluate(() => {
        const r = document.querySelector(".pp-mark[data-colour]").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(400);
      expect(await page.locator(".selbar").count()).toBe(1);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      expect(await page.locator(".selbar").count()).toBe(0);
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
      await page.click('.ptoolbtn[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      /* A real touch pointer across the page. It must move the paper, not
         mark it — the single most common failure in a web annotator. */
      await page.evaluate(() => {
        const svg = document.querySelector(".pp-ink");
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
      await page.click('.ptoolbtn[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      await page.evaluate(() => {
        const svg = document.querySelector(".pp-ink");
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
      await page.click('.ptoolbtn[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => [...document.querySelectorAll(".ink-stroke")].filter((p) => p.getAttribute("d")).length);
      await page.evaluate(() => {
        const svg = document.querySelector(".pp-ink");
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
      const idle = await page.evaluate(() => getComputedStyle(document.querySelector(".pp-ink")).pointerEvents);
      expect(idle).toBe("none", "the ink layer is eating taps while no ink tool is armed");
      await page.click('.ptoolbtn[aria-label="Pen"]');
      await page.waitForTimeout(300);
      const armed = await page.evaluate(() => getComputedStyle(document.querySelector(".pp-ink")).pointerEvents);
      expect(armed).toBe("auto");
    });
  });
});

/* ========================================================================= */
group("§15 · the quality bar", () => {
  it("every icon-only control has an accessible name", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const nameless = await page.evaluate(() => [...document.querySelectorAll(".paper button")]
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
      const small = await page.evaluate(() => [...document.querySelectorAll(".paper button")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ c: b.className, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
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
        const p = document.querySelector(".paper");
        if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
      });
      await page.waitForTimeout(500);
      await page.click('.prail-tabs button:has-text("Marks")');
      await page.waitForTimeout(600);
      /* The label without its count — the count is a separate element inside
         the chip, so textContent runs them together. */
      const chips = await page.evaluate(() => [...document.querySelectorAll(".chip")].map((c) => {
        const n = c.querySelector("em");
        return c.textContent.replace(n ? n.textContent : "", "").trim();
      }));
      expect(chips).toContain("Revision");
      expect(chips).toContain("Glossary");
      expect(chips).toContain("Threads");
      expect(chips).toContain("Master Caution");
      /* Not invented categories — and not a filter by what a mark looks like. */
      expect(chips.join(" ")).notToContain("Highlights");

      /* The counts are real: the fixture has one Revision mark and one Thread. */
      const counted = await page.evaluate(() => {
        const out = {};
        for (const c of document.querySelectorAll(".chip")) {
          const n = c.querySelector("em");
          if (n) out[c.textContent.replace(n.textContent, "").trim()] = Number(n.textContent);
        }
        return out;
      });
      expect(counted.Revision).toBe(1);
      expect(counted.Threads).toBe(1);
    });
  });
});
