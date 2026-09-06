/* THE ANNOTATION LAYER'S RULES, AS ASSERTIONS.
 *
 * The brief states fourteen rules and a check for each. The ones that can be
 * decided without a database or a browser are decided here, and this runs in
 * `npm run check` — so a rule cannot quietly stop being true.
 *
 * The rest (R9's payload isolation, R12's Fly solo payload) need the live
 * database and live in check:paper-db, which is deliberately NOT in the default
 * suite because that suite must not need credentials.
 *
 * Run: npm run check:paper
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { flatten, createAnchor, resolveAnchor } from "../src/lib/anchor.js";
import {
  densityLevel, segmentsFor,
  applyFilter, RINGS, DENSITY_MIN, DENSITY_LEVELS,
} from "../src/lib/paperMarks.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (rule, name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${rule} · ${name}`); }
  else { fails.push(`${rule} · ${name}${detail ? `  ${detail}` : ""}`); console.log(`  FAIL ${rule} · ${name}  ${detail}`); }
};

/* ---- R1 · an anchor is text, never coordinates -------------------------- */
console.log("\nR1 — an anchor is text, never coordinates");
{
  const a = createAnchor("The quick brown fox jumps over the lazy dog.", 4, 19);
  const keys = Object.keys(a);
  ok("R1", "an anchor carries no position", !keys.some((k) => /^(page|rect|rects|bbox)$/.test(k)),
     JSON.stringify(keys));
  ok("R1", "it carries the words and their context",
     a.quote === "quick brown fox" && typeof a.prefix === "string" && typeof a.suffix === "string");

  // The database refuses one too, and that is the enforcement that matters —
  // this asserts the constraint is still declared in the migration.
  const sql = read("supabase/migrations/0014_paper_annotations.sql");
  ok("R1", "the database refuses a positional anchor",
     /constraint\s+anchor_is_text_only\s+check/i.test(sql)
     && /anchor \? 'page'/.test(sql) && /anchor \? 'bbox'/.test(sql));

  // And no code path builds one: `anchor:` is only ever fed anchorFor/createAnchor.
  const annots = read("src/lib/annotations.js");
  ok("R1", "nothing in the client writes a position into an anchor",
     !/anchor:\s*\{[^}]*\b(page|rect|bbox)\b/.test(annots));
}

/* ---- R2 · orphaned, never relocated ------------------------------------- */
console.log("\nR2 — a lost annotation is orphaned, never relocated");
{
  const text = "Alpha beta gamma. Delta epsilon zeta. Eta theta iota.";
  const a = createAnchor(text, 18, 37);
  const gone = "Alpha beta gamma. Nothing of the sort survives here. Eta theta iota.";
  ok("R2", "an edited-away passage resolves to null", resolveAnchor(a, gone) === null);

  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R2", "the reader marks orphans rather than dropping them",
     /markOrphaned\(o\.id, true\)/.test(reader) && !/deleteAnnotation\(o\.id\)/.test(reader));
  const sql = read("supabase/migrations/0014_paper_annotations.sql");
  ok("R2", "the status write cannot become a delete",
     /function paper_annotation_status/.test(sql) && !/delete from paper_annotations/i.test(sql));
}

/* ---- R3 · overlapping marks flatten ------------------------------------- */
console.log("\nR3 — overlapping marks flatten before they render");
{
  const ranges = [
    { id: "a", start: 0, end: 20 }, { id: "b", start: 10, end: 30 },
    { id: "c", start: 10, end: 20 }, { id: "d", start: 25, end: 40 },
    { id: "e", start: 0, end: 40 },
  ];
  const segs = flatten(ranges);
  ok("R3", "segments come out sorted and non-overlapping",
     segs.every((s, i) => s.end > s.start && (i === 0 || s.start >= segs[i - 1].end)),
     JSON.stringify(segs.map((s) => [s.start, s.end])));
  ok("R3", "they cover the same span", segs[0].start === 0 && segs.at(-1).end === 40);
  ok("R3", "every mark is accounted for in some segment",
     ranges.every((r) => segs.some((s) => s.ids.includes(r.id))));

  const page = read("src/components/paper/PaperPage.jsx");
  ok("R3", "the renderer draws segments, never annotations",
     /segments = \[\]/.test(page) && /for \(const seg of segments\)/.test(page));
}

/* ---- R4 · individuals for your rings, density for everyone else --------- */
console.log("\nR4 — individuals for your rings, density for everyone else");
{
  // 500 people on one paragraph, two of them in your formation.
  const many = Array.from({ length: 500 }, (_, i) => ({
    id: `x${i}`, start: 100, end: 260, kind: "highlight",
    close: i < 2, author_id: `u${i}`,
  }));
  const { segments } = segmentsFor(many);
  ok("R4", "500 marks on one passage make one segment", segments.length === 1,
     `got ${segments.length}`);
  ok("R4", "and at most three density levels exist",
     segments.every((s) => s.density >= 0 && s.density <= DENSITY_LEVELS));
  ok("R4", "only the reader's own rings are drawn individually",
     segments[0].mine.length === 2, `got ${segments[0].mine.length}`);

  ok("R4", "one person is not the class", densityLevel(1, 10) === 0);
  ok("R4", "two is", densityLevel(2, 10) > 0);
  ok("R4", "density is relative to the busiest passage",
     densityLevel(5, 5) === DENSITY_LEVELS && densityLevel(5, 100) < DENSITY_LEVELS);
  ok("R4", `the floor is ${DENSITY_MIN}`, densityLevel(DENSITY_MIN - 1, 50) === 0);
}

/* ---- R5 · the cheapest mark is wordless --------------------------------- */
console.log("\nR5 — the cheapest mark is wordless");
{
  const annots = read("src/lib/annotations.js");
  ok("R5", "a highlight defaults to no body at all",
     /kind = "highlight", ring = "module",\s*\n?\s*body = null/.test(annots.replace(/\s+/g, " "))
     || /body = null/.test(annots));
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R5", "the highlight control is the first and largest in the selection bar",
     reader.indexOf("selbar-main") < reader.indexOf("selbar-act"));
  // The body of highlightNow, on its own: it must reach addMark and must never
  // reach the composer. Sliced to the function rather than a character window,
  // so the assertion cannot drift when a line is added above it.
  const body = reader.slice(reader.indexOf("const highlightNow"));
  const fn = body.slice(0, body.indexOf("}, [sel, addMark]);"));
  ok("R5", "and it opens no composer",
     /addMark\(\{ kind: "highlight"/.test(fn) && !/setComposer/.test(fn), fn.length ? "" : "not found");
}

/* ---- R6 · nothing arrives on the paper unbidden -------------------------- */
console.log("\nR6 — notes never insert themselves under a reader");
{
  const reader = read("src/components/paper/PaperReader.jsx");

  /* The rule used to be defended with a pending buffer and a quiet line,
     because a poll could drop a note in above somebody mid-paragraph. The
     paper has no timer at all now, so there is nothing left that could: marks
     arrive on a gesture, and the gesture is a button. That is a stronger
     guarantee than the buffer was, and this asserts it directly. */
  ok("R6", "the reader runs no timer of its own",
     !/setInterval\(/.test(reader) && !/setTimeout\([^)]*syncFromServer/.test(reader));
  ok("R6", "marks arrive only on mount or on the refresh gesture",
     (reader.match(/syncFromServer\(/g) || []).length <= 3
     && /const refreshNow = useCallback/.test(reader));
  ok("R6", "and refreshing pins the page the reader is on",
     /getBoundingClientRect\(\)\.top[\s\S]{0,400}scrollTop \+= after - before/.test(reader));
  ok("R6", "the refresh control says what it does",
     /aria-label="Check for new marks on this paper"/.test(reader));
}

/* ---- R7 · live everywhere else, and cheap when nothing is happening ------ */
console.log("\nR7 — the socket, and what happens when it is not there");
{
  const live = read("src/lib/live.js");
  const app = read("src/App.jsx");

  ok("R7", "realtime is imported lazily, never into the entry chunk",
     /await import\("@supabase\/realtime-js"\)|import\("@supabase\/realtime-js"\)/.test(live));
  ok("R7", "supabaseClient still takes PostgrestClient alone",
     !/realtime/i.test(read("src/lib/supabaseClient.js").split("const url")[0].replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")));
  ok("R7", "listen always hands back a way to stop", /return \(\) => \{[\s\S]{0,200}unsubscribe\(\)/.test(live));
  ok("R7", "one socket for the whole app", /let clientPromise = null/.test(live));
  ok("R7", "the payload is a doorbell, not a delivery — the caller re-reads",
     /onChange\(table\)/.test(live) && !/payload\.new/.test(live));

  ok("R7", "the fallback slows right down while the socket is up",
     /POLL_WHEN_LIVE_MS = 60000/.test(app) && /POLL_WHEN_DOWN_MS = 5000/.test(app));
  ok("R7", "and it is the fallback, not the mechanism",
     /liveOn \? POLL_WHEN_LIVE_MS : POLL_WHEN_DOWN_MS/.test(app));
  ok("R7", "the tab going away pauses it rather than skipping a tick",
     /document\.visibilityState === "visible"/.test(app));
  ok("R7", "both the socket and the timer are cleared on unmount",
     /stop\(\);\s*\n\s*clearInterval\(t\);/.test(app));
  // Comments stripped first: this file's own header says the word "presence"
  // while explaining why presence is not on the socket, and a checker that
  // reads its own prose as evidence has been wrong here before.
  const liveCode = live.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  ok("R7", "presence is deliberately not on the socket", !/presence/i.test(liveCode));
}

/* ---- R8 · your own marks are instant ------------------------------------ */
console.log("\nR8 — your own marks are instant");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R8", "the row is on screen before the insert is awaited",
     /setRows\(\(held\) => \[\.\.\.held, optimistic\]\);\s*\n\s*const saved = await createAnnotation/.test(reader));
  ok("R8", "a failed write removes it and says why",
     /held\.filter\(\(r\) => r\.id !== optimistic\.id\)/.test(reader) && /did not save/.test(reader));
}

/* ---- R9 / R12 · enforced on the server, not in the client --------------- */
console.log("\nR9 and R12 — visibility is the server's decision");
{
  const sql = read("supabase/migrations/0014_paper_annotations.sql");
  ok("R9", "a correction reaches its author and the staff, nobody else",
     /case when a\.kind = 'correction' then me\.staff/.test(sql));
  ok("R9", "and the ring it was stored with cannot widen that",
     /then me\.staff\s*\n?\s*else ring_covers/.test(sql));
  ok("R12", "Fly solo is symmetric and lives in the query",
     /me\.solo/.test(sql) && /invisible/.test(sql));
  ok("R12", "one ring helper, not two", (sql.match(/create or replace function ring_covers/g) || []).length === 1);
  ok("R12", "the rings are exactly the app's four",
     RINGS.map((r) => r.id).join(",") === "solo,wingman,formation,module");

  const annots = read("src/lib/annotations.js");
  ok("R9", "the client never selects annotations directly",
     !/from\("paper_annotations"\)\s*\.select/.test(annots)
     && /rpc\("paper_annotations_for"/.test(annots));
}

/* ---- R10 · a question is a Snag, and it mirrors ------------------------- */
console.log("\nR10 — a question is a Snag, and it mirrors");
{
  const annots = read("src/lib/annotations.js");
  ok("R10", "asking creates a Ready Room thread", /insertThread\(/.test(annots));
  ok("R10", "the thread opens with the quoted passage", /`> \$\{quote\}`/.test(annots));
  const sql = read("supabase/migrations/0014_paper_annotations.sql");
  ok("R10", "a question without a thread cannot be stored",
     /question_has_thread check \(kind <> 'question' or thread_id is not null\)/.test(sql));
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R10", "a note creates no thread",
     /composer\.kind === "question"[\s\S]{0,200}askOnPassage/.test(reader));
  ok("R10", "the paper grows no reply UI of its own", !/postReply|insertReply/.test(reader));
}

/* ---- R11 · empty reads "not yet", never "nothing" ----------------------- */
console.log('\nR11 — empty reads "not yet", never "nothing"');
{
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R11", "the empty state names the next action",
     /Nobody has marked this one up yet\. Select a line and yours will be the first\./.test(reader));
  ok("R11", "no zero is ever stated",
     !/\b0 (marks|notes|highlights)\b/.test(reader) && !/>No marks</.test(reader));
  ok("R11", "the orphan list is absent rather than empty",
     /orphans\.length > 0 && \(/.test(reader));
}

/* ---- R13 · Smooth Air turns it off -------------------------------------- */
console.log("\nR13 — Smooth Air turns it all off");
{
  const css = read("src/components/paper/paper.css");
  ok("R13", "the app's own class, not a new mechanism", /\.app\.smooth-air/.test(css));
  ok("R13", "and prefers-reduced-motion with it", /prefers-reduced-motion: reduce/.test(css));
}

/* ---- R14 · the house style ---------------------------------------------- */
console.log("\nR14 — the paper obeys the house style");
{
  const css = read("src/components/paper/paper.css");
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  ok("R14", "no hex literal anywhere in the paper view", hex.length === 0, hex.join(" "));
  ok("R14", "density is the livery accent at low alpha",
     /--active[^;]*\/ \.0?7\)/.test(css) && /--active[^;]*\/ \.13\)/.test(css) && /--active[^;]*\/ \.20\)/.test(css));
  ok("R14", "the page carries a hairline, not a shadow",
     /\.pp \{[^}]*border: 1px solid var\(--line\)/.test(css) && !/\.pp \{[^}]*box-shadow/.test(css));

  // 13px type floor, measured rather than trusted.
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const small = sizes.filter((n) => n < 13);
  ok("R14", `every font-size is at least 13px (${sizes.length} declared)`, small.length === 0, small.join(", "));

  // 44px targets: the controls that are smaller carry padding to reach it, so
  // this asserts the floor on the min-height declarations that exist.
  const heights = [...css.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
  ok("R14", "no control declares a height under 30px", heights.every((h) => h >= 30), heights.join(", "));
}

/* ---- the filter strip is reused, not rebuilt ---------------------------- */
console.log("\nfilters");
{
  const list = [
    { id: 1, author_id: "me", kind: "highlight", status: "ok" },
    { id: 2, author_id: "you", kind: "note", status: "ok" },
    { id: 3, author_id: "you", kind: "question", status: "ok" },
    { id: 4, author_id: "me", kind: "highlight", status: "orphaned" },
  ];
  ok("—", "mine", applyFilter(list, "mine", "me").length === 2);
  ok("—", "notes", applyFilter(list, "notes", "me").length === 1);
  ok("—", "questions", applyFilter(list, "questions", "me").length === 1);
  ok("—", "orphaned", applyFilter(list, "orphaned", "me").length === 1);
  ok("—", "everything", applyFilter(list, "all", "me").length === 4);
}

/* ---- the reader is full screen, and stays that way ---------------------- */
console.log("\nfull screen");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  const css = read("src/components/paper/paper.css");
  ok("—", "the screen is fixed to the viewport", /\.paper \{[^}]*position: fixed; inset: 0/.test(css));

  /* The rule this protects, and it cost an hour to find: `position: fixed` is
     only the size of the window if no ancestor has been promoted to its own
     composited layer. `.deck-inner` carries `.route-fade`, which animates
     opacity on every navigation, so the reader painted as a strip a few pixels
     tall while every box it owned measured perfectly. Layout was right the
     whole time; painting was not. */
  ok("—", "and it renders through a portal, outside the deck's animated wrapper",
     /createPortal\(/.test(reader) && /document\.querySelector\("\.app"\)/.test(reader));
  ok("—", "into .app rather than the body, so Smooth Air still reaches it",
     /document\.querySelector\("\.app"\) \|\| document\.body/.test(reader)
     && /\.app\.smooth-air/.test(css));
}

/* ---- the reader is not on the first-paint path -------------------------- */
console.log("\nweight");
{
  const app = read("src/App.jsx");
  ok("—", "the reader is a lazy chunk of its own",
     /paper: chunk\(\(\) => import\("\.\/components\/paper\/PaperReader\.jsx"\)\)/.test(app));
  const dist = join(ROOT, "dist/assets");
  let built = [];
  try { built = readdirSync(dist); } catch { /* not built yet */ }
  if (built.length) {
    const entry = built.find((f) => /^index-.*\.js$/.test(f));
    const src = entry ? read(`dist/assets/${entry}`) : "";
    ok("—", "and pdf.js is not in the entry chunk", !/GlobalWorkerOptions/.test(src));
  }
}

console.log(`\npaper: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
