import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { fetchAllPresence } from "./presence.js";
import { rightSeatCandidates } from "./roomModel.js";

/* ============================================================================
   The Ready Room's shared data — squadrons, their chat, and the right seat.

   These were `squadrons={[]} messages={[]}` in App.jsx: the room rendered its
   own empty states correctly and there was simply nothing behind them. The
   tables have existed since 0005.

   WHAT THE CHAT IS. comms_messages with a squadron_id set. The same table
   carries the module-wide channel (squadron_id null), which is why every read
   here is explicit about the column rather than filtering in JavaScript
   afterwards — a missing `.not("squadron_id", "is", null)` would quietly pour
   the whole module channel into one squadron's room.

   FLY SOLO IS SYMMETRIC, and it is enforced in this file rather than at the
   call sites, so no future caller can forget it and leak.
   ========================================================================= */

const fail = (e, f) => { if (e) console.error(e); return f; };

const toMessage = (r) => ({
  id: r.id, squadronId: r.squadron_id, body: r.body,
  authorId: r.user_id, createdAt: r.created_at,
});

/* Who this account cannot see, in one round trip, so each read below does not
   make the same two queries over again. */
async function hiddenFor(me) {
  if (!me) return new Set();
  const [blocked, muted] = await Promise.all([fetchBlocks(me), fetchMutes(me)]);
  return new Set([...blocked, ...muted]);
}

/* Every squadron this account is in, across every module, each with its roster
   and the last thing said in it.

   Across every module deliberately: the room is global — that is the whole
   point of it being the Ready Room and not a per-module tab — so a squadron
   does not disappear from the sidebar because you happen to be looking at a
   different module today. */
export async function fetchMySquadrons(me) {
  if (isFlySolo() || !me) return [];

  const { data: mine, error: e1 } = await supabase
    .from("squadron_members")
    .select("squadron_id, squadrons!inner(id, module_code, status, study_time)")
    .eq("user_id", me);
  if (e1) return fail(e1, []);

  const ids = [...new Set((mine || []).map((r) => r.squadron_id))];
  if (!ids.length) return [];

  const [{ data: members, error: e2 }, hidden] = await Promise.all([
    supabase.from("squadron_members").select("squadron_id, user_id, marking, joined_at").in("squadron_id", ids),
    hiddenFor(me),
  ]);
  if (e2) return fail(e2, []);

  // The last message per squadron, for the sidebar's preview line. One query
  // for all of them rather than one per squadron.
  const { data: recent } = await supabase
    .from("comms_messages")
    .select("squadron_id, body, created_at")
    .in("squadron_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  const preview = new Map();
  for (const m of recent || []) {
    if (!preview.has(m.squadron_id) && m.body) preview.set(m.squadron_id, m.body);
  }

  return (mine || []).map((r) => {
    const sq = r.squadrons;
    return {
      id: sq.id,
      // Identity is the module, which is what the roster screen already
      // calls it. Inventing a names table here would be a second owner of the
      // same fact.
      name: `${sq.module_code} squadron`,
      code: sq.module_code,
      moduleCode: sq.module_code,
      status: sq.status,
      preview: preview.get(sq.id) || null,
      members: (members || [])
        .filter((m) => m.squadron_id === sq.id && !hidden.has(m.user_id))
        .map((m) => ({ user_id: m.user_id, marking: m.marking, joined_at: m.joined_at })),
    };
  });
}

/* The chat in every squadron this account is in. Ordered oldest-first, because
   it is read as a transcript and not as a feed. */
export async function fetchSquadronMessages(me, squadronIds = [], limit = 300) {
  if (isFlySolo() || !me || !squadronIds.length) return [];
  const { data, error } = await supabase
    .from("comms_messages")
    .select("id, squadron_id, user_id, body, created_at")
    .in("squadron_id", squadronIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error, []);
  const hidden = await hiddenFor(me);
  return (data || [])
    .filter((r) => r.squadron_id && r.body && !hidden.has(r.user_id))
    .map(toMessage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function postSquadronMessage({ me, squadronId, moduleCode, body }) {
  const text = (body || "").trim();
  if (!text || !me || !squadronId) return null;
  // No client-side id here, unlike a thread: comms_messages.id is a uuid with
  // a default, so the row takes the one Postgres makes and the insert returns
  // it. The chat is posted-then-shown rather than optimistic — a chat message
  // that has not landed yet is a much smaller loss than a question that has
  // not, and pretending otherwise would need a second id space.
  const { data, error } = await supabase
    .from("comms_messages")
    .insert({ squadron_id: squadronId, module_code: moduleCode || "", user_id: me, body: text })
    .select().single();
  if (error) return fail(error, null);
  return toMessage(data);
}

/* §7 — who is in the room right now that you actually share a squadron with.

   This calls right_seat() rather than reading presence and filtering here.
   The rule now exists in exactly one place, in SQL (0009), and a caller that
   forgets to filter cannot get a stranger back because there is no unfiltered
   version to call. That matters: the room HAD already forgotten once, handing
   the raw presence list straight to the view.

   The client-side rightSeatCandidates stays as the fallback below, for a
   database that has not had 0009 run against it yet — same rule, same
   sentence, and the migration is what makes it authoritative. */
export async function fetchRightSeat(me, squadrons = []) {
  if (isFlySolo() || !me) return [];

  const { data, error } = await supabase.rpc("right_seat", { p_me: me });
  if (!error) {
    return (data || []).map((r) => ({
      user_id: r.user_id, squadronId: r.squadron_id,
      module_code: r.module_code, chapter_id: r.chapter_id, last_seen: r.last_seen,
    }));
  }

  // 0009 not run here. Fall back to the same boundary in JavaScript rather
  // than to no boundary — an empty right seat is a worse lie than a slower
  // one, and an unfiltered one is not an option.
  console.error(error);
  const [presence, blocked] = await Promise.all([fetchAllPresence(me), fetchBlocks(me)]);
  const members = [];
  for (const sq of squadrons) {
    members.push({ squadron_id: sq.id, user_id: me });
    for (const m of sq.members || []) members.push({ squadron_id: sq.id, user_id: m.user_id });
  }
  return rightSeatCandidates({ me, members, presence: presence || [], blocked });
}
