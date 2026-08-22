import { supabase } from "./supabaseClient.js";
import { PRESENCE_WINDOW_MIN } from "./social.js";

// Presence via heartbeat rather than Realtime channels: one upsert on an
// interval, and "who is here" is a query for rows seen recently. No project
// level Realtime configuration required, and a dropped socket self-heals.

export async function heartbeat({ userId, displayName, moduleCode, chapterId }) {
  if (!userId) return;
  const { error } = await supabase.from("presence").upsert(
    {
      user_id: userId,
      display_name: displayName || null,
      module_code: moduleCode || null,
      chapter_id: chapterId || null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error(error);
}

export async function clearPresence(userId) {
  if (!userId) return;
  await supabase.from("presence").delete().eq("user_id", userId);
}

function sinceIso() {
  return new Date(Date.now() - PRESENCE_WINDOW_MIN * 60000).toISOString();
}

export async function fetchChapterPresence(chapterId, excludeUserId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from("presence")
    .select("*")
    .eq("chapter_id", chapterId)
    .gte("last_seen", sinceIso());
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).filter((p) => p.user_id !== excludeUserId);
}

export async function fetchModulePresence(moduleCode, excludeUserId) {
  if (!moduleCode) return [];
  const { data, error } = await supabase
    .from("presence")
    .select("*")
    .eq("module_code", moduleCode)
    .gte("last_seen", sinceIso());
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).filter((p) => p.user_id !== excludeUserId);
}

export async function fetchAllPresence(excludeUserId) {
  const { data, error } = await supabase.from("presence").select("*").gte("last_seen", sinceIso());
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).filter((p) => p.user_id !== excludeUserId);
}
