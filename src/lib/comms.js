import { supabase } from "./supabaseClient.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { CHAPTER_OPENERS } from "../data/openers.js";

// §7.8 — a channel, not a forum. No threads, no upvotes, no accepted answers,
// no karma. The only aviation-native additions are the chapter chip, pinning a
// message to a chapter, and filtering the channel to the chapter you are on.

const fail = (e, f) => { if (e) console.error(e); return f; };

export async function fetchMessages({ moduleCode, chapterId = null, userId, limit = 100 }) {
  let q = supabase
    .from("comms_messages")
    .select("*")
    .eq("module_code", moduleCode)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (chapterId) q = q.eq("chapter_id", chapterId);
  const { data, error } = await q;
  if (error) return fail(error, []);

  // §9 — muted senders are hidden from you here; blocked users are hidden in
  // both directions everywhere, so they are filtered too.
  const [muted, blocked] = userId
    ? await Promise.all([fetchMutes(userId), fetchBlocks(userId)])
    : [[], []];
  const hidden = new Set([...muted, ...blocked]);
  // Sorted here rather than trusting the query's ordering to survive: the log
  // reads oldest-first, and a reversed channel is not subtly wrong, it is
  // unreadable.
  return (data || [])
    .filter((m) => !hidden.has(m.user_id))
    .filter((m) => !chapterId || m.chapter_id === chapterId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function sendMessage({ moduleCode, squadronId = null, userId, body, chapterId = null }) {
  const text = (body || "").trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from("comms_messages")
    .insert({ module_code: moduleCode, squadron_id: squadronId, user_id: userId, body: text, chapter_id: chapterId })
    .select()
    .single();
  if (error) return fail(error, null);
  return data;
}

export async function fetchPinned(moduleCode, chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from("comms_messages")
    .select("*")
    .eq("module_code", moduleCode)
    .eq("pinned_to", chapterId)
    .order("created_at", { ascending: true });
  if (error) return fail(error, []);
  return (data || [])
    .filter((m) => m.pinned_to === chapterId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function pinToChapter(messageId, chapterId) {
  const { error } = await supabase.from("comms_messages").update({ pinned_to: chapterId }).eq("id", messageId);
  return !fail(error, true);
}

export async function unpin(messageId) {
  const { error } = await supabase.from("comms_messages").update({ pinned_to: null }).eq("id", messageId);
  return !fail(error, true);
}

export async function fetchReactions(messageIds = []) {
  if (!messageIds.length) return {};
  const { data, error } = await supabase.from("comms_reactions").select("*").in("message_id", messageIds);
  if (error) return fail(error, {});
  const out = {};
  for (const r of data || []) {
    out[r.message_id] = out[r.message_id] || {};
    out[r.message_id][r.emoji] = (out[r.message_id][r.emoji] || 0) + 1;
  }
  return out;
}

export async function fetchMyReactions(userId, messageIds = []) {
  if (!userId || !messageIds.length) return {};
  const { data, error } = await supabase
    .from("comms_reactions").select("message_id, emoji").eq("user_id", userId).in("message_id", messageIds);
  if (error) return fail(error, {});
  const out = {};
  for (const r of data || []) (out[r.message_id] = out[r.message_id] || new Set()).add(r.emoji);
  return out;
}

export async function toggleReaction(messageId, userId, emoji, on) {
  if (!userId) return;
  const { error } = on
    ? await supabase.from("comms_reactions").delete().match({ message_id: messageId, user_id: userId, emoji })
    : await supabase.from("comms_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  fail(error, null);
}

export { GROUP_WINDOW_MS, groupMessages } from "./commsGrouping.js";

// §8.1 — the app speaks first, but only through the RPC. The quiet check and
// the insert must be one statement: done client-side they race, and two people
// opening a quiet channel at the same moment both post. Until 0006 has run this
// fails soft and no opener appears, which is the correct behaviour — the
// feature simply is not live.
export async function maybePostOpener(moduleCode, chapterId) {
  const opener = CHAPTER_OPENERS[chapterId];
  if (!moduleCode || !opener) return null;
  const { data, error } = await supabase.rpc("post_opener_if_quiet", {
    mod: moduleCode, chap: chapterId, opener,
  });
  if (error) return fail(error, null);
  return data || null;
}

// §9 — the client asks the database for permission. A refusal is a real answer,
// not an error to swallow.
export async function takeRateSlot(userId, kind, perHour) {
  if (!userId) return false;
  const { data, error } = await supabase.rpc("rate_limit_take", {
    uid: userId, k: kind, per_hour: perHour,
  });
  // If the function is missing -- 0006 not run -- do not block the user.
  if (error) { console.error(error); return true; }
  return data !== false;
}
