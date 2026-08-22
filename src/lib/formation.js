import { supabase } from "./supabaseClient.js";
import { MAX_FORMATION } from "./formationRail.js";

// §7.9 — a temporary shared session on one chapter, 2-6 people. It ends when
// the last person leaves. Nobody is ever removed for falling behind.

const fail = (e, f) => { if (e) console.error(e); return f; };

export async function fetchOpenFormation(chapterId) {
  if (!chapterId) return null;
  const { data, error } = await supabase
    .from("formations").select("*").eq("chapter_id", chapterId).is("ended_at", null)
    .order("started_at", { ascending: false }).limit(1);
  if (error) return fail(error, null);
  const rows = (data || []).filter((f) => f.chapter_id === chapterId && !f.ended_at);
  return rows[0] || null;
}

export async function fetchMembers(formationId) {
  if (!formationId) return [];
  const { data, error } = await supabase
    .from("formation_members").select("*").eq("formation_id", formationId).is("left_at", null);
  if (error) return fail(error, []);
  return (data || []).filter((m) => m.formation_id === formationId && !m.left_at);
}

export async function startFormation({ chapterId, moduleCode, squadronId, userId }) {
  const { data, error } = await supabase
    .from("formations")
    .insert({ chapter_id: chapterId, module_code: moduleCode, squadron_id: squadronId || null })
    .select().single();
  if (error) return fail(error, null);
  await joinFormation(data.id, userId);
  return data;
}

export async function joinFormation(formationId, userId) {
  const members = await fetchMembers(formationId);
  // §7.9 caps a formation at six. A seventh join is refused, not silently
  // accepted and then hidden by a slice() in the rail.
  if (members.length >= MAX_FORMATION) return { ok: false, reason: "full" };
  if (members.some((m) => m.user_id === userId)) return { ok: true, reason: "already-in" };
  const { error } = await supabase
    .from("formation_members").insert({ formation_id: formationId, user_id: userId });
  if (error) return { ok: false, reason: "error" };
  return { ok: true };
}

export async function leaveFormation(formationId, userId) {
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("formation_members").update({ left_at: at })
    .match({ formation_id: formationId, user_id: userId });
  if (error) return fail(error, false);
  // Ends when the last person leaves — checked here rather than left to a job,
  // so an abandoned formation never lingers as a live one nobody is in.
  const left = await fetchMembers(formationId);
  if (!left.length) await supabase.from("formations").update({ ended_at: at }).eq("id", formationId);
  return true;
}

// Questions attempted per user on this chapter — the rail's notion of position.
export async function fetchChapterPositions(userIds = [], chapterId) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !chapterId) return {};
  const { data, error } = await supabase
    .from("question_attempts").select("user_id, question_id, chapter_id")
    .eq("chapter_id", chapterId).in("user_id", ids);
  if (error) return fail(error, {});
  const seen = {};
  for (const r of data || []) {
    if (r.chapter_id !== chapterId) continue;
    (seen[r.user_id] = seen[r.user_id] || new Set()).add(r.question_id);
  }
  return Object.fromEntries(ids.map((id) => [id, seen[id]?.size || 0]));
}

// §7.3 — Formation is one of Traffic's three item types: someone opened a live
// session, with a Join button and the faces of who is in it.
export async function fetchOpenFormationsForModule(moduleCode) {
  if (!moduleCode) return [];
  const { data, error } = await supabase
    .from("formations").select("*").eq("module_code", moduleCode).is("ended_at", null)
    .order("started_at", { ascending: false });
  if (error) return fail(error, []);
  const open = (data || []).filter((f) => f.module_code === moduleCode && !f.ended_at);
  const withMembers = await Promise.all(
    open.map(async (f) => ({ ...f, members: await fetchMembers(f.id) }))
  );
  // A formation nobody is in is over, whether or not anything closed it.
  return withMembers.filter((f) => f.members.length > 0);
}
