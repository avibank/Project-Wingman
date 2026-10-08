/* =============================================================================
   THE TOUR ENGINE — the approved engine, wired to the live app.
   -----------------------------------------------------------------------------
   Handed over 2026-10-06. The maths, the timings and the structure are the
   handoff's; what changed is only what the live app made necessary, and each
   one is marked where it is made.

   THREE ADAPTATIONS, all of them the handoff's own escape hatches:

   · THE SCROLLER IS `.deck`, NOT THE WINDOW. This app is a three-row grid —
     topbar, scroller, chin — and the middle row is what moves (Deck.jsx's
     header says why). The handoff allows for exactly this: "If the app
     scrolls inside a main element instead of the window, pass `scroller` and
     keep the maths." Every rect below is still viewport-relative.

   · SMOOTH AIR IS `.app.smooth-air`, not `data-smooth-air="1"`. The handoff
     says to swap in the real one, here and in `reduce`.

   · THE LAYER MOUNTS INSIDE `.app`, not on `<body>`. The livery, the finish
     and light/dark are all classes and data attributes on `.app`, so a layer
     outside it would be the only part of the screen not wearing them.

   WHAT DID NOT CHANGE: the plan/ringTo/free geometry, every duration and
   easing, the fade-only-between-pages rule, and the controls.
   ========================================================================= */
import { TOUR_STEPS, TOUR_BETA_NOTE, BETA_NOTE } from "./tourSteps.js";
import "./tour.css";

const PAD = 10;   // frame padding around a target
const M = 12;     // margin to the viewport / card
const SHEET_BP = 640;

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* THE RECT OF A TARGET, which is usually just its own.
   -----------------------------------------------------------------------------
   The Ready Room's rail is a flat run of section headers and rows, not three
   nested blocks, and its stylesheet is the design's kept as sent — so wrapping
   a section in a div to hang `data-tour` on it would change the layout the
   design specifies. `display: contents` is the tool for that: the wrapper
   stops existing for layout and its children keep their place in the rail.

   The cost, and the reason this function exists: an element with
   `display: contents` HAS NO BOX, so `getBoundingClientRect` gives zeroes and
   the frame would collapse to a point. When that happens the rect is the
   union of its children instead, which is the box those children occupy and
   therefore the box the section visually is. */
function rectOf(el) {
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) return r;
  const kids = [...el.children].map((c) => c.getBoundingClientRect()).filter((k) => k.width > 0 && k.height > 0);
  if (!kids.length) return r;
  const left = Math.min(...kids.map((k) => k.left));
  const top = Math.min(...kids.map((k) => k.top));
  const right = Math.max(...kids.map((k) => k.right));
  const bottom = Math.max(...kids.map((k) => k.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function startTour({
  navigate,          // async (route) => void — resolves once the new page has rendered
  currentRoute,      // () => string
  setPane,           // async (pane) => void — Ready Room main pane, in place
  setPanelTab,       // async (tab) => void  — lesson notes panel tab
  onCta,             // () => void           — "Create my licence"
  onClose,           // (reason) => void
  scroller = null,
  root = null,
  /* The script, so the caller can change the last step's button without
     editing the script: it reads "Create my account" for a visitor and "Done"
     for a student who already has a stamp. Defaults to the script itself. */
  steps: stepList = null,
}) {
  /* Smooth Air and reduced motion are the same thing to this engine, and the
     app spells the first one as a class. */
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches
    || Boolean(document.querySelector(".app.smooth-air"));

  const steps = stepList || TOUR_STEPS;
  const total = steps.length;
  steps.forEach((s) => {
    const same = steps.filter((x) => x.section === s.section);
    if (same.length > 1) { s.n = same.indexOf(s) + 1; s.of = same.length; }
  });

  /* The scroller is found late and re-found on every read: the app replaces
     `.deck` on a screen change, so a reference taken at start would be stale
     by the second page. */
  const box = () => scroller || document.querySelector(".deck") || null;
  const sc = {
    get top() { const b = box(); return b ? b.scrollTop : window.scrollY; },
    get max() { const b = box(); return b ? b.scrollHeight - b.clientHeight : document.documentElement.scrollHeight - innerHeight; },
    get view() {
      const b = box();
      if (b) { const r = b.getBoundingClientRect(); return { top: r.top, h: b.clientHeight, w: b.clientWidth, left: r.left }; }
      return { top: 0, h: innerHeight, w: innerWidth, left: 0 };
    },
    /* The handoff's own scroll, restored 2026-10-06 and kept. It was
       replaced with an rAF ease on the light's curve, which measured better
       on paper and made every page change half a second slower to come to
       rest — and slower is the thing this owner reads as wrong. "Like the
       demo" means the demo's code, so this is the demo's code. */
    to(top, instant) {
      const o = { top, behavior: instant || reduce() ? "auto" : "smooth" };
      const b = box();
      if (b) b.scrollTo(o); else window.scrollTo(o);
    },
  };

  const host = root || document.querySelector(".app") || document.body;
  const dg = document.createElement("div");
  dg.className = "dg on";
  host.appendChild(dg);

  /* ADAPTATION 4: the "tutorial is up" marker. The old guide set this and
     tour.css still needs it — a target at the foot of the deck cannot be
     scrolled clear of a card docked at the foot unless the page can scroll
     past its own end, and `plan` would silently fall back to docking at the
     top instead. It is an attribute on .app rather than on the layer because
     the rules it drives are on .deck and .bm-page, which are siblings of the
     layer; and it comes off in close(), so the padding is only there while
     the tour is. */
  const appEl = document.querySelector(".app");
  appEl?.setAttribute("data-tour-on", "1");

  let i = 0, last = -1, page = null, auto = false, autoT = 0, token = 0, stepAt = 0;
  const $ = (sel) => dg.querySelector(sel);
  const target = () => (steps[i].target ? document.querySelector(`[data-tour="${steps[i].target}"]`) : null);
  const sheet = () => sc.view.w < SHEET_BP;
  /* THE CARD'S FINAL HEIGHT, not its height right now. `free()` subtracts it
     to find the room left for the light, and the card ANIMATES its height
     between steps — so reading it live gave a different answer on every frame
     of that animation. An observer on the card then re-framed on each of
     them, which snapped the ring instead of letting it glide. `setCard` knows
     the height the card is going to, so it records it. */
  let cardFinalH = 0;
  const cardH = () => cardFinalH || $(".dg-card")?.offsetHeight || 0;

  function free(dock) {
    const v = sc.view, gap = sheet() ? 0 : 16, ch = cardH();
    return dock === "top" ? { top: ch + gap + M, bot: v.h - M } : { top: M, bot: v.h - ch - gap - M };
  }

  /* THE PAGE DOES NOT MOVE TO FOCUS. THE LIGHT DOES.
     ---------------------------------------------------------------------------
     Owner, 2026-10-07: "never crop to focus show the whole screen at all times
     only use the highlight box to focus on stuff."

     The handoff's plan CENTRED its target in the room the card leaves, so every
     step scrolled whether it needed to or not — and `want` is a position, not a
     constraint, so a target already in plain sight was still dragged to the
     middle of the free area. On a tall screen that reads as a crop: the lesson's
     two steps scrolled the video off the top and left a close-up of one panel,
     which is the opposite of showing somebody where a thing is.

     It also cost the smoothness. A scroll and the light are on two different
     clocks — the browser's own smooth-scroll curve and the ring's CSS
     transition — and they agree only at the two endpoints, so for the whole of
     every move the box slid out of register with the thing it was framing. A
     step that does not scroll cannot do that.

     So MOVING THE CARD BEATS MOVING THE PAGE. `opts` offers each dock two
     options — leave the scroll exactly where it is, or move it the LEAST amount
     that brings the frame inside the free area — and a standing option wins
     OUTRIGHT whenever it shows MIN_VIS of the target. Not on a tie-break, not
     with a small penalty: both docks are tried standing still before any
     scrolling is considered at all.

     A THUMB ON THE SCALE WAS NOT ENOUGH, and that is the instructive part. The
     first attempt kept `vis / th` as the score and subtracted 0.01 for moving.
     The lesson's panel is taller than the room the card leaves, so docking at
     the TOP showed 238px of it with no scroll while docking at the bottom and
     scrolling 435px showed all of it — 0.46 against 0.98, which 0.01 does not
     touch. The page still scrolled and the video still went off the top.
     Visibility was never the thing to maximise. Stillness is. */

  /* ENOUGH OF A TARGET TO BE A TARGET.
     ---------------------------------------------------------------------------
     Owner, 2026-10-08: "during the demo you can scroll down a bit just dont
     overly crop." Both halves matter and the first version only had the
     second: a standing option won as soon as 44px of the target was showing,
     so the ground card was lit along the very bottom edge of the window with
     everything it contained below the fold. 44px is a hit area, not a sight.

     So: a frame that FITS in the room the card leaves has to be showing in
     FULL before the page is allowed to stay put, and one taller than the room
     has to be showing most of that room. Short of either, the page moves — and
     it still moves by the LEAST amount that brings the frame in, never to
     centre it, which is the difference between scrolling a bit and cropping. */
  const MIN_VIS = 44;
  const enough = (th, room) => Math.min(th, room * 0.6);

  function opts(el, dock) {
    const v = sc.view, r = rectOf(el), yNow = r.top - v.top, th = r.height + PAD * 2;
    const f = free(dock), room = f.bot - f.top, y0 = yNow - PAD;
    const seen = (st) => {
      const y = yNow - (st - sc.top) - PAD;
      return Math.max(0, Math.min(y + th, f.bot) - Math.max(y, f.top));
    };
    /* IT MOVES BY THE SHORTFALL, NOT BY WHATEVER WOULD CONTAIN THE FRAME.
       A frame that FITS is brought fully in — that is already the least that
       can be asked. One TALLER than the room never fits, and putting its top
       at the top of the free area, which is what this did, is the full
       centring scroll under another name: 435px on the lesson, the video off
       the top, the crop the owner objected to in the first place. A tall frame
       is moved just far enough to be showing `enough` of itself, and not one
       pixel more (owner, 2026-10-08: "scroll down a bit just dont overly
       crop"). */
    const short = Math.max(0, enough(th, room) - seen(sc.top));
    let want = sc.top;
    if (short > 0.5) {
      if (y0 + th > f.bot && y0 > f.top) want = sc.top + Math.min(short, y0 - f.top);
      else if (y0 < f.top) want = sc.top - Math.min(short, f.top - y0);
    }
    const clamp = (n) => Math.max(0, Math.min(sc.max, n));
    const still = clamp(sc.top), moved = clamp(want);
    return {
      still: { dock, st: still, vis: seen(still), moves: false },
      moved: { dock, st: moved, vis: seen(moved), moves: Math.abs(moved - sc.top) > 1 },
    };
  }

  function plan(el) {
    const r = rectOf(el), th = r.height + PAD * 2;
    const room = Math.max(1, free("bottom").bot - free("bottom").top);
    const need = Math.max(MIN_VIS, Math.min(th, enough(th, room)));
    const o = ["bottom", "top"].map((d) => opts(el, d));
    /* Bottom first, so a dock that keeps the card where it already is wins a
       genuine tie — the card moving from foot to head is itself a change the
       student has to re-read. */
    const pick = (list) => list.reduce((a, c) => (c.vis > a.vis + 0.5 ? c : a));
    const stand = o.map((x) => x.still).filter((x) => x.vis >= need);
    if (stand.length) return pick(stand);
    return pick(o.map((x) => x.moved));
  }

  function ringTo(el, dock, stFinal, instant) {
    const ring = $(".dg-ring"); if (!ring) return;
    const s = steps[i], v = sc.view;
    ring.style.transition = instant ? "none" : "";
    if (s.whole) {
      ring.className = "dg-ring whole";
      Object.assign(ring.style, {
        width: `${v.w - 12}px`, height: `${v.h - 12}px`,
        transform: `translate(${v.left + 6}px,${v.top + 6}px)`, borderRadius: "14px",
      });
      /* The whole window is the hole, so the panels have nothing to cover —
         which is what the ported sheet said with a dim at zero alpha. */
      return;
    }
    if (!el) {
      ring.className = "dg-ring full";
      Object.assign(ring.style, {
        width: "0px", height: "0px",
        transform: `translate(${v.left + v.w / 2}px,${v.top + v.h / 2}px)`,
      });
      /* Nothing framed: the hole has no size, so the panels cover the lot. */
      return;
    }
    ring.className = "dg-ring";
    const r = rectOf(el), shift = stFinal == null ? 0 : stFinal - sc.top, f = free(dock);
    const y = r.top - v.top - PAD - shift, h = r.height + PAD * 2;
    const y1 = Math.max(y, f.top - 4), y2 = Math.min(y + h, f.bot + 4);
    /* BOTH EDGES ARE CLAMPED, NOT THE LEFT ONE AND THE WIDTH (owner, 2026-10-08:
       "fix the box to only be around what you are pointing in the ready room").
       It used to take `width = r.width + 2·PAD` and then push `x` right to the
       window's edge — so whenever a target starts at x=0, as the Ready Room's
       rail does, the box kept its full width from the clamped left and spilled
       over the right. Measured on the Squadrons step: the rail's content is
       330px wide and ends at 331, and the ring ran to 356 — 25px of chat
       column lit along with it. The right edge is worked out from the target's
       own right now, so clamping one side cannot move the other. */
    const x = Math.max(v.left + 6, r.left - PAD);
    const right = Math.min(r.right + PAD, v.left + v.w - 6);
    const w = Math.max(0, right - x);
    Object.assign(ring.style, {
      width: `${w}px`, height: `${Math.max(0, y2 - y1)}px`,
      transform: `translate(${x}px,${v.top + y1}px)`, borderRadius: "18px",
    });
  }

  function smooth(top, instant) {
    if (Math.abs(sc.top - top) < 1) return;
    auto = true; clearTimeout(autoT); autoT = setTimeout(() => { auto = false; }, 900);
    sc.to(top, instant);
  }

  function frame(instant) {
    const card = $(".dg-card"); if (!card) return;
    const s = steps[i], el = target();
    if (s.whole || !el) {
      card.dataset.dock = "bottom";
      if (sc.top > 0) smooth(0, instant);
      ringTo(el, "bottom", 0, instant);
      return;
    }
    const p = plan(el);
    card.dataset.dock = p.dock;
    smooth(p.st, instant);
    ringTo(el, p.dock, p.st, instant);
  }

  /* The TARGET is watched, never the card. A target can change size under the
     light — an image arriving — and that is worth a re-frame; the card's own
     height is known in advance (see `cardFinalH`) and watching it only ever
     fought the glide. Callbacks are ignored while the engine is scrolling and
     for 600ms after a step change, which is the window the entrance animation
     occupies. */
  const targetRO = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      if (auto || performance.now() - stepAt < 600) return;
      const el = target(), c = $(".dg-card");
      if (!el || !c || steps[i]?.whole) return;
      ringTo(el, c.dataset.dock || "bottom", null, true);
    })
    : null;
  let watchedTarget = null;
  function observeTarget() {
    const el = target();
    if (!targetRO || watchedTarget === el) return;
    if (watchedTarget) targetRO.unobserve(watchedTarget);
    watchedTarget = el || null;
    if (el) targetRO.observe(el);
  }

  function waitFor(sel, ms = 1600) {
    return new Promise((res) => {
      if (!sel || document.querySelector(sel)) { res(); return; }
      const t0 = performance.now();
      const tick = () => ((document.querySelector(sel) || performance.now() - t0 > ms) ? res() : requestAnimationFrame(tick));
      tick();
    });
  }

  function ensureCard() {
    if ($(".dg-card")) return;
    dg.innerHTML = `<div class="dg-ring"></div>
      <div class="dg-card" role="dialog" aria-label="A tour of Wingman">
        <div class="dg-bar"><i></i></div>
        <div class="dg-top"><span class="dg-kicker"></span><button class="dg-skip" type="button">Skip</button></div>
        <div class="dg-slot"></div>
        <div class="dg-acts"><button class="dg-back" type="button">Back</button><button class="dg-next" type="button">Next</button></div>
      </div>`;
    const card = $(".dg-card");
    $(".dg-next").onclick = () => go(i + 1);
    $(".dg-back").onclick = () => go(i - 1);
    $(".dg-skip").onclick = () => close("skip");
    let sx = null;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      sx = e.clientX; card.setPointerCapture(e.pointerId); card.dataset.dragging = "1";
    });
    card.addEventListener("pointermove", (e) => {
      if (sx !== null) card.style.setProperty("--drag", `${(e.clientX - sx) * 0.6}px`);
    });
    const end = (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx; sx = null;
      delete card.dataset.dragging; card.style.setProperty("--drag", "0px");
      if (dx < -60) go(i + 1); else if (dx > 60) go(i - 1);
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function setCard(s, dir) {
    const card = $(".dg-card"), h0 = card.offsetHeight;
    card.classList.toggle("is-sheet", sheet());
    $(".dg-bar i").style.transform = `scaleX(${(i + 1) / total})`;
    $(".dg-kicker").innerHTML = esc(s.section) + (s.n ? `<span class="dg-count">${s.n} of ${s.of}</span>` : "");
    $(".dg-slot").innerHTML = `<div class="dg-body ${dir}"><h3 class="dg-title">${esc(s.title)}</h3><p class="dg-text">${esc(s.text)}</p></div>`;
    $(".dg-back").disabled = i === 0;
    $(".dg-next").textContent = s.cta || "Next";
    card.style.height = "";
    const h1 = card.offsetHeight;
    cardFinalH = h1;
    if (h0 && h0 !== h1 && !reduce()) {
      card.style.height = `${h0}px`;
      void card.offsetHeight;
      card.style.height = `${h1}px`;
      setTimeout(() => { card.style.height = ""; }, 420);
    }
  }

  async function show(n) {
    const t = ++token, s = steps[n], dir = n < last ? "from-left" : "from-right";
    i = n; last = n;
    ensureCard(); setCard(s, dir);
    const newPage = s.page !== page;
    const ring = $(".dg-ring");
    /* THE SCREEN GOES OUT WITH THE LIGHT, and the swap happens behind it.
       The demo fades its app, waits 220ms, and only then replaces the content
       and puts the scroll back to the top — so the cut and the reset are both
       invisible and what a person sees is a crossfade. We were doing those
       two things in full view, which is the difference between "smooth" and
       "awful" (owner, 2026-10-06, comparing the two side by side). */
    if (newPage && page !== null && ring && !reduce()) {
      ring.style.transition = "opacity .22s ease";
      ring.style.opacity = 0;
      await wait(220);
    }
    if (t !== token) return;
    if (currentRoute() !== s.route) await navigate(s.route);
    if (s.pane && setPane) await setPane(s.pane);
    if (s.panelTab && setPanelTab) await setPanelTab(s.panelTab);
    await waitFor(s.target ? `[data-tour="${s.target}"]` : null);
    if (t !== token) return;
    page = s.page;
    stepAt = performance.now();
    bindScroll();
    if (newPage) {
      /* PLACED WHILE IT IS STILL INVISIBLE, THEN FADED IN. `ringTo` sets no
         opacity at all now — it used to set 1 on every call, so the ring
         appeared at its old size for a frame before being moved, which is the
         flash on a page change. Opacity is this function's business and
         nowhere else's. */
      sc.to(0, true);
      requestAnimationFrame(() => {
        frame(true);
        observeTarget();
        const r = $(".dg-ring");
        /* NO DELAY. The curve and the duration are the handoff's and they
           stay; the `.1s` in front of them was 100ms in which the light was
           already in the right place and deliberately not being drawn. A
           page change measured 1130ms from the press to rest, and about 460
           of those were a dimmed screen with no light on it at all — dead
           time before the movement, which is the thing that reads as slow. */
        if (r && !reduce()) { r.style.transition = "opacity .35s ease"; r.style.opacity = 1; }
        else if (r) r.style.opacity = 1;
      });
    } else {
      /* Same page: the ring is already on screen, so it simply glides. */
      requestAnimationFrame(() => {
        const r = $(".dg-ring");
        if (r) { r.style.transition = ""; r.style.opacity = 1; }
        frame(false);
        observeTarget();
      });
    }
  }

  function go(n) {
    if (n < 0) return;
    if (n >= total) { onCta?.(); close("done"); return; }
    show(n);
  }

  function betaNote() {
    dg.innerHTML = `<div class="dg-modal"><div class="dg-box" role="dialog" aria-label="${esc(BETA_NOTE.title)}">
      <span class="dg-kicker">${esc(BETA_NOTE.kicker)}</span>
      <h3>${esc(BETA_NOTE.title)}</h3>
      <p>${esc(BETA_NOTE.text)}</p>
      <p class="dg-cls">${esc(BETA_NOTE.note)}</p>
      <div class="dg-modal-acts"><button class="dg-next" type="button">${esc(BETA_NOTE.cta)}</button></div>
    </div></div>`;
    const btn = $(".dg-modal .dg-next");
    btn.focus();
    btn.onclick = () => {
      const m = $(".dg-modal");
      m.classList.add("is-out");
      setTimeout(() => { dg.innerHTML = ""; show(0); }, reduce() ? 0 : 200);
    };
  }

  const onKey = (e) => {
    if ($(".dg-modal")) {
      if (e.key === "Enter" || e.key === "ArrowRight") $(".dg-modal .dg-next").click();
      return;
    }
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Escape") close("skip");
  };
  const onScroll = () => {
    if (auto) return;
    const c = $(".dg-card");
    if (c) ringTo(target(), c.dataset.dock, null, true);
  };
  /* `plan` aims at where the target WILL be, measured before the page moved,
     and a screen whose height changes while it scrolls — the lesson, mounting
     its video — invalidates that aim. `onScroll` is deliberately deaf while
     the engine is the one scrolling, so the light is put right here, on the
     handoff's own listener, the moment the browser's scroll stops. It changes
     nothing about how anything moves. */
  const onScrollEnd = () => {
    auto = false;
    const c = $(".dg-card");
    if (c && !steps[i]?.whole && target()) ringTo(target(), c.dataset.dock, null, true);
  };
  let rT = 0;
  const onResize = () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const c = $(".dg-card");
      if (c) { c.classList.toggle("is-sheet", sheet()); frame(true); }
    }, 60);
  };
  /* The scroller is replaced on every screen change, so the scroll listener
     goes on the CAPTURE phase at the document — one binding that still hears
     whichever element is scrolling now. */
  document.addEventListener("keydown", onKey);
  /* THE ACTIVE SCROLLER, NOT THE DOCUMENT. Listening on `document` with
     capture caught every scroll on the page, including ones in panes the tour
     is not pointing at, and kept catching them after the app had replaced the
     scroller on a page change. `bindScroll` re-binds to whatever `box()`
     answers now, and is called on every step. */
  let boundTo = null;
  function bindScroll() {
    const el = box() || window;
    if (boundTo === el) return;
    if (boundTo) {
      boundTo.removeEventListener("scroll", onScroll);
      boundTo.removeEventListener("scrollend", onScrollEnd);
    }
    boundTo = el;
    boundTo.addEventListener("scroll", onScroll, { passive: true });
    boundTo.addEventListener("scrollend", onScrollEnd);
  }
  bindScroll();
  addEventListener("resize", onResize);

  function close(reason) {
    token++;
    document.removeEventListener("keydown", onKey);
    if (boundTo) {
      boundTo.removeEventListener("scroll", onScroll);
      boundTo.removeEventListener("scrollend", onScrollEnd);
      boundTo = null;
    }
    removeEventListener("resize", onResize);
    targetRO?.disconnect();
    watchedTarget = null;
    dg.remove();
    appEl?.removeAttribute("data-tour-on");
    onClose?.(reason);
  }

  (async () => {
    if (currentRoute() !== "/") await navigate("/");
    page = "deck";
    if (TOUR_BETA_NOTE) betaNote(); else show(0);
  })();

  /* The reason travels, because the caller has one close that means "the
     student pressed Skip" and another that means "this component is going
     away". They are not the same event and acting on the second as if it were
     the first costs the student their place — see Guide.jsx. */
  return { close: (reason = "skip") => close(reason), go };
}
