import { supabase } from "./supabaseClient.js";

// Per-question outcomes and the aggregate built from them.
//
// The aggregate goes through an RPC that returns counts only, so showing
// "N pilots also missed this" never pulls anyone's individual answers into the
// browser.

export async function recordAttempt({ userId, questionId, chapterId, correct }) {
  if (!userId || !questionId) return;
  const { error } = await supabase
    .from("question_attempts")
    .insert({ user_id: userId, question_id: questionId, chapter_id: chapterId, correct });
  if (error) console.error(error);
}

export async function fetchMissStats(questionId) {
  if (!questionId) return null;
  const { data, error } = await supabase.rpc("question_miss_stats", { q_id: questionId });
  if (error) {
    console.error(error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { attempts: Number(row.attempts || 0), missers: Number(row.missers || 0) };
}
