/* =============================================================================
   READING THE REPORTS — the other half of the pill in the corner.
   -----------------------------------------------------------------------------
   The owner, 2026-10-06: "I can't see it if someone presses it as an admin."
   Three reports had reached the table by then and nobody had ever read one —
   including a `layout` line from the stylesheet canary, which is the phone
   problem that has been chased by hand twice.

   EVERYTHING LANDS IN ONE TABLE AND MEANS THREE DIFFERENT THINGS, so this is
   where that is sorted out rather than in the screen:
     · target_type 'route'  — a student pressed the pill. `reason` is JSON.
     · target_id 'stylesheet' / 'layout' — src/lib/recover.js and canary.js
       wrote it, with no human involved. These matter MORE than they look:
       they come from devices nobody here can hold.
     · anything else — 0005's content moderation, which this screen shows
       but does not pretend to be a queue for.

   `reason` IS PARSED DEFENSIVELY. It is free text in the schema and three
   different writers put things in it; a screen that assumed JSON would throw
   on the first hand-written row and take the whole list with it.
   ========================================================================= */
import { supabase } from "./supabaseClient.js";

/** What a row is really about, in one word the screen can group by. */
export function kindOf(row) {
  if (row.target_id === "stylesheet" || row.target_id === "layout") return "device";
  if (row.target_type === "route") return "page";
  return "content";
}

/** `reason` as an object, whatever was actually written into it. */
export function detailOf(row) {
  const raw = row.reason;
  if (!raw) return { said: null, rest: {} };
  if (typeof raw === "object") return { said: raw.said || null, rest: raw };
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object") return { said: o.said || null, rest: o };
  } catch { /* not JSON — a person typed it, which is still a report */ }
  return { said: String(raw), rest: {} };
}

/**
 * The newest reports. `status` filters; null is everything.
 * Never throws: an admin screen that goes blank because the network blinked
 * is worse than one that says it could not load.
 */
export async function fetchReports({ status = "open", limit = 100 } = {}) {
  try {
    let q = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { ok: false, rows: [], error: error.message };
    return { ok: true, rows: data || [] };
  } catch (e) {
    return { ok: false, rows: [], error: String(e?.message || e) };
  }
}

/** Move one report's status. 0005 allows 'open' | 'actioned' | 'dismissed'. */
export async function setReportStatus(id, status) {
  try {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    return { ok: !error, error: error?.message || null };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
