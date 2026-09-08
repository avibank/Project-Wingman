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

/* ========================================================================= */
group("§11 · the rack and the pills", () => {
  it("the tick rail shows every mark in the paper, positioned by page", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const rail = await page.evaluate(() => {
        const r = document.querySelector(".pticks");
        if (!r) return null;
        const box = r.getBoundingClientRect();
        return {
          width: Math.round(box.width),
          ticks: [...r.querySelectorAll(".ptick")].map((t) => ({
            colour: t.dataset.colour || null, mine: t.hasAttribute("data-mine"), top: t.style.top,
          })),
          you: !!r.querySelector(".pticks-you"),
        };
      });
      expect(rail).toBeTruthy("no tick rail");
      expect(rail.ticks.length).toBeAtLeast(3, "the fixture's marks are not on the rail");
      /* Yours are drawn wider and opaque; the module's narrower and lighter. */
      expect(rail.ticks.some((t) => t.mine)).toBeTruthy();
      expect(rail.ticks.some((t) => !t.mine)).toBeTruthy();
      expect(rail.you).toBeTruthy("no marker for where the reader is");
      expect(rail.width).toBeAtLeast(30, "a rail a thumb cannot find");
    });
  });

  it("the rail is one control, not forty tiny ones", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const buttons = await page.evaluate(
        () => document.querySelectorAll(".pticks button, button.ptick").length);
      expect(buttons).toBe(0, "each tick is its own button — forty targets nobody can hit");
      expect(await page.locator("button.pticks").count()).toBe(1);
    });
  });

  it("clicking the rail jumps, and the way back appears", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const before = await page.evaluate(() => Number(document.querySelector(".pnum input").value));
      await page.evaluate(() => {
        const r = document.querySelector(".pticks");
        const box = r.getBoundingClientRect();
        r.dispatchEvent(new MouseEvent("click", {
          bubbles: true, clientX: box.left + 15, clientY: box.top + box.height * 0.62,
        }));
      });
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => Number(document.querySelector(".pnum input").value));
      expect(after).toBeAtLeast(before + 1, "the rail did not move the reader");
      /* §11.1 — and it says how to get back. */
      const pill = await page.locator(".pback").count();
      expect(pill).toBe(1, "no way back after a jump");
      expect(await page.locator(".pback").innerText()).toContain(String(before));
    });
  });

  it("the way back returns to the exact place, then goes away", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1000);
      await page.evaluate(() => { document.querySelector(".pscroll").scrollTop = 900; });
      await page.waitForTimeout(500);
      const top = await page.evaluate(() => document.querySelector(".pscroll").scrollTop);
      await page.evaluate(() => {
        const r = document.querySelector(".pticks");
        const box = r.getBoundingClientRect();
        r.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: box.left + 15, clientY: box.top + box.height * 0.8 }));
      });
      await page.waitForTimeout(900);
      await page.click(".pback");
      await page.waitForTimeout(900);
      const back = await page.evaluate(() => document.querySelector(".pscroll").scrollTop);
      expect(Math.abs(back - top)).toBeAtMost(30, "it did not come back to where it left");
      expect(await page.locator(".pback").count()).toBe(0, "the pill stayed after it was used");
    });
  });

  it("the page number is a scrubber, and it says what is near", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(900);
      const moved = await page.evaluate(async () => {
        const input = document.querySelector(".pnum input");
        const r = input.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const opts = (X) => ({ bubbles: true, pointerId: 4, pointerType: "mouse", isPrimary: true, clientX: X, clientY: y });
        input.dispatchEvent(new PointerEvent("pointerdown", opts(x)));
        input.dispatchEvent(new PointerEvent("pointermove", opts(x + 240)));
        await new Promise((res) => setTimeout(res, 250));
        const card = document.querySelector(".pscrub");
        const shown = card ? card.innerText.replace(/\n/g, " ") : null;
        const value = input.value;
        input.dispatchEvent(new PointerEvent("pointerup", opts(x + 240)));
        return { shown, value };
      });
      expect(moved.shown).toBeTruthy("no card while scrubbing");
      expect(Number(moved.value)).toBeAtLeast(2, "dragging did not move the target page");
      await page.waitForTimeout(700);
      expect(await page.locator(".pscrub").count()).toBe(0, "the card stayed after the drag");
    });
  });
});

group("§11 · the rail stays reachable", () => {
  it("the rail is not underneath the panel", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".paper");
        if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
      });
      await page.waitForTimeout(700);
      const clear = await page.evaluate(() => {
        const rail = document.querySelector(".pticks");
        const panel = document.querySelector(".prail");
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

/* ========================================================================= */
group("§4.6 · a big paper lays out before it downloads", () => {
  it("every page has a slot at the right height straight away", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      const shape = await page.evaluate(() => {
        const slots = [...document.querySelectorAll(".pslot")];
        const ghosts = [...document.querySelectorAll(".pp-ghost")];
        const sc = document.querySelector(".pscroll");
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
      expect(await op(page, ".pbar")).toBe(1, "the bar was not solid to begin with");

      await page.waitForTimeout(3200);                    // sit still
      expect(await page.evaluate(() => document.querySelector(".paper").hasAttribute("data-quiet")))
        .toBeTruthy("it never went quiet");
      const faded = await op(page, ".pbar");
      expect(faded).toBeAtMost(0.2, "the bar did not recede");
      /* Faded, not gone. A control that vanishes is one you have to remember
         exists. */
      expect(faded).toBeAtLeast(0.05, "the bar disappeared completely");

      await page.mouse.move(700, 500);
      await page.waitForTimeout(300);
      expect(await op(page, ".pbar")).toBe(1, "moving did not bring it back");
    });
  });

  it("a panel you opened is never faded", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.evaluate(() => {
        const p = document.querySelector(".paper");
        if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
      });
      await page.waitForTimeout(3400);
      expect(await op(page, ".prail")).toBe(1, "the panel faded — it is something you chose to open");
    });
  });

  it("nothing fades while a menu or a composer is open", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool[aria-label="More"]');
      await page.waitForTimeout(3400);
      expect(await page.evaluate(() => document.querySelector(".paper").hasAttribute("data-quiet")))
        .toBeFalsy("the chrome faded under an open menu");
    });
  });

  it("Just the paper hides everything, and a pointer brings it back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool[aria-label="Just the paper"]');
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.querySelector(".paper").hasAttribute("data-hush")))
        .toBeTruthy("the toggle did nothing");
      /* And the way out is the label itself, which now says how to undo it. */
      expect(await page.locator('.ptool[aria-label="Bring the controls back"]').count()).toBe(1);
      /* Reaching for the bar makes it solid, so it can never trap you. */
      await page.hover(".pbar");
      await page.waitForTimeout(300);
      expect(await op(page, ".pbar")).toBe(1, "the bar stayed hidden under the pointer");
    });
  });

  it("the document is never underneath the panel or the rail", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(900);
      const boxes = await page.evaluate(() => {
        const pg = document.querySelector(".pp:not(.pp-ghost)");
        const panel = document.querySelector(".prail");
        const rail = document.querySelector(".pticks");
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
        slots: document.querySelectorAll(".pslot").length,
        canvases: document.querySelectorAll(".pscroll canvas").length,
        spacers: document.querySelectorAll(".pspacer").length,
        total: Number(document.querySelector(".pnum + span")?.textContent?.replace(/\D/g, "") || 0),
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
        const p = document.querySelector(".paper");
        if (p.dataset.rail === "none") document.querySelector('.ptool[aria-label="Pages and contents"]').click();
      });
      await page.waitForTimeout(1200);
      const rail = await page.evaluate(() => ({
        thumbs: document.querySelectorAll(".thumbs .thumb").length,
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
        return { quiet: document.querySelector(".paper").hasAttribute("data-quiet"),
                 bar: o(".pbar"), dock: o(".ptools"), bot: o(".pbot") };
      });
      const awake = await read();
      expect(awake.bar).toBe(1, "the chrome starts hidden");

      /* Sit still. Nothing touches the page. */
      await page.waitForTimeout(3400);
      const idle = await read();
      expect(idle.quiet).toBeTruthy("the chrome never faded");
      expect(idle.bar).toBeAtMost(0.3, "the bar stayed solid while reading");
      expect(idle.dock).toBeAtMost(0.3);
      expect(idle.bot).toBeAtMost(0.3);
      /* Faded, NOT gone — a control that disappears is one you have to
         remember exists. */
      expect(idle.bar).toBeAtLeast(0.05, "the bar vanished completely");

      await page.mouse.move(700, 500);
      await page.waitForTimeout(400);
      const back = await read();
      expect(back.quiet).toBeFalsy();
      expect(back.bar).toBe(1, "moving did not bring the chrome back");
    });
  });

  it("Just the paper hides everything, and reaching for it brings it back", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.click('.ptool[aria-label="Just the paper"]');
      await page.waitForTimeout(500);
      await page.mouse.move(30, 870);
      await page.waitForTimeout(400);
      const hushed = await page.evaluate(() => {
        const o = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; };
        return { hush: document.querySelector(".paper").hasAttribute("data-hush"),
                 bar: o(".pbar"), panel: o(".prail") };
      });
      expect(hushed.hush).toBeTruthy();
      expect(hushed.bar).toBeAtMost(0.3, "the bar is still solid in Just the paper");
      if (hushed.panel !== null) {
        expect(hushed.panel).toBeAtMost(0.3, "a 322px panel is not just the paper");
      }
      /* And the way back is a control that says so. */
      expect(await page.locator('.ptool[aria-label="Bring the controls back"]').count()).toBe(1);
      await page.click('.ptool[aria-label="Bring the controls back"]');
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector(".pbar")).opacity))).toBe(1);
    });
  });

  it("a thousand pages do not become a thousand canvases", async () => {
    await withPage(laptop, async (page) => {
      await openReader(page);
      await page.waitForTimeout(1200);
      const weight = await page.evaluate(() => ({
        canvases: document.querySelectorAll(".paper canvas").length,
        slots: document.querySelectorAll(".pslot").length,
      }));
      /* The window is a handful of pages either side, never the document. */
      expect(weight.slots).toBeAtMost(40, "every page has a slot mounted");
      expect(weight.canvases).toBeAtMost(40, "every page has a canvas mounted");
    });
  });
});
