import { supabase } from "./supabaseClient.js";
import { PRESENCE_WINDOW_MIN } from "./social.js";
import { isFlySolo } from "./flySolo.js";

// Presence via heartbeat rather than Realtime channels: one upsert on an
// interval, and "who is here" is a query for rows seen recently. No project
// level Realtime configuration required, and a dropped socket self-heals.

export async function heartbeat({ userId, displayName, moduleCode, chapterId }) {
  if (!userId) return;
  // Fly solo — nobody sees where you are. Enforced at the write, not at the
  // read, so there is nothing to leak. This used to read the key directly and
  // nothing ever wrote it, so it never fired; flySolo.js owns the mirror now.
  if (isFlySolo()) {
    await clearPresence(userId);
    return;
  }
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
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
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
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
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
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
  const { data, error } = await supabase.from("presence").select("*").gte("last_seen", sinceIso());
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).filter((p) => p.user_id !== excludeUserId);
}
