import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "./supabaseClient.js";
import { loadJSON, saveJSON } from "./storage.js";

export function useUserProgress() {
  const { isSignedIn, user } = useUser();
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);

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

  const persist = useCallback(
    (nextData) => {
      if (!isSignedIn || !user) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        supabase
          .from("user_progress")
          .upsert(
            { user_id: user.id, data: nextData, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          )
          .then(({ error }) => {
            if (error) console.error(error);
          });
      }, 500);
    },
    [isSignedIn, user]
  );

  const get = useCallback(
    (key, fallback) => {
      if (isSignedIn) {
        return data[key] !== undefined ? data[key] : fallback;
      }
      return loadJSON(key, fallback);
    },
    [isSignedIn, data]
  );

  const set = useCallback(
    (key, value) => {
      if (isSignedIn) {
        setData((prev) => {
          const next = { ...prev, [key]: value };
          persist(next);
          return next;
        });
      } else {
        saveJSON(key, value);
      }
    },
    [isSignedIn, persist]
  );

  return { get, set, loaded, isSignedIn };
}
