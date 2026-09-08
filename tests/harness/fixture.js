/* THE FIXTURE — two students, an instructor, and marks that exercise the rules.
 *
 * Deliberately small and deliberately awkward: a mark from each student, an
 * ANONYMOUS question from one of them (so a test can assert the other's client
 * never receives its author), a correction (which must be invisible to
 * everybody but its author and staff), and an ink stroke.
 */
export const PAPER_ID = "M1.DEV";   // the dev paper: real body text, 14 pages
export const MODULE = "M1";

export const PROFILES = {
  student_one: { user_id: "student_one", callsign: "Alex", is_staff: false, invisible: false, code: "K4M" },
  student_two: { user_id: "student_two", callsign: "Dana", is_staff: false, invisible: false, code: "P7Q" },
  instructor:  { user_id: "instructor",  callsign: "Haddad", is_staff: true,  invisible: false, code: "A2Z" },
};

/* The passages are real strings from the fixture paper, so a text anchor over
   them resolves the way it will in production rather than against invented
   text that always matches. */
export const MARKS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    paper_id: PAPER_ID, module_code: MODULE, paper_version: 1,
    author_id: "student_one", kind: "highlight", ring: "module",
    body: null, colour: "critical", thread_id: null, resolved_at: null, status: "ok",
    anchor: { quote: "dynamically-typed languages", prefix: "", suffix: "" },
    hint: null, anonymous: false, agree_count: 0,
    created_at: "2026-09-01T09:00:00.000Z", updated_at: "2026-09-01T09:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    paper_id: PAPER_ID, module_code: MODULE, paper_version: 1,
    author_id: "student_two", kind: "highlight", ring: "module",
    body: null, colour: "definition", thread_id: null, resolved_at: null, status: "ok",
    anchor: { quote: "trace-based", prefix: "", suffix: "" },
    hint: null, anonymous: false, agree_count: 3,
    created_at: "2026-09-02T09:00:00.000Z", updated_at: "2026-09-02T09:00:00.000Z",
  },
  {
    /* The one the anonymity test is about. Written by student_two; student_one's
       client must never see `author_id`, and the instructor's must. */
    id: "33333333-3333-4333-8333-333333333333",
    paper_id: PAPER_ID, module_code: MODULE, paper_version: 1,
    author_id: "student_two", kind: "question", ring: "module",
    body: "Why does the trace tree need a guard here?", colour: "unsure",
    thread_id: "T-fixture-1", resolved_at: null, status: "ok",
    anchor: { quote: "type specialization", prefix: "", suffix: "" },
    hint: null, anonymous: true, agree_count: 0,
    created_at: "2026-09-03T09:00:00.000Z", updated_at: "2026-09-03T09:00:00.000Z",
  },
  {
    /* Invisible to student_one entirely — not hidden in the DOM, absent. */
    id: "44444444-4444-4444-8444-444444444444",
    paper_id: PAPER_ID, module_code: MODULE, paper_version: 1,
    author_id: "student_two", kind: "correction", ring: "solo",
    body: "Figure 3 is mislabelled.", colour: null, thread_id: null,
    resolved_at: null, status: "ok",
    anchor: { quote: "Figure 3", prefix: "", suffix: "" },
    hint: null, anonymous: false, agree_count: 0,
    created_at: "2026-09-04T09:00:00.000Z", updated_at: "2026-09-04T09:00:00.000Z",
  },
];

export const INK = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    paper_id: PAPER_ID, module_code: MODULE, paper_version: 1,
    author_id: "student_one", page: 1, tool: "pen", colour: "graphite",
    width: 0.0032, ring: "solo",
    points: [[0.2, 0.3], [0.35, 0.42], [0.5, 0.31]],
    created_at: "2026-09-05T09:00:00.000Z",
  },
];

export const THREADS = [
  {
    id: "T-fixture-1", module_id: MODULE, lesson_id: null,
    title: "A question on a paper", body: "> type specialization\n\nWhy does the trace tree need a guard here?",
    author_id: "student_two", created_at: "2026-09-03T09:00:00.000Z",
    paper_id: PAPER_ID, page: 1,
  },
];
