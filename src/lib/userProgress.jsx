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

const ProgressContext = createContext(null);

function useProgressState() {
  const { isSignedIn, user } = useUser();
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const pending = useRef({});
  const timer = useRef(null);

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
    supabase.rpc("merge_progress", { uid: user.id, patch }).then(({ error }) => {
      if (error) console.error(error);
    });
  }, [user?.id]);

  const set = useCallback(
    (key, value) => {
      if (isSignedIn) {
        setData((prev) => ({ ...prev, [key]: value }));
        pending.current = { ...pending.current, [key]: value };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 500);
      } else {
        saveJSON(key, value);
      }
    },
    [isSignedIn, flush]
  );

  const get = useCallback(
    (key, fallback) => {
      if (isSignedIn) return data[key] !== undefined ? data[key] : fallback;
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

  return { get, set, loaded, isSignedIn, resetAll };
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
