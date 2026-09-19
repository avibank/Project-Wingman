/* =============================================================================
   WHO ELSE IS ON THIS MODULE.
   -----------------------------------------------------------------------------
   The Crew tab is ABOUT THE MODULE, not about your friends — §2 of the launch
   handoff. It answers three questions and nothing else: how many people are on
   it, who is on each chapter now, and whose stamps are on each chapter's wall.

   PRIVACY IS THE SHAPE OF THIS FILE, not a filter on top of it. §2: "chapter-
   level position only, never a lesson or a score." So nothing below ever
   selects a lesson, a score or an attempt — the position it reads is
   `presence.chapter_id`, and the only other fact is whether a chapter is
   finished. There is no query here that could leak a score, because there is no
   query here that asks for one.

   FLY SOLO IS ENFORCED HERE, for the reason flySolo.js gives about presence:
   gated in one place so no caller can forget. It is symmetric — a student who
   is flying solo sees nobody and appears to nobody — and both halves are below.

   One round trip per source rather than one per person: presence, completions,
   profiles, and the answer counts. A module with forty people is four requests.
   ========================================================================= */
import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";
import { stampOf } from "./stamp.js";

const fail = (e, f) => { if (e) console.error(e); return f; };

/**
 * Everyone on a module, with where they are and what they have signed off.
 * @returns {{ people: Array, onNow: number, finished: number, solo: boolean }}
 */
export async function fetchCrew(moduleCode, me, { chapterIds = [] } = {}) {
  const none = { people: [], onNow: 0, finished: 0, solo: true };
  if (!moduleCode) return { ...none, solo: false };
  /* Symmetric, and this is the half that runs on your own device. */
  if (isFlySolo()) return none;

  const since = new Date(Date.now() - 1000 * 60 * 5).toISOString();
  const [presence, completions] = await Promise.all([
    supabase.from("presence").select("user_id, chapter_id, display_name, last_seen")
      .eq("module_code", moduleCode).gte("last_seen", since)
      .then(({ data, error }) => fail(error, data || [])),
    supabase.from("chapter_completions").select("user_id, chapter_id")
      .eq("module_code", moduleCode)
      .then(({ data, error }) => fail(error, data || [])),
  ]);

  const ids = [...new Set([...presence.map((p) => p.user_id), ...completions.map((c) => c.user_id)])];
  if (!ids.length) return { people: [], onNow: 0, finished: 0, solo: false };

  /* The profiles, and this is the OTHER half of Fly solo: anyone who has it on
     is dropped here, so they are absent from the crew rather than hidden in
     it. `.eq("invisible", false)` is how squadron.js does the same thing. */
  const profiles = await supabase
    .from("pilot_profiles")
    .select("user_id, callsign, real_name, is_staff, invisible, stamp_shape, stamp_code, stamp_rim, stamp_ring, stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at")
    .in("user_id", ids)
    .then(({ data, error }) => fail(error, data || []));

  const visible = new Set(profiles.filter((p) => !p.invisible).map((p) => p.user_id));
  /* Somebody with no profile row yet is still a person on the module: they are
     visible unless they have said otherwise, and nobody has said otherwise for
     them. Failing the other way would hide every new account. */
  for (const id of ids) if (!profiles.some((p) => p.user_id === id)) visible.add(id);

  /* WHO HAS ANSWERED, and it is answers in THIS module's threads. Counted over
     two queries rather than a join, because PostgREST's embedded filters
     cannot express "replies to threads whose module is X" without a view. */
  /* module_id, not module_code: lesson_threads has carried the module under
     that name since 0008, and check:schema is what said so. */
  const threads = await supabase.from("lesson_threads").select("id")
    .eq("module_id", moduleCode)
    .then(({ data, error }) => fail(error, data || []));
  const answers = new Map();
  if (threads.length) {
    const rows = await supabase.from("lesson_replies").select("author_id")
      .in("thread_id", threads.map((t) => t.id))
      .then(({ data, error }) => fail(error, data || []));
    for (const r of rows) answers.set(r.author_id, (answers.get(r.author_id) || 0) + 1);
  }

  const byId = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const doneBy = new Map();
  for (const c of completions) {
    if (!doneBy.has(c.user_id)) doneBy.set(c.user_id, new Set());
    doneBy.get(c.user_id).add(c.chapter_id);
  }
  const here = new Map(presence.map((p) => [p.user_id, p]));

  const people = ids.filter((id) => visible.has(id) && id !== me).map((id) => {
    const p = byId[id] || {};
    const at = here.get(id);
    const done = doneBy.get(id) || new Set();
    return {
      userId: id,
      name: p.callsign || at?.display_name || p.real_name || "Someone",
      callsign: p.callsign || null,
      staff: !!p.is_staff,
      /* CHAPTER-LEVEL AND NO FINER. §2 is explicit about it. */
      chapterId: at?.chapter_id || null,
      on: !!at,
      done,
      finished: chapterIds.length > 0 && chapterIds.every((c) => done.has(c)),
      answers: answers.get(id) || 0,
      stamp: stampOf(p),
    };
  });

  return {
    people,
    onNow: people.filter((p) => p.on).length,
    finished: people.filter((p) => p.finished).length,
    solo: false,
  };
}
