import { supabase } from "./supabaseClient.js";

/* DISCOVERY — the three routes a student who knows nobody takes to somebody.
 *
 * In order of how much they matter: an invite link a classmate pastes into the
 * group chat they already have, joining an open room, and noticing a person in
 * a thread they answered.
 *
 * EVERY PEOPLE-FACING READ HERE IS AN RPC, and that is the point rather than a
 * style choice. The browser holds the anon key and every table carries
 * `using (true)`, so a rule enforced in JavaScript is not enforced: PostgREST
 * will serve pilot_profiles to anyone who asks for it. Adding a
 * `.from("pilot_profiles")` query to this file to "make search faster" would
 * quietly undo every refusal below — see the header of 0011, and 0009 before
 * it, for why that is the shape.
 *
 * WHAT THOSE REFUSALS ARE CHANGED ON 2026-10-11, and this paragraph used to
 * name the wrong one. It said the rule was that "a person is only findable
 * inside the searcher's orbit" — 0011's `in_my_orbit`, which 0041 WITHDREW
 * for search after the owner looked for somebody he knew by name and by
 * username and got nothing back. What the function still refuses, and what
 * therefore still has to stay inside it: Fly solo, blocks both ways, 0011's
 * `discoverable`, and 0012's rule that a real name somebody chose not to show
 * is never matched on. Those are the reasons this is an RPC; orbit was only
 * ever one of them.
 */

const fail = (e, f) => { if (e) console.error(e); return f; };

/* Search. A registered student is findable by the name they go by or by their
   callsign, and the ORDER is the server's — what you typed comes first, then
   somebody you share a squadron with (0041). The client formats and does not
   sort, the same division as the leaderboard. An empty query returns nothing
   rather than everything: the function refuses a blank term too. */
export async function searchPeople(me, q) {
  if (!me || !q?.trim()) return [];
  const { data, error } = await supabase.rpc("people_search", { p_me: me, p_q: q });
  if (error) return fail(error, []);
  return data || [];
}

/* THE PEOPLE LIST — everyone, alphabetical by callsign (0041).
 *
 * NO NAMES AND NO COUNT, both by construction rather than by restraint. The
 * function has no column for a real name, so a roster of them cannot be read
 * off the side of the screen; and it returns rows with no total beside them,
 * because the owner asked for a directory that does not expose how few
 * students there might be (2026-10-11). A name arrives only when it was
 * searched for, or when a profile is opened — see searchPeople below.
 */
export async function browsePeople(me, limit = 400) {
  if (!me) return [];
  const { data, error } = await supabase.rpc("people_browse", { p_me: me, p_limit: limit });
  if (error) return fail(error, []);
  return data || [];
}

export async function searchSquadrons(q) {
  if (!q?.trim()) return [];
  const { data, error } = await supabase
    .from("squadrons")
    .select("id,name,blurb,module_code,join_policy")
    .not("name", "is", null)
    .ilike("name", `%${q.trim()}%`)
    .limit(20);
  if (error) return fail(error, []);
  return data || [];
}

export async function searchThreads(q) {
  if (!q?.trim()) return [];
  const { data, error } = await supabase
    .from("lesson_threads")
    .select("id,body,module_id,lesson_id,created_at")
    .ilike("body", `%${q.trim()}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return fail(error, []);
  return data || [];
}

/* Rooms you could join. `filter` is 'yours' | 'exam' | 'all' and is applied in
   the query rather than here, so the list is never larger than what you may
   see. Sorted by activity, not size. */
export async function discoverSquadrons(me, filter = "all") {
  if (!me) return [];
  const { data, error } = await supabase.rpc("discover_squadrons", { p_me: me, p_filter: filter });
  if (error) return fail(error, []);
  return data || [];
}

/* ONE DOOR IN. Capacity, blocks and the join policy are all decided by the
   function, so a second caller cannot get a different answer. The result is a
   word the caller renders: joined, requested, full, already_in, unavailable,
   invite_only, missing. "full" is an ordinary outcome rather than an error. */
export async function joinSquadron(me, squadronId) {
  if (!me || !squadronId) return "missing";
  const { data, error } = await supabase.rpc("join_squadron", { p_me: me, p_squadron: squadronId });
  if (error) return fail(error, "missing");
  return data || "missing";
}

/* Resolving an invite link. A revoked or expired token answers 'missing' on
   purpose: a link that says "this was revoked" tells a stranger the room is
   real. */
export async function squadronByInvite(me, token) {
  if (!token?.trim()) return null;
  const { data, error } = await supabase.rpc("squadron_by_invite", {
    p_me: me || "", p_token: token.trim(),
  });
  if (error) return fail(error, null);
  return (data && data[0]) || null;
}

/* AN ABSOLUTE URL. This returned `wingman.institute/j/<token>` — no scheme —
   and every caller stuck `https://` on the front by hand, which is a broken
   link the moment one of them forgets. It also meant the invite could not be
   handed to `navigator.share`, which requires a real URL. The origin is the
   one the student is actually on, so an invite copied from a preview deploy
   points at that preview rather than at production. */
export function inviteUrl(token) {
  const origin = (typeof window !== "undefined" && window.location?.origin)
    || "https://www.wingman.institute";
  return `${origin}/j/${token}`;
}

/* Person-to-person. An invite is a request the other person accepts — it never
   force-adds, so this writes a row and stops. */
export async function inviteToSquadron(me, squadronId, inviteeId) {
  if (!me || !squadronId || !inviteeId) return false;
  const { error } = await supabase.from("squadron_invites").upsert(
    { squadron_id: squadronId, inviter_id: me, invitee_id: inviteeId, state: "pending" },
    { onConflict: "squadron_id,invitee_id" },
  );
  if (error) return fail(error, false);
  return true;
}

/* CAPACITY IS NEVER A FRACTION. Not "8 of 32", no bar, no "24 spaces left". A
   group of eight is a squadron; shown as a fraction it becomes a half-empty
   one, and that framing is what kills small groups rather than their size. The
   only place a cap may surface is a Full button on a room that genuinely is.
   This function exists so there is one place that sentence is written. */
export function headcountLine(members, online) {
  const m = `${members} member${members === 1 ? "" : "s"}`;
  return online > 0 ? `${m} · ${online} online` : m;
}

/* The two things a room's own card says about how busy it is. Same rule. */
export function activityLine(members, activeWeek) {
  return `${members} member${members === 1 ? "" : "s"} · ${activeWeek} active this week`;
}

/* ONE DOOR OUT AS WELL AS IN. Creating a squadron makes the row, puts the
   maker in it as owner and mints the invite token in a single statement —
   0022's create_squadron. Two calls from the client would leave an ownerless
   room behind every time the second one failed, and discovery would then show
   it to strangers.

   Returns the new id, or null. Null covers the rate limit as well as a bad
   name: five rooms a day is enough for a class and not enough to fill the
   discovery screen with empties. */
export async function createSquadron(me, { name, moduleCode, blurb, policy } = {}) {
  if (!me || !name?.trim() || !moduleCode) return null;
  const { data, error } = await supabase.rpc("create_squadron", {
    p_me: me, p_name: name.trim(), p_module: moduleCode,
    p_blurb: blurb?.trim() || null, p_policy: policy || "invite_only",
  });
  if (error) return fail(error, null);
  return data || null;
}

export async function renameSquadron(me, squadronId, name, blurb) {
  if (!me || !squadronId || !name?.trim()) return false;
  const { data, error } = await supabase.rpc("rename_squadron", {
    p_me: me, p_squadron: squadronId, p_name: name.trim(), p_blurb: blurb ?? null,
  });
  if (error) return fail(error, false);
  return Boolean(data);
}

/* A fresh link, and the old one stops working the moment this returns. The
   control behind "somebody shared it who shouldn't have". */
export async function revokeInvite(me, squadronId) {
  const { data, error } = await supabase.rpc("revoke_invite", { p_me: me, p_squadron: squadronId });
  if (error) return fail(error, null);
  return data || null;
}

/* The token out of a pasted link, whatever shape it arrives in: a full URL, a
   bare path, or the eight characters on their own. Somebody pasting from a
   group chat gets whatever their phone put on the clipboard. */
export function tokenFromLink(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const m = s.match(/(?:\/j\/|^)([A-Za-z0-9]{6,16})\/?$/);
  return m ? m[1] : null;
}
