import { supabase } from "./supabaseClient.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { TEAM_MAX } from "./teams.js";

// §9.4 — the Ready Room's data. A room, not a feed: everything here is present
// tense, and the squawk list is what makes it never empty.

const fail = (e, f) => { if (e) console.error(e); return f; };

// §10 — "Don't ship a social surface where it's empty. Turn it on per module
// once there's content." A module with no social surface is fine; one with a
// visibly abandoned surface is not.
export async function socialEnabledModules() {
  const { data, error } = await supabase.from("module_social").select("module_code, enabled");
  if (error) return fail(error, null);   // null = table missing, caller decides
  return new Set((data || []).filter((r) => r.enabled).map((r) => r.module_code));
}

// §9.4 band 2 — unanswered questions from every chapter, with context attached.
export async function fetchOpenSquawks(userId, moduleCode = null, limit = 20) {
  let q = supabase.from("open_squawks").select("*").limit(limit);
  if (moduleCode) q = q.eq("module_code", moduleCode);
  const { data, error } = await q;
  if (error) return fail(error, []);
  const [blocked, muted] = userId
    ? await Promise.all([fetchBlocks(userId), fetchMutes(userId)])
    : [[], []];
  const hidden = new Set([...blocked, ...muted]);
  return (data || [])
    .filter((s) => !hidden.has(s.user_id))
    .filter((s) => !moduleCode || s.module_code === moduleCode);
}

// §9.3.4 — only the person who asked decides what answered it, which is why
// this goes through the RPC rather than a bare update.
export async function markAnswer(answerId, questionId, userId) {
  const { data, error } = await supabase.rpc("mark_answer", {
    answer_id: answerId, question_id: questionId, marker: userId,
  });
  if (error) return fail(error, false);
  return data === true;
}

export async function setQuestion(messageId, isQuestion) {
  const { error } = await supabase.from("comms_messages").update({ is_question: isQuestion }).eq("id", messageId);
  return !fail(error, true);
}

// §11 — only CFI standing may mark an explanation verified.
export async function markVerified(messageId, byUserId) {
  const { error } = await supabase
    .from("comms_messages")
    .update({ is_verified: true, verified_by: byUserId })
    .eq("id", messageId);
  return !fail(error, false);
}

// ------------------------------------------------------------- §9.4.3 teams
export async function fetchMyTeams(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(id, name, module_code, created_at)")
    .eq("user_id", userId);
  if (error) return fail(error, []);
  // One row comes back per membership, so a team appears once per member it
  // has. Dedupe by id rather than trusting the filter to have done it.
  const byId = new Map();
  for (const r of data || []) if (r.teams) byId.set(r.teams.id, r.teams);
  return [...byId.values()];
}

export async function fetchTeamMembers(teamId) {
  if (!teamId) return [];
  const { data, error } = await supabase.from("team_members").select("*").eq("team_id", teamId);
  if (error) return fail(error, []);
  const seen = new Set();
  return (data || []).filter((m) => {
    if (m.team_id !== teamId || seen.has(m.user_id)) return false;
    seen.add(m.user_id);
    return true;
  });
}

export async function createTeam({ name, moduleCode, userId }) {
  const trimmed = (name || "").trim();
  if (!trimmed || !userId) return null;
  const { data, error } = await supabase
    .from("teams").insert({ name: trimmed, module_code: moduleCode || null, created_by: userId })
    .select().single();
  if (error) return fail(error, null);
  await supabase.from("team_members").insert({ team_id: data.id, user_id: userId });
  return data;
}

export async function joinTeam(teamId, userId) {
  const members = await fetchTeamMembers(teamId);
  // §9.4.3 caps a team at six. A seventh is refused rather than accepted and
  // then hidden by a slice() in the roster.
  if (members.length >= TEAM_MAX) return { ok: false, reason: "full" };
  if (members.some((m) => m.user_id === userId)) return { ok: true, reason: "already-in" };
  const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
  return error ? { ok: false, reason: "error" } : { ok: true };
}

export async function leaveTeam(teamId, userId) {
  const { error } = await supabase.from("team_members").delete().match({ team_id: teamId, user_id: userId });
  if (error) return fail(error, false);
  // A team nobody is in is over.
  const left = await fetchTeamMembers(teamId);
  if (!left.length) await supabase.from("teams").delete().eq("id", teamId);
  return true;
}

// Per-module completion percentages for everyone named, for §9.4's
// complementary matching.
export async function fetchProgressByModule(userIds = [], moduleTotals = {}) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("chapter_completions").select("user_id, module_code, chapter_id").in("user_id", ids);
  if (error) return fail(error, {});
  const seen = {};
  for (const r of data || []) {
    const u = (seen[r.user_id] = seen[r.user_id] || {});
    (u[r.module_code] = u[r.module_code] || new Set()).add(r.chapter_id);
  }
  const out = {};
  for (const id of ids) {
    out[id] = {};
    for (const [code, total] of Object.entries(moduleTotals)) {
      const n = seen[id]?.[code]?.size || 0;
      if (n) out[id][code] = Math.round((n / total) * 100);
    }
  }
  return out;
}
