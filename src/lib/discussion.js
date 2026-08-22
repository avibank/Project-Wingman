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

export async function addPost({ threadId, body, user, prefs }) {
  if (!user?.id || !body?.trim()) return null;
  const { data, error } = await supabase
    .from("discussion_posts")
    .insert({ thread_id: threadId, body: body.trim(), ...authorFields(user, prefs) })
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
