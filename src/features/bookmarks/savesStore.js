/* =====================================================================
   SAVES STORE — the single place a bookmark is created or removed.
   Rule: the screen changes first (instant), the server follows. If the
   server refuses, the screen goes back and the student is told plainly.
   Nothing is ever shown as saved that isn't saved.
   ===================================================================== */
import { toast } from './toastBus.js';
import { track } from './track.js';

/** @typedef {'question'|'card'|'video'|'page'} Kind */
/** @typedef {{ id:string, user_id:string, module_id:string, kind:Kind, ref_id:string, chapter:number|null, at_seconds:number|null, page:number|null, created_at:string }} SaveRow */

const TABLE = 'saves';
let getClient = null;                 // () => Promise<SupabaseClient> — authed as the signed-in student
let state = { ready: false, userId: null, rows: /** @type {SaveRow[]} */ ([]), error: null };
let snapshot = state;
const subs = new Set();
const emit = () => { snapshot = { ...state, rows: state.rows.slice() }; subs.forEach((f) => f()); };

export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const getSnapshot = () => snapshot;

const keyOf = (kind, refId, page) => `${kind}|${refId}|${page ?? ''}`;
const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Call once after Clerk sign-in. Loads every save for this student (all modules; it is a small list). */
export async function initSaves({ getSupabase, userId }) {
  getClient = getSupabase;
  state = { ready: false, userId, rows: [], error: null }; emit();
  try {
    const sb = await getClient();
    const { data, error } = await sb.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    state = { ...state, ready: true, rows: data ?? [] };
  } catch (e) {
    console.error('[bookmarks] load failed', e);
    state = { ...state, ready: true, error: 'load' };
  }
  emit();
}
/** Call on sign-out so the next student never sees the last one's saves. */
export function resetSaves() { getClient = null; state = { ready: false, userId: null, rows: [], error: null }; emit(); }

/* NOBODY IS SIGNED IN, AND THAT IS SETTLED — which is not the same as "we have
   not asked yet", and the difference was a blank screen. Every Bookmarks
   screen holds on `ready`, and `ready` only became true when initSaves
   finished; signed out it never ran, so /bookmarks rendered an empty
   aria-busy section for ever. There is nothing saved, because there is nobody
   to have saved it, and the screen can say so: this settles the store with no
   rows and no student, and the designed empty state does the rest.

   Call it only once Clerk has actually answered. Called while it is still
   loading, a signed-in student sees the empty state flash before their own
   saves arrive. */
export function noStudent() { getClient = null; state = { ready: true, userId: null, rows: [], error: null }; emit(); }

export const findSave = (kind, refId, page = null) => state.rows.find((r) => keyOf(r.kind, r.ref_id, r.page) === keyOf(kind, refId, page));
export const isSaved = (kind, refId, page = null) => !!findSave(kind, refId, page);

async function withRetry(fn) {
  for (let i = 0; i < 3; i++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, offline: true };
    try { const r = await fn(); if (!r.error) return { ok: true, data: r.data }; console.error('[bookmarks]', r.error); }
    catch (e) { console.error('[bookmarks]', e); }
    await sleep([400, 1200, 3000][i]);
  }
  return { ok: false };
}
const failCopy = (res, verb) => (res.offline ? `You're offline, so that didn't ${verb}.` : `That didn't ${verb}. Try again in a moment.`);

/**
 * Save something. Instant on screen; synced after.
 * Saving the same lesson again moves its saved second; saving the same thing twice never makes two.
 * @param {{kind:Kind, moduleId:string, refId:string, chapter?:number|null, atSeconds?:number|null, page?:number|null}} s
 */
export async function addSave({ kind, moduleId, refId, chapter = null, atSeconds = null, page = null }, { quiet = false } = {}) {
  if (!state.userId) return { ok: false };
  const prev = findSave(kind, refId, page);
  const row = { id: prev?.id ?? newId(), user_id: state.userId, module_id: moduleId, kind, ref_id: String(refId), chapter, at_seconds: atSeconds, page, created_at: new Date().toISOString() };
  state.rows = [row, ...state.rows.filter((r) => r !== prev)]; emit();
  const res = await withRetry(async () => (await getClient()).from(TABLE).upsert(row, { onConflict: 'user_id,kind,ref_id,page' }).select().single());
  if (res.ok) {
    state.rows = state.rows.map((r) => (r === row ? res.data : r)); emit();
    track('save_added', { kind, moduleId });
    return { ok: true, row: res.data };
  }
  state.rows = state.rows.filter((r) => r !== row); if (prev) state.rows = [prev, ...state.rows]; emit();
  if (!quiet) toast(failCopy(res, 'save'), { action: { label: 'Retry', fn: () => addSave({ kind, moduleId, refId, chapter, atSeconds, page }) } });
  return { ok: false };
}

/** Save several at once (e.g. "Save the ones I missed"). One toast for the lot. */
export async function addMany(list) {
  const results = await Promise.all(list.map((s) => addSave(s, { quiet: true })));
  const failed = list.filter((_, i) => !results[i].ok);
  if (failed.length) toast(`${failed.length} didn't save. Try again in a moment.`, { action: { label: 'Retry', fn: () => addMany(failed) } });
  return { saved: list.length - failed.length, failed: failed.length };
}

/** Remove a save. Instant; the removed row is returned so the caller can offer Undo. */
export async function removeSave(row) {
  const had = state.rows.includes(row) ? row : state.rows.find((r) => r.id === row.id);
  if (!had) return { ok: true };
  const at = state.rows.indexOf(had);
  state.rows = state.rows.filter((r) => r !== had); emit();
  const res = await withRetry(async () => (await getClient()).from(TABLE).delete().eq('id', had.id));
  if (res.ok) { track('save_removed', { kind: had.kind }); return { ok: true, row: had }; }
  state.rows = [...state.rows.slice(0, at), had, ...state.rows.slice(at)]; emit();
  toast(failCopy(res, 'remove'), { action: { label: 'Retry', fn: () => removeSave(had) } });
  return { ok: false };
}

/** Undo for a removal: puts it back exactly as it was (same second, same page). */
export const restoreSave = (row) => addSave({ kind: row.kind, moduleId: row.module_id, refId: row.ref_id, chapter: row.chapter, atSeconds: row.at_seconds, page: row.page });

/** Saves whose content was deleted by the author are hidden by the screens; this clears them from the server quietly. */
export async function pruneMissing(missingRows) {
  if (!missingRows.length || !getClient) return;
  const ids = missingRows.map((r) => r.id);
  state.rows = state.rows.filter((r) => !ids.includes(r.id)); emit();
  try { await (await getClient()).from(TABLE).delete().in('id', ids); } catch (e) { console.error('[bookmarks] prune', e); }
}
