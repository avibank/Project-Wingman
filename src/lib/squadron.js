import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";
import { hueFor } from "./familiar.js";

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
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return null;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("squadron_members")
    .select("squadron_id, squadrons!inner(id, module_code, status, study_time)")
    .eq("user_id", userId)
    .eq("squadrons.module_code", moduleCode)
    .maybeSingle();
  if (error) return fail(error, null);
  return data?.squadrons || null;
}

export async function fetchRoster(userId, squadronId) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
  if (!squadronId) return [];
  const { data, error } = await supabase.rpc("squadron_roster", { uid: userId, sid: squadronId });
  if (error) return fail(error, []);
  return data || [];
}

// The onboarding gate needs to tell "this user has no profile yet" apart from
// "the query failed". Conflating them would trap every user in onboarding for
// as long as the table is missing -- which is exactly the state before 0005
// runs. fetchProfile collapses both to null, so the gate uses this instead.
export async function fetchProfileStatus(userId) {
  if (!userId) return { profile: null, failed: true };
  const { data, error } = await supabase
    .from("pilot_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) { console.error(error); return { profile: null, failed: true }; }
  return { profile: data || null, failed: false };
}

// Names and staff badges for a set of user ids, so a presence rail can label
// each face. Missing rows simply have no profile yet.
export async function fetchProfiles(ids = []) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return {};
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("user_id, callsign, is_staff")
    .in("user_id", unique);
  if (error) return fail(error, {});
  return Object.fromEntries((data || []).map((r) => [r.user_id, r]));
}

// §5 — the radar's radial distance is how far ahead or behind someone is in
// this module, so it needs a real percentage per member. Anyone with no
// completions is genuinely at 0, not missing.
export async function fetchModuleProgress(userIds = [], moduleCode, totalChapters = 0) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !moduleCode || !totalChapters) return {};
  const { data, error } = await supabase
    .from("chapter_completions")
    .select("user_id, chapter_id, module_code")
    .eq("module_code", moduleCode)
    .in("user_id", ids);
  if (error) return fail(error, {});
  const seen = {};
  for (const row of data || []) {
    if (row.module_code !== moduleCode) continue;         // belt and braces
    (seen[row.user_id] = seen[row.user_id] || new Set()).add(row.chapter_id);
  }
  return Object.fromEntries(
    ids.map((id) => [id, Math.round(((seen[id]?.size || 0) / totalChapters) * 100)])
  );
}

// §7.1 screen 1 shows real pilots who are already flying. If there are none
// yet, it returns an empty list and the screen says what to do next -- it never
// backfills. §1, non-negotiable 3.
export async function fetchRecentPilots(userId, limit = 8) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("user_id, callsign, is_staff, study_time, created_at")
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
// Two members within 13° of hue: the later joiner takes the next marking.
//
// The hue is hueFor(user_id) — the same deterministic per-person colour the
// rest of the app uses. It used to be the presence temperature of a livery the
// pilot chose at signup, which meant six possible hues clustered between 20°
// and 70°, so almost everybody collided with almost everybody.
export function assignMarkings(roster) {
  const out = [];
  for (const member of [...roster].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))) {
    const hue = hueFor(member.user_id);
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
