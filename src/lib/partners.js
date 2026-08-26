import { supabase } from "./supabaseClient.js";
import { MIN_POPULATION } from "./social.js";
import { fetchModulePresence, fetchAllPresence } from "./presence.js";
import { isFlySolo } from "./flySolo.js";

// Study partners, wingmen, and the co-pilot flight log.
//
// Everything here is a suggestion. Nothing auto-groups users, there is no
// accept/decline handshake, and identity is always shown — matching is ambient
// visibility, not a request someone has to answer.

// A pair is stored with the two ids sorted so it has exactly one row whichever
// side writes it.
function pairKey(a, b) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

// ------------------------------------------------------------------- wingmen
export async function fetchWingmen(userId) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
  if (!userId) return [];
  const { data, error } = await supabase.from("wingmen").select("*").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function addWingman(userId, wingmanUserId, displayName) {
  if (!userId || !wingmanUserId || userId === wingmanUserId) return false;
  const { error } = await supabase
    .from("wingmen")
    .upsert({ user_id: userId, wingman_user_id: wingmanUserId, display_name: displayName || null }, { onConflict: "user_id,wingman_user_id" });
  if (error) console.error(error);
  return !error;
}

export async function removeWingman(userId, wingmanUserId) {
  const { error } = await supabase.from("wingmen").delete().eq("user_id", userId).eq("wingman_user_id", wingmanUserId);
  if (error) console.error(error);
  return !error;
}

// ------------------------------------------------------------- joint streaks
// The shared streak only advances on a day both pilots studied.
export async function recordStudyDay(userId, wingmanUserId) {
  if (!userId || !wingmanUserId) return null;
  const key = pairKey(userId, wingmanUserId);
  const today = new Date().toISOString().slice(0, 10);
  const isA = key.user_a === userId;

  const { data: row } = await supabase
    .from("wingman_streaks")
    .select("*")
    .eq("user_a", key.user_a)
    .eq("user_b", key.user_b)
    .maybeSingle();

  const next = {
    ...key,
    current: row?.current ?? 0,
    longest: row?.longest ?? 0,
    last_day: row?.last_day ?? null,
    a_studied_on: isA ? today : row?.a_studied_on ?? null,
    b_studied_on: isA ? row?.b_studied_on ?? null : today,
  };

  // Both sides in on the same day: advance if it follows the last counted day.
  if (next.a_studied_on === today && next.b_studied_on === today && next.last_day !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    next.current = next.last_day === yesterday ? next.current + 1 : 1;
    next.longest = Math.max(next.longest, next.current);
    next.last_day = today;
  }

  const { data, error } = await supabase
    .from("wingman_streaks")
    .upsert(next, { onConflict: "user_a,user_b" })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function fetchJointStreak(userId, wingmanUserId) {
  if (!userId || !wingmanUserId) return null;
  const key = pairKey(userId, wingmanUserId);
  const { data, error } = await supabase
    .from("wingman_streaks")
    .select("*")
    .eq("user_a", key.user_a)
    .eq("user_b", key.user_b)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// ------------------------------------------------------- live co-pilot sessions
export async function startCopilotSession({ moduleCode, chapterId, user, displayName }) {
  const { data, error } = await supabase
    .from("copilot_sessions")
    .insert({ module_code: moduleCode, chapter_id: chapterId || null })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  await joinCopilotSession(data.id, user?.id, displayName);
  return data;
}

export async function joinCopilotSession(sessionId, userId, displayName) {
  if (!sessionId || !userId) return false;
  const { error } = await supabase
    .from("copilot_participants")
    .upsert({ session_id: sessionId, user_id: userId, display_name: displayName || null }, { onConflict: "session_id,user_id" });
  if (error) console.error(error);
  return !error;
}

export async function leaveCopilotSession(sessionId, userId) {
  if (!sessionId || !userId) return;
  await supabase
    .from("copilot_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
}

export async function fetchOpenSessions(moduleCode) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return [];
  let q = supabase.from("copilot_sessions").select("*, participants:copilot_participants(*)").is("ended_at", null);
  if (moduleCode) q = q.eq("module_code", moduleCode);
  const { data, error } = await q.order("started_at", { ascending: false }).limit(20);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

// Flight log: derived entirely from co-pilot session data, never hand-logged.
export async function fetchFlightLog(userId) {
  if (!userId) return [];
  const { data: mine, error } = await supabase.from("copilot_participants").select("session_id,joined_at,left_at").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  const ids = (mine || []).map((r) => r.session_id);
  if (!ids.length) return [];

  const { data: others } = await supabase.from("copilot_participants").select("*").in("session_id", ids).neq("user_id", userId);
  const durations = Object.fromEntries(
    (mine || []).map((r) => [r.session_id, r.left_at ? (new Date(r.left_at) - new Date(r.joined_at)) / 60000 : 0])
  );

  const byPartner = new Map();
  for (const row of others || []) {
    const entry = byPartner.get(row.user_id) || { userId: row.user_id, displayName: row.display_name, sessions: 0, minutes: 0 };
    entry.sessions += 1;
    entry.minutes += Math.round(durations[row.session_id] || 0);
    entry.displayName = entry.displayName || row.display_name;
    byPartner.set(row.user_id, entry);
  }
  return [...byPartner.values()].sort((a, b) => b.sessions - a.sessions);
}

// ---------------------------------------------------------------- suggestions
// Course/class match outranks pace. Below the population floor we return a
// neutral empty signal rather than a thin, sad-looking list.
export async function fetchPartnerSuggestions({ userId, moduleCode, course }) {
  // Fly solo is symmetric: you see nobody. Gated here rather than in each
  // component, so no caller can forget and leak.
  if (isFlySolo()) return { belowThreshold: true, active: 0, suggestions: [] };
  const present = moduleCode ? await fetchModulePresence(moduleCode, userId) : await fetchAllPresence(userId);
  if (present.length < MIN_POPULATION) {
    return { belowThreshold: true, active: present.length, suggestions: [] };
  }

  const ids = present.map((p) => p.user_id);
  const { data: prefs } = await supabase.from("user_prefs").select("user_id,course").in("user_id", ids);
  const courseById = Object.fromEntries((prefs || []).map((p) => [p.user_id, p.course]));

  const suggestions = present
    .map((p) => {
      const sameCourse = course && courseById[p.user_id] && courseById[p.user_id] === course;
      return {
        userId: p.user_id,
        displayName: p.display_name,
        moduleCode: p.module_code,
        chapterId: p.chapter_id,
        // Course match is the strong signal; presence alone is the fallback.
        reason: sameCourse ? `Same class · studying ${p.module_code || "now"}` : `Studying ${p.module_code || "now"}`,
        weight: sameCourse ? 2 : 1,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  return { belowThreshold: false, active: present.length, suggestions };
}

// ------------------------------------------------- shared-completion bump
// "You and your wingman finished this within the day" — answerable only now
// that completions carry a timestamp.
export async function recordCompletion(userId, chapterId, moduleCode) {
  if (!userId || !chapterId) return;
  const { error } = await supabase
    .from("chapter_completions")
    .upsert({ user_id: userId, chapter_id: chapterId, module_code: moduleCode }, { onConflict: "user_id,chapter_id" });
  if (error) console.error(error);
}

export async function fetchSharedCompletions(me, them, windowHours = 24) {
  if (!me || !them) return [];
  const { data, error } = await supabase.rpc("shared_completions", { me, them, window_hours: windowHours });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

// Your own completions, with the timestamps chapter_completions now carries.
export async function fetchMyCompletions(userId, moduleCode) {
  if (!userId) return [];
  let q = supabase.from("chapter_completions").select("*").eq("user_id", userId);
  if (moduleCode) q = q.eq("module_code", moduleCode);
  const { data, error } = await q.order("completed_at", { ascending: false }).limit(30);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}
