/* =============================================================================
   Wingman — annotation anchors
   -----------------------------------------------------------------------------
   An annotation does not point at "page 4, rectangle 12". It points at the words
   themselves, plus enough surrounding text to tell two identical passages apart.

   That is what lets a highlight made on the PDF survive the paper becoming
   native content later, and lets a highlight survive you editing a paragraph
   somewhere else in the same paper.

   Two functions matter:

     createAnchor(text, start, end)   -> anchor record, stored with the annotation
     resolveAnchor(anchor, text)      -> { start, end, method, score } or null

   null means orphaned. Never guess: a wrong position is worse than no position,
   because the reader cannot tell it is wrong.

   No dependencies. Pure functions. Safe to run on the server or in the browser.

   SUPPLIED WITH THE BRIEF AND COPIED VERBATIM. It arrived with 29 passing tests
   (scripts/check-anchor.mjs) and the brief names it as the one piece not to
   rewrite. Anything this file gets wrong is a bug to fix in the tests first.
   ============================================================================= */

/* eslint-disable no-use-before-define -- `round` and the helpers below are
   consts declared after their callers. That is safe: nothing here runs during
   module evaluation. The rule is disabled rather than the file reordered
   because the brief names this as the one piece not to rewrite, and a diff
   against the supplied version has to stay empty. */

export const CONTEXT_CHARS = 32;   // how much text either side is kept as context
export const ACCEPT_SCORE  = 0.75; // below this, the annotation is orphaned

/* -----------------------------------------------------------------------------
   Normalisation
   -----------------------------------------------------------------------------
   Text pulled out of a PDF is not the text a human sees. Lines wrap mid-sentence,
   long words are broken with a hyphen, and runs of whitespace are arbitrary.
   Native content has none of that. So both sides get normalised the same way
   before anything is compared, and we keep a map back to the original offsets so
   the caller still gets real positions to draw at.
   -------------------------------------------------------------------------- */
export function normalise(text){
  const out = [];
  const map = [];                  // map[i] = index in the original string
  let i = 0, pendingSpace = false, runStart = 0;

  while (i < text.length){
    const ch = text[i];

    // soft hyphen: never real text
    if (ch === '­'){ i++; continue; }

    // "com-\npiler" is one word that got broken by the line wrap
    if (ch === '-' && /[\r\n]/.test(text.slice(i + 1, i + 3))){
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && /[a-z]/i.test(text[j])){ i = j; continue; }
    }

    if (/\s/.test(ch)){
      if (!pendingSpace){ runStart = i; pendingSpace = out.length > 0; }
      i++; continue;
    }

    // a collapsed run of whitespace maps back to where that run began
    if (pendingSpace){ out.push(' '); map.push(runStart); pendingSpace = false; }
    out.push(ch); map.push(i);
    i++;
  }
  map.push(text.length);           // so an end offset one past the last char maps
  return { norm: out.join(''), map };
}

/* -----------------------------------------------------------------------------
   Creating an anchor
   -------------------------------------------------------------------------- */
export function createAnchor(text, start, end, extra){
  if (!(end > start)) throw new Error('createAnchor: empty selection');

  const { norm, map } = normalise(text);
  const nStart = originalToNorm(map, start, norm.length);
  const nEnd   = originalToNorm(map, end,   norm.length);

  const quote  = norm.slice(nStart, nEnd);
  const prefix = norm.slice(Math.max(0, nStart - CONTEXT_CHARS), nStart);
  const suffix = norm.slice(nEnd, Math.min(norm.length, nEnd + CONTEXT_CHARS));

  // if this exact string appears more than once, remember which one this is
  let occurrence = 0;
  for (let at = norm.indexOf(quote); at !== -1 && at < nStart; at = norm.indexOf(quote, at + 1))
    occurrence++;

  return Object.assign({
    quote, prefix, suffix, occurrence,
    approx: nStart,          // a hint for tie-breaking only, never an identity
    block: null,             // filled in once papers are native content
    blockOffset: null
  }, extra || {});
}

/* -----------------------------------------------------------------------------
   Resolving an anchor against a (possibly changed) document
   -------------------------------------------------------------------------- */
export function resolveAnchor(anchor, text, opts){
  const accept = (opts && opts.accept) != null ? opts.accept : ACCEPT_SCORE;
  const { norm, map } = normalise(text);
  const q = anchor.quote;
  if (!q) return null;

  /* 1 — the block it was written against, if the paper is native and it still exists */
  if (anchor.block && opts && opts.blocks && opts.blocks[anchor.block] != null){
    const base = opts.blocks[anchor.block];
    const at = base + (anchor.blockOffset || 0);
    if (norm.slice(at, at + q.length) === q) return out(map, at, at + q.length, 'block', 1);
  }

  /* 2 — the quote still reads exactly as written */
  const hits = [];
  for (let at = norm.indexOf(q); at !== -1; at = norm.indexOf(q, at + 1)) hits.push(at);

  if (hits.length === 1) return out(map, hits[0], hits[0] + q.length, 'exact', 1);

  if (hits.length > 1){
    // several identical passages — the context decides which one
    let best = hits[0], bestScore = -1;
    for (const at of hits){
      const p = norm.slice(Math.max(0, at - CONTEXT_CHARS), at);
      const s = norm.slice(at + q.length, at + q.length + CONTEXT_CHARS);
      let sc = 0.6 * similarity(p, anchor.prefix) + 0.4 * similarity(s, anchor.suffix);
      sc -= Math.min(0.15, Math.abs(at - (anchor.approx || 0)) / Math.max(norm.length, 1) * 0.15);
      if (sc > bestScore){ bestScore = sc; best = at; }
    }
    return out(map, best, best + q.length, 'context', Math.max(0.5, bestScore));
  }

  /* 3 — the passage itself was edited: find the closest thing to it */
  const cand = candidates(norm, q);
  let best = null, bestScore = 0;
  for (const at of cand){
    const width = Math.min(norm.length - at, Math.round(q.length * 1.35) + 8);
    for (const w of [q.length, width]){
      const window = norm.substr(at, w);
      let sc = similarity(window.toLowerCase(), q.toLowerCase());
      if (sc <= bestScore) continue;
      const p = norm.slice(Math.max(0, at - CONTEXT_CHARS), at);
      const s = norm.slice(at + w, at + w + CONTEXT_CHARS);
      sc = 0.8 * sc + 0.1 * similarity(p, anchor.prefix) + 0.1 * similarity(s, anchor.suffix);
      if (sc > bestScore){ bestScore = sc; best = [at, at + w]; }
    }
  }
  if (best && bestScore >= accept) return out(map, best[0], best[1], 'fuzzy', round(bestScore));

  /* 4 — gone. Say so; do not put it somewhere plausible. */
  return null;
}

/* -----------------------------------------------------------------------------
   internals
   -------------------------------------------------------------------------- */
function out(map, nStart, nEnd, method, score){
  const last = Math.max(nStart, nEnd - 1);
  return {
    start: map[Math.min(nStart, map.length - 1)],
    // one past the last character actually covered, so the range never trails
    // the whitespace that follows it
    end:   map[Math.min(last, map.length - 1)] + 1,
    method, score: round(score)
  };
}
const round = (n) => Math.round(n * 1000) / 1000;

function originalToNorm(map, index, normLength){
  // first normalised position whose source index is >= index
  let lo = 0, hi = normLength;
  while (lo < hi){
    const mid = (lo + hi) >> 1;
    if (map[mid] < index) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/* Where might this quote have ended up? Cheap candidate positions only —
   the expensive similarity check runs on a handful of them, never the whole doc. */
function candidates(norm, q){
  const found = new Set();
  const add = (at) => { if (at >= 0) found.add(at); };

  for (const len of [30, 18, 10]){
    if (q.length < len) continue;
    const head = q.slice(0, len);
    for (let at = norm.indexOf(head); at !== -1 && found.size < 60; at = norm.indexOf(head, at + 1)) add(at);
    if (found.size) break;
  }
  for (const len of [30, 18, 10]){
    if (q.length < len) continue;
    const tail = q.slice(-len);
    for (let at = norm.indexOf(tail); at !== -1 && found.size < 60; at = norm.indexOf(tail, at + 1))
      add(at - (q.length - len));
    if (found.size) break;
  }
  if (!found.size){
    // last resort: the longest word in the quote, which is usually the rarest
    const words = q.split(' ').filter(w => w.length > 4).sort((a, b) => b.length - a.length);
    for (const w of words.slice(0, 3)){
      for (let at = norm.indexOf(w); at !== -1 && found.size < 60; at = norm.indexOf(w, at + 1))
        add(at - Math.round(q.indexOf(w)));
      if (found.size) break;
    }
  }
  return [...found];
}

/* similarity: 1 - normalised edit distance, with a cheap length guard */
export function similarity(a, b){
  if (a === b) return 1;
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / max > 0.5) return 0;
  return 1 - levenshtein(a, b) / max;
}

function levenshtein(a, b){
  if (a.length > b.length){ const t = a; a = b; b = t; }
  const row = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) row[i] = i;
  for (let j = 1; j <= b.length; j++){
    let prev = row[0]; row[0] = j;
    for (let i = 1; i <= a.length; i++){
      const tmp = row[i];
      row[i] = Math.min(
        row[i] + 1,
        row[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return row[a.length];
}

/* -----------------------------------------------------------------------------
   Overlapping highlights
   -----------------------------------------------------------------------------
   Eleven people highlighting the same paragraph cannot be eleven nested spans.
   Flatten every resolved range into non-overlapping segments first, then render
   each segment once, carrying the list of annotations that cover it.
   -------------------------------------------------------------------------- */
export function flatten(ranges){
  const edges = new Set();
  for (const r of ranges){ edges.add(r.start); edges.add(r.end); }
  const points = [...edges].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++){
    const start = points[i], end = points[i + 1];
    const ids = ranges.filter(r => r.start <= start && r.end >= end);
    if (ids.length) segments.push({ start, end, count: ids.length, ids: ids.map(r => r.id) });
  }
  return segments;
}
