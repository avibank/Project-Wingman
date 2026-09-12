/* =============================================================================
   The outbox — work that has been done but not yet saved.
   -----------------------------------------------------------------------------
   WHAT WAS WRONG. A mark made with no signal stayed on the page, the chrome
   said "Offline · marks are saved here", and the mark was gone on the next
   load. Nothing was queued anywhere: no localStorage key, no retry, no POST
   when the network came back. Measured, twice, in docs/audit-pdf.md as P0-2.
   The reassurance was the worst part — the one moment the student is told
   their work is safe was the moment it had just been lost.

   WHAT THIS IS. A small durable queue in localStorage. A write that fails for
   any reason is remembered here with everything needed to replay it, and
   replayed when the network comes back, when the tab is looked at again, or
   when the paper is next opened. Nothing is thrown away until the server has
   confirmed it.

   THREE RULES it is built on.

   1. ORDER IS KEPT AND NEVER SKIPPED. The ops replay oldest first and stop at
      the first failure, because an edit to a mark that has not been created
      yet is not a recoverable state. A queue that skipped past a stuck op
      would deliver a deletion before its insert.

   2. AN ID IS MINTED BEFORE THE QUEUE, NOT AFTER THE SERVER. Both the insert
      and every later edit or delete carry the same uuid, so a mark made
      offline, restyled offline and then flushed arrives as one row that was
      always that row. The reader adopts that id the moment the op is queued,
      exactly as it adopts the server's id on the happy path.

   3. IT IS PER BROWSER, AND SAYS SO. localStorage does not follow the student
      to another device, and a queue is not a sync engine. The banner this
      feeds says work is waiting on THIS device, which is true, rather than
      "saved", which was not.
   ========================================================================= */

const KEY = "wm.reader.outbox.v1";
/* A cap, because a student who works through a whole manual on a dead
   connection should not fill the origin's storage quota and start losing
   writes at the far end. Oldest wins: what was done first is what other work
   depends on. */
const MAX = 400;

const can = () => {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(KEY + ".t", "1");
    localStorage.removeItem(KEY + ".t");
    return true;
  } catch { return false; }
};
const HAVE = can();

function read() {
  if (!HAVE) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function write(list) {
  if (!HAVE) return false;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); return true; }
  catch { return false; }
}

export const newLocalId = () => (
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    /* Good enough as a fallback: it only has to be unique among one person's
       unsent work, and it is replaced by nothing — the server keeps it. */
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    })
);

/* Remember one write. `t` says which handler replays it; `paper` lets a reader
   show what of ITS OWN work is still waiting without parsing the rest.

   A delete aimed at something still sitting in this queue CANCELS it instead
   of queueing behind it. Undoing a mark made offline would otherwise send an
   insert and then a delete for a row nobody ever saw — and worse, if the
   insert is one the server will never accept, the delete waits behind it for
   good. Two ops that annihilate should annihilate here, where it is free. */
export function remember(t, paper, args) {
  const list = read();
  const gone = t === "mark.del" ? [args?.id]
    : t === "ink.del" ? (args?.ids || [])
      : null;
  if (gone && gone.length) {
    const ids = new Set(gone.filter(Boolean));
    const add = t === "mark.del" ? "mark.add" : "ink.add";
    const cancelled = list.some((o) => o.t === add && ids.has(o.args?.id));
    if (cancelled) {
      const keep = list.filter((o) => {
        if (o.paper !== paper) return true;
        if ((o.t === add || o.t === "mark.edit") && ids.has(o.args?.id)) return false;
        return true;
      });
      /* Only the ids that were never sent are cancelled. Anything in `ids` the
         server already has still needs a real delete. */
      const left = gone.filter((id) => !list.some((o) => o.t === add && o.args?.id === id));
      write(keep);
      if (!left.length) return null;
      args = t === "mark.del" ? { ...args, id: left[0] } : { ...args, ids: left };
      return remember(t, paper, args);
    }
  }
  const op = { k: newLocalId(), t, paper, args, at: Date.now(), tries: 0 };
  list.push(op);
  write(list);
  return op;
}

export function forget(k) {
  write(read().filter((o) => o.k !== k));
}

/* Everything still waiting, oldest first. */
export const waiting = () => read();

/* What is waiting for one paper — the number the reader puts on screen. */
export const waitingFor = (paper) => read().filter((o) => o.paper === paper);

/* The marks and strokes a reader should draw on top of what the server sent,
   so reopening a paper offline shows the work rather than an empty page. */
export function unsent(paper) {
  const marks = [], ink = [], dropped = new Set();
  for (const o of read()) {
    if (o.paper !== paper) continue;
    if (o.t === "mark.del") { dropped.add(o.args?.id); continue; }
    if (o.t === "ink.del") { (o.args?.ids || []).forEach((i) => dropped.add(i)); continue; }
    if (o.t === "mark.add") marks.push(o.args);
    if (o.t === "ink.add") ink.push(o.args);
  }
  return { marks: marks.filter((m) => !dropped.has(m.id)),
           ink: ink.filter((i) => !dropped.has(i.id)),
           dropped };
}

/* Replay. `handlers` is { "mark.add": fn, … }; a handler returns truthy when
   the server has it. The first failure stops the run and leaves the rest — see
   rule 1 — so a flush is safe to call as often as you like.

   Returns what happened, because the banner needs to say something specific:
   "three saved" is news, and so is "still waiting". */
export async function flush(handlers) {
  const list = read();
  if (!list.length) return { sent: 0, left: 0, stopped: false };
  let sent = 0;
  let stuck = null;
  for (const op of list) {
    const fn = handlers[op.t];
    if (!fn) { forget(op.k); continue; }   // an op from an older build
    let ok = false;
    try { ok = !!(await fn(op.args)); } catch { ok = false; }
    if (!ok) {
      /* Counted rather than retried forever. A write the server will never
         accept — a CHECK violation, a paper that has been deleted — would
         otherwise block everything behind it for good.

         AND IT DID. The count was kept and reported and then the run returned
         anyway, so the dead op stayed at the head of an ordered queue and
         every later mark and stroke sat behind it for ever: one question whose
         thread insert failed (`question_has_thread` refuses a question with a
         null thread) was enough to stop this device saving anything again,
         while the island said "N waiting on this device" indefinitely.

         Eight tries is the end of it. The op is set aside — kept, not thrown
         away, so it can be looked at — and the queue moves on. Ordering still
         holds for everything the server has not refused. */
      const all = read();
      const mine = all.find((o) => o.k === op.k);
      if (mine) { mine.tries = (mine.tries || 0) + 1; write(all); }
      if ((mine?.tries || 0) >= 8) {
        forget(op.k);
        dead(op);
        stuck = op;
        continue;
      }
      return { sent, left: read().length, stopped: true, stuck: null };
    }
    forget(op.k);
    sent++;
  }
  return { sent, left: read().length, stopped: false, stuck };
}

/* SET ASIDE, NOT LOST. An op the server has refused eight times is moved here
   rather than deleted: the student's work is still on this device, and a
   support conversation can see what would not go. Capped, because a dead
   letter that grows for ever is a second bug. */
const DEAD = "pw-rdr-outbox-dead";
function dead(op) {
  try {
    const held = JSON.parse(localStorage.getItem(DEAD) || "[]");
    held.push({ ...op, diedAt: Date.now() });
    localStorage.setItem(DEAD, JSON.stringify(held.slice(-40)));
  } catch { /* private mode — the op is gone either way */ }
}

export function deadLetters() {
  try { return JSON.parse(localStorage.getItem(DEAD) || "[]"); } catch { return []; }
}

/* The three moments a browser tells you the world may have changed. Returns an
   unsubscribe, because a reader that is unmounted must not keep flushing. */
export function whenBackOnline(run) {
  if (typeof window === "undefined") return () => {};
  const go = () => { if (navigator.onLine !== false) run(); };
  const vis = () => { if (document.visibilityState === "visible") go(); };
  window.addEventListener("online", go);
  window.addEventListener("focus", go);
  document.addEventListener("visibilitychange", vis);
  /* And a slow poll, because `online` is a lie often enough to matter: a
     captive portal, a VPN reconnect and a sleeping laptop all come back
     without firing it. */
  const t = setInterval(go, 20_000);
  return () => {
    window.removeEventListener("online", go);
    window.removeEventListener("focus", go);
    document.removeEventListener("visibilitychange", vis);
    clearInterval(t);
  };
}

/* Told, not guessed. Used by the tests and by the banner. */
export const storageWorks = () => HAVE;
