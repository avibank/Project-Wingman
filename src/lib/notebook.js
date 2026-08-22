import { supabase } from "./supabaseClient.js";
import { authorFields } from "./social.js";

// Notebook annotations: chapter-level notes from students, sitting alongside the
// locked official study material (which lives in data.js and is not editable here).

export async function fetchAnnotations(chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from("notebook_annotations")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function countAnnotations(chapterId) {
  if (!chapterId) return 0;
  const { count, error } = await supabase
    .from("notebook_annotations")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);
  if (error) {
    console.error(error);
    return 0;
  }
  return count || 0;
}

export async function addAnnotation({ chapterId, moduleCode, body, user, prefs }) {
  if (!user?.id || !body?.trim()) return null;
  const { data, error } = await supabase
    .from("notebook_annotations")
    .insert({ chapter_id: chapterId, module_code: moduleCode, body: body.trim(), ...authorFields(user, prefs) })
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// Only the author may edit their own annotation; enforced here and in the UI.
export async function updateAnnotation(id, userId, body) {
  const { data, error } = await supabase
    .from("notebook_annotations")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function deleteAnnotation(id, userId) {
  const { error } = await supabase.from("notebook_annotations").delete().eq("id", id).eq("user_id", userId);
  if (error) console.error(error);
  return !error;
}

// --------------------------------------------------------------------- votes
// Votes drive sort order only. Re-voting the same way clears the vote.
export async function castVote(annotationId, userId, value) {
  if (!userId) return null;
  const { data: existing } = await supabase
    .from("annotation_votes")
    .select("value")
    .eq("annotation_id", annotationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing && existing.value === value) {
    const { error } = await supabase.from("annotation_votes").delete().eq("annotation_id", annotationId).eq("user_id", userId);
    if (error) console.error(error);
    return 0;
  }
  const { error } = await supabase
    .from("annotation_votes")
    .upsert({ annotation_id: annotationId, user_id: userId, value }, { onConflict: "annotation_id,user_id" });
  if (error) console.error(error);
  return value;
}

export async function fetchMyVotes(userId, annotationIds) {
  if (!userId || !annotationIds?.length) return {};
  const { data, error } = await supabase
    .from("annotation_votes")
    .select("annotation_id,value")
    .eq("user_id", userId)
    .in("annotation_id", annotationIds);
  if (error) {
    console.error(error);
    return {};
  }
  return Object.fromEntries((data || []).map((r) => [r.annotation_id, r.value]));
}

// --------------------------------------------------------------------- flags
// Distinct from a downvote, and anonymous to the author: nothing here is ever
// surfaced back to the annotation's owner.
export async function flagAnnotation(annotationId, userId, reason) {
  if (!userId) return false;
  const { error } = await supabase
    .from("annotation_flags")
    .upsert({ annotation_id: annotationId, user_id: userId, reason: reason || null }, { onConflict: "annotation_id,user_id" });
  if (error) {
    console.error(error);
    return false;
  }
  await supabase.from("notebook_annotations").update({ status: "under_review" }).eq("id", annotationId).eq("status", "ok");
  return true;
}

// Admin/instructor review queue.
export async function fetchFlagQueue() {
  const { data, error } = await supabase
    .from("annotation_flags")
    .select("*, annotation:notebook_annotations(*)")
    .eq("resolved", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function resolveFlag(annotationId, status, correctionNote) {
  const { error } = await supabase
    .from("notebook_annotations")
    .update({ status, correction_note: correctionNote || null, updated_at: new Date().toISOString() })
    .eq("id", annotationId);
  if (error) console.error(error);
  await supabase.from("annotation_flags").update({ resolved: true }).eq("annotation_id", annotationId);
  return !error;
}

// ------------------------------------------------------- personal show / hide
export async function fetchHides(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("notebook_hides").select("*").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export async function setChapterHidden(userId, chapterId, hidden, scope = "permanent") {
  if (!userId) return false;
  if (!hidden) {
    const { error } = await supabase.from("notebook_hides").delete().eq("user_id", userId).eq("chapter_id", chapterId);
    if (error) console.error(error);
    return !error;
  }
  const { error } = await supabase
    .from("notebook_hides")
    .upsert({ user_id: userId, chapter_id: chapterId, scope }, { onConflict: "user_id,chapter_id" });
  if (error) console.error(error);
  return !error;
}

export async function dismissAnnotation(userId, annotationId, scope = "permanent") {
  if (!userId) return false;
  const { error } = await supabase
    .from("annotation_dismissals")
    .upsert({ user_id: userId, annotation_id: annotationId, scope }, { onConflict: "annotation_id,user_id" });
  if (error) console.error(error);
  return !error;
}

export async function fetchDismissals(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("annotation_dismissals").select("*").eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

// Session-scoped rows are cleared on app open so they reset next launch.
export async function clearSessionScoped(userId) {
  if (!userId) return;
  await supabase.from("notebook_hides").delete().eq("user_id", userId).eq("scope", "session");
  await supabase.from("annotation_dismissals").delete().eq("user_id", userId).eq("scope", "session");
}
