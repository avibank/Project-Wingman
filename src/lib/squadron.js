import { supabase } from "./supabaseClient.js";

// Squadrons, profiles and safety. §7.1, §8.3, §9.
//
// Nothing here ever invents a member. A squadron short of ten is `forming` and
// the UI is required to say so plainly rather than padding the roster.

export const TARGET_SQUADRON = 12;
export const MIN_ACTIVE = 10;
export const MARKINGS = ["solid", "double", "dashed", "notched"];

const fail = (e, f) => { if (e) console.error(e); return f; };

// ------------------------------------------------------------------ profile
export async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from("pilot_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) return fail(error, null);
  return data;
}

export async function saveProfile(userId, patch) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("pilot_profiles")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return fail(error, null);
  return data;
}

// ---------------------------------------------------------------- squadron
export async function assignSquadron(userId, moduleCode, studyTime) {
  if (!userId || !moduleCode) return null;
  const { data, error } = await supabase.rpc("assign_squadron", { uid: userId, mod: moduleCode, stime: studyTime || null });
  if (error) return fail(error, null);
  return data;
}

export async function fetchSquadron(userId, moduleCode) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("squadron_members")
    .select("squadron_id, squadrons!inner(id, module_code, livery, status, study_time)")
    .eq("user_id", userId)
    .eq("squadrons.module_code", moduleCode)
    .maybeSingle();
  if (error) return fail(error, null);
  return data?.squadrons || null;
}

export async function fetchRoster(userId, squadronId) {
  if (!squadronId) return [];
  const { data, error } = await supabase.rpc("squadron_roster", { uid: userId, sid: squadronId });
  if (error) return fail(error, []);
  return data || [];
}

// Liveries for a set of user ids, so a presence rail can paint each face in
// its owner's own tail. Missing rows simply have no profile yet.
export async function fetchProfiles(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("user_id, callsign, livery, is_staff")
    .in("user_id", unique);
  if (error) return fail(error, {});
  return Object.fromEntries((data || []).map((r) => [r.user_id, r]));
}

// §7.1 screen 1 shows real pilots who are already flying. If there are none
// yet, it returns an empty list and the screen says what to do next -- it never
// backfills. §1, non-negotiable 3.
export async function fetchRecentPilots(userId, limit = 8) {
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("user_id, callsign, livery, is_staff, study_time, created_at")
    .eq("invisible", false)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (error) return fail(error, []);
  const blocked = userId ? await fetchBlocks(userId) : [];
  return (data || [])
    .filter((p) => p.user_id !== userId && !blocked.includes(p.user_id))
    .slice(0, limit)
    .map((p) => ({ ...p, joined_at: p.created_at }));
}

// §7.1 — a Forming squadron shows real members at full size and renders the
// remainder as visibly empty seats. Never a placeholder that suggests a person.
export function seatLayout(roster, target = TARGET_SQUADRON) {
  const filled = roster.length;
  return {
    filled,
    target,
    forming: filled < MIN_ACTIVE,
    openSeats: Math.max(0, target - filled),
    label: `Your squadron is forming — ${filled} of ${target} seats filled. We'll add pilots as they arrive, and tell you when someone lands.`,
  };
}

// §2.9 — collisions are resolved with markings, never by reassigning a hue.
// Two members within 13° of warm hue: the later joiner takes the next marking.
export function assignMarkings(roster, hueOf) {
  const out = [];
  for (const member of [...roster].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))) {
    const hue = hueOf(member.livery);
    const clash = out.filter((o) => {
      const d = Math.abs(o.hue - hue);
      return Math.min(d, 360 - d) < 13;
    });
    const used = new Set(clash.map((c) => c.marking));
    out.push({ ...member, hue, marking: MARKINGS.find((m) => !used.has(m)) || "solid" });
  }
  return out;
}

// ------------------------------------------------------------------ safety
// §9 — blocking is symmetric and total.
export async function blockUser(userId, blockedId) {
  const { error } = await supabase.from("blocks").upsert({ user_id: userId, blocked_id: blockedId }, { onConflict: "user_id,blocked_id" });
  return !fail(error, true);
}
export async function unblockUser(userId, blockedId) {
  const { error } = await supabase.from("blocks").delete().eq("user_id", userId).eq("blocked_id", blockedId);
  return !fail(error, true);
}
export async function fetchBlocks(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("blocks").select("blocked_id").eq("user_id", userId);
  if (error) return fail(error, []);
  return (data || []).map((r) => r.blocked_id);
}
export async function muteUser(userId, mutedId) {
  const { error } = await supabase.from("mutes").upsert({ user_id: userId, muted_id: mutedId }, { onConflict: "user_id,muted_id" });
  return !fail(error, true);
}
export async function unmuteUser(userId, mutedId) {
  const { error } = await supabase.from("mutes").delete().eq("user_id", userId).eq("muted_id", mutedId);
  return !fail(error, true);
}
export async function fetchMutes(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("mutes").select("muted_id").eq("user_id", userId);
  if (error) return fail(error, []);
  return (data || []).map((r) => r.muted_id);
}
export async function reportContent({ reporterId, targetType, targetId, reason, chapterId, channelId }) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId, target_type: targetType, target_id: targetId,
    reason: reason || null, chapter_id: chapterId || null, channel_id: channelId || null,
  });
  return !fail(error, true);
}
