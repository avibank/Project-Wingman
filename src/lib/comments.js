import { supabase } from "./supabaseClient.js";

export async function fetchComments(chapterId) {
  const base = supabase.from("comments").select("*").order("created_at", { ascending: true });
  const { data, error } = chapterId ? await base.eq("chapter_id", chapterId) : await base.is("chapter_id", null);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function postComment(chapterId, author, text) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ chapter_id: chapterId, author, text })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function toggleReaction(comment, type, alreadyReacted) {
  const nextCount = Math.max(0, comment.reactions[type] + (alreadyReacted ? -1 : 1));
  const nextReactions = { ...comment.reactions, [type]: nextCount };
  const { error } = await supabase.from("comments").update({ reactions: nextReactions }).eq("id", comment.id);
  if (error) console.error(error);
  return nextReactions;
}

export function getGuestName() {
  return localStorage.getItem("pw-guest-name");
}

export function setGuestName(name) {
  localStorage.setItem("pw-guest-name", name);
}
