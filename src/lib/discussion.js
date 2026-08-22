import { supabase } from "./supabaseClient.js";
import { authorFields } from "./social.js";

// Threaded, chapter-anchored discussion. Any user subscribed to the chapter's
// module can read and post — there is no approval step.
//
// This is separate from the legacy flat `comments` table, which backs the
// module-wide Discussion tab. Threads live here.

export async function fetchThreads({ chapterId = null, moduleCode = null, limit = 30 } = {}) {
  let q = supabase.from("discussion_threads").select("*").order("last_activity_at", { ascending: false }).limit(limit);
  if (chapterId) q = q.eq("chapter_id", chapterId);
  else if (moduleCode) q = q.eq("module_code", moduleCode);
  const { data, error } = await q;
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function fetchThreadsForModules(moduleCodes, limit = 30) {
  if (!moduleCodes?.length) return [];
  const { data, error } = await supabase
    .from("discussion_threads")
    .select("*")
    .in("module_code", moduleCodes)
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function countThreads(chapterId) {
  if (!chapterId) return 0;
  const { count, error } = await supabase
    .from("discussion_threads")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);
  if (error) {
    console.error(error);
    return 0;
  }
  return count || 0;
}

export async function createThread({ chapterId, moduleCode, title, body, user, prefs }) {
  if (!user?.id || !title?.trim()) return null;
  const { data, error } = await supabase
    .from("discussion_threads")
    .insert({
      chapter_id: chapterId,
      module_code: moduleCode,
      title: title.trim(),
      body: body?.trim() || null,
      ...authorFields(user, prefs),
    })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function fetchPosts(threadId) {
  if (!threadId) return [];
  const { data, error } = await supabase
    .from("discussion_posts")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function addPost({ threadId, parentId = null, body, user, prefs, isAdmin = false }) {
  if (!user?.id || !body?.trim()) return null;
  const { data, error } = await supabase
    .from("discussion_posts")
    .insert({ thread_id: threadId, parent_id: parentId, is_admin: isAdmin, body: body.trim(), ...authorFields(user, prefs) })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// Replies to things this user wrote — the "your activity" stream on Social.
export async function fetchRepliesToUser(userId, limit = 20) {
  if (!userId) return [];
  const { data: mine, error: e1 } = await supabase.from("discussion_threads").select("id,title").eq("user_id", userId);
  if (e1) {
    console.error(e1);
    return [];
  }
  const ids = (mine || []).map((t) => t.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("discussion_posts")
    .select("*")
    .in("thread_id", ids)
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(error);
    return [];
  }
  const titles = Object.fromEntries((mine || []).map((t) => [t.id, t.title]));
  return (data || []).map((p) => ({ ...p, thread_title: titles[p.thread_id] }));
}

export async function deletePost(id, userId) {
  const { error } = await supabase.from("discussion_posts").delete().eq("id", id).eq("user_id", userId);
  if (error) console.error(error);
  return !error;
}

// Re-voting the same way clears the vote, matching the notebook's behaviour.
export async function votePost(postId, userId, value) {
  if (!userId) return 0;
  if (value === 0) {
    const { error } = await supabase.from("post_votes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) console.error(error);
    return 0;
  }
  const { error } = await supabase
    .from("post_votes")
    .upsert({ post_id: postId, user_id: userId, value }, { onConflict: "post_id,user_id" });
  if (error) console.error(error);
  return value;
}

export async function fetchMyPostVotes(userId, postIds) {
  if (!userId || !postIds?.length) return {};
  const { data, error } = await supabase.from("post_votes").select("post_id,value").eq("user_id", userId).in("post_id", postIds);
  if (error) {
    console.error(error);
    return {};
  }
  return Object.fromEntries((data || []).map((r) => [r.post_id, r.value]));
}

// Flat rows -> a reply tree the UI can indent.
export function buildTree(posts) {
  const byId = new Map(posts.map((p) => [p.id, { ...p, replies: [] }]));
  const roots = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  });
  return roots;
}

// ---------------------------------------------------------- reaction chips
// Chips are a two-second way to take part: a tap, not a paragraph.
export const REACTION_KINDS = [
  { kind: "same", label: "Same" },
  { kind: "good_catch", label: "Good catch" },
  { kind: "confused", label: "Still confused" },
];

export async function fetchReactions(postIds) {
  if (!postIds?.length) return {};
  const { data, error } = await supabase.from("post_reactions").select("post_id,user_id,kind").in("post_id", postIds);
  if (error) {
    console.error(error);
    return {};
  }
  const out = {};
  for (const r of data || []) {
    out[r.post_id] = out[r.post_id] || {};
    out[r.post_id][r.kind] = (out[r.post_id][r.kind] || 0) + 1;
  }
  return out;
}

export async function fetchMyReactions(userId, postIds) {
  if (!userId || !postIds?.length) return {};
  const { data, error } = await supabase.from("post_reactions").select("post_id,kind").eq("user_id", userId).in("post_id", postIds);
  if (error) {
    console.error(error);
    return {};
  }
  const out = {};
  for (const r of data || []) {
    out[r.post_id] = out[r.post_id] || new Set();
    out[r.post_id].add(r.kind);
  }
  return out;
}

export async function toggleReactionChip(postId, userId, kind, on) {
  if (!userId) return false;
  if (on) {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId).eq("kind", kind);
    if (error) console.error(error);
    return !error;
  }
  const { error } = await supabase
    .from("post_reactions")
    .upsert({ post_id: postId, user_id: userId, kind }, { onConflict: "post_id,user_id,kind" });
  if (error) console.error(error);
  return !error;
}
