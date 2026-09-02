import { supabase } from "./supabaseClient.js";

/* DISCOVERY — the three routes a student who knows nobody takes to somebody.
 *
 * In order of how much they matter: an invite link a classmate pastes into the
 * group chat they already have, joining an open room, and noticing a person in
 * a thread they answered.
 *
 * EVERY PEOPLE-FACING READ HERE IS AN RPC, and that is the point rather than a
 * style choice. The browser holds the anon key and every table carries
 * `using (true)`, so a scope enforced in JavaScript is not enforced: PostgREST
 * will serve pilot_profiles to anyone who asks for it. The rule that a person
 * is only findable inside the searcher's orbit lives in 0011 as a function
 * that cannot return a stranger. Adding a `.from("pilot_profiles")` query to
 * this file to "make search faster" would quietly undo it — see the header of
 * 0011, and 0009 before it, for why that is the shape.
 */

const fail = (e, f) => { if (e) console.error(e); return f; };

/* Search. Squadrons and threads are searchable broadly; people are not, and
   the scoping is the server's. An empty query returns nothing rather than
   everything — the function refuses a blank term for the same reason. */
export async function searchPeople(me, q) {
  if (!me || !q?.trim()) return [];
  const { data, error } = await supabase.rpc("people_search", { p_me: me, p_q: q });
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

export function inviteUrl(token) {
  return `wingman.institute/j/${token}`;
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
