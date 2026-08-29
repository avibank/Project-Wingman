import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { initialSession, playerReducer, DEFAULT_BAR_POS } from "./lessonSurface.js";
import { useUserProgress } from "./userProgress.jsx";

// Session state for the lesson surface, and it lives ABOVE the router.
//
// That placement is the whole reason the mini player can exist. If any of this
// were created inside a lesson page component it would be torn down the first
// time anyone navigated, which is exactly the moment the feature has to keep
// working. The <video> node itself is mounted once by PlayerLayer, a sibling
// of the routed content, and is never re-parented — re-parenting a video
// restarts playback in every browser, and not restarting playback is the
// entire point.
//
// What persists and what does not, from the brief:
//   notes, threads, replies  -> the account, through the progress store
//   player.seconds           -> the account, per lesson (pw-lesson-pos)
//   tab, banner, composer    -> memory only
const NOTES_KEY = "pw-notes";
const THREADS_KEY = "pw-threads";
const REPLIES_KEY = "pw-replies";
const SEEN_KEY = "pw-thread-seen";
const SEEDED_KEY = "pw-lesson-seeded";
// Per account: someone who watches at 1.5 watches everything at 1.5, and
// re-choosing it every lesson is a small insult.
const RATE_KEY = "pw-rate";
const VOLUME_KEY = "pw-volume";
// Per DEVICE, not per account. Where you like the note bar depends on the
// screen in front of you, so it lives in localStorage like text size.
const BAR_POS_KEY = "pw-bar-pos";

const readBarPos = () => {
  try {
    const raw = localStorage.getItem(BAR_POS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.fx === "number" && typeof v.fy === "number" ? v : DEFAULT_BAR_POS;
  } catch { return DEFAULT_BAR_POS; }
};

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const progress = useUserProgress();
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [session, setSession] = useState(() => ({ ...initialSession, barPos: readBarPos() }));

  // What the lesson page is currently showing: its lesson, the empty slot the
  // player is positioned over, and the callbacks the player reports through.
  // Held in a ref as well as state because the player reads it every frame
  // while positioning and must not re-subscribe to do it.
  const [stage, setStageState] = useState(null);
  const stageRef = useRef(null);
  const setStage = useCallback((next) => { stageRef.current = next; setStageState(next); }, []);

  const dispatchPlayer = useCallback(
    (ev) => setSession((s) => ({ ...s, player: playerReducer(s.player, ev) })), []);

  // Notes, threads and replies are read once into session and written back on
  // every change. Session is the live copy so the surface re-renders on the
  // frame it changes; the store is the durable one.
  const loaded = progress.loaded;
  const hydrated = useRef(false);
  useEffect(() => {
    if (!loaded || hydrated.current) return;
    hydrated.current = true;
    setSession((s) => ({
      ...s,
      notes: progress.get(NOTES_KEY, []),
      threads: progress.get(THREADS_KEY, []),
      replies: progress.get(REPLIES_KEY, []),
      // Speed and volume follow the account across devices; the bar's position
      // does not, and was read from localStorage at mount.
      player: {
        ...s.player,
        rate: progress.get(RATE_KEY, 1),
        volume: progress.get(VOLUME_KEY, 1),
      },
    }));
  }, [loaded, progress]);

  // The seeded content's notes and threads are demo data, so they are written
  // once and then owned by the account like anything else — otherwise deleting
  // a seeded note would bring it back on the next reload.
  // Guarded by a ref as well as the stored flag, and the ref is the one that
  // matters. A failed write makes the provider revert every key in the patch —
  // right for a setting, wrong here: it deleted pw-lesson-seeded, so seedFrom
  // ran a second time and overwrote threads with the seed, taking a comment
  // somebody had just typed with it. Measured: post with the network down and
  // the row appeared, then vanished.
  const seeded = useRef(false);
  const seedFrom = useCallback((content) => {
    if (!content || !loaded || seeded.current || progress.get(SEEDED_KEY, false)) return;
    seeded.current = true;
    // Claim hydration before writing. Child effects run before the parent's,
    // so App's seed call lands FIRST and the hydrate effect below would then
    // read the store back — except progress.get reads React state, which lags
    // its own set by a render, so it read the empty value and wiped the seed.
    // The notes and threads vanished on the next load and the tabs lost their
    // counts. One of the two has to own the first write, and it is this one.
    hydrated.current = true;
    progress.set(SEEDED_KEY, true);
    progress.set(NOTES_KEY, content.notes || []);
    progress.set(THREADS_KEY, content.threads || []);
    progress.set(REPLIES_KEY, content.replies || []);
    setSession((s) => ({
      ...s,
      notes: content.notes || [],
      threads: content.threads || [],
      replies: content.replies || [],
    }));

    // The seeded watch state, so every route-row state is visible on a first
    // run — three lessons done, three part-watched, the rest untouched. Merged
    // rather than assigned: a lesson the account already has a position for
    // keeps it, so seeding can never overwrite real progress.
    const pos = { ...progress.get("pw-lesson-pos", {}) };
    let touched = false;
    for (const m of content.modules || []) {
      for (const c of m.chapters || []) {
        for (const l of c.lessons || []) {
          if (!l.watchedS || !l.durationS || pos[l.id]) continue;
          pos[l.id] = { pct: Math.min(1, l.watchedS / l.durationS) };
          touched = true;
        }
      }
    }
    if (touched) progress.set("pw-lesson-pos", pos);
  }, [loaded, progress]);

  // One writer per collection. `mutate` takes any of the pure functions from
  // lessonSurface.js — they all take a session and return a new one — applies
  // it, and persists whichever of the three collections it changed.
  const mutate = useCallback((fn) => {
    setSession((s) => {
      const next = fn(s);
      if (next === s) return s;
      if (next.notes !== s.notes) progress.set(NOTES_KEY, next.notes);
      if (next.threads !== s.threads) progress.set(THREADS_KEY, next.threads);
      if (next.replies !== s.replies) progress.set(REPLIES_KEY, next.replies);
      return next;
    });
  }, [progress]);

  // Optimistic posting, which is most of what "snappy" means in practice.
  //
  // The row is on screen the instant Post is pressed, marked pending, and the
  // store settles underneath. If the write fails the row STAYS and is marked
  // failed — never delete something a person typed — and Retry re-runs the
  // same write. The progress provider reverts its own state on a failed save,
  // which is right for a setting and wrong for a sentence someone wrote, so
  // the pending set is tracked here rather than inferred from the store.
  const [pending, setPending] = useState(() => ({}));
  const postOptimistic = useCallback((id, fn) => {
    setPending((m) => ({ ...m, [id]: "pending" }));
    mutate(fn);
    // The store batches and flushes on its own clock; one turn later it has
    // either taken the write or set saveError.
    setTimeout(() => {
      setPending((m) => {
        const next = { ...m };
        if (progressRef.current?.saveError) next[id] = "failed";
        else delete next[id];
        return next;
      });
    }, 900);
  }, [mutate]);
  const clearPending = useCallback((id) => {
    setPending((m) => { const n = { ...m }; delete n[id]; return n; });
  }, []);

  const markSeen = useCallback((threadId) => {
    const seen = progress.get(SEEN_KEY, {});
    progress.set(SEEN_KEY, { ...seen, [threadId]: new Date().toISOString() });
  }, [progress]);

  // Rows in both lists seek the video, and the video is owned by the layer.
  // The request travels as state so the two never hold references to each
  // other: the list asks for a second, the layer applies it and clears it.
  // The bar's position is written on drop rather than on every pointermove:
  // a drag is sixty writes a second otherwise.
  const setBarPos = useCallback((frac, persist) => {
    setSession((s) => ({ ...s, barPos: frac }));
    if (persist) { try { localStorage.setItem(BAR_POS_KEY, JSON.stringify(frac)); } catch { /* private mode */ } }
  }, []);

  const setRate = useCallback((rate) => {
    progress.set(RATE_KEY, rate);
    setSession((s) => ({ ...s, player: { ...s.player, rate } }));
  }, [progress]);

  const setVolume = useCallback((volume, muted) => {
    progress.set(VOLUME_KEY, volume);
    setSession((s) => ({ ...s, player: { ...s.player, volume, muted: muted ?? volume === 0 } }));
  }, [progress]);

  const requestSeek = useCallback(
    (seconds) => setSession((s) => ({ ...s, seekTo: { seconds, at: Date.now() } })), []);
  const clearSeek = useCallback(() => setSession((s) => ({ ...s, seekTo: null })), []);

  // "Watch at 2:17" from People. It travels as a pending target rather than a
  // seek, because the lesson has not mounted yet and its video has no duration
  // to seek within — the lesson page turns it into the same resume the player
  // already applies on loadedmetadata.
  const requestWatch = useCallback(
    (target) => setSession((s) => ({ ...s, watchAt: target })), []);
  const clearWatch = useCallback(() => setSession((s) => ({ ...s, watchAt: null })), []);

  const value = useMemo(() => ({
    session, setSession, mutate, dispatchPlayer,
    stage, setStage, stageRef,
    seedFrom, markSeen, requestSeek, clearSeek, requestWatch, clearWatch,
    setBarPos, setRate, setVolume, pending, postOptimistic, clearPending,
    lastSeen: progress.get(SEEN_KEY, {}),
    setTab: (tab) => setSession((s) => ({ ...s, tab })),
  }), [session, stage, mutate, dispatchPlayer, setStage, seedFrom, markSeen,
       requestSeek, clearSeek, requestWatch, clearWatch,
       setBarPos, setRate, setVolume, pending, postOptimistic, clearPending, progress]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
