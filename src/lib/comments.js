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
export async function fetchRecentActivity(limit = 10) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}
export async function postComment(chapterId, author, text, userId = null, imageUrl = null, realName = null, isAdmin = false) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ chapter_id: chapterId, author, text, user_id: userId, image_url: imageUrl, real_name: realName, is_admin: isAdmin })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
export async function uploadCommentPhoto(file) {
  if (!file.type.startsWith("image/")) {
    return { error: "Only image files can be attached." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Photo is too large (max 5MB)." };
  }
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("comment-photos").upload(path, file);
  if (uploadError) {
    console.error(uploadError);
    return { error: "Upload failed, please try again." };
  }
  const { data } = supabase.storage.from("comment-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}
export async function toggleReaction(comment, type, alreadyReacted) {
  const nextCount = Math.max(0, comment.reactions[type] + (alreadyReacted ? -1 : 1));
  const nextReactions = { ...comment.reactions, [type]: nextCount };
  const { error } = await supabase.from("comments").update({ reactions: nextReactions }).eq("id", comment.id);
  if (error) console.error(error);
  return nextReactions;
}
export async function deleteComment(id) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}
export const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export function canEditComment(comment, currentUserId) {
  if (!currentUserId || comment.user_id !== currentUserId) return false;
  return Date.now() - new Date(comment.created_at).getTime() < EDIT_WINDOW_MS;
}
export async function updateCommentText(id, text) {
  const { data, error } = await supabase.from("comments").update({ text }).eq("id", id).select().single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}
