/* =============================================================================
   THE CLASS THE DEMO SHOWS.
   -----------------------------------------------------------------------------
   Everything a new student should see on their first look, and cannot see in
   their own account yet: a module half done, a caution lamp lit where an
   average has slipped, people on the Crew tab at different chapters, a right
   seat, two squadrons talking, and module questions with answers under them.

   Written as rows in the real tables' shapes, so the real screens read it
   through the real queries (pgcore.js). The student is `me`, their own Clerk
   id, so every screen that asks "whose is this" gets the answer it would get
   for them. Their callsign and name are theirs; the progress is the demo's.

   No organisation appears anywhere in here: no school, no airline, no
   authority. The people are invented, and so is every message.
   ========================================================================= */
import { PALETTE } from "../lib/stamp.js";

const ink = (k) => PALETTE[k % PALETTE.length]?.n || null;

/* Fourteen classmates. `at` is the Mathematics chapter they are on, `on` is
   online now, `sq` the squadrons they are in (A = Night Shift, B = Final
   Approach). */
const CLASS = [
  { id: "demo_sara", name: "Sara Hamdan", cs: "SPARROW", code: "SP7", shape: "seal", pattern: "rays", at: 3, on: true, sq: "AB" },
  { id: "demo_yousef", name: "Yousef Karim", cs: "TORQUE", code: "TQ2", shape: "roundel", pattern: "checks", at: 2, on: true, sq: "A" },
  { id: "demo_mariam", name: "Mariam Saleh", cs: "HALO", code: "H4L", shape: "gauge", pattern: "guilloche", at: 4, on: true, sq: "A" },
  { id: "demo_omar", name: "Omar Nasser", cs: "RIVET", code: "RV9", shape: "postage", pattern: "none", at: 3, on: true, sq: "B" },
  { id: "demo_dana", name: "Dana Qasem", cs: "VECTOR", code: "V3C", shape: "window", pattern: "knurl", at: 2, on: true, sq: "A" },
  { id: "demo_hamad", name: "Hamad Rashed", cs: "GIMBAL", code: "GB5", shape: "tag", pattern: "crochet", at: 1, on: false, sq: "B" },
  { id: "demo_lulwa", name: "Lulwa Adel", cs: "MACH", code: "MC1", shape: "seal", pattern: "guilloche", at: 4, on: false, sq: "" },
  { id: "demo_reem", name: "Reem Ali", cs: "KITE", code: "K1T", shape: "roundel", pattern: "rays", at: 1, on: true, sq: "" },
  { id: "demo_bader", name: "Bader Faisal", cs: "FLAP", code: "FL4", shape: "gauge", pattern: "none", at: 2, on: false, sq: "B" },
  { id: "demo_haya", name: "Haya Mansour", cs: "NOVA", code: "N0V", shape: "window", pattern: "checks", at: 3, on: false, sq: "" },
  { id: "demo_khaled", name: "Khaled Amin", cs: "PITOT", code: "PT8", shape: "postage", pattern: "knurl", at: 1, on: false, sq: "" },
  { id: "demo_noor", name: "Noor Hassan", cs: "", code: "NH6", shape: "tag", pattern: "rays", at: 2, on: true, sq: "" },
  { id: "demo_abdullah", name: "Abdullah Faraj", cs: "", code: "AF3", shape: "seal", pattern: "checks", at: 1, on: false, sq: "" },
  { id: "demo_fatma", name: "Fatma Yusuf", cs: "SLATS", code: "SL2", shape: "roundel", pattern: "crochet", at: 3, on: false, sq: "" },
];

const SQ_A = "d0000000-0000-4000-8000-00000000000a";
const SQ_B = "d0000000-0000-4000-8000-00000000000b";
const SEAT = "d0000000-0000-4000-8000-0000000005ea";

export function seed({ me, look = {} } = {}) {
  const now = Date.now();
  const ago = (min) => new Date(now - min * 60000).toISOString();
  const daysAgo = (d, hh = 18, mm = 0) => { const x = new Date(now); x.setDate(x.getDate() - d); x.setHours(hh, mm, 0, 0); return x.toISOString(); };
  const today = new Date(now).toISOString().slice(0, 10);

  const stampOf = (p, k) => ({
    stamp_shape: p.shape, stamp_code: p.code, stamp_rim: true, stamp_ring: null,
    stamp_pattern: p.pattern, stamp_ink: ink(k * 5 + 3), stamp_seed: 101 + k * 37, stamp_issued_at: daysAgo(20 - k),
  });

  const pilot_profiles = [
    {
      user_id: me, callsign: look.callsign || null, real_name: look.name || null, code: "A7K",
      is_staff: false, invisible: false, discoverable: true, created_at: daysAgo(21),
      stamp_shape: "seal", stamp_code: "A7K", stamp_rim: true, stamp_ring: null, stamp_pattern: "rays",
      stamp_ink: ink(1), stamp_seed: 4242, stamp_issued_at: daysAgo(19),
      hours_s: 15120 + 3900, lessons_signed: 5, days_flown: 12,
    },
    ...CLASS.map((p, k) => ({
      user_id: p.id, callsign: p.cs || null, real_name: p.name, code: p.code, is_staff: false,
      invisible: false, discoverable: true, created_at: daysAgo(30 - k), ...stampOf(p, k),
    })),
  ];

  /* Who has finished which Mathematics chapter: everybody has every chapter
     before the one they are on. That is what Crew draws. */
  const chapter_completions = [];
  CLASS.forEach((p, k) => {
    for (let c = 1; c < p.at; c++) {
      chapter_completions.push({ user_id: p.id, module_code: "M1", chapter_id: `M1.0${c}`, completed_at: daysAgo(14 - c - (k % 4)) });
    }
  });
  chapter_completions.push({ user_id: me, module_code: "M1", chapter_id: "M1.01", completed_at: daysAgo(9) });

  const presence = CLASS.filter((p) => p.on).map((p) => ({
    user_id: p.id, module_code: "M1", chapter_id: `M1.0${p.at}`, lesson_id: null,
    display_name: p.cs || p.name.split(" ")[0], last_seen: ago(1),
  }));

  const squadrons = [
    { id: SQ_A, module_code: "M1", name: "Night Shift", blurb: "Mathematics, most evenings", status: "active", owner_id: "demo_sara",
      join_policy: "invite_only", invite_token: "nightshift", member_cap: 32, created_at: daysAgo(18) },
    { id: SQ_B, module_code: "M1", name: "Final Approach", blurb: "Exam practice, weekends", status: "active", owner_id: "demo_omar",
      join_policy: "open", invite_token: "finalappr", member_cap: 32, created_at: daysAgo(16) },
  ];
  const squadron_members = [
    { squadron_id: SQ_A, user_id: me, role: "member", muted: false, joined_at: daysAgo(17), last_read_at: ago(40), marking: "solid" },
    { squadron_id: SQ_B, user_id: me, role: "member", muted: false, joined_at: daysAgo(12), last_read_at: daysAgo(1, 21), marking: "solid" },
    ...CLASS.flatMap((p, k) => [
      ...(p.sq.includes("A") ? [{ squadron_id: SQ_A, user_id: p.id, role: p.id === "demo_sara" ? "owner" : "member", muted: false, joined_at: daysAgo(18 - (k % 5)), last_read_at: ago(3 + k), marking: "solid" }] : []),
      ...(p.sq.includes("B") ? [{ squadron_id: SQ_B, user_id: p.id, role: p.id === "demo_omar" ? "owner" : "member", muted: false, joined_at: daysAgo(16 - (k % 4)), last_read_at: ago(30 + k), marking: "solid" }] : []),
    ]),
  ];

  let n = 0;
  const msg = (sq, who, at, body, extra = {}) => ({
    id: `d1000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, squadron_id: sq, module_code: "M1", user_id: who,
    body, created_at: at, edited_at: null, deleted_at: null, reply_to: null, pinned_at: null, pinned_by: null, is_system: false, ...extra,
  });
  const comms_messages = [
    msg(SQ_A, "demo_sara", daysAgo(1, 20, 10), "Geometry exam before Thursday, everyone?"),
    msg(SQ_A, "demo_yousef", daysAgo(1, 20, 14), "Two lessons left in Algebra. Give me tonight."),
    msg(SQ_A, me, daysAgo(1, 20, 31), "Sat Geometry this afternoon. 2 out of 4. The circle area one caught me."),
    msg(SQ_A, "demo_mariam", daysAgo(1, 20, 36), "Radius or diameter?"),
    msg(SQ_A, me, daysAgo(1, 20, 37), "Diameter. Of course."),
    msg(SQ_A, "demo_dana", ago(95), "I put my transposing question in the module board. Someone please save me."),
    msg(SQ_A, "demo_sara", ago(88), "Answered it. Square first, then divide."),
    msg(SQ_A, "demo_mariam", ago(52), "Trig tonight at nine if anyone is on."),
    msg(SQ_A, "demo_yousef", ago(14), "I'm in."),
    msg(SQ_A, "demo_sara", ago(6), "Same. Bring the sine table."),
    msg(SQ_B, "demo_omar", daysAgo(2, 11, 0), "Saturday: full Mathematics papers, one after another, against the clock."),
    msg(SQ_B, "demo_bader", daysAgo(2, 11, 20), "Count me in. My times are awful."),
    msg(SQ_B, me, daysAgo(2, 12, 5), "In. I need the practice on Algebra."),
    msg(SQ_B, "demo_hamad", daysAgo(1, 9, 40), "Anyone finished Arithmetic? The ratio lesson lost me."),
  ];
  const mine = comms_messages.filter((m) => m.user_id === me);
  const comms_receipts = mine.flatMap((m) => {
    const others = CLASS.filter((p) => p.sq.includes(m.squadron_id === SQ_A ? "A" : "B")).map((p) => p.id);
    return others.map((uid, k) => ({ message_id: m.id, user_id: uid, delivered_at: m.created_at, read_at: k % 3 === 2 ? null : m.created_at }));
  });

  const thread = (id, who, at, title, body, best = null) => ({
    id, module_id: "M1", lesson_id: null, t: null, author_id: who, created_at: at, title, body, best_reply_id: best,
  });
  const lesson_threads = [
    thread("DT1", "demo_dana", ago(100), "Transposing with a square root: which step comes first?",
      "Algebra, lesson 1 transposes V = √(2gh) for h. I keep ending up with 2g/V² instead of V²/2g. What am I doing backwards?", "DT1.R1"),
    thread("DT2", "demo_yousef", ago(160), "Why is sin 30° exactly one half?",
      "Is there a way to see it without memorising the table?"),
    thread("DT3", me, daysAgo(1, 16, 20), "Geometry exam, question 2: radius or diameter?",
      "The question gives a radius of 2 m and I worked it out with 4 m. Posting it so nobody else does the same."),
    thread("DT4", "demo_hamad", daysAgo(3, 10, 5), "Quickest way to learn the powers of 2?",
      "I can do them slowly, but not under the exam clock."),
  ];
  const reply = (id, tid, who, at, body, parent = null) => ({ id, thread_id: tid, author_id: who, created_at: at, parent_id: parent, body });
  const lesson_replies = [
    reply("DT1.R1", "DT1", "demo_sara", ago(88), "Square both sides first: V² = 2gh. Then divide both sides by 2g, which gives h = V²/2g. You are dividing before you square."),
    reply("DT1.R2", "DT1", me, ago(80), "Writing every step on its own line stops me doing this. Same trick works for the pendulum formula."),
    reply("DT1.R3", "DT1", "demo_dana", ago(71), "That was it. Thank you both.", "DT1.R1"),
    reply("DT2.R1", "DT2", "demo_mariam", ago(140), "Cut an equilateral triangle in half. The side opposite the 30° angle is half the hypotenuse, so the ratio is exactly one half."),
    reply("DT3.R1", "DT3", "demo_omar", daysAgo(1, 17, 2), "Easy one to miss under the clock. I underline the word radius now."),
    reply("DT3.R2", "DT3", "demo_haya", daysAgo(1, 18, 40), "Did the same thing in the Physics exam. Thanks for posting it."),
  ];
  const thread_votes = [
    { thread_id: "DT1", user_id: "demo_yousef", dir: 1, created_at: ago(90) },
    { thread_id: "DT1", user_id: "demo_mariam", dir: 1, created_at: ago(85) },
    { thread_id: "DT1", user_id: me, dir: 1, created_at: ago(84) },
    { thread_id: "DT2", user_id: "demo_sara", dir: 1, created_at: ago(150) },
    { thread_id: "DT3", user_id: "demo_omar", dir: 1, created_at: daysAgo(1, 17) },
    { thread_id: "DT3", user_id: "demo_reem", dir: 1, created_at: daysAgo(1, 18) },
  ];
  const lesson_reply_votes = [
    { reply_id: "DT1.R1", user_id: "demo_dana", created_at: ago(75) },
    { reply_id: "DT1.R1", user_id: me, created_at: ago(79) },
    { reply_id: "DT2.R1", user_id: "demo_yousef", created_at: ago(130) },
  ];

  /* The right seat: one classmate you are studying with right now. */
  const copilot_sessions = [{ id: SEAT, started_at: ago(25), last_active_at: ago(2), ended_at: null }];
  const copilot_participants = [
    { session_id: SEAT, user_id: me, display_name: look.callsign || "You", joined_at: ago(25), left_at: null, at_module: "M1", at_place: "Algebra", at_since: ago(20) },
    { session_id: SEAT, user_id: "demo_sara", display_name: "SPARROW", joined_at: ago(25), left_at: null, at_module: "M1", at_place: "Geometry", at_since: ago(12) },
  ];
  const seat_messages = [
    { id: "d2000000-0000-4000-8000-000000000001", session_id: SEAT, user_id: "demo_sara", body: "Doing the Geometry exam now. Twenty minutes, no peeking.", kept: false, created_at: ago(14) },
    { id: "d2000000-0000-4000-8000-000000000002", session_id: SEAT, user_id: me, body: "Good luck. I'm on simultaneous equations.", kept: false, created_at: ago(13) },
  ];

  const save = (kind, ref, chapter, extra = {}) => ({
    id: `d3000000-0000-4000-8000-${String(ref).replace(/\W/g, "").padStart(12, "0").slice(-12)}`,
    user_id: me, module_id: "M1", kind, ref_id: ref, chapter, at_seconds: null, page: null, created_at: ago(200), ...extra,
  });
  const saves = [
    save("question", "M1.03.Q2", 3),
    save("question", "M1.02.Q4", 2),
    save("card", "M1.01.Q3", 1),
    save("card", "M1.04.Q1", 4),
    save("video", "M1.02.1", 2, { at_seconds: 312 }),
  ];

  const signed = (min) => ({ rot: Math.round((((min * 7) % 12) - 6) * 10) / 10, at: ago(min) });
  const progress = {
    "pw-lesson-done": { "M1.01.1": true, "M1.01.2": true, "M1.01.3": true, "M1.02.1": true, "M2.02.1": true },
    "pw-signoff": {
      "M1.01.1": signed(60 * 24 * 9), "M1.01.2": signed(60 * 24 * 8), "M1.01.3": signed(60 * 24 * 8 - 30),
      "M1.02.1": signed(60 * 24 * 2), "M2.02.1": signed(60 * 24 * 4),
    },
    "pw-lesson-pos": { "M1.02.2": 310 },
    "pw-quiz-scores": {
      "M1.01": { correct: 5, total: 5 }, "M1.02": { correct: 4, total: 5 }, "M1.03": { correct: 2, total: 4 },
      "M2.02": { correct: 5, total: 5 }, "M2.01": { correct: 3, total: 3 },
    },
    "pw-minimums": 85,
    "pw-hobbs": { M1: 15120, M2: 3900 },
    "pw-days": { n: 12, last: today },
    "pw-last-place": [{ kind: "lesson", moduleCode: "M1", chapterId: "M1.02", lessonId: "M1.02.2", pct: 0.41 }],
    ...(look.progress || {}),
  };

  return {
    pilot_profiles, chapter_completions, presence, squadrons, squadron_members,
    comms_messages, comms_receipts, lesson_threads, lesson_replies, thread_votes, lesson_reply_votes,
    copilot_sessions, copilot_participants, seat_messages, saves,
    user_progress: [{ user_id: me, data: progress }],
  };
}

/* The social functions the harness never needed. Each answers in the shape
   its SQL returns (0005, 0009, 0011, 0022), from the rows above. */
export const DEMO_RPC = {
  my_seat: (s, b) => {
    const mineIn = s.copilot_participants.filter((p) => p.user_id === b.p_me && !p.left_at);
    for (const m of mineIn) {
      const cs = s.copilot_sessions.find((x) => x.id === m.session_id && !x.ended_at);
      const other = s.copilot_participants.find((p) => p.session_id === m.session_id && p.user_id !== b.p_me && !p.left_at);
      if (cs && other) {
        return [{ session_id: cs.id, partner_id: other.user_id, partner_module: other.at_module, partner_place: other.at_place,
          partner_since: other.at_since, started_at: cs.started_at, last_active_at: cs.last_active_at }];
      }
    }
    return [];
  },
  my_seat_requests: () => [],
  right_seat: (s, b) => {
    const mine = new Set(s.squadron_members.filter((m) => m.user_id === b.p_me).map((m) => m.squadron_id));
    const since = Date.now() - 90 * 1000;
    const seen = new Set();
    return s.presence
      .filter((p) => p.user_id !== b.p_me && Date.parse(p.last_seen) >= since)
      .map((p) => ({ p, sq: s.squadron_members.find((m) => m.user_id === p.user_id && mine.has(m.squadron_id)) }))
      .filter(({ p, sq }) => sq && !seen.has(p.user_id) && seen.add(p.user_id))
      .map(({ p, sq }) => ({ user_id: p.user_id, squadron_id: sq.squadron_id, module_code: p.module_code, chapter_id: p.chapter_id, last_seen: p.last_seen }));
  },
  squadron_roster: (s, b) => s.squadron_members
    .filter((m) => m.squadron_id === b.sid)
    .map((m) => {
      const p = s.pilot_profiles.find((x) => x.user_id === m.user_id) || {};
      return { user_id: m.user_id, callsign: p.callsign || null, livery: null, marking: m.marking || "solid", is_staff: !!p.is_staff, joined_at: m.joined_at };
    }),
  discover_squadrons: (s, b) => s.squadrons.map((q) => {
    const members = s.squadron_members.filter((m) => m.squadron_id === q.id);
    return { id: q.id, name: q.name, blurb: q.blurb, module_code: q.module_code, exam_window: null, join_policy: q.join_policy,
      members: members.length, active_week: members.length, is_full: false, known_ids: [],
      already_in: members.some((m) => m.user_id === b.p_me), requested: false };
  }),
  people_search: (s, b) => {
    const q = String(b.p_q || "").trim().toLowerCase();
    if (!q) return [];
    return s.pilot_profiles
      .filter((p) => p.user_id !== b.p_me && `${p.callsign || ""} ${p.real_name || ""}`.toLowerCase().includes(q))
      .map((p) => ({ user_id: p.user_id, display_name: p.callsign || p.real_name, module_code: "M1", shares_squadron: false }));
  },
  seat_heartbeat: () => null,
  expire_right_seats: () => null,
  rate_limit_take: () => true,
  post_opener_if_quiet: () => null,
  shared_completions: () => [],
  question_miss_stats: () => [],
  papers_for: () => [],
};
