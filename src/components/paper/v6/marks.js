/* The real marks, behind v6's chrome.
 *
 * HANDOVER section 2 says what the chrome wants: a list of objects with
 * `{id, g, pg, k, kind, who, t, tx, ask, ans, fresh}`, pushed through
 * `WM.add`, and the island, the panel and the page all update themselves.
 * HANDOVER section 3 says what the database wants, and it is not that: a mark
 * is stored as characters, never as a position, and 0014's CHECK constraint
 * refuses any anchor carrying a page, a rect or a bbox.
 *
 * This file is the join between the two, and it owns three things:
 *
 *   1  fetching, by page window and never by document
 *   2  relayout() — the quads, rebuilt from anchors on every layout change
 *   3  writing back what the student does
 *
 * RELAYOUT IS THE ONLY PLACE A QUAD IS DRAWN. The handed-over stamp() draws
 * its own the moment a selection is marked, which is what makes a new mark
 * appear instantly; relayout replaces them on the next frame from the stored
 * anchor. Two things follow. A mark that cannot be resolved disappears rather
 * than sitting somewhere plausible, which is the honest failure. And the
 * geometry is right under rotation, which stamp()'s is not — see toLocal().
 */
import { resolveAnchor } from "../../../lib/anchor.js";
import { anchorFor } from "../../../lib/paperMarks.js";
import { MEANING_OF, colourKey, INK_OF } from "../../../lib/readerIcons.js";
import {
  fetchAnnotations, createAnnotation, updateAnnotation, deleteAnnotation,
} from "../../../lib/annotations.js";
import { fetchInk, createStroke } from "../../../lib/ink.js";
import { rangeOver, offsetsOf, toLocal, spansIn } from "./geometry.js";

/* v6's five colour keys, and the vocabulary either side of them. The join
   itself is readerIcons.js and is not restated here. */
const KIND_TO_DB = { hl: "highlight", ul: "underline", st: "strikethrough", ask: "question", note: "note" };
const KIND_FROM_DB = { highlight: "hl", underline: "ul", strikethrough: "st", question: "ask", note: "note", correction: "hl" };

/* Red is private end to end. It is never sent to other students and never
   counted in class heat, and the way that is guaranteed is the ring it is
   written with — not a filter in the panel, which is only what THIS reader
   happens to draw. */
const ringFor = (k) => (k === "r" ? "solo" : "module");

const AGO = [[31536e6, "y"], [2592e6, "mo"], [864e5, "d"], [36e5, "h"], [6e4, "m"]];
const WORDS = { y: "a year", mo: "a month", d: "a day", h: "an hour", m: "a minute" };
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 6e4) return "just now";
  for (const [span, unit] of AGO) {
    const n = Math.floor(ms / span);
    if (n >= 1) {
      if (unit === "d" && n === 1) return "yesterday";
      if (n === 1) return `${WORDS[unit]} ago`;
      const long = { y: "years", mo: "months", d: "days", h: "hours", m: "minutes" }[unit];
      return `${n} ${long} ago`;
    }
  }
  return "just now";
}

export function createMarkStore({ paper, moduleCode, me, model, WM, chrome, live, onCounts }) {
  /* Everything the reader is holding, keyed by the server's id. `placed` is
     the resolved offsets; a row that would not resolve is orphaned and kept
     out of the page rather than guessed at. */
  const rows = new Map();          // id -> the database row
  const placed = new Map();        // id -> { start, end }
  const orphans = new Set();
  /* THE PAGES ARRIVE BEFORE THIS DOES, and that is not a race to be tightened
     — it is the right order. React renders the stage as soon as it knows the
     paper's shape; the store is built when the extracted text lands, which on
     a long manual is seconds later. So the map belongs to the component and is
     handed in, already holding whatever showed up first. The spans are not
     kept at all: they are read off the text layer when they are needed. */
  const pages = live.pages;        // pg -> { page, marks, ink, text } from SheetPage
  const fetched = new Set();       // page windows already asked for
  let rot = 0;
  let pending = [];                // rows the quiet poll found, not yet shown

  const paperId = paper?.id || null;

  /* The runs on one page, in the order pdf.js reported them — which is the
     order the text layer built its spans in, which is what makes position the
     mapping between the two. Cached because lay() asks for it once per page
     per frame and the filter is a walk of every run in the document. */
  const itemCache = new Map();
  const itemsFor = (pg) => {
    let list = itemCache.get(pg);
    if (!list) { list = model.items.filter((it) => it.page === pg); itemCache.set(pg, list); }
    return list;
  };

  /* ── which page a resolved mark is on ───────────────────────────────── */
  const pageOfRow = (id) => {
    const at = placed.get(id);
    if (!at || !model) return null;
    const first = model.items.find((it) => it.end > at.start);
    return first ? first.page : null;
  };

  /* ── the shape the chrome reads ─────────────────────────────────────── */
  function toWM(row, fresh) {
    const pg = pageOfRow(row.id);
    if (!pg) return null;
    const at = placed.get(row.id);
    return {
      id: row.id,
      g: row.id,
      pg,
      k: colourKey(row.colour || MEANING_OF.y),
      kind: KIND_FROM_DB[row.kind] || "hl",
      who: row.kind === "question" ? "anon" : (row.author_id === me ? "me" : row.author_id),
      t: ago(row.updated_at || row.created_at),
      tx: model.text.slice(at.start, at.end).replace(/\s+/g, " ").trim(),
      ask: row.kind === "question" ? (row.body || "") : undefined,
      ans: row.kind === "question" ? (row.answers || []) : undefined,
      fresh: !!fresh,
    };
  }

  function absorb(list, fresh) {
    let added = 0;
    for (const row of list) {
      if (rows.has(row.id)) continue;
      const at = row.anchor ? resolveAnchor(row.anchor, model.text) : null;
      rows.set(row.id, row);
      if (!at) { orphans.add(row.id); continue; }
      placed.set(row.id, at);
      const m = toWM(row, fresh);
      if (m) { WM.marks.push(m); added += 1; }
    }
    if (added) WM.emit();
    onCounts?.(counts());
    return added;
  }

  function counts() {
    let hl = 0, rv = 0;
    for (const m of WM.marks) {
      if (m.who !== "me") continue;
      if (m.k === "r") rv += 1; else hl += 1;
    }
    return { hl, rv, orphans: orphans.size };
  }

  /* ── 1 · fetching, by window ────────────────────────────────────────────
     HANDOVER, Making it feel smooth: ask for the marks on the pages you are
     about to show. One popular paper will have thousands and you must never
     load them all.

     The RPC answers per paper rather than per page, so the window is applied
     here on the way in: everything is asked for once, and only the rows whose
     passage falls inside the window are resolved and drawn. What that saves
     is the expensive half — resolveAnchor over a 3MB string, and a Range and
     a set of boxes per mark. */
  async function loadWindow(from, to) {
    if (!paperId || !model) return;
    const key = `${from}-${to}`;
    if (fetched.has(key)) return;
    fetched.add(key);
    const all = await fetchAnnotations(me, paperId);
    const lo = model.pageStart[from - 1] ?? 0;
    const hi = model.pageStart[to] ?? model.text.length;
    /* A row's own quote is enough to decide whether it is worth resolving:
       the anchor carries it, and finding it in the window's slice is a string
       search rather than the full fuzzy walk. */
    const slice = model.text.slice(lo, hi);
    const near = all.filter((r) => {
      if (rows.has(r.id)) return false;
      const q = r.anchor?.quote;
      return !q || slice.includes(q.slice(0, 40));
    });
    absorb(near, false);
    relayout();
  }

  /* The quiet poll. HANDOVER: the only thing it may do is light the dot —
     never touch the page, never re-sort the panel, never move anything under
     the student's eyes. So it collects, and stops. */
  async function poll() {
    if (!paperId || !model) return 0;
    const all = await fetchAnnotations(me, paperId);
    pending = all.filter((r) => !rows.has(r.id) && !pending.some((p) => p.id === r.id))
      .concat(pending);
    return pending.length;
  }

  /* They pressed the dot. Build off-screen, put them in on one frame. */
  function pull() {
    const list = pending;
    pending = [];
    const n = absorb(list, true);
    relayout();
    return n;
  }

  /* ── 2 · relayout ──────────────────────────────────────────────────────
     HANDOVER section 3, and the test it says will fail first: resize the
     window, zoom, rotate a page, open and close the panel, and every mark is
     still exactly on its words.

     Only visible pages, and only once per frame however many things asked. */
  /* One frame, however many things asked — and a timer racing it, because a
     frame is not guaranteed to arrive. requestAnimationFrame is the right
     primitive for smoothness and the wrong one for correctness: a hidden tab
     never gets a frame, so a reader that only schedules on rAF sits there with
     the marks fetched, resolved and undrawn, and shows a bare paper the moment
     it comes back. Measured in a background pane, where every mark on a
     correctly loaded paper was missing for this reason and nothing else.

     Whichever fires first does the work and cancels the other. */
  let frame = 0, timer = 0;
  function relayout() {
    if (frame || timer) return;
    const run = () => { cancelAnimationFrame(frame); clearTimeout(timer); frame = timer = 0; lay(); };
    frame = requestAnimationFrame(run);
    timer = setTimeout(run, 50);
  }

  function lay() {
    /* Rebuilding the quads under an open pill would leave the chrome holding
       elements that are no longer on the page. */
    if (chrome.busy?.()) return;
    for (const [pg, els] of pages) {
      const spans = spansIn(els?.text);
      const layer = els?.marks;
      if (!layer) continue;
      layer.replaceChildren();
      if (!spans) continue;                    // the words are not there yet
      for (const m of WM.marks) {
        if (m.pg !== pg) continue;
        const at = placed.get(m.id);
        if (!at) continue;
        const range = rangeOver(spans, itemsFor(pg), at.start, at.end);
        if (!range) continue;
        const hex = chrome.resolve(m.kind === "ask" ? "p" : m.k);
        for (const r of range.getClientRects()) {
          if (r.width < 1.5 || r.height < 1) continue;
          const box = toLocal(r, els.page, rot);
          const d = document.createElement("span");
          d.className = `mkq ${m.kind}`;
          d.dataset.g = m.g;
          d.dataset.kind = m.kind;
          d.dataset.k = m.kind === "ask" ? "p" : m.k;
          d.style.cssText = `left:${box.left}px;top:${box.top}px;`
            + `width:${box.width}px;height:${box.height}px;--k:${hex}`;
          layer.appendChild(d);
        }
        range.detach?.();
      }
    }
  }

  /* ── 3 · writing back ──────────────────────────────────────────────── */

  /* A mark the student has just made. The chrome hands over the DOM Range it
     drew from; what is stored is the characters that Range covered, plus the
     quote and 32 characters either side as the fallback. Never the boxes. */
  async function made(mark, range, pgEl) {
    const pg = Number(pgEl.dataset.pg);
    const spans = spansIn(pages.get(pg)?.text);
    const off = offsetsOf(range, spans, itemsFor(pg));
    if (!off) { WM.drop(mark.g); return; }

    placed.set(mark.id, off);
    mark.tx = model.text.slice(off.start, off.end).replace(/\s+/g, " ").trim();
    relayout();

    const row = await createAnnotation({
      paperId, moduleCode, me,
      kind: KIND_TO_DB[mark.kind] || "highlight",
      ring: ringFor(mark.k),
      colour: MEANING_OF[mark.k],
      anchor: anchorFor(model.text, off.start, off.end),
      body: mark.kind === "ask" ? (mark.ask || null) : null,
    });
    if (!row) return;                          // offline: it stays on the page

    /* The server's id replaces the local one everywhere at once, so the panel
       card, the quads and the row all agree. */
    const old = mark.id;
    rows.set(row.id, row);
    placed.set(row.id, off);
    placed.delete(old);
    mark.id = row.id; mark.g = row.id;
    document.querySelectorAll(`.mkq[data-g="${old}"]`).forEach((q) => { q.dataset.g = row.id; });
    WM.emit();
    onCounts?.(counts());
  }

  async function dropped(g) {
    const row = rows.get(g);
    placed.delete(g); rows.delete(g); orphans.delete(g);
    onCounts?.(counts());
    if (row && row.author_id === me) await deleteAnnotation(g);
  }

  async function converted(g, kind, k) {
    const row = rows.get(g);
    if (!row || row.author_id !== me) return;
    const patch = { kind: KIND_TO_DB[kind] || "highlight", colour: MEANING_OF[k] };
    Object.assign(row, patch);
    await updateAnnotation(g, patch);
  }

  async function recoloured(g, k) {
    const row = rows.get(g);
    if (!row || row.author_id !== me) return;
    const patch = { colour: MEANING_OF[k], ring: ringFor(k) };
    Object.assign(row, patch);
    onCounts?.(counts());
    await updateAnnotation(g, patch);
  }

  /* A finished stroke. Ink is coordinates and nothing else — there is no
     sentence you could store instead that would let you draw it again — so it
     goes to paper_ink, which has no anchor column to smuggle a position into.
     Points are already fractions of the unrotated page: the chrome draws into
     a 0-1000 viewBox, and the table wants 0-1. */
  async function stroke(pgEl, path, pts, tool, S) {
    const pg = Number(pgEl.dataset.pg);
    const width = (S.size[tool.id] || 3) / 1000;
    const row = await createStroke({
      paperId, moduleCode, me, page: pg,
      tool: tool.id === "hl" ? "marker" : tool.id,
      colour: INK_OF[S.colour[tool.id]] || "graphite",
      width, ring: "solo",
      points: pts.map(([x, y]) => [x / 1000, y / 1000]),
    });
    if (row) path.dataset.id = row.id;
  }

  /* The student's own strokes, drawn back onto a page as it arrives. */
  const inkRows = [];
  async function loadInk() {
    if (!paperId) return;
    const list = await fetchInk(me, paperId);
    inkRows.push(...list);
    for (const pg of pages.keys()) paintInk(pg);
  }
  function paintInk(pg) {
    const els = pages.get(pg);
    if (!els?.ink) return;
    els.ink.replaceChildren();
    for (const s of inkRows) {
      if (s.page !== pg) continue;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("stroke", `var(--ink-${s.colour}, #3A4149)`);
      p.setAttribute("stroke-width", String((s.width || 0.003) * 1000));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("d", s.points.map(([x, y], i) => `${i ? "L" : "M"}${x * 1000} ${y * 1000}`).join(""));
      p.dataset.id = s.id;
      els.ink.appendChild(p);
    }
  }

  /* ── what the shell tells us ───────────────────────────────────────── */
  const api = {
    loadWindow, loadInk, poll, pull, relayout,
    made, dropped, converted, recoloured, stroke,
    counts,
    orphans: () => [...orphans].map((id) => rows.get(id)).filter(Boolean),
    waiting: () => pending.length,
    setRotation(v) { rot = v; relayout(); },
    /* A page arriving from React, or leaving. */
    page(pg, els) {
      if (els) paintInk(pg);
      relayout();
    },
    text() { relayout(); },
    /* The student's most recent five, for the island's fanned deck. */
    recent() {
      return WM.marks.filter((m) => m.who === "me")
        .slice(-5).reverse()
        .map((m) => [m.pg, m.k, m.tx.slice(0, 90)]);
    },
    /* What a mark resolved to, for the manual tests: the one number that says
       whether a highlight is on the right words, without reading it. */
    where: (id) => placed.get(id) || null,
    live: () => ({
      pages: [...pages.keys()],
      spans: [...pages.entries()].map(([pg, els]) => [pg, spansIn(els.text)?.length || 0]),
    }),
  };
  if (import.meta.env?.DEV) window.__marks = api;
  return api;
}
