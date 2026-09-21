/* =============================================================================
   A FAKE POSTGREST, SERVED OVER REAL HTTP.
   -----------------------------------------------------------------------------
   The app keeps its real Supabase client and makes real `fetch` calls; only the
   thing at the other end is ours. That matters for one test in particular.

   §15b.2: "assert on the NETWORK RESPONSE BODY, not the DOM, that another
   student's client never receives the author id of an anonymous question."
   A stubbed `supabase` object cannot answer that question — there is no
   response body to inspect, and asserting on what a stub returned is asserting
   on the stub. With a real HTTP endpoint, Playwright reads the actual bytes
   that crossed the wire.

   The visibility rules below are a deliberate re-implementation of what
   `paper_marks_for` and `paper_ink_for` do in SQL — the rings, the correction
   rule, Fly solo, and the anonymity strip. Where the two could drift, a static
   assertion in check-reader.mjs compares them, because a harness that is
   kinder than the server is worse than no harness.

   Anything not implemented answers 501 rather than [] — a silent empty array is
   how a harness passes a test the product would fail.
   ========================================================================= */
import { MARKS, INK, PROFILES, THREADS } from "./fixture.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

/* Reset per page load so tests do not leak into each other. */
export function makeStore() {
  return {
    paper_annotations: clone(MARKS),
    paper_ink: clone(INK),
    pilot_profiles: Object.values(clone(PROFILES)),
    lesson_threads: clone(THREADS),
    lesson_replies: [],
    user_progress: [],
    blocks: [], mutes: [], wingmen: [], uploads: {},
    formation_members: [], squadron_members: [], squadrons: [],
    chapter_completions: [], quiz_attempts: [], quiz_runs: [],
    /* Everything else the app touches while a paper is open. Empty, but
       PRESENT: a 501 here is the harness failing, not the product, and it
       would drown the console assertion that catches real errors. */
    presence: [], presence_visible: [], comms_messages: [], reports: [], question_attempts: [],
    /* The Flight Deck's right seat reads who you have flown with. */
    copilot_participants: [], message_attachments: [],
    paper_reads: [], lesson_progress: [],
    /* Empty, but present — the state after 0018 has been run. The Library asks
       for it on every module view, and a 501 here is the harness missing a
       table rather than the product failing. */
    papers: [],
    /* 0028. Bookmarks loads this on sign-in, so it is asked for on every page
       load whether or not a test touches it. */
    saves: [],
    /* The Ready Room's own tables, empty until a test seeds them. */
    comms_reactions: [], comms_receipts: [], thread_votes: [], lesson_reply_votes: [],
    copilot_sessions: [], seat_messages: [], seat_requests: [], squadron_invites: [],
    user_prefs: [], wingman_streaks: [],
  };
}

const isStaff = (store, uid) =>
  !!store.pilot_profiles.find((p) => p.user_id === uid)?.is_staff;
const isInvisible = (store, uid) =>
  !!store.pilot_profiles.find((p) => p.user_id === uid)?.invisible;
const nameOf = (store, uid) =>
  store.pilot_profiles.find((p) => p.user_id === uid)?.callsign || "Someone";

/* ring_covers, as SQL has it. The fixture has no wingmen or formations, so
   anything narrower than `module` reaches only its author — which is exactly
   what makes the correction test meaningful. */
function ringCovers(store, author, viewer, ring, moduleCode) {
  if (author === viewer) return true;
  if (ring === "solo") return false;
  if (ring === "wingman" || ring === "formation") {
    return store.wingmen.some((w) =>
      (w.user_id === author && w.wingman_user_id === viewer)
      || (w.user_id === viewer && w.wingman_user_id === author));
  }
  if (ring === "module") return !!moduleCode;
  return false;
}

function marksFor(store, uid, paperId, since) {
  const solo = isInvisible(store, uid);
  const staff = isStaff(store, uid);
  return store.paper_annotations
    .filter((a) => a.paper_id === paperId)
    .filter((a) => !since || a.updated_at > since)
    .filter((a) => {
      if (a.author_id === uid) return true;
      if (solo || isInvisible(store, a.author_id)) return false;
      if (store.blocks.some((b) =>
        (b.user_id === uid && b.blocked_id === a.author_id)
        || (b.user_id === a.author_id && b.blocked_id === uid))) return false;
      if (store.mutes.some((m) => m.user_id === uid && m.muted_id === a.author_id)) return false;
      /* R9 — the KIND decides who sees a correction, not the ring it was
         stored with. */
      if (a.kind === "correction") return staff;
      return ringCovers(store, a.author_id, uid, a.ring, a.module_code);
    })
    .map((a) => {
      const mine = a.author_id === uid;
      /* §6.2 — anonymity is enforced HERE, on the way out, not in the browser.
         The id is not hidden, it is absent. Instructors still get it, and the
         UI says so plainly rather than promising what it does not deliver. */
      const hide = a.anonymous && !mine && !staff;
      return {
        ...a,
        author_id: hide ? null : a.author_id,
        author_name: mine ? "You" : hide ? "Anonymous" : nameOf(store, a.author_id),
        close: mine || ringCovers(store, a.author_id, uid, "formation", a.module_code),
      };
    })
    .sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
}

function inkFor(store, uid, paperId) {
  const solo = isInvisible(store, uid);
  return store.paper_ink
    .filter((k) => k.paper_id === paperId)
    .filter((k) => k.author_id === uid
      || (!solo && !isInvisible(store, k.author_id)
        && ringCovers(store, k.author_id, uid, k.ring, k.module_code)))
    .map((k) => ({ ...k, author_name: k.author_id === uid ? "You" : nameOf(store, k.author_id), mine: k.author_id === uid }));
}

/* 0021 moved every write behind a function, because the tables themselves now
   refuse the anon key. The harness models the half that matters here: the
   author_id comes from `uid` and is NOT taken from the caller, and an update
   or a delete only touches rows that uid wrote. A test that could still edit
   somebody else's mark against this fixture would be testing nothing. */
const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));

const EDITABLE = ["body", "colour", "ring", "kind", "style", "hint", "anonymous", "resolved_at"];

/* ---------------------------------------------------------------- 0034
   THE BOARD. Mirrors the SQL rather than approximating it, because the walk
   that drives the result screen is the only place the ordering is seen by an
   eye: score descending, then time ascending, then the earlier hand-in — and
   the SECONDS are the wall clock between two stamps this file writes, never a
   countdown the page sent. An unfinished run has no submitted_at and is not on
   the board. Somebody flying solo is on their own board and nobody else's. */
/* A FIXTURE STUDENT HAS BEEN THROUGH THE WALKTHROUGH. It opens by itself for
   anybody who has not, full screen, so without this every suite that loads the
   Flight Deck would load the walkthrough instead. A uid starting "new" is a
   brand-new student and gets it, which is how the walkthrough is walked. */
const startingProgress = (uid) => (/^new/.test(String(uid || ""))
  ? {}
  : { "pw-tour": { at: "2026-09-01T00:00:00.000Z", how: "fixture" } });

const RPC = {
  start_quiz_run: (s, b) => {
    if (!b.uid || !b.p_quiz || !(b.p_total > 0)) return null;
    const open = s.quiz_runs.find((r) => r.user_id === b.uid && r.quiz_id === b.p_quiz && !r.submitted_at);
    if (open) return open.id;
    const row = {
      id: uuid(), user_id: b.uid, module_code: b.p_module || null,
      chapter_id: b.p_chapter || null, quiz_id: b.p_quiz, total: b.p_total,
      score: null, callsign: null, code: null,
      started_at: new Date().toISOString(), submitted_at: null,
    };
    s.quiz_runs.push(row);
    return row.id;
  },

  finish_quiz_run: (s, b) => {
    const row = s.quiz_runs.find((r) => r.id === b.p_run && r.user_id === b.uid);
    if (!row) return null;
    if (row.submitted_at) return row;                 // idempotent, like the SQL
    const p = s.pilot_profiles.find((x) => x.user_id === b.uid) || {};
    row.submitted_at = new Date().toISOString();
    row.score = Math.max(0, Math.min(Number(b.p_score) || 0, row.total));
    row.callsign = p.callsign ?? null;
    row.code = p.code ?? null;
    return row;
  },

  quiz_leaderboard: (s, b) => {
    const blocked = (a, c) => s.blocks.some((x) =>
      (x.user_id === a && x.blocked_id === c) || (x.user_id === c && x.blocked_id === a));
    const visible = s.quiz_runs.filter((r) => {
      if (r.quiz_id !== b.p_quiz || !r.submitted_at) return false;
      if (r.user_id === b.uid) return true;           // always on your own board
      const p = s.pilot_profiles.find((x) => x.user_id === r.user_id) || {};
      return !p.invisible && !blocked(b.uid, r.user_id);
    });
    const secs = (r) => Math.max(0, Math.floor((Date.parse(r.submitted_at) - Date.parse(r.started_at)) / 1000));
    const sorted = [...visible].sort((x, y) =>
      y.score - x.score || secs(x) - secs(y) || String(x.submitted_at).localeCompare(String(y.submitted_at)));
    return sorted.slice(0, Math.max(1, Math.min(b.p_limit || 50, 200))).map((r, i) => {
      const p = s.pilot_profiles.find((x) => x.user_id === r.user_id) || {};
      return {
        rank: i + 1, run_id: r.id, user_id: r.user_id,
        callsign: (r.callsign || "").trim() || "Someone",
        code: (r.code || "").trim() || "---",
        score: r.score, total: r.total, seconds: secs(r),
        is_you: r.user_id === b.uid, runs_total: sorted.length,
        stamp_shape: p.stamp_shape ?? null, stamp_code: p.stamp_code ?? null,
        stamp_rim: p.stamp_rim ?? null, stamp_ring: p.stamp_ring ?? null,
        stamp_pattern: p.stamp_pattern ?? null, stamp_ink: p.stamp_ink ?? null,
        stamp_seed: p.stamp_seed ?? null, stamp_issued_at: p.stamp_issued_at ?? null,
      };
    });
  },

  paper_mark_add: (s, b) => {
    if (!b.uid || !b.p_paper || !b.p_anchor) return null;
    const now = new Date().toISOString();
    const row = {
      id: b.p_id || uuid(), paper_id: b.p_paper, module_code: b.p_module,
      paper_version: 1, author_id: b.uid,
      kind: b.p_kind || "highlight", ring: b.p_ring || "module",
      body: b.p_body ?? null, thread_id: b.p_thread_id ?? null,
      colour: b.p_colour ?? null, anchor: b.p_anchor, hint: b.p_hint ?? null,
      anonymous: b.p_anonymous ?? (b.p_kind === "question" || b.p_colour === "unsure"),
      status: "ok", agree_count: 0, created_at: now, updated_at: now,
    };
    const at = s.paper_annotations.findIndex((a) => a.id === row.id);
    if (at >= 0) s.paper_annotations[at] = row; else s.paper_annotations.push(row);
    return row;
  },
  paper_mark_edit: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id && a.author_id === b.uid);
    if (!row) return false;
    for (const k of EDITABLE) if (b.p_patch && k in b.p_patch) row[k] = b.p_patch[k];
    row.updated_at = new Date().toISOString();
    return true;
  },
  paper_mark_delete: (s, b) => {
    const at = s.paper_annotations.findIndex((a) => a.id === b.p_id && a.author_id === b.uid);
    if (at < 0) return false;
    s.paper_annotations.splice(at, 1);
    return true;
  },
  paper_ink_add: (s, b) => {
    if (!b.uid || !b.p_paper || !b.p_page || !b.p_points) return null;
    const row = {
      id: b.p_id || uuid(), paper_id: b.p_paper, module_code: b.p_module,
      paper_version: 1, author_id: b.uid, page: b.p_page,
      tool: b.p_tool || "pen", colour: b.p_colour || "graphite",
      width: b.p_width ?? 0.0032, ring: b.p_ring || "solo", points: b.p_points,
      created_at: new Date().toISOString(),
    };
    const at = s.paper_ink.findIndex((k) => k.id === row.id);
    if (at >= 0) s.paper_ink[at] = row; else s.paper_ink.push(row);
    return row;
  },
  paper_ink_delete: (s, b) => {
    const ids = new Set(b.p_ids || []);
    let n = 0;
    for (let i = s.paper_ink.length - 1; i >= 0; i--) {
      if (ids.has(s.paper_ink[i].id) && s.paper_ink[i].author_id === b.uid) { s.paper_ink.splice(i, 1); n++; }
    }
    return n;
  },
  progress_for: (s, b) => (s.user_progress.find((r) => r.user_id === b.uid)?.data || startingProgress(b.uid)),
  progress_clear: (s, b) => {
    const at = s.user_progress.findIndex((r) => r.user_id === b.uid);
    if (at >= 0) s.user_progress.splice(at, 1);
    return true;
  },

  paper_marks_for: (s, b) => marksFor(s, b.uid, b.p_paper, b.p_since),
  paper_annotations_for: (s, b) => marksFor(s, b.uid, b.p_paper, b.p_since),
  paper_ink_for: (s, b) => inkFor(s, b.uid, b.p_paper),
  paper_corrections_for: (s, b) => (isStaff(s, b.uid)
    ? s.paper_annotations.filter((a) => a.kind === "correction" && a.module_code === b.p_module && !a.resolved_at)
      .map((a) => ({ ...a, author_name: nameOf(s, a.author_id) }))
    : []),
  paper_annotation_status: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id);
    if (row) { row.status = b.p_status === "orphaned" ? "orphaned" : "ok"; row.updated_at = new Date().toISOString(); }
    return null;
  },
  merge_progress: (s, b) => {
    const row = s.user_progress.find((r) => r.user_id === b.uid) || { user_id: b.uid, data: startingProgress(b.uid) };
    row.data = { ...row.data, ...b.patch };
    if (!s.user_progress.includes(row)) s.user_progress.push(row);
    return null;
  },
  agree_with_mark: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id);
    if (!row) return null;
    row.agree_count = (row.agree_count || 0) + 1;
    row.updated_at = new Date().toISOString();
    return row.agree_count;
  },
  /* Normally there are no uploaded papers in the harness — the reader is
     exercised against the committed dev paper. `scripts/measure-manual.mjs`
     sets this to the real 1012-page manual's row so the timings are measured
     against the real file over the real wire, not a 14-page stand-in. */
  papers_for: () => (process.env.HARNESS_REAL_PAPER ? JSON.parse(process.env.HARNESS_REAL_PAPER) : []),
  add_paper: (s, b) => [{ made_id: b.p_id, made_visibility: b.p_visibility || "solo", made_status: "pending", downgraded: false }],
  paper_status: () => null,
  delete_paper: () => true,
  my_modules: () => [],
  right_seat: () => [],
  /* HARNESS_SEAT puts somebody in the right seat, the same way HARNESS_REAL_PAPER
     puts the real manual in the Library: the seat is a live session and there
     is no fixture shape for "right now". §3's logbook draws that person's
     questions teal and names a filter after them, so a walk that cannot seat
     anybody cannot test either. The value is the partner's id. */
  my_seat: () => (process.env.HARNESS_SEAT
    ? [{ session_id: "seat_harness", partner_id: process.env.HARNESS_SEAT,
         partner_module: "M1", partner_place: null, partner_since: null,
         started_at: new Date().toISOString(), last_active_at: new Date().toISOString() }]
    : []),
  presence_touch: () => null,
  suggest_code: () => "T3T",
  claim_code: (s, b) => b.want,
  assign_squadron: () => null,
  squadron_roster: () => [],
  people_search: () => [],

  /* 0029 — issuing a stamp. The two rules the SQL exists for, kept: it
     refuses a second call, and the SEED IS THE SERVER'S. A harness that let
     the client choose the seed would let a walk pass against a bug the real
     function cannot have. */
  issue_stamp: (s, b) => {
    let row = s.pilot_profiles.find((p) => p.user_id === b.uid);
    if (!row) { row = { user_id: b.uid }; s.pilot_profiles.push(row); }
    if (row.stamp_issued_at) throw new Error("that stamp is already issued");
    const code = String(b.p_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    if (!code) throw new Error("a stamp needs a code");
    Object.assign(row, {
      stamp_shape: b.p_shape,
      stamp_code: code,
      stamp_rim: b.p_rim !== false,
      stamp_ring: String(b.p_ring || "").toUpperCase().replace(/[^A-Z0-9 .'-]/g, "").slice(0, 10) || null,
      stamp_pattern: b.p_pattern || "none",
      stamp_ink: b.p_ink || null,
      stamp_seed: 1 + Math.floor(Math.random() * 999998),
      stamp_issued_at: new Date().toISOString(),
    });
    return row;
  },

  /* 0035 — the code and the stamp, issued together. The same refusals as the
     SQL, worded the same way, because the creator tells "taken" apart by the
     words: a three-character code, one issue, and nobody else's code. */
  issue_licence: (s, b) => {
    const want = String(b.p_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{3}$/.test(want)) throw new Error("a licence needs a three-character code");
    let row = s.pilot_profiles.find((p) => p.user_id === b.uid);
    if (!row) { row = { user_id: b.uid }; s.pilot_profiles.push(row); }
    if (row.stamp_issued_at) throw new Error("that stamp is already issued");
    if (s.pilot_profiles.some((p) => p.code === want && p.user_id !== b.uid)) throw new Error("that code is taken");
    Object.assign(row, {
      code: want,
      stamp_code: want,
      stamp_shape: b.p_shape,
      stamp_rim: b.p_rim !== false,
      stamp_ring: String(b.p_ring || "").toUpperCase().replace(/[^A-Z0-9 .'-]/g, "").slice(0, 10) || null,
      stamp_pattern: b.p_pattern || "none",
      stamp_ink: b.p_ink || null,
      stamp_seed: 1 + Math.floor(Math.random() * 999998),
      stamp_issued_at: new Date().toISOString(),
    });
    return row;
  },

  /* 0030 — the licence card, read for anybody. The SQL's rule in one line:
     your own card is always yours, somebody flying solo is on nobody's, and a
     block cuts both ways. The column list is the boundary, so it is spelled
     out here too rather than spreading the row. */
  licence_card: (s, b) => {
    const row = s.pilot_profiles.find((p) => p.user_id === b.p_user);
    if (!row) return [];
    if (row.user_id !== b.p_viewer && row.invisible) return [];
    const blocked = (s.blocks || []).some((x) =>
      (x.user_id === b.p_viewer && x.blocked_id === b.p_user)
      || (x.user_id === b.p_user && x.blocked_id === b.p_viewer));
    if (blocked) return [];
    const take = ["user_id", "callsign", "real_name", "code", "bio", "phrase",
      "cover", "cover_ink", "cover_image", "is_staff", "hours_s", "lessons_signed",
      "days_flown", "stamp_shape", "stamp_code", "stamp_rim", "stamp_ring",
      "stamp_pattern", "stamp_ink", "stamp_seed", "stamp_issued_at",
      "photo_url", "photo_zoom", "photo_x", "photo_y"];
    const out = {};
    for (const k of take) out[k] = row[k] ?? null;
    return [out];
  },

  /* ---- the Ready Room. The same rules as the SQL, kept small: 0022's votes
     and chat, 0026's attachments, 0027's receipts. A recipient is a member who
     had joined by the time a message was sent, not blocked either way and not
     muting its author. */
  thread_vote_counts: (s, b) => {
    const ids = new Set(b.p_threads || []);
    const out = new Map();
    for (const v of s.thread_votes) {
      if (!ids.has(v.thread_id)) continue;
      const row = out.get(v.thread_id) || { thread_id: v.thread_id, score: 0, mine: 0 };
      row.score += v.dir;
      if (v.user_id === b.p_me) row.mine = v.dir;
      out.set(v.thread_id, row);
    }
    return [...out.values()];
  },
  toggle_thread_vote: (s, b) => {
    const at = s.thread_votes.findIndex((v) => v.thread_id === b.p_thread && v.user_id === b.p_me);
    const was = at >= 0 ? s.thread_votes[at].dir : null;
    if (at >= 0) s.thread_votes.splice(at, 1);
    if (was === b.p_dir || ![-1, 1].includes(b.p_dir)) return 0;
    s.thread_votes.push({ thread_id: b.p_thread, user_id: b.p_me, dir: b.p_dir, created_at: new Date().toISOString() });
    return b.p_dir;
  },
  mark_squadrons_delivered: (s, b) => {
    const now = new Date().toISOString();
    let n = 0;
    for (const sid of b.p_squadrons || []) {
      const mine = s.squadron_members.find((m) => m.squadron_id === sid && m.user_id === b.p_me);
      if (!mine) continue;
      for (const m of s.comms_messages) {
        if (m.squadron_id !== sid || m.user_id === b.p_me || m.deleted_at) continue;
        if (mine.joined_at && m.created_at < mine.joined_at) continue;
        if (s.comms_receipts.some((r) => r.message_id === m.id && r.user_id === b.p_me)) continue;
        s.comms_receipts.push({ message_id: m.id, user_id: b.p_me, delivered_at: now, read_at: null });
        n += 1;
      }
    }
    return n;
  },
  mark_squadron_read: (s, b) => {
    const mine = s.squadron_members.find((m) => m.squadron_id === b.p_squadron && m.user_id === b.p_me);
    if (!mine) return null;
    const now = new Date().toISOString();
    for (const m of s.comms_messages) {
      if (m.squadron_id !== b.p_squadron || m.user_id === b.p_me || m.deleted_at) continue;
      if (mine.joined_at && m.created_at < mine.joined_at) continue;
      const r = s.comms_receipts.find((x) => x.message_id === m.id && x.user_id === b.p_me);
      if (r) { if (!r.read_at) r.read_at = now; } else {
        s.comms_receipts.push({ message_id: m.id, user_id: b.p_me, delivered_at: now, read_at: now });
      }
    }
    mine.last_read_at = now;
    return now;
  },
  message_receipts: (s, b) => {
    const ids = new Set(b.p_messages || []);
    const blocked = (x, y) => s.blocks.some((k) => (k.user_id === x && k.blocked_id === y) || (k.user_id === y && k.blocked_id === x));
    const out = [];
    for (const m of s.comms_messages) {
      if (!ids.has(m.id) || m.user_id !== b.p_me) continue;
      for (const sm of s.squadron_members) {
        if (sm.squadron_id !== m.squadron_id || sm.user_id === m.user_id) continue;
        if (sm.joined_at && sm.joined_at > m.created_at) continue;
        if (blocked(m.user_id, sm.user_id)) continue;
        if (s.mutes.some((u) => u.user_id === sm.user_id && u.muted_id === m.user_id)) continue;
        const r = s.comms_receipts.find((x) => x.message_id === m.id && x.user_id === sm.user_id);
        out.push({ message_id: m.id, user_id: sm.user_id, delivered_at: r?.delivered_at || null, read_at: r?.read_at || null });
      }
    }
    return out;
  },
  my_marks_in_module: (s, b) => s.paper_annotations
    .filter((a) => a.author_id === b.uid && a.module_code === b.p_module && a.anchor?.quote)
    .slice(0, b.p_limit || 60)
    .map((a) => ({ id: a.id, paper_id: a.paper_id, paper_title: a.paper_id, quote: a.anchor.quote, anchor: a.anchor, kind: a.kind, colour: a.colour })),
  toggle_message_reaction: (s, b) => {
    const at = s.comms_reactions.findIndex((r) => r.message_id === b.p_message && r.user_id === b.p_me && r.emoji === b.p_emoji);
    if (at >= 0) { s.comms_reactions.splice(at, 1); return false; }
    s.comms_reactions.push({ message_id: b.p_message, user_id: b.p_me, emoji: b.p_emoji });
    return true;
  },
  pin_message: (s, b) => {
    const m = s.comms_messages.find((x) => x.id === b.p_message);
    if (!m) return false;
    for (const x of s.comms_messages) if (x.squadron_id === m.squadron_id) { x.pinned_at = null; x.pinned_by = null; }
    if (b.p_on !== false) { m.pinned_at = new Date().toISOString(); m.pinned_by = b.p_me; }
    return true;
  },
  edit_message: (s, b) => {
    const m = s.comms_messages.find((x) => x.id === b.p_message && x.user_id === b.p_me && !x.deleted_at);
    if (!m) return false;
    m.body = b.p_body;
    m.edited_at = new Date().toISOString();
    return true;
  },
  delete_message: (s, b) => {
    const m = s.comms_messages.find((x) => x.id === b.p_message && x.user_id === b.p_me);
    if (!m) return false;
    m.deleted_at = new Date().toISOString();
    m.body = null;
    return true;
  },
  set_squadron_muted: (s, b) => {
    const mine = s.squadron_members.find((m) => m.squadron_id === b.p_squadron && m.user_id === b.p_me);
    if (!mine) return false;
    mine.muted = Boolean(b.p_muted);
    return true;
  },
  leave_squadron: (s, b) => {
    s.squadron_members = s.squadron_members.filter((m) => !(m.squadron_id === b.p_squadron && m.user_id === b.p_me));
    return "left";
  },
  create_squadron: (s, b) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    s.squadrons.push({ id, module_code: b.p_module, name: b.p_name, blurb: b.p_blurb, status: "active", owner_id: b.p_me,
      join_policy: b.p_policy || "invite_only", invite_token: id.slice(0, 8), member_cap: 32, created_at: now });
    s.squadron_members.push({ squadron_id: id, user_id: b.p_me, role: "owner", muted: false, joined_at: now, last_read_at: now, marking: "solid" });
    return id;
  },
  add_message_attachments: (s, b) => {
    const rows = (b.p_rows || []).map((r) => ({ id: crypto.randomUUID(), message_id: b.p_message, created_at: new Date().toISOString(), ...r }));
    s.message_attachments.push(...rows);
    return rows;
  },
  rename_squadron: () => true,
  revoke_invite: () => null,
  join_squadron: () => "missing",
  discover_squadrons: () => [],
  squadron_by_invite: () => null,
  my_seat_requests: () => [],
  request_right_seat: () => "asked",
  cancel_right_seat: () => true,
  answer_right_seat: () => null,
  seat_heartbeat: () => null,
  end_right_seat: () => true,
  expire_right_seats: () => 0,
  shared_completions: () => [],
};

/* The two embedded reads the Ready Room makes, resolved the way PostgREST would:
   the squadron onto its membership row, and a message's attachments onto the
   message. Anything else embedded is still left off. Copies, never the stored
   rows, so a read cannot write into the store. */
const EMBEDS = {
  "squadron_members.squadrons": (row, store) => store.squadrons.find((x) => x.id === row.squadron_id) || null,
  "comms_messages.message_attachments": (row, store) => store.message_attachments.filter((a) => a.message_id === row.id),
};
function embed(table, rows, url, store) {
  const select = url.searchParams.get("select") || "";
  const wanted = [...select.matchAll(/(?:(\w+):)?(\w+)(!inner)?\(/g)]
    .map(([, alias, name, inner]) => ({ alias: alias || name, fn: EMBEDS[`${table}.${name}`], inner: Boolean(inner) }))
    .filter((e) => e.fn);
  if (!wanted.length) return rows;
  return rows
    .map((r) => { const out = { ...r }; for (const e of wanted) out[e.alias] = e.fn(r, store); return out; })
    .filter((r) => wanted.every((e) => !e.inner || r[e.alias] != null));
}

/* ORDER AND LIMIT, which this used to ignore. A read that asks for the newest
   message per squadron got whichever row was inserted first, so the rail's
   preview showed yesterday's line under today's time. */
function shape(rows, url) {
  let out = rows;
  const order = url.searchParams.get("order");
  if (order) {
    const keys = order.split(",").map((k) => {
      const [col, dir = "asc"] = k.split(".");
      return { col, desc: dir === "desc" };
    });
    out = [...out].sort((a, b) => {
      for (const { col, desc } of keys) {
        const x = a[col];
        const y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
  return out;
}

/* PostgREST's filter syntax, only the operators the app actually sends. */
function applyFilters(rows, url) {
  let out = rows;
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const val = rest.join(".");
    if (op === "eq") out = out.filter((r) => String(r[key]) === val);
    else if (op === "neq") out = out.filter((r) => String(r[key]) !== val);
    else if (op === "in") {
      const set = val.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      out = out.filter((r) => set.includes(String(r[key])));
    } else if (op === "is") out = out.filter((r) => (val === "null" ? r[key] == null : true));
    else if (op === "not" && rest[0] === "is") out = out.filter((r) => (rest[1] === "null" ? r[key] != null : true));
  }
  return out;
}

export function postgrestMiddleware() {
  const stores = new Map();       // one store per browser context, keyed by header
  const storeFor = (req) => {
    const key = req.headers["x-harness-store"] || "default";
    if (!stores.has(key)) stores.set(key, makeStore());
    return stores.get(key);
  };

  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/rest/v1/") && !url.pathname.startsWith("/harness/")
        && !url.pathname.startsWith("/storage/v1/object/")) return next();

    /* `.single()` in supabase-js asks for ONE OBJECT with an Accept header,
       and a real PostgREST answers with a bare object rather than an array of
       one. Ignoring that header made every `.insert().select().single()`
       resolve to an array, which the client then spread into an object with
       numeric keys — a saved row that looked saved and rendered as nothing.
       A harness that is kinder than the server is worse than no harness. */
    const wantsOne = String(req.headers.accept || "").includes("pgrst.object");
    const send = (code, body) => {
      if (wantsOne && Array.isArray(body)) {
        if (body.length !== 1) {
          res.statusCode = 406;
          res.setHeader("content-type", "application/json");
          return res.end(JSON.stringify({ message: `harness: expected 1 row, got ${body.length}` }));
        }
        [body] = body;
      }
      res.statusCode = code;
      res.setHeader("content-type", "application/json");
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.end(JSON.stringify(body ?? null));
    };
    if (req.method === "OPTIONS") return send(200, {});

    let body = null;
    /* The raw bytes as well as the parsed object: an upload's body is a WEBP,
       not JSON, and the stream is drained exactly once here. Reading it again
       further down attaches a listener to a finished stream, so `end` never
       fires and the request hangs for ever — which is what the first version
       of the storage branch below did. */
    let raw = null;
    if (req.method !== "GET" && req.method !== "DELETE") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      raw = Buffer.concat(chunks);
      const text = raw.toString("utf8");
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    }

    const store = storeFor(req);

    /* STORAGE, ENOUGH OF IT TO TEST AN UPLOAD. A POST or PUT to an object
       path remembers the byte count; a GET of the public path answers a 1x1
       so an <img> can load. That is the whole of what a screen needs to be
       driven through pick -> crop -> upload -> the cover changing, with no
       real bucket and nothing left in one afterwards.

       It is NOT a proxy. HARNESS_STORAGE_ORIGIN sends this prefix to the real
       project when a test wants the real manual, and vite.config.js decides
       that, not this file — a stub that answered first would silently replace
       the thing that walk exists to measure. */
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const key = url.pathname.replace("/storage/v1/object/", "").replace(/^public\//, "");
      if (req.method === "POST" || req.method === "PUT") {
        store.uploads[key] = raw ? raw.length : 0;
        return send(200, { Key: key });
      }
      if (req.method === "GET") {
        if (!(key in store.uploads)) return send(404, { message: "Object not found" });
        res.statusCode = 200;
        res.setHeader("content-type", "image/gif");
        res.setHeader("access-control-allow-origin", "*");
        return res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
      }
    }

    /* A door for tests: reset, seed, or read the whole store. */
    if (url.pathname === "/harness/reset") { stores.set(req.headers["x-harness-store"] || "default", makeStore()); return send(200, { ok: true }); }
    if (url.pathname === "/harness/store") return send(200, store);

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.slice("/rest/v1/rpc/".length);
      const fn = RPC[name];
      if (!fn) { console.warn(`[harness] no RPC "${name}"`); return send(501, { message: `harness: rpc ${name} not implemented` }); }
      /* A function that RAISES answers 400 with a message, as PostgREST does
         for a raise in plpgsql — that is how issue_stamp refuses a second
         call, and a harness that threw a 500 instead would let a screen pass
         its "already issued" path against the wrong shape of failure. */
      try { return send(200, fn(store, body || {})); }
      catch (e) { return send(400, { message: String(e?.message || e), code: "P0001" }); }
    }

    const table = url.pathname.slice("/rest/v1/".length).split("?")[0];
    /* 0032's view: presence minus anybody whose ACCOUNT says invisible. The
       write side gates on a per-device mirror, so a row can outlive the
       switch — a second device still beating, or a tab that was closed when
       it went on. Derived here because this harness has no joins. */
    if (table === "presence_visible") {
      const hidden = new Set(store.pilot_profiles.filter((p) => p.invisible).map((p) => p.user_id));
      store.presence_visible = store.presence.filter((r) => !hidden.has(r.user_id));
    }
    if (!(table in store)) { console.warn(`[harness] no table "${table}"`); return send(501, { message: `harness: table ${table} not implemented` }); }

    if (req.method === "GET") return send(200, shape(embed(table, applyFilters(store[table], url), url, store), url));

    if (req.method === "POST") {
      /* AN UPSERT MERGES ON ITS on_conflict COLUMNS, as PostgREST does. Matching
         on id alone gave every upsert without an id a row of its own: the
         profile upsert on each page load left two rows for one person, the
         next maybeSingle() failed with PGRST116 — 284 times in one matrix run —
         and presence reached 148 rows for one student. */
      const keys = (url.searchParams.get("on_conflict") || "").split(",").map((k) => k.trim()).filter(Boolean);
      const ignore = /ignore-duplicates/.test(String(req.headers.prefer || ""));
      const out = [];
      for (const raw of Array.isArray(body) ? body : [body]) {
        const at = keys.length
          ? store[table].findIndex((x) => keys.every((k) => x[k] !== undefined && String(x[k]) === String(raw[k])))
          : (raw.id ? store[table].findIndex((x) => x.id === raw.id) : -1);
        if (at >= 0) {
          if (!ignore) store[table][at] = { ...store[table][at], ...raw, updated_at: new Date().toISOString() };
          out.push(store[table][at]);
          continue;
        }
        const row = {
          id: raw.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "ok",
          ...raw,
        };
        store[table].push(row);
        out.push(row);
      }
      return send(201, out);
    }

    if (req.method === "PATCH") {
      const hit = applyFilters(store[table], url);
      for (const r of hit) Object.assign(r, body, { updated_at: new Date().toISOString() });
      return send(200, hit);
    }

    if (req.method === "DELETE") {
      const hit = applyFilters(store[table], url);
      store[table] = store[table].filter((r) => !hit.includes(r));
      return send(200, hit);
    }

    return send(405, { message: "harness: method not allowed" });
  };
}
