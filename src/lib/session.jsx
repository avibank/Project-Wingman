import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { initialSession, playerReducer } from "./lessonSurface.js";
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

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const progress = useUserProgress();
  const [session, setSession] = useState(initialSession);

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
    }));
  }, [loaded, progress]);

  // The seeded content's notes and threads are demo data, so they are written
  // once and then owned by the account like anything else — otherwise deleting
  // a seeded note would bring it back on the next reload.
  const seedFrom = useCallback((content) => {
    if (!content || !loaded || progress.get(SEEDED_KEY, false)) return;
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

  const markSeen = useCallback((threadId) => {
    const seen = progress.get(SEEN_KEY, {});
    progress.set(SEEN_KEY, { ...seen, [threadId]: new Date().toISOString() });
  }, [progress]);

  // Rows in both lists seek the video, and the video is owned by the layer.
  // The request travels as state so the two never hold references to each
  // other: the list asks for a second, the layer applies it and clears it.
  const requestSeek = useCallback(
    (seconds) => setSession((s) => ({ ...s, seekTo: { seconds, at: Date.now() } })), []);
  const clearSeek = useCallback(() => setSession((s) => ({ ...s, seekTo: null })), []);

  const value = useMemo(() => ({
    session, setSession, mutate, dispatchPlayer,
    stage, setStage, stageRef,
    seedFrom, markSeen, requestSeek, clearSeek,
    lastSeen: progress.get(SEEN_KEY, {}),
    setTab: (tab) => setSession((s) => ({ ...s, tab })),
  }), [session, stage, mutate, dispatchPlayer, setStage, seedFrom, markSeen,
       requestSeek, clearSeek, progress]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
