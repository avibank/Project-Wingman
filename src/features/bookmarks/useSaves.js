import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, pruneMissing } from './savesStore';
import { content, useContentVersion } from './content';
import { papersOn } from '../../lib/flags.js';

/* PAGES IS THE READER'S FOLDER, AND PAPERS ARE PAUSED.
 *
 * `KINDS` is what every screen here iterates: the folder cards, the grouping,
 * the totals. Taking `page` out of it is what makes the fourth folder absent
 * rather than empty — and it has to be absent, because every word on it names
 * the reader.
 *
 * WHAT IS NOT DONE, DELIBERATELY: the rows. A `page` save stays in `saves`
 * exactly as it is. It is skipped on the way in (below), never resolved and
 * never pruned — pruning DELETES from the server, and a pause that quietly
 * emptied somebody's bookmarks would not be a pause. Turn the variable back
 * on and the folder comes back with everything in it.
 */
const ALL_KINDS = /** @type {const} */ (['question', 'card', 'video', 'page']);
export const KINDS = ALL_KINDS.filter((k) => papersOn || k !== 'page');
export const FOLDERS = {
  question: { slug: 'questions', name: 'Questions', action: 'Practise these',
    hint: 'Bookmark a question while you take a quiz.', cta: 'Take a quiz', where: 'on any question while you take a quiz' },
  card: { slug: 'cards', name: 'Study cards', action: 'Test yourself',
    hint: 'Flip a chapter\u2019s cards and keep the ones worth another look.', cta: 'Open the card sets', where: 'on any card in the Library\u2019s study card sets' },
  video: { slug: 'videos', name: 'Videos', action: 'Resume',
    hint: 'Bookmark a lesson at the moment that matters.', cta: 'Find a lesson', where: 'in the player while a lesson plays' },
  page: { slug: 'pages', name: 'Pages', action: 'Open newest page',
    hint: 'Bookmark a page while you read the paper.', cta: 'Open the paper', where: 'on any page in the paper reader' },
};
export const kindFromSlug = (slug) => KINDS.find((k) => FOLDERS[k].slug === slug) ?? null;

export const useSavesState = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * Turns a stored save into what a screen shows.
 *   an object   — draw this
 *   null        — the author deleted it; prune it
 *   undefined   — the content is not loaded yet; hold it and ask again
 * The difference matters because pruning DELETES from the server: answering
 * "gone" about a chunk still in flight would empty a student's bookmarks.
 */
export function resolve(row) {
  if (row.kind === 'question' || row.kind === 'card') {
    const q = content.question(row.ref_id);
    return q ? { row, kind: row.kind, q } : q;                       // null or undefined passes straight through
  }
  if (row.kind === 'video') {
    const l = content.lesson(row.ref_id);
    return l ? { row, kind: 'video', lesson: l, at: row.at_seconds ?? 0 } : l;
  }
  if (row.kind === 'page') {
    const p = content.paper(row.ref_id);
    if (p === undefined) return undefined;
    if (!p) return null;
    /* A PAPER WITH NO PAGE COUNT HAS NOT BEEN MEASURED, NOT SHORTENED, and
       that difference decides whether a row is deleted from the server.
       `content.paper` reports `pages || 0`, so a paper listed without a
       length would make every page in it "past the end" — `null`, which
       prunes. An unknown length cannot answer the question, so it does not:
       hold the row and ask again.

       This is a guard, not a fix for something observed: every paper the
       repo lists today carries its length. It is here because the cost of
       being wrong is a student's bookmarks, and because the same mistake one
       field along is what the three-state comment above this function is
       about. */
    if (!p.pageCount) return undefined;
    /* A page past the end of a paper we DO hold is a page that no longer
       exists — the paper was replaced with a shorter one. Gone, not unknown. */
    return row.page >= 1 && row.page <= p.pageCount ? { row, kind: 'page', paper: p, page: row.page } : null;
  }
  return null;
}

/** Everything saved in one module (or 'all'), resolved, newest first, grouped by kind. Dead saves are pruned. */
export function useModuleSaves(moduleId) {
  const s = useSavesState();
  const v = useContentVersion();
  const out = useMemo(() => {
    const byKind = { question: [], card: [], video: [], page: [] }; const missing = []; let waiting = 0;
    for (const row of s.rows) {
      if (moduleId !== 'all' && row.module_id !== moduleId) continue;
      /* Paused: held, not resolved, not counted and above all not pruned. */
      if (!papersOn && row.kind === 'page') continue;
      const it = resolve(row);
      if (it) byKind[row.kind].push(it);
      else if (it === null) missing.push(row);
      else waiting += 1;
    }
    return { byKind, missing, waiting, total: KINDS.reduce((n, k) => n + byKind[k].length, 0) };
  }, [s, moduleId, v]);
  useEffect(() => { if (s.ready && out.missing.length) pruneMissing(out.missing); }, [s.ready, out.missing]);
  /* Not ready while anything is still waiting on content: the home screen shows
     its empty line when total is 0, and "nothing yet" is the wrong thing to say
     to somebody whose saves are still arriving. */
  return { ...out, ready: s.ready && !out.waiting, error: s.error };
}

/** How many things are saved in one module. The Flight Deck's bag and the
    Manual strip's drawn bag both read this, so they cannot disagree. */
export function useSavesCount(moduleId) {
  const s = useSavesState();
  /* The bag counts what the bag can open. A page bookmark is still saved; it
     is not one of the things this module's Bookmarks will show today. */
  return s.rows.reduce((n, r) => n
    + ((moduleId === 'all' || r.module_id === moduleId) && (papersOn || r.kind !== 'page') ? 1 : 0), 0);
}
