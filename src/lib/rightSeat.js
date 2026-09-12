import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";

/* ============================================================================
   THE RIGHT SEAT — the position, and the person in it.

   The copilot is a STATE, not a screen. It adds a face and a dot to surfaces
   that already exist; it never adds a nav item. This file is the state's only
   owner: who you are flying with, where each of you is, and the two requests
   waiting on an answer.

   WHAT IS DELIBERATELY NOT HERE: any way to make somebody your copilot without
   them agreeing. request_right_seat writes a request; answer_right_seat is the
   only thing that opens a session, and only the person asked may call it.
   Everything below is a thin wrapper over those functions for exactly the
   reason 0009 and 0011 give — the browser holds the anon key, so a rule the
   client enforces is not a rule.

   THE HOUR. A seat nobody has touched for an hour empties itself. That is
   expire_right_seats(), and it is called opportunistically from load() rather
   than from a scheduler: the person who opens the room is the person who needs
   the answer to be current, and a cron job for it would be a second owner of
   the same fact.
   ========================================================================= */

const fail = (e, f) => { if (e) console.error(e); return f; };

/* Everything the right-seat screen needs, in one round trip. Returns null when
   the seat is empty, which is the ordinary state and not an error. */
export async function fetchSeat(me) {
  if (isFlySolo() || !me) return null;
  const { data, error } = await supabase.rpc("my_seat", { p_me: me });
  if (error) return fail(error, null);
  const r = (data || [])[0];
  if (!r) return null;
  return {
    sessionId: r.session_id,
    partnerId: r.partner_id,
    partnerModule: r.partner_module || null,
    partnerPlace: r.partner_place || null,
    partnerSince: r.partner_since || null,
    startedAt: r.started_at,
    lastActiveAt: r.last_active_at,
  };
}

/* Both directions. An incoming request is something to answer; an outgoing one
   is what turns "Ask to fly" into "Asked — waiting", and that label has to be
   true rather than hopeful. */
export async function fetchSeatRequests(me) {
  if (isFlySolo() || !me) return { in: [], out: [] };
  const { data, error } = await supabase.rpc("my_seat_requests", { p_me: me });
  if (error) return fail(error, { in: [], out: [] });
  const rows = data || [];
  return {
    in: rows.filter((r) => r.direction === "in").map((r) => ({ id: r.id, userId: r.from_id, at: r.created_at })),
    out: rows.filter((r) => r.direction === "out").map((r) => ({ id: r.id, userId: r.to_id, at: r.created_at })),
  };
}

/* Ask. The outcome is a word the caller renders rather than a boolean, because
   the four ways this can fail all deserve different sentences:
   'asked' | 'accepted' | 'not_shared' | 'already_flying' | 'unavailable' | 'missing'.
   'accepted' happens when they had already asked you — answering theirs is the
   honest resolution, rather than opening a second request pointing back. */
export async function askRightSeat(me, them) {
  if (!me || !them) return "missing";
  const { data, error } = await supabase.rpc("request_right_seat", { p_me: me, p_them: them });
  if (error) return fail(error, "missing");
  return data || "missing";
}

export async function cancelRightSeat(me, them) {
  const { data, error } = await supabase.rpc("cancel_right_seat", { p_me: me, p_them: them });
  if (error) return fail(error, false);
  return Boolean(data);
}

/* Accept or decline. Returns the session id on an accept, null on a decline —
   and null is also what a request that expired underneath you returns, which
   is why the caller reloads rather than trusting its own copy. */
export async function answerRightSeat(me, requestId, accept) {
  const { data, error } = await supabase.rpc("answer_right_seat", {
    p_me: me, p_request: requestId, p_accept: Boolean(accept),
  });
  if (error) return fail(error, null);
  return data || null;
}

/* WHERE I AM. Called as the student moves rather than on a timer: it is what
   puts their place on the other half of the partner's card, and it doubles as
   the heartbeat that keeps the hour from running out. A no-op when there is no
   session, so callers never have to check first. */
export async function seatHeartbeat(me, moduleCode, place) {
  if (isFlySolo() || !me) return null;
  const { data, error } = await supabase.rpc("seat_heartbeat", {
    p_me: me, p_module: moduleCode || null, p_place: place || null,
  });
  if (error) return fail(error, null);
  return data || null;
}

export async function endRightSeat(me) {
  const { data, error } = await supabase.rpc("end_right_seat", { p_me: me });
  if (error) return fail(error, false);
  return Boolean(data);
}

/* Session chat. Deleted when the seat empties — that is end_right_seat's job,
   not this file's — except for the lines somebody deliberately kept. */
export async function fetchSeatMessages(sessionId) {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from("seat_messages").select("id, user_id, body, kept, created_at")
    .eq("session_id", sessionId).order("created_at", { ascending: true }).limit(200);
  if (error) return fail(error, []);
  return (data || []).map((r) => ({
    id: r.id, authorId: r.user_id, body: r.body, kept: r.kept, createdAt: r.created_at,
  }));
}

export async function postSeatMessage(me, sessionId, body) {
  const text = (body || "").trim();
  if (!text || !me || !sessionId) return null;
  const { data, error } = await supabase
    .from("seat_messages").insert({ session_id: sessionId, user_id: me, body: text })
    .select("id, user_id, body, kept, created_at").single();
  if (error) return fail(error, null);
  return { id: data.id, authorId: data.user_id, body: data.body, kept: data.kept, createdAt: data.created_at };
}

/* "Keep this" — the one thing that survives the seat emptying. It is a flag on
   the message rather than a copy somewhere else, so what you kept is still the
   line you read rather than a paraphrase of it. */
export async function keepSeatMessage(id, on = true) {
  const { error } = await supabase.from("seat_messages").update({ kept: Boolean(on) }).eq("id", id);
  if (error) return fail(error, false);
  return true;
}

/* Opportunistic housekeeping, called from the room's own load. Cheap, idempotent,
   and correct whether or not anybody ever calls it — a seat that has not been
   swept is still shown as stale rather than as live, because the screen reads
   last_active_at itself. */
export async function sweepSeats() {
  const { error } = await supabase.rpc("expire_right_seats", {});
  if (error) console.error(error);
}
