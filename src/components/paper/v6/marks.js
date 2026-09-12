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
  fetchAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, askOnPassage,
  markOrphaned, agreeWithMark,
} from "../../../lib/annotations.js";
import { fetchDiscussion, insertReply } from "../../../lib/threads.js";
import { fetchProfiles } from "../../../lib/squadron.js";
import { fetchInk, createStroke, deleteStrokes } from "../../../lib/ink.js";
import { rangeOver, offsetsOf, toLocal, spansIn } from "./geometry.js";
import {
  remember, flush as flushOutbox, waitingFor, unsent, newLocalId,
} from "./outbox.js";

/* v6's five colour keys, and the vocabulary either side of them. The join
   itself is readerIcons.js and is not restated here. */
/* v6's five quad kinds, and 0017's six stored ones. `flag` stamps as a
   highlight because that is what a flag IS on the page — a red mark, private,
   meaning "come back to this" — and giving it a kind of its own would be a
   migration to store a word the colour already says. */
const KIND_TO_DB = {
  hl: "highlight", ul: "underline", st: "strikethrough",
  ask: "question", note: "note", txt: "text", flag: "highlight",
};
const KIND_FROM_DB = {
  highlight: "hl", underline: "ul", strikethrough: "st",
  question: "ask", note: "note", text: "txt", correction: "hl",
};

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

export function createMarkStore({
  paper, moduleCode, me, model, WM, chrome, live, people, onNames, onCounts, onTrouble,
}) {
  /* Said once, not once per mark: a network that is down is down for all of
     them, and five "offline" messages in a row is noise rather than news. */
  let saidAt = 0;
  const trouble = (kind) => {
    if (Date.now() - saidAt < 30_000) return;
    saidAt = Date.now();
    onTrouble?.(kind);
  };
  /* Everything the reader is holding, keyed by the server's id. `placed` is
     the resolved offsets; a row that would not resolve is orphaned and kept
     out of the page rather than guessed at. */
  let lastSent = 0;                // how many the last drain got away
  let draining = false;            // one replay at a time, or ops double up
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
  const replies = new Map();       // thread id -> the answers under it
  const inkRows = [];              // every stroke of this student's on this paper

  /* ── the undo stack ────────────────────────────────────────────────────
     HANDOVER section 4: "Undo says a word" becomes a real stack over marks
     AND ink. Each entry knows how to put the world back and how to do the
     thing again, so undo and redo are the same machinery run in opposite
     directions rather than two code paths that have to agree.

     What an entry is NOT is a snapshot. A paper carries thousands of marks;
     copying the list on every highlight would be the most expensive thing the
     reader does, to support a key nobody presses twice in a row. */
  const past = [];
  const future = [];
  const LIMIT = 50;
  function did(entry) {
    past.push(entry);
    if (past.length > LIMIT) past.shift();
    future.length = 0;
  }

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
      /* YOUR OWN QUESTION IS YOURS. This read `row.kind === "question" ? "anon"`
         first, so it threw your identity away on your own rows — although the
         server already anonymises other people's (0018 nulls author_id for
         somebody else's anonymous mark, and always returns yours with your id
         on it). The cost was everywhere: your questions never reached the You
         tallies, never appeared in "where you have been", were excluded from
         the panel's Mine and included in its Class.

         Two fields now, because they answer two different questions. `who` is
         whose it is, and decides what you may do to it. `anon` is how it must
         be shown, and is true for every question including your own. */
      who: row.author_id === me ? "me" : (row.kind === "question" ? "anon" : row.author_id),
      anon: row.kind === "question",
      agree: Number(row.agree_count) || 0,
      iAgree: Boolean(row.i_agree),
      t: ago(row.updated_at || row.created_at),
      tx: model.text.slice(at.start, at.end).replace(/\s+/g, " ").trim(),
      /* The card reads `ask` for the words on a mark, whatever kind it is —
         a question's question and a note's note are the same field. */
      ask: (row.kind === "question" || row.kind === "note" || row.kind === "text")
        ? (row.body || "") : undefined,
      ans: row.kind === "question" ? (replies.get(row.thread_id) || []) : undefined,
      fresh: !!fresh,
    };
  }

  function absorb(list, fresh) {
    let added = 0;
    for (const row of list) {
      if (rows.has(row.id)) continue;
      const at = row.anchor ? resolveAnchor(row.anchor, model.text) : null;
      rows.set(row.id, row);
      if (!at) {
        /* Marked on the server as well as here. The status is part of the
           record: the next reader to open this paper should not have to
           re-discover that the passage is gone. */
        orphans.add(row.id);
        /* `status`, not `orphaned` — paper_marks_for returns a column called
           status and there has never been an `orphaned` one, so this guard was
           always undefined and a write went out for every unresolvable mark,
           every time the paper was opened. paper_annotation_status is also the
           one paper RPC with no uid argument, so those were unauthenticated
           writes on other people's rows. */
        if (row.status !== "orphaned") markOrphaned(row.id, me, true);
        continue;
      }
      placed.set(row.id, at);
      const m = toWM(row, fresh);
      if (m) { WM.marks.push(m); added += 1; }
    }
    if (added) WM.emit();
    onCounts?.(counts());
    names(list.map((r) => r.author_id));
    return added;
  }

  /* The three tiles in the You tray. A question is not a highlight, and now
     that your own questions come back as yours they would have been counted
     as one. */
  function counts() {
    let hl = 0, rv = 0;
    for (const m of WM.marks) {
      if (m.who !== "me") continue;
      if (m.k === "r") { rv += 1; continue; }
      if (m.kind === "hl" || m.kind === "ul" || m.kind === "st") hl += 1;
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
  /* ONE FULL READ, THEN ONLY WHAT IS NEW. The cache key is the window, and
     the window moves with every page turn — so every turn was a miss, and
     every miss called paper_marks_for for the WHOLE paper and threw away all
     but the rows near the window. On a paper with a term's worth of marks that
     is the entire table, per page turn, for ever.

     The rows are held here instead. The first call reads everything once; each
     later call asks only for what has changed since, which is what p_since has
     been for since 0018 and what this passed null to. */
  let known = null;
  let readAt = null;
  async function rowsForPaper() {
    if (known === null) {
      known = await fetchAnnotations(me, paperId);
      readAt = new Date().toISOString();
      return known;
    }
    const since = readAt;
    readAt = new Date().toISOString();
    const fresh = await fetchAnnotations(me, paperId, since);
    if (fresh.length) {
      const byId = new Map(known.map((r) => [r.id, r]));
      for (const r of fresh) byId.set(r.id, r);
      known = [...byId.values()];
    }
    return known;
  }

  async function loadWindow(from, to) {
    if (!paperId || !model) return;
    const key = `${from}-${to}`;
    if (fetched.has(key)) return;
    fetched.add(key);
    const all = await rowsForPaper();
    /* Work this device has not managed to send yet is drawn alongside what the
       server returned, so reopening a paper on a dead connection shows the
       marks rather than an empty page. They are shaped like rows because
       everything downstream reads rows; the id is the one minted when the
       write was queued, so when the outbox finally drains the row that
       arrives IS this one. */
    const mine = unsent(paperId);
    const pendingRows = mine.marks.map((a) => ({
      id: a.id, paper_id: a.paperId, module_code: a.moduleCode, author_id: me,
      kind: a.kind, ring: a.ring, colour: a.colour, body: a.body,
      thread_id: a.threadId || null, anchor: a.anchor, hint: null,
      status: "ok", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })).filter((r) => !rows.has(r.id));
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
    absorb(near.concat(pendingRows.filter((r) => {
      const q = r.anchor?.quote;
      return !q || slice.includes(q.slice(0, 40));
    })), false);
    relayout();
  }

  /* The quiet poll. HANDOVER: the only thing it may do is light the dot —
     never touch the page, never re-sort the panel, never move anything under
     the student's eyes. So it collects, and stops. */
  async function poll() {
    if (!paperId || !model) return 0;
    const all = await rowsForPaper();
    const queued = new Set(unsent(paperId).marks.map((a) => a.id));
    pending = all.filter((r) => !rows.has(r.id) && !queued.has(r.id)
        && !pending.some((p) => p.id === r.id))
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
        /* A TEXT BOX SHOWS ITS WORDS ON THE PAGE. That is the whole of the
           difference between it and a note: a note is a pin you open, a text
           box is a label you can read without opening anything. It hangs off
           the end of the passage it is anchored to, so it travels with the
           words rather than sitting where the paper used to be. */
        if (m.kind === "txt" && m.ask) {
          const last = layer.lastElementChild;
          if (last) {
            const lab = document.createElement("span");
            lab.className = "mkq lab";
            lab.dataset.g = m.g;
            lab.textContent = m.ask;
            lab.style.cssText = `left:${parseFloat(last.style.left) + parseFloat(last.style.width) + 6}px;`
              + `top:${parseFloat(last.style.top) - 2}px;--k:${hex}`;
            layer.appendChild(lab);
          }
        }
        range.detach?.();
      }
    }
  }

  /* ── 2b · the questions, and where their answers live ──────────────────
     A question on a paper is a THREAD IN THE READY ROOM, opening with the
     passage that was marked. The paper never grows its own discussion: the
     card in the panel is a window onto the room, so an answer typed here and
     an answer typed there are the same answer.

     Anonymity is the author id being stripped by the server, never the reader
     declining to draw it — `paper_marks_for` returns no author for a question,
     and `who` is set to 'anon' from that absence rather than from the kind. */
  async function loadThreads() {
    if (!moduleCode) return;
    const { threads, replies: rows } = await fetchDiscussion(moduleCode, me);
    const mine = new Set(threads.map((t) => t.id));
    const by = new Map();
    for (const r of rows) {
      if (!mine.has(r.threadId)) continue;
      const list = by.get(r.threadId) || [];
      list.push({ who: r.authorId, n: null, tx: r.body, at: r.createdAt });
      by.set(r.threadId, list);
    }
    for (const [id, list] of by) {
      list.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      replies.set(id, list);
    }
    attach();
    await names([...by.values()].flat().map((a) => a.who));
  }

  /* The answers a mark is carrying, re-read from the threads. */
  function attach() {
    let touched = false;
    for (const m of WM.marks) {
      if (m.kind !== "ask") continue;
      const row = rows.get(m.id);
      const list = replies.get(row?.thread_id) || [];
      if (list.length !== (m.ans || []).length) { m.ans = list; touched = true; }
    }
    if (touched) WM.emit();
  }

  /* Names for the ids that turned up, so a card says who answered rather than
     two question marks. Fetched once per id and written into the object the
     panel reads, which is why it is handed in rather than built here. */
  const asked = new Set();
  async function names(ids) {
    const want = [...new Set(ids)].filter((id) => id && id !== me && !asked.has(id));
    if (!want.length) return;
    want.forEach((id) => asked.add(id));
    const found = await fetchProfiles(want);
    let any = false;
    for (const [id, row] of Object.entries(found)) {
      const call = row.callsign || "Someone";
      people[id] = { n: call, i: call.slice(0, 2).toUpperCase(), tut: !!row.is_staff };
      any = true;
    }
    if (any) onNames?.();
  }

  /* ── 3 · writing back ──────────────────────────────────────────────── */

  /* A mark the student has just made. The chrome hands over the DOM Range it
     drew from; what is stored is the characters that Range covered, plus the
     quote and 32 characters either side as the fallback. Never the boxes. */
  async function made(mark, range, pgEl) {
    const pg = Number(pgEl.dataset.pg);
    const spans = spansIn(pages.get(pg)?.text);
    const off = offsetsOf(range, spans, itemsFor(pg));
    if (!off) {
      /* WM.drop filters the JS list and emits; it does not touch the DOM, and
         nothing on this path triggers a relayout. So the quads the chrome had
         just stamped stayed on the page: a highlight that looked made, saved
         nothing, and vanished at the next zoom with no explanation. */
      WM.drop(mark.g);
      document.querySelectorAll(`.mkq[data-g="${mark.g}"]`).forEach((q) => q.remove());
      trouble("lost");
      return;
    }

    placed.set(mark.id, off);
    mark.tx = model.text.slice(off.start, off.end).replace(/\s+/g, " ").trim();
    relayout();

    /* A question opens its thread first, so the mark it writes can point at
       it. If the thread fails the mark is still a mark — a question nobody can
       answer yet beats losing what the student marked. */
    const threadId = mark.kind === "ask"
      ? await askOnPassage({
        moduleCode, me, quote: mark.tx, body: mark.ask || "",
        paperTitle: paper?.title,
      })
      : null;

    const row = await createAnnotation({
      paperId, moduleCode, me,
      kind: KIND_TO_DB[mark.kind] || "highlight",
      ring: ringFor(mark.k),
      colour: MEANING_OF[mark.k],
      anchor: anchorFor(model.text, off.start, off.end),
      body: mark.kind === "ask" ? (mark.ask || null) : null,
      threadId,
    });
    if (!row) {
      /* OFFLINE, AND KEPT. The mark stays on the page — losing what somebody
         just marked is the worse failure of the two — and now it also goes
         into the outbox with an id minted here, so the insert that eventually
         goes up is THIS mark rather than a new one, and anything the student
         does to it in the meantime lands on the same row.

         This used to end at `trouble("offline")`, which said "marks are saved
         here" and then lost them on reload. See P0-2. */
      const localId = /^[0-9a-f-]{36}$/i.test(mark.id) ? mark.id : newLocalId();
      const args = {
        id: localId, paperId, moduleCode, me,
        kind: KIND_TO_DB[mark.kind] || "highlight",
        ring: ringFor(mark.k),
        colour: MEANING_OF[mark.k],
        anchor: anchorFor(model.text, off.start, off.end),
        body: mark.kind === "ask" ? (mark.ask || null) : null,
        threadId,
      };
      remember("mark.add", paperId, args);
      const was = mark.id;
      placed.set(localId, off); placed.delete(was);
      mark.id = localId; mark.g = localId;
      document.querySelectorAll(`.mkq[data-g="${was}"]`).forEach((q) => { q.dataset.g = localId; });
      WM.emit();
      onCounts?.(counts());
      /* Undoable exactly like a saved one: the record it points at is the
         queued op, and removing it takes the op out of the queue too. */
      did({
        what: mark.kind === "ask" ? "question" : "highlight",
        undo: () => remove(localId),
        redo: () => { remember("mark.add", paperId, args); restore({ ...args, id: localId, author_id: me,
          kind: args.kind, ring: args.ring, colour: args.colour, anchor: args.anchor }, off, mark); },
      });
      trouble("offline");
      return;
    }

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

    /* Recorded only once the server has it, so undo never has to reason about
       a mark that is halfway to existing. */
    did({
      what: mark.kind === "ask" ? "question" : "highlight",
      undo: () => remove(row.id),
      redo: () => restore(row, off, mark),
    });
  }

  /* Taking a mark off the page and out of the database, without recording it —
     the caller decides whether this is an undo or a deletion. */
  async function remove(id) {
    const row = rows.get(id);
    WM.drop(id);
    document.querySelectorAll(`.mkq[data-g="${id}"]`).forEach((q) => q.remove());
    placed.delete(id); rows.delete(id); orphans.delete(id);
    onCounts?.(counts());
    if (row && row.author_id === me) {
      if (!(await deleteAnnotation(id, me))) remember("mark.del", paperId, { id, me });
    } else if (!row) {
      /* No row means it never reached the server — so what has to go is the
         queued insert, not a row that does not exist. */
      remember("mark.del", paperId, { id, me });
    }
  }

  /* And putting one back where it was. The row keeps its id, so a mark undone
     and redone is the same mark to everybody else, not a new one. */
  async function restore(row, off, mark) {
    rows.set(row.id, row);
    placed.set(row.id, off);
    WM.marks.push({ ...mark, id: row.id, g: row.id });
    WM.emit();
    relayout();
    onCounts?.(counts());
    await createAnnotation({
      paperId, moduleCode, me, id: row.id,
      kind: row.kind, ring: row.ring, colour: row.colour,
      anchor: row.anchor, body: row.body, threadId: row.thread_id,
    });
  }

  async function dropped(g) {
    const row = rows.get(g);
    const off = placed.get(g);
    const mark = WM.marks.find((m) => m.g === g);
    const copy = mark && { ...mark };
    placed.delete(g); rows.delete(g); orphans.delete(g);
    onCounts?.(counts());
    if (row && off && copy) {
      did({
        what: copy.kind === "ask" ? "question" : "highlight",
        undo: () => restore(row, off, copy),
        redo: () => remove(row.id),
      });
    }
    if (row && row.author_id === me) {
      if (!(await deleteAnnotation(g, me))) remember("mark.del", paperId, { id: g, me });
    } else if (!row) {
      /* NO ROW MEANS IT NEVER REACHED THE SERVER, so what has to go is the
         queued insert. remove() has always done this and dropped() — the path
         the pill's bin and the eraser actually use — never did: mark something
         offline, delete it, reconnect, and the queued add replayed and put it
         back. outbox.js has a whole annihilation mechanism for exactly this
         and this function never reached it. */
      remember("mark.del", paperId, { id: g, me });
    }
  }

  /* A MARK MADE OFFLINE HAS NO ROW, and both of these returned early on that,
     so the page repainted, the island confirmed it, and nothing was stored or
     queued. The queued insert is the record until it lands, so patching that
     is patching the mark. */
  function patchQueued(g, patch) {
    const op = unsent(paperId).marks.find((a) => a.id === g);
    if (!op) return false;
    remember("mark.add", paperId, { ...op, ...patch });
    return true;
  }

  async function converted(g, kind, k) {
    const row = rows.get(g);
    if (!row) {
      patchQueued(g, { kind: KIND_TO_DB[kind] || "highlight", colour: MEANING_OF[k] });
      return;
    }
    if (row.author_id !== me) return;
    const was = { kind: row.kind, colour: row.colour };
    const patch = { kind: KIND_TO_DB[kind] || "highlight", colour: MEANING_OF[k] };
    did({ what: "change", undo: () => repatch(g, was), redo: () => repatch(g, patch) });
    await repatch(g, patch);
  }

  async function recoloured(g, k) {
    const row = rows.get(g);
    if (!row) { patchQueued(g, { colour: MEANING_OF[k], ring: ringFor(k) }); return; }
    if (row.author_id !== me) return;
    const was = { colour: row.colour, ring: row.ring };
    const patch = { colour: MEANING_OF[k], ring: ringFor(k) };
    did({ what: "colour", undo: () => repatch(g, was), redo: () => repatch(g, patch) });
    await repatch(g, patch);
  }

  /* One place a mark's own fields change, so undo and redo are the same call
     with different values — and so the page, the panel and the row can never
     disagree about what a mark is. */
  async function repatch(g, patch) {
    const row = rows.get(g);
    if (!row) return;
    Object.assign(row, patch);
    const m = WM.marks.find((x) => x.g === g);
    if (m) {
      if (patch.kind) m.kind = KIND_FROM_DB[patch.kind] || m.kind;
      if (patch.colour) m.k = colourKey(patch.colour);
      WM.emit();
    }
    relayout();
    onCounts?.(counts());
    if (!(await updateAnnotation(g, patch, me))) remember("mark.edit", paperId, { id: g, patch, me });
  }

  /* An answer typed into a card. It goes to the thread the Ready Room shows,
     and it is on the card before the network hears about it — nothing a
     student types waits on a round trip. */
  async function answer(markId, text) {
    const row = rows.get(markId);
    const thread = row?.thread_id;
    if (!thread || !text.trim()) return;
    const list = replies.get(thread) || [];
    const at = new Date().toISOString();
    list.push({ who: me, n: null, tx: text.trim(), at });
    replies.set(thread, list);
    attach();
    WM.emit();
    await insertReply({
      id: `R${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      threadId: thread, body: text.trim(), authorId: me, createdAt: at,
    });
  }

  /* A finished stroke. Ink is coordinates and nothing else — there is no
     sentence you could store instead that would let you draw it again — so it
     goes to paper_ink, which has no anchor column to smuggle a position into.
     Points are already fractions of the unrotated page: the chrome draws into
     a 0-1000 viewBox, and the table wants 0-1. */
  async function stroke(pgEl, path, pts, tool, S, drawn = {}) {
    const pg = Number(pgEl.dataset.pg);
    /* WHAT WAS ACTUALLY DRAWN, handed over by the chrome, rather than the
       slider number read back afterwards. `drawn.width` is in the page's own
       0-1000 viewBox units with the highlighter's nib multiplier and the
       page's drawn width already in it, so dividing by 1000 gives the fraction
       of the page the table wants — and the stroke reloads at the thickness it
       was drawn at, at any zoom. The fallback is the old arithmetic, for a
       caller that has not been updated. */
    const width = drawn.width != null
      ? Math.max(0.0004, drawn.width / 1000)
      : (S.size[tool.id] || 3) / 1000;
    const opacity = drawn.opacity == null ? 1 : drawn.opacity;
    const cap = drawn.cap || "round";
    const variant = drawn.variant || 0;
    /* The palette's name when the colour is one of the five, the hex itself
       when it is one of the grid's twenty-four. INK_OF only knows the five and
       returned undefined for everything else, which became "graphite". */
    const picked = S.colour[tool.id];
    const colour = INK_OF[picked] || (/^#/.test(String(picked)) ? String(picked) : "graphite");
    /* 0017 KNOWS TWO NIBS AND THE TOOL TABLE HAS SIX. The column's CHECK is
       `tool in ('pen','marker')` and its comment says what they mean: pen
       lays colour down solid, marker lays it down translucent the way a
       highlighter does over words. So every tool is one or the other.

       Passing the tool's own id — 'mkr', 'shp' — was a CHECK violation, which
       comes back as a null row: the stroke stayed on the page, saved nothing,
       and was gone on reload. Marker strokes have been doing that since the
       tool was wired. */
    const row = await createStroke({
      paperId, moduleCode, me, page: pg,
      tool: tool.id, colour, width, opacity, cap, variant, ring: "solo",
      points: pts.map(([x, y]) => [x / 1000, y / 1000]),
    });
    if (!row) {
      /* Same bargain as a mark: it stays on the page and it goes in the
         outbox, with its id minted here so a redo is the same stroke. */
      const localId = newLocalId();
      remember("ink.add", paperId, {
        id: localId, paperId, moduleCode, me, page: pg,
        tool: tool.id, colour, width, opacity, cap, variant, ring: "solo",
        points: pts.map(([x, y]) => [x / 1000, y / 1000]),
      });
      path.dataset.id = localId;
      /* The live stroke keeps the colour it was drawn in. It used to have its
         stroke attribute stripped and a palette NAME put on it instead, so a
         free colour turned grey the instant the save failed. */
      if (!/^#/.test(colour)) { path.dataset.ink = colour; path.removeAttribute("stroke"); }
      trouble("offline");
      return;
    }
    path.dataset.id = row.id;
    /* A named colour is painted by its name, so the stylesheet stays the one
       owner of what a palette colour looks like. A free colour has no name to
       be painted by and keeps the stroke it was drawn with. */
    if (!/^#/.test(String(row.colour))) { path.dataset.ink = row.colour; path.removeAttribute("stroke"); }
    inkRows.push(row);
    did({
      what: "stroke",
      undo: async () => {
        path.remove();
        const i = inkRows.findIndex((x) => x.id === row.id);
        if (i >= 0) inkRows.splice(i, 1);
        await deleteStrokes([row.id], me);
      },
      /* Drawn again from the record rather than from the element, because the
         element may have been thrown away with its page by then. */
      redo: async () => {
        inkRows.push(row);
        paintInk(pg);
        await createStroke({
          paperId, moduleCode, me, page: pg, id: row.id,
          tool: row.tool, colour: row.colour, width: row.width, ring: row.ring,
          points: row.points,
        });
      },
    });
  }

  /* The words on a note. It is the mark's body, so it goes where a question's
     body goes, and it is on the card before the network hears about it. */
  async function note(id, text) {
    const row = rows.get(id);
    const m = WM.marks.find((x) => x.g === id);
    if (!m) return;
    const was = m.ask || "";
    m.ask = text;
    WM.emit();
    /* A text box's words are drawn ON the page, so changing them is a layout
       change as well as a data one. */
    relayout();
    if (!row || row.author_id !== me) return;
    did({
      what: "note",
      undo: async () => { m.ask = was; WM.emit(); await updateAnnotation(id, { body: was || null }, me); },
      redo: async () => { m.ask = text; WM.emit(); await updateAnnotation(id, { body: text || null }, me); },
    });
    row.body = text;
    const saved = await updateAnnotation(id, { body: text || null }, me);
    if (!saved) {
      remember("mark.edit", paperId, { id, patch: { body: text || null }, me });
      trouble("offline");
    }
  }

  /* The eraser took some strokes off. They come off the record too, and the
     removal is undoable the same way everything else is. */
  /* What a stroke is made of, so the rubber can keep the parts it missed. */
  function pointsOf(id) {
    const row = inkRows.find((r) => r.id === id);
    return row ? row.points : null;
  }

  async function erasedInk(ids, split = []) {
    const gone = ids.map((id) => inkRows.find((r) => r.id === id)).filter(Boolean);
    for (const row of gone) {
      const i = inkRows.findIndex((x) => x.id === row.id);
      if (i >= 0) inkRows.splice(i, 1);
    }
    if (gone.length) {
      did({
        what: "stroke",
        undo: async () => {
          inkRows.push(...gone);
          for (const pg of new Set(gone.map((r) => r.page))) paintInk(pg);
          for (const row of gone) {
            await createStroke({
              paperId, moduleCode, me, page: row.page, id: row.id,
              tool: row.tool, colour: row.colour, width: row.width, ring: row.ring,
              points: row.points,
            });
          }
        },
        redo: async () => {
          for (const row of gone) {
            const i = inkRows.findIndex((x) => x.id === row.id);
            if (i >= 0) inkRows.splice(i, 1);
          }
          for (const pg of new Set(gone.map((r) => r.page))) paintInk(pg);
          await deleteStrokes(gone.map((r) => r.id), me);
        },
      });
    }
    await deleteStrokes(ids, me);

    /* "Just where you rub" leaves the runs the rubber missed, as strokes of
       their own — so one stroke can become two, which is what a rubber does
       to a line it crosses in the middle. They are written after the delete,
       so a failure halfway leaves nothing duplicated. */
    for (const piece of split) {
      const was = gone.find((r) => r.id === piece.id);
      if (!was) continue;
      for (const run of piece.runs) {
        const row = await createStroke({
          paperId, moduleCode, me, page: was.page,
          tool: was.tool, colour: was.colour, width: was.width, ring: was.ring,
          points: run,
        });
        if (row) { inkRows.push(row); }
      }
      paintInk(was.page);
    }
  }

  /* A SNAPSHOT IS A PICTURE OF THE PAGE, not a record on it. Nothing is
     stored and nothing needs to be: the region is cropped out of the raster
     the reader already drew, at the resolution it was drawn at, and handed to
     the student as a file. */
  function snapshot(pgEl, a, b) {
    const canvas = pgEl.querySelector("canvas");
    if (!canvas || !canvas.width) return;
    const x0 = Math.min(a[0], b[0]) / 1000, x1 = Math.max(a[0], b[0]) / 1000;
    const y0 = Math.min(a[1], b[1]) / 1000, y1 = Math.max(a[1], b[1]) / 1000;
    const sx = Math.round(x0 * canvas.width), sy = Math.round(y0 * canvas.height);
    const sw = Math.max(1, Math.round((x1 - x0) * canvas.width));
    const sh = Math.max(1, Math.round((y1 - y0) * canvas.height));
    const out = document.createElement("canvas");
    out.width = sw; out.height = sh;
    out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = url;
      a2.download = `${(paper?.title || "paper").replace(/[^\w-]+/g, "-").slice(0, 40)}-p${pgEl.dataset.pg}.png`;
      document.body.appendChild(a2); a2.click(); a2.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  }

  /* ── taking your marks with you ────────────────────────────────────────
     HANDOVER section 4's last row: "A student can pull their marks out of a
     paper — at minimum their revision deck."

     MARKDOWN, because it opens in everything and pastes into anything — a
     revision app, a document, a message to somebody on the course. A format
     nobody can read is the same as no export.

     Only this student's own marks. The class's belong to the class, and a red
     mark is private end to end — including from an export that might be
     forwarded. */
  const MEANS = {
    y: "Exam likely", b: "Definition", g: "Testable fact",
    p: "Question", r: "To revise",
  };
  function deckText() {
    const mine = WM.marks
      .filter((m) => m.who === "me" || m.kind === "ask")
      .sort((a, b) => a.pg - b.pg || a.tx.localeCompare(b.tx));
    const when = new Date().toLocaleDateString(undefined,
      { day: "numeric", month: "long", year: "numeric" });
    const out = [`# ${paper?.title || "This paper"} — your marks`, ""];
    const counted = mine.filter((m) => m.kind !== "ask");
    out.push(`${counted.length} mark${counted.length === 1 ? "" : "s"} · taken ${when}`, "");

    const by = new Map();
    for (const m of mine) {
      if (m.kind === "ask") continue;
      const list = by.get(m.pg) || [];
      list.push(m);
      by.set(m.pg, list);
    }
    for (const [pg, list] of [...by].sort((a, b) => a[0] - b[0])) {
      const head = head0(pg);
      out.push(`## Page ${String(pg).padStart(4, "0")}${head ? ` — ${head}` : ""}`, "");
      for (const m of list) {
        const what = MEANS[m.k] || "Marked";
        out.push(`- **${what}** — "${m.tx}"${m.ask ? ` — ${m.ask}` : ""}`);
      }
      out.push("");
    }

    /* Questions last, with their answers, because that is what they are for. */
    const asked = mine.filter((m) => m.kind === "ask");
    if (asked.length) {
      out.push("## Questions on this paper", "");
      for (const q of asked) {
        out.push(`- "${q.tx}"${q.ask ? ` — ${q.ask}` : ""}`);
        for (const a of q.ans || []) {
          const who = (people[a.who] || {}).n || "Someone";
          out.push(`    - ${who}: ${a.tx}`);
        }
      }
      out.push("");
    }
    return out.join("\n");
  }

  function head0(pg) {
    try { return chrome.head ? chrome.head(pg) : ""; } catch { return ""; }
  }

  function takeOut() {
    const text = deckText();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(paper?.title || "paper").replace(/[^\w-]+/g, "-").slice(0, 48)}-marks.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return text;
  }

  /* ── undo and redo ─────────────────────────────────────────────────────
     Movement only ever happens because the student asked for it, so both of
     these say what they did — the island's message is the acknowledgement,
     and without it an undo on a page you are not looking at is silent. */
  async function undo() {
    const entry = past.pop();
    if (!entry) return null;
    future.push(entry);
    await entry.undo();
    return entry.what;
  }
  async function redo() {
    const entry = future.pop();
    if (!entry) return null;
    past.push(entry);
    await entry.redo();
    return entry.what;
  }

  /* The student's own strokes, drawn back onto a page as it arrives. */
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
      /* The stored NAME and nothing else. The stylesheet decides what it
         looks like, so no colour string is built here. */
      /* A NAME IF IT HAS ONE, THE COLOUR ITSELF IF IT DOES NOT. The palette's
         eight names are a design decision the stylesheet owns; the free
         colours the grid offers are not in it, and storing one as "graphite"
         — which is what INK_OF did with any hex — turned olive into dark grey
         the moment the save came back. */
      if (/^#/.test(s.colour)) p.setAttribute("stroke", s.colour);
      else p.setAttribute("data-ink", s.colour);
      /* WIDTH IS A FRACTION OF THE PAGE, so it reloads at the thickness it was
         drawn at whatever the zoom was. It used to store the raw slider number
         and redraw it as viewBox units: a 12 pt highlighter stroke is about 32
         viewBox units when it is drawn and came back as 12. */
      p.setAttribute("stroke-width", String((s.width || 0.003) * 1000));
      p.setAttribute("fill", "none");
      /* Opacity and cap round-trip too. Both were dropped on the way out and
         invented on the way back, so a marker at 55% and a highlighter at 38%
         both returned fully opaque, covering the words they were drawn over,
         and a chisel highlighter came back round-capped. */
      p.setAttribute("stroke-opacity", String(s.opacity == null ? 1 : s.opacity));
      p.setAttribute("stroke-linecap", s.cap || "round");
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("d", s.points.map(([x, y], i) => `${i ? "L" : "M"}${x * 1000} ${y * 1000}`).join(""));
      p.dataset.id = s.id;
      els.ink.appendChild(p);
    }
  }

  /* ── what the shell tells us ───────────────────────────────────────── */
  const api = {
    loadWindow, loadInk, loadThreads, poll, pull, relayout,
    made, dropped, converted, recoloured, stroke, answer, note, erasedInk, snapshot, pointsOf,
    takeOut, deckText,
    /* Whether this account drew a stroke. The server cannot answer it — there
       is no session to check against — so the caller has to, and the eraser
       asks before it takes anything off. */
    mine: (id) => {
      if (!id) return true;               // a stroke still being drawn is ours
      const row = inkRows.find((r) => r.id === id);
      return !row || row.author_id === me;
    },
    undo, redo, canUndo: () => past.length > 0, canRedo: () => future.length > 0,
    counts,
    /* The shape the panel's card reads, because an orphan is still a mark —
       it has words, a colour and an author, and the only thing it has lost is
       where it sat. */
    orphans: () => [...orphans].map((id) => {
      const row = rows.get(id);
      if (!row) return null;
      return {
        id, k: colourKey(row.colour || MEANING_OF.y),
        kind: KIND_FROM_DB[row.kind] || "hl",
        /* YOUR OWN QUESTION IS YOURS. This read `row.kind === "question" ? "anon"`
         first, so it threw your identity away on your own rows — although the
         server already anonymises other people's (0018 nulls author_id for
         somebody else's anonymous mark, and always returns yours with your id
         on it). The cost was everywhere: your questions never reached the You
         tallies, never appeared in "where you have been", were excluded from
         the panel's Mine and included in its Class.

         Two fields now, because they answer two different questions. `who` is
         whose it is, and decides what you may do to it. `anon` is how it must
         be shown, and is true for every question including your own. */
      who: row.author_id === me ? "me" : (row.kind === "question" ? "anon" : row.author_id),
      anon: row.kind === "question",
      agree: Number(row.agree_count) || 0,
      iAgree: Boolean(row.i_agree),
        t: ago(row.updated_at || row.created_at),
        tx: row.anchor?.quote || "",
      };
    }).filter(Boolean),
    waiting: () => pending.length,

    /* ── a note or a question dropped on the page ────────────────────
       The composer collects the words and the student clicks the spot. The
       pin is already drawn; this is the record behind it.

       IT IS STILL ANCHORED TO TEXT. A pin arrives as a point, and a point is
       exactly what R1 refuses to store — a coordinate does not survive the
       paper being re-extracted, and the CHECK on paper_annotations would
       refuse it anyway. So the point is resolved to the nearest run of words
       on that page at the moment it is dropped, and what is stored is those
       words plus their context, like every other mark. The pin is then drawn
       back at the start of that run, which is a few pixels from where it was
       clicked and is the same few pixels after a reflow. */
    async pin({ kind, tx, pg, x, y, el }) {
      /* spansIn returns a SPARSE array indexed by the run number, so it has
         holes wherever a run has not been drawn — walking it with for..of
         hands you undefined, which is how the first version of this threw on
         getBoundingClientRect and lost the note it was trying to save. */
      const spans = spansIn(pages.get(pg)?.text);
      const items = itemsFor(pg);
      const pgEl = document.querySelector(`.sheetpg[data-pg="${pg}"]`);
      let off = null;
      if (pgEl && spans && spans.length) {
        const box = pgEl.getBoundingClientRect();
        const px = box.left + box.width * (x / 100);
        const py = box.top + box.height * (y / 100);
        /* the run whose box is nearest the drop point, by centre distance */
        let best = null, bd = Infinity;
        for (const sp of spans) {
          if (!sp) continue;
          const b = sp.getBoundingClientRect();
          if (!b.width) continue;
          const dx = Math.max(b.left - px, 0, px - b.right);
          const dy = Math.max(b.top - py, 0, py - b.bottom);
          const d = Math.hypot(dx, dy);
          if (d < bd) { bd = d; best = sp; }
        }
        if (best) {
          const r = document.createRange();
          r.selectNodeContents(best);
          off = offsetsOf(r, spans, items);
        }
      }
      if (!off) {
        /* No text on the page at all — a scan, or a figure page. The note is
           worth keeping and there is nothing to anchor it to, so it is told
           plainly rather than saved somewhere it cannot come back from. */
        trouble("notext");
        return;
      }
      const threadId = kind === "ask"
        ? await askOnPassage({ moduleCode, me, quote: model.text.slice(off.start, off.end),
          body: tx, paperTitle: paper?.title })
        : null;
      const args = {
        paperId, moduleCode, me,
        kind: kind === "ask" ? "question" : "note",
        ring: kind === "ask" ? "module" : "solo",
        colour: kind === "ask" ? MEANING_OF.p : MEANING_OF.y,
        anchor: anchorFor(model.text, off.start, off.end),
        body: tx, threadId,
      };
      const row = await createAnnotation(args);
      if (!row) {
        const localId = newLocalId();
        remember("mark.add", paperId, { ...args, id: localId });
        if (el) el.dataset.g = localId;
        trouble("offline");
        return;
      }
      if (el) el.dataset.g = row.id;
      rows.set(row.id, row);
      placed.set(row.id, off);
      WM.marks.push({ id: row.id, g: row.id, pg, k: kind === "ask" ? "p" : "y",
        kind, who: "me", t: "just now", tx, ask: kind === "ask" ? tx : undefined,
        ans: kind === "ask" ? [] : undefined });
      WM.emit();
      onCounts?.(counts());
      did({
        what: kind === "ask" ? "question" : "note",
        undo: () => { el?.remove(); return remove(row.id); },
        redo: () => restore(row, off, { pg, k: kind === "ask" ? "p" : "y", kind, tx }),
      });
    },
    /* ── the outbox ──────────────────────────────────────────────────
       How much of this student's work on THIS paper has not reached the
       server. The island reads it, which is why the banner can now say a
       number instead of a promise. */
    unsent: () => waitingFor(paperId).length,
    justSent: () => lastSent,
    /* Replay, oldest first, stopping at the first refusal. Safe to call as
       often as you like — an empty queue is a no-op and a stuck one stays
       stuck rather than delivering a deletion before its insert. */
    async drain() {
      if (draining) return { sent: 0 };
      draining = true;
      try {
        const out = await flushOutbox({
          "mark.add": async (a) => {
            const row = await createAnnotation(a);
            if (row) { rows.set(row.id, row); onCounts?.(counts()); }
            return row;
          },
          "mark.edit": (a) => updateAnnotation(a.id, a.patch, a.me),
          "mark.del": (a) => deleteAnnotation(a.id, a.me),
          "ink.add": async (a) => {
            const row = await createStroke(a);
            if (row) inkRows.push(row);
            return row;
          },
          "ink.del": (a) => deleteStrokes(a.ids, a.me),
        });
        lastSent = out.sent;
        if (out.sent > 0) { relayout(); onCounts?.(counts()); }
        return out;
      } finally { draining = false; }
    },
    /* AGREEING WITH A MARK. `agree_with_mark` has existed since 0018, the
       client wrapper since the same day, and neither was ever called — so the
       count column was written by nothing and read by nothing. The panel's
       card has the control now, so the store needs the verb. */
    async agree(id, on) {
      const m = WM.marks.find((x) => x.g === id);
      if (m) {
        m.iAgree = Boolean(on);
        m.agree = Math.max(0, (m.agree || 0) + (on ? 1 : -1));
        WM.emit();
      }
      const ok = await agreeWithMark(id, me, Boolean(on));
      if (!ok && m) {
        /* Put it back rather than leave a number nobody can trust. */
        m.iAgree = !on;
        m.agree = Math.max(0, (m.agree || 0) + (on ? -1 : 1));
        WM.emit();
        trouble("offline");
      }
      return ok;
    },
    /* A deletion from the panel is the same deletion as from the page, so it
       goes through the same function and lands in the same undo history. */
    deleteMark: (id) => dropped(id),
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
