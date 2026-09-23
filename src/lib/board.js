/* =============================================================================
   THE LEADERBOARD — R5 and R6 of the exam brief, migration 0034.
   -----------------------------------------------------------------------------
   THE CLIENT ONLY FORMATS, and that is R5 rather than a preference: "Rows rank
   by score descending, then by time ascending. Time is submittedAt − startedAt
   in real seconds, decided server-side, never from the countdown in the
   browser." So there is no sort in this file and no arithmetic on a time. The
   rank, the seconds, the place and the size of the board all arrive decided.

   THE TIME IS NOT THE COUNTDOWN. The paper's clock stops when the paper leaves
   the screen; the board's time is the wall clock between the two stamps the
   server wrote. They are different numbers on purpose, and only the second one
   cannot be made up by a browser. 0034's header carries the argument and the
   cost.

   A RUN IS OPENED WHEN THE PAPER OPENS, not when it is handed in, because
   `started_at` has to be the server's. Coming back to a paper returns the run
   already open rather than starting a second one, so resuming does not restart
   the clock — and an unfinished run never reaches the board.
   ========================================================================= */
import { supabase, configured } from "./supabaseClient.js";

const fail = (e, f) => { if (e) console.error(e); return f; };

/** Opens a run, or returns the one already open for this paper. */
export async function startRun({ me, moduleCode, chapterId, quizId, total }) {
  if (!configured || !me || !quizId || !total) return null;
  const { data, error } = await supabase.rpc("start_quiz_run", {
    uid: me, p_module: moduleCode || null, p_chapter: chapterId || null,
    p_quiz: quizId, p_total: total,
  });
  if (error) return fail(error, null);
  return (Array.isArray(data) ? data[0] : data) || null;
}

/** Hands it in. The time and the name are decided there, not here. */
export async function finishRun({ me, runId, score }) {
  if (!configured || !me || !runId) return null;
  const { data, error } = await supabase.rpc("finish_quiz_run", {
    uid: me, p_run: runId, p_score: Math.max(0, Math.round(score || 0)),
  });
  if (error) return fail(error, null);
  return (Array.isArray(data) ? data[0] : data) || null;
}

/* The row a screen draws. Renamed here and nowhere else, so the board's markup
   reads as the pack wrote it and the SQL reads as SQL. */
const toRow = (r) => ({
  id: r.run_id,
  rank: Number(r.rank),
  userId: r.user_id,
  callsign: r.callsign,
  account: r.code,
  score: Number(r.score),
  total: Number(r.total),
  seconds: Number(r.seconds),
  isYou: !!r.is_you,
  /* Shaped for stampOf, which is the one thing allowed to read a stamp row. */
  profile: {
    stamp_shape: r.stamp_shape, stamp_code: r.stamp_code, stamp_rim: r.stamp_rim,
    stamp_ring: r.stamp_ring, stamp_pattern: r.stamp_pattern, stamp_ink: r.stamp_ink,
    stamp_seed: r.stamp_seed, stamp_issued_at: r.stamp_issued_at,
    stamp_pscope: r.stamp_pscope, stamp_pink: r.stamp_pink, stamp_cink: r.stamp_cink,
  },
});

/** The board for one paper. Ranked, timed and placed by the server. */
export async function fetchBoard({ me, quizId, limit = 50 }) {
  if (!configured || !me || !quizId) return { runs: [], total: 0 };
  const { data, error } = await supabase.rpc("quiz_leaderboard", {
    uid: me, p_quiz: quizId, p_limit: limit,
  });
  if (error) return fail(error, { runs: [], total: 0 });
  const rows = (data || []).map(toRow);
  /* `runs_total` is the size of the whole board; `rows.length` is what the
     limit let through. "You're 3rd of 12" has to be the first one, or the
     board lies about where you came the moment it is longer than the limit. */
  return { runs: rows, total: Number(data?.[0]?.runs_total || rows.length) };
}

/** 7:35, never 07:35 — the pack's own `mmss`. */
/* =============================================================================
   WHO HAS FINISHED — Rule 4 of the quiz-stamps brief, migration 0038.
   -----------------------------------------------------------------------------
   One row per PERSON per quiz, their most recent finish first and yours
   pinned ahead of them (the owner's answer to the brief's open question 2),
   capped, with the whole count beside it. The cap and the order are the
   server's for the same reason the board's rank is: a client that ordered
   this could drop you off your own row.
   ========================================================================= */
export async function fetchFinishers({ me, quizIds = [], cap = 11 }) {
  const ids = [...new Set(quizIds.filter(Boolean))];
  if (!configured || !me || !ids.length) return {};
  const { data, error } = await supabase.rpc("quiz_finishers", {
    uid: me, p_quizzes: ids, p_cap: cap,
  });
  if (error) return fail(error, {});
  const out = {};
  for (const r of data || []) {
    const q = (out[r.quiz_id] ||= { people: [], total: 0 });
    q.total = Number(r.finishers) || q.total;
    q.people.push({
      userId: r.user_id, callsign: r.callsign, account: r.code, isYou: !!r.is_you,
      /* Shaped for stampOf, which is the one thing allowed to read a stamp row. */
      profile: {
        stamp_shape: r.stamp_shape, stamp_code: r.stamp_code, stamp_rim: r.stamp_rim,
        stamp_ring: r.stamp_ring, stamp_pattern: r.stamp_pattern, stamp_pscope: r.stamp_pscope,
        stamp_ink: r.stamp_ink, stamp_pink: r.stamp_pink, stamp_cink: r.stamp_cink,
        stamp_seed: r.stamp_seed, stamp_issued_at: r.stamp_issued_at,
      },
    });
  }
  return out;
}

export const mmss = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

/** 1st, 2nd, 3rd, 11th — the pack's own `ord`. */
export const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st"
  : n % 10 === 2 && n % 100 !== 12 ? "nd"
  : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
