import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "./supabaseClient.js";
import { loadJSON, saveJSON } from "./storage.js";

// Progress state, shared.
//
// This used to be a bare hook that every component called independently. Each
// caller then held its own copy of the whole progress object and wrote that
// whole object back, so a write from one component deleted keys another had
// saved — completing a chapter and then changing any setting discarded the
// completion. Two changes stop that:
//
//   1. Writes send only the keys that changed, through merge_progress, which
//      merges server-side. A stale caller can no longer delete anything.
//   2. One provider holds the state for the whole tree, so reads cannot drift
//      apart in the first place.

// Keys that hold something a person wrote, rather than something they chose.
// A failed save must never revert one of these — see flush() below.
const AUTHORED = new Set([
  "pw-notes",
  "pw-threads",
  "pw-replies",
  "pw-logbook",
  "pw-quiz-run",
]);

const ProgressContext = createContext(null);

function useProgressState() {
  const { isSignedIn, user } = useUser();
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const pending = useRef({});
  const timer = useRef(null);
  // What the server last confirmed, so a failed write has something to go back
  // to that is not just "whatever was on screen before".
  const lastServer = useRef({});
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    if (isSignedIn && user) {
      supabase
        .from("user_progress")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data: row, error }) => {
          if (!active) return;
          if (error) console.error(error);
          setData(row?.data || {});
          lastServer.current = row?.data || {};
          setLoaded(true);
        });
    } else {
      setData({});
      setLoaded(true);
    }
    return () => {
      active = false;
    };
  }, [isSignedIn, user?.id]);

  // Coalesce rapid writes into one patch, then merge it server-side.
  const flush = useCallback(() => {
    if (!user?.id) return;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    // Applying first means a failed save leaves the UI ahead of the server, so
    // a failure has to put something back. WHAT it puts back depends on what
    // the key holds, and that distinction is the whole of this branch:
    //
    //   a preference — reverting is right. Someone toggled a switch, it did not
    //   save, and leaving it on would be a lie about the stored state.
    //
    //   something a person WROTE — reverting is destruction. A note, a comment,
    //   a reply: putting the key back to what the server last had deletes the
    //   sentence they just typed because a network dropped. It is kept, the
    //   patch is queued to try again, and the surface shows it as unsent.
    //
    // This was reachable and it did happen: posting a comment with the write
    // path failing made the row appear and then vanish, because the revert took
    // pw-lesson-seeded with it and the seed was written back over the threads.
    const before = lastServer.current;
    supabase.rpc("merge_progress", { uid: user.id, patch }).then(({ error }) => {
      if (error) {
        console.error(error);
        const authored = Object.keys(patch).filter((k) => AUTHORED.has(k));
        const settings = Object.keys(patch).filter((k) => !AUTHORED.has(k));
        setData((prev) => {
          const reverted = { ...prev };
          for (const k of settings) {
            if (before[k] === undefined) delete reverted[k];
            else reverted[k] = before[k];
          }
          return reverted;
        });
        // Authored keys go back on the queue rather than being thrown away, so
        // the next write — or a Retry — carries them again. Anything already
        // queued since wins, because it is newer.
        if (authored.length) {
          const requeue = {};
          for (const k of authored) requeue[k] = patch[k];
          pending.current = { ...requeue, ...pending.current };
        }
        setSaveError(settings.length
          ? "That did not save. Your last change has been put back."
          : "That did not save yet. Nothing you wrote has been lost.");
      } else {
        lastServer.current = { ...lastServer.current, ...patch };
        setSaveError(null);
      }
    });
  }, [user?.id]);

  // Every setting applies on the frame it is changed, before anything is
  // saved. This is the whole fix for "changing a preference does nothing until
  // you navigate", and the bug was here rather than in any one control: the
  // signed-in branch was already optimistic, and the signed-out branch wrote
  // to localStorage and touched no React state at all — so nothing re-rendered
  // until something else happened to. Both branches now move state first and
  // persist afterwards.
  const set = useCallback(
    (key, value) => {
      setData((prev) => ({ ...prev, [key]: value }));
      if (isSignedIn) {
        pending.current = { ...pending.current, [key]: value };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 500);
      } else {
        saveJSON(key, value);
      }
    },
    [isSignedIn, flush]
  );

  // Signed out, state is the live copy and localStorage is the durable one:
  // read state first so a value just written is visible on this render, and
  // fall back to storage for anything not yet touched this session.
  const get = useCallback(
    (key, fallback) => {
      if (data[key] !== undefined) return data[key];
      if (isSignedIn) return fallback;
      return loadJSON(key, fallback);
    },
    [isSignedIn, data]
  );

  // App.jsx called this on "reset all progress"; it never existed, so the
  // reset threw and silently did nothing for signed-in users.
  const resetAll = useCallback(async () => {
    if (!isSignedIn || !user?.id) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = {};
    const { error } = await supabase.from("user_progress").delete().eq("user_id", user.id);
    if (error) console.error(error);
    setData({});
  }, [isSignedIn, user?.id]);

  // Don't lose a queued patch if the tab closes mid-debounce.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  return { get, set, loaded, isSignedIn, resetAll, saveError };
}

export function UserProgressProvider({ children }) {
  const value = useProgressState();
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useUserProgress() {
  const ctx = useContext(ProgressContext);
  // Standalone fallback keeps the hook usable outside the provider (tests,
  // isolated previews) without reintroducing shared-state divergence in the app.
  const standalone = useProgressState();
  return ctx || standalone;
}
