import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "./supabaseClient.js";

// Shared helpers for the social layer.
//
// Author identity is snapshotted onto every row at write time (username, real
// name, and the author's display preference) so any reader can render the right
// name without a join — the same approach `comments.author` / `real_name`
// already uses.

export const PRESENCE_WINDOW_MIN = 3;
// Below this many recent users a module's presence/suggestions read as empty
// rather than sparse, so we show a neutral state instead.
export const MIN_POPULATION = 3;
// An annotation at or below this score collapses behind a "show anyway".
export const COLLAPSE_SCORE = -3;

// How a row's author should appear, honouring the preference they had set when
// they wrote it.
export function displayNameFor(row) {
  if (!row) return "Unknown";
  const pref = row.author_display_pref || "real";
  if (pref === "username") return row.author_username || "Pilot";
  return row.author_real_name || row.author_username || "Pilot";
}

// Identity fields to stamp on any row this user authors.
export function authorFields(user, prefs) {
  return {
    user_id: user?.id,
    author_username: user?.username || null,
    author_real_name: user?.fullName || null,
    author_display_pref: prefs?.identity_display || "real",
  };
}

function fail(error, fallback) {
  if (error) console.error(error);
  return fallback;
}

// ------------------------------------------------------------------ preferences
export async function fetchPrefs(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from("user_prefs").select("*").eq("user_id", userId).maybeSingle();
  if (error) return fail(error, null);
  return data;
}

export async function savePrefs(userId, patch) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_prefs")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return fail(error, null);
  return data;
}

// Loads the signed-in user's social preferences once and exposes a writer.
// Rows this user authors are stamped with `identity_display`, so the name a
// reader sees is the one the author chose at the time of writing.
export function useSocialPrefs() {
  const { isSignedIn, user } = useUser();
  const [prefs, setPrefs] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    if (!isSignedIn || !user?.id) {
      setPrefs(null);
      setLoaded(true);
      return;
    }
    fetchPrefs(user.id).then((row) => {
      if (!live) return;
      setPrefs(row || { user_id: user.id, accent_color: "blue", identity_display: "real", course: null });
      setLoaded(true);
    });
    return () => { live = false; };
  }, [isSignedIn, user?.id]);

  const update = useCallback(
    async (patch) => {
      if (!user?.id) return null;
      const saved = await savePrefs(user.id, patch);
      if (saved) setPrefs(saved);
      return saved;
    },
    [user?.id]
  );

  return { prefs, loaded, update };
}
