import { supabase } from "./supabaseClient.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { stageFor } from "./backstop.js";

// §7.7 — "Call a wingman". Soft and non-urgent: never "Mayday". The aviation
// flavour lives in the motion, not in an emergency word.

const fail = (e, f) => { if (e) console.error(e); return f; };

export async function createCall({ userId, chapterId, questionId = null, body = null }) {
  const { data, error } = await supabase
    .from("calls")
    .insert({ user_id: userId, chapter_id: chapterId, question_id: questionId, body })
    .select()
    .single();
  if (error) return fail(error, null);
  return data;
}

export async function fetchMyCalls(userId, chapterId = null) {
  if (!userId) return [];
  let q = supabase.from("calls").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (chapterId) q = q.eq("chapter_id", chapterId);
  const { data, error } = await q;
  if (error) return fail(error, []);
  return (data || []).filter((c) => c.user_id === userId && (!chapterId || c.chapter_id === chapterId));
}

// Open calls this user could answer, minus anyone blocked in either direction
// and anyone they have muted (§9).
export async function fetchAnswerableCalls(userId, chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from("calls").select("*").eq("chapter_id", chapterId).eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) return fail(error, []);
  const [blocked, muted] = userId
    ? await Promise.all([fetchBlocks(userId), fetchMutes(userId)])
    : [[], []];
  const hidden = new Set([...blocked, ...muted, userId]);
  return (data || []).filter(
    (c) => c.chapter_id === chapterId && c.status === "open" && !hidden.has(c.user_id)
  );
}

export async function fetchResponses(callId) {
  const { data, error } = await supabase
    .from("call_responses").select("*").eq("call_id", callId).order("created_at", { ascending: true });
  if (error) return fail(error, []);
  return (data || []).filter((r) => r.call_id === callId);
}

export async function respondToCall({ callId, userId, body }) {
  const text = (body || "").trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from("call_responses").insert({ call_id: callId, user_id: userId, body: text }).select().single();
  if (error) return fail(error, null);
  // A call with an answer is no longer waiting. Closing it here is what stops
  // the backstop from nudging anyone about a question already answered.
  await supabase.from("calls").update({ status: "answered" }).eq("id", callId);
  return data;
}

export async function postCallToComms(call, moduleCode) {
  const { error } = await supabase.from("comms_messages").insert({
    module_code: moduleCode,
    user_id: call.user_id,
    body: call.body,
    chapter_id: call.chapter_id,
  });
  if (error) return fail(error, false);
  await supabase.from("calls").update({ status: "posted" }).eq("id", call.id);
  return true;
}

// §7.7 stage 3 — never let a call silently expire. This is what the caller is
// shown, and it is derived, so it is right even with no scheduler running.
export function callState(call, responseCount = 0, now = Date.now()) {
  if (!call) return null;
  if (call.status === "answered" || responseCount > 0) return "answered";
  if (call.status === "posted") return "posted";
  const stage = stageFor(call, now);
  return stage >= 3 ? "unanswered" : "waiting";
}
