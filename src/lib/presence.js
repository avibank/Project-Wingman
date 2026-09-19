import { supabase } from "./supabaseClient.js";
import { PRESENCE_WINDOW_MIN } from "./social.js";
import { isFlySolo } from "./flySolo.js";

// Presence via heartbeat rather than Realtime channels: one upsert on an
// interval, and "who is here" is a query for rows seen recently. No project
// level Realtime configuration required, and a dropped socket self-heals.
//
// THE WRITES GO TO `presence`; THE READS GO TO `presence_visible` (0032).
// That is not tidiness. Fly solo gates the write and deletes the row, which
// leaves nothing to read — per DEVICE. The gate is the localStorage mirror,
// and `pilot_profiles.invisible` is the account: turn it on on a phone and a
// laptop still open on a module keeps writing rows for somebody who asked to
// disappear, every forty-five seconds. The view drops anybody whose ACCOUNT
// says invisible, so a row written by a device that has not heard the news
// reaches nobody. Both ends, because one end is per-device.

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
    .from("presence_visible")
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
    .from("presence_visible")
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
  const { data, error } = await supabase.from("presence_visible").select("*").gte("last_seen", sinceIso());
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).filter((p) => p.user_id !== excludeUserId);
}
