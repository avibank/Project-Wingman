/* =============================================================================
   A READY ROOM WORTH LOOKING AT, for the harness.
   -----------------------------------------------------------------------------
   From student_one's side (Alex): two squadrons, a transcript with read,
   delivered and unread messages, questions in every state, votes, one flight
   together and somebody in the room.

     npm run harness, then:  node tests/harness/room-seed.mjs
   or import { seedRoom } and call it from a runner.
   ========================================================================= */
import { pathToFileURL } from "node:url";

export async function seedRoom(BASE = process.env.HARNESS || "http://127.0.0.1:5190") {
  const post = async (table, rows) => {
    const r = await fetch(`${BASE}/rest/v1/${table}`, {
      method: "POST", headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  };
  /* Today's times are counted back from now, in the same order, so a seed run at
     08:52 cannot make a message at 12:40 — one from the future, unread whatever
     the read mark says. Earlier days keep their clock times. */
  const iso = (daysAgo, hh, mm) => {
    if (daysAgo === 0) return new Date(Date.now() - (13 * 60 - (hh * 60 + mm) + 5) * 60000).toISOString();
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0); return d.toISOString();
  };
  const ME = "student_one", DANA = "student_two", HADDAD = "instructor";
  const JT = "aaaaaaaa-0000-4000-8000-000000000001";
  const NS = "aaaaaaaa-0000-4000-8000-000000000002";
  const m = (n) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`;
  
  await fetch(`${BASE}/harness/reset`, { method: "POST" }).catch(() => {});
  
  await post("squadrons", [
    { id: JT, module_code: "M1", name: "JT Squadron", blurb: "Module 1, evenings", status: "active", owner_id: DANA,
      join_policy: "invite_only", invite_token: "jtsq1234", member_cap: 32, created_at: iso(8, 10, 0) },
    { id: NS, module_code: "M1", name: "Night Shift", blurb: null, status: "active", owner_id: ME,
      join_policy: "invite_only", invite_token: "nshift12", member_cap: 32, created_at: iso(12, 21, 0) },
  ]);
  await post("squadron_members", [
    { squadron_id: JT, user_id: ME, role: "member", muted: false, joined_at: iso(8, 10, 5), last_read_at: iso(0, 12, 38), marking: "solid" },
    { squadron_id: JT, user_id: DANA, role: "owner", muted: false, joined_at: iso(8, 10, 0), last_read_at: iso(0, 12, 39), marking: "solid" },
    { squadron_id: JT, user_id: HADDAD, role: "member", muted: false, joined_at: iso(8, 11, 0), last_read_at: iso(1, 21, 10), marking: "solid" },
    { squadron_id: NS, user_id: ME, role: "owner", muted: false, joined_at: iso(12, 21, 0), last_read_at: iso(0, 9, 0), marking: "solid" },
    { squadron_id: NS, user_id: HADDAD, role: "member", muted: false, joined_at: iso(12, 21, 5), last_read_at: iso(2, 18, 44), marking: "solid" },
  ]);
  const msg = (n, sq, who, at, body, extra = {}) => ({
    id: m(n), squadron_id: sq, module_code: "M1", user_id: who, body, created_at: at, edited_at: null,
    deleted_at: null, reply_to: null, pinned_at: null, pinned_by: null, is_system: false, ...extra,
  });
  await post("comms_messages", [
    msg(1, JT, DANA, iso(1, 20, 14), "Right — quiz 2 tomorrow. Who has actually finished chapter 4?"),
    msg(2, JT, HADDAD, iso(1, 20, 15), "Two lessons left. Give me tonight."),
    msg(3, JT, ME, iso(1, 20, 31), "Same. I will put the notes in the paper so you can all see them."),
    msg(4, JT, ME, iso(0, 12, 33), "This is the bit that caught me out."),
    msg(5, JT, DANA, iso(0, 12, 36), "Oh that is the one with the double label."),
    msg(6, JT, DANA, iso(0, 12, 36), "Haddad posted it in the module threads an hour ago."),
    msg(7, JT, HADDAD, iso(0, 12, 40), "Link it here, I never open threads on my phone", { reply_to: m(6) }),
    msg(8, JT, HADDAD, iso(0, 12, 41), "so the static port one — did anyone actually get 3?"),
    msg(9, NS, HADDAD, iso(2, 18, 2), "Starting at nine tonight if anyone is on."),
    msg(10, NS, ME, iso(2, 18, 40), "pushed the notes to the paper"),
  ]);
  await post("comms_receipts", [
    { message_id: m(3), user_id: DANA, delivered_at: iso(1, 20, 32), read_at: iso(1, 20, 32) },
    { message_id: m(3), user_id: HADDAD, delivered_at: iso(1, 20, 33), read_at: iso(1, 21, 10) },
    { message_id: m(4), user_id: DANA, delivered_at: iso(0, 12, 34), read_at: iso(0, 12, 35) },
    { message_id: m(4), user_id: HADDAD, delivered_at: iso(0, 12, 34), read_at: null },
    { message_id: m(10), user_id: HADDAD, delivered_at: iso(2, 18, 40), read_at: null },
  ]);
  await post("lesson_threads", [
    { id: "T-rr-1", module_id: "M1", lesson_id: null, t: null, author_id: DANA, created_at: iso(0, 12, 18),
      title: "Pitot blockage — which instruments lie and which stay honest?",
      body: "Lesson 3 says a blocked pitot with a clear static kills the ASI only. But the worked example in the paper has the altimeter reading low as well.\n\nIs the paper wrong, or am I mixing up a blocked pitot with a blocked static?", best_reply_id: null },
    { id: "T-rr-2", module_id: "M1", lesson_id: null, t: null, author_id: ME, created_at: iso(0, 11, 2),
      title: "Correction — the diagram on p.126 labels the static port twice",
      body: "The lower callout points at the drain, not the static port.", best_reply_id: null },
    { id: "T-rr-3", module_id: "M1", lesson_id: null, t: null, author_id: HADDAD, created_at: iso(2, 9, 30),
      title: "Synchro vs resolver — what actually changes in the output?",
      body: "Both take a shaft angle and put out an AC signal. I can recite the winding counts but I cannot say in one sentence what the difference buys you.", best_reply_id: "T-rr-3.R1" },
    { id: "T-rr-4", module_id: "M1", lesson_id: null, t: null, author_id: DANA, created_at: iso(3, 16, 5),
      title: "Does anyone have a clean way to remember which way the capsule moves in an ASI?",
      body: "I get it right in the exam and wrong in the hangar.", best_reply_id: null },
  ]);
  await post("lesson_replies", [
    { id: "T-rr-1.R1", thread_id: "T-rr-1", author_id: HADDAD, created_at: iso(0, 12, 26), parent_id: null,
      body: "You are mixing the two. Blocked pitot, clear static: the ASI behaves like an altimeter. The altimeter and VSI never touch pitot pressure, so they stay honest." },
    { id: "T-rr-1.R2", thread_id: "T-rr-1", author_id: ME, created_at: iso(0, 12, 31), parent_id: null,
      body: "The worked example has a blocked static as well — read the second line of the setup. Two faults, not one." },
    { id: "T-rr-1.R3", thread_id: "T-rr-1", author_id: DANA, created_at: iso(0, 12, 44), parent_id: "T-rr-1.R2",
      body: "That is it. Thank you." },
    { id: "T-rr-2.R1", thread_id: "T-rr-2", author_id: HADDAD, created_at: iso(0, 11, 40), parent_id: null,
      body: "Confirmed, mine does the same. Marked it as a correction so it routes to the author." },
    { id: "T-rr-3.R1", thread_id: "T-rr-3", author_id: DANA, created_at: iso(2, 10, 0), parent_id: null,
      body: "A synchro gives you three stator outputs whose ratios encode the angle; a resolver gives you two, at 90°, which come out as sine and cosine of the angle directly." },
    { id: "T-rr-3.R2", thread_id: "T-rr-3", author_id: ME, created_at: iso(2, 10, 20), parent_id: null,
      body: "Worth adding: that is also why resolvers turn up wherever the next box is digital." },
  ]);
  await post("thread_votes", [
    { thread_id: "T-rr-1", user_id: HADDAD, dir: 1, created_at: iso(0, 12, 20) },
    { thread_id: "T-rr-1", user_id: ME, dir: 1, created_at: iso(0, 12, 21) },
    { thread_id: "T-rr-3", user_id: DANA, dir: 1, created_at: iso(2, 9, 40) },
  ]);
  await post("lesson_reply_votes", [
    { reply_id: "T-rr-1.R1", user_id: DANA, created_at: iso(0, 12, 30) },
    { reply_id: "T-rr-3.R1", user_id: ME, created_at: iso(2, 10, 5) },
    { reply_id: "T-rr-3.R1", user_id: HADDAD, created_at: iso(2, 10, 6) },
  ]);
  await post("copilot_participants", [
    { session_id: "cccccccc-0000-4000-8000-000000000001", user_id: ME, display_name: "Alex", joined_at: iso(1, 19, 0), left_at: iso(1, 20, 0) },
    { session_id: "cccccccc-0000-4000-8000-000000000001", user_id: DANA, display_name: "Dana", joined_at: iso(1, 19, 0), left_at: iso(1, 20, 0) },
  ]);
  await post("presence", [{ user_id: DANA, last_seen: new Date().toISOString(), module_code: "M1", lesson_id: null }]);
  return "seeded: 2 squadrons, 10 messages, 5 receipts, 4 questions, 6 replies, votes, a flight, presence";
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  seedRoom().then((m) => console.log(m)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
