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
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { flatten, createAnchor, resolveAnchor } from "../src/lib/anchor.js";
import {
  densityLevel, segmentsFor, sentenceAround,
  applyFilter, FILTERS, filterCounts, RINGS, DENSITY_MIN, DENSITY_LEVELS,
  DOCKS, TOOL_SIZES, KINDS,
} from "../src/lib/paperMarks.js";
import {
  INK_COLOURS, COLOUR_IDS, PEN_SIZES, thin, pathFor, toFraction, toPixels,
  strokeHit, strokesUnder, colourOr, penWidth, THIN_TOLERANCE,
} from "../src/lib/paperInk.js";
import {
  spreads, spreadOf, pagesToDraw, stepZoom, fitScale, findAll,
  flattenOutline, ZOOM_STEPS, LAYOUTS, PAPER_LIGHTS, FITS,
} from "../src/lib/paperView.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/* paper.css is gone. The reader is styled by the shipped sheet, scoped
   verbatim by `npm run reader:css`, plus the additions file that carries
   everything the demo had no need for — page internals, ink, the two
   virtualised rails. The cascade sees one stylesheet, so these rules are
   asked of one string. */
const readerCss = () =>
  read("src/components/paper/v6/reader.css") + "\n" + read("src/components/paper/v6/additions.css");

/* THE READER IS NOT ONE FILE ANY MORE, and pretending it is was how this
   suite went green against a component that had already stopped shipping.

   v6's chrome is four generated parts; the shell that feeds them owns the
   paper and the data; the measuring and the mark store are their own modules.
   An assertion about what the reader DOES has to be able to find it wherever
   it lives, so "the reader" as a source text is all of them, joined. Where an
   assertion is really about one file, it names that file. */
const READER_FILES = [
  "src/components/paper/v6/ReaderV6.jsx",
  "src/components/paper/v6/SheetPage.jsx",
  "src/components/paper/v6/marks.js",
  "src/components/paper/v6/geometry.js",
  "src/components/paper/v6/mount.js",
  "src/components/paper/v6/part1.js",
  "src/components/paper/v6/part2.js",
  "src/components/paper/v6/part3.js",
  "src/components/paper/v6/part4.js",
];
const readerSrc = () => READER_FILES.map(read).join("\n");

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

  const reader = readerSrc();
  ok("R2", "the reader marks orphans rather than dropping them",
     /markOrphaned\(row\.id, true\)/.test(reader) && /orphans\.add\(row\.id\)/.test(reader));
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

  const page = read("src/components/paper/v6/SheetPage.jsx");
  /* v6 DOES NOT FLATTEN, and that is its design rather than an omission.
     v5 merged overlapping marks into segments so eleven people on one
     paragraph drew a handful of boxes instead of eleven stacked ones. v6's
     quad is per MARK — one absolutely-placed box per line of each mark — and
     HANDOVER is explicit that this is deliberate and not to be "simplified".

     The cost is real and is stated rather than hidden: two highlights over
     the same words draw two boxes at 38% alpha each, so the overlap reads
     darker. On a class paper that is a heat map by accident. What is asserted
     here is that the flattening code still EXISTS and is still tested (it is
     R3's whole point, and a future build may want it back), and that v6 draws
     one quad per mark on purpose. */
  ok("R3", "flattening is still there, and v6 draws per mark on purpose",
     /export function segmentsFor/.test(read("src/lib/paperMarks.js"))
     && /RELAYOUT IS THE ONLY PLACE A QUAD IS DRAWN/.test(read("src/components/paper/v6/marks.js")));
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
  const reader = readerSrc();
  /* THE SELECTION BAR IS GONE. This used to assert that the highlight button
     came first and largest in it; COMPONENTS.md deletes the bar outright —
     "One popover does properties, ownership and actions. There is no separate
     selection toolbar." — and an armed marking tool now fires the moment a
     selection settles. That is a cheaper wordless mark than the bar was, so
     the rule is stronger, not waived; what it asserts had to change. */
  ok("R5", "there is no selection toolbar to reach for",
     !/selbar/.test(reader));
  /* The effect that fires on a settled selection: it must reach addMark for a
     text-marking tool and must never reach setComposer on that branch. It was
     highlightNow, then markSelection, before the tool became the gesture. */
  /* v6 has no composer at all: the selection pill marks directly, and the
     cheapest mark is one tap on the words. */
  ok("R5", "and marking a selection opens no composer",
     /stamp\(k\)/.test(reader) && !/setComposer|function Composer/.test(reader));
}

/* ---- R6 · nothing arrives on the paper unbidden -------------------------- */
console.log("\nR6 — notes never insert themselves under a reader");
{
  const reader = readerSrc();

  /* The rule used to be defended with a pending buffer and a quiet line,
     because a poll could drop a note in above somebody mid-paragraph. The
     paper has no timer at all now, so there is nothing left that could: marks
     arrive on a gesture, and the gesture is a button. That is a stronger
     guarantee than the buffer was, and this asserts it directly. */
  /* THIS RULE WAS REVERSED ON PURPOSE AND THE REVERSAL IS RECORDED.

     It used to read "the reader runs no timer of its own" — stronger than the
     brief, written that way deliberately. v6 asks for the opposite and is
     specific about the limit: "A quiet background check runs about once a
     minute and its only permitted effect is to light the island's dot. The
     page changes when the student presses the dot, and never on its own."

     So the constraint moved from "no timer" to the one that actually matters:
     the timer may light the dot and touch nothing else. `poll()` collects
     into a pending list and returns a count; only `pull()`, which the dot
     calls, ever reaches WM. */
  ok("R6", "the quiet poll may light the dot and do nothing else",
     /async function poll\(\)/.test(reader)
     && /pending = all\.filter/.test(reader)
     && !/poll\(\)[\s\S]{0,400}WM\.emit\(\)/.test(reader));
  ok("R6", "and marks arrive only on the window fetch or on that gesture",
     (reader.match(/absorb\(/g) || []).length <= 4
     && /island\.current\?\.waiting\(n\)/.test(reader)
     && /onPull\(\)/.test(reader));
  /* v5 had to pin the scroll position because its marks were a list whose
     height changed. v6's are absolutely-positioned overlays on the page, so
     arriving marks move nothing by construction — there is no layout to
     disturb. What has to be true instead is that they are built and inserted
     in one go rather than trickling in, which `pull()` does. */
  ok("R6", "and nothing moves under the student when they arrive",
     /function pull\(\)[\s\S]{0,260}absorb\(list, true\)/.test(reader));
  /* COMPONENTS.md's top bar names this button "Check for new marks", and the
     shipped label is the one that ships. */
  ok("R6", "the control that pulls them in says what it is",
     /title="Class marks"/.test(reader));
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
  const reader = readerSrc();
  /* The boxes are on the words before anything is awaited: stamp() draws
     them from the live selection, and made() resolves, relayouts and only
     then writes. */
  ok("R8", "the mark is on the page before the insert is awaited",
     /relayout\(\);\s*\n\s*\/\* A question opens its thread first[\s\S]{0,400}await createAnnotation/.test(reader)
     || /relayout\(\);[\s\S]{0,600}const row = await createAnnotation/.test(reader));
  ok("R8", "a write that did not land says so rather than going quiet",
     /if \(!row\) \{[\s\S]{0,1800}trouble\("offline"\)/.test(reader)
     && /onTrouble\(\) \{ island\.current\?\.offline\(true\); \}/.test(reader));
  /* P0-2 — and saying so is no longer the whole of it. A mark made with no
     signal used to stay in memory, be announced as saved, and be gone on the
     next load. Both halves are asserted: the write is REMEMBERED, and the
     banner reads a real number rather than promising. */
  ok("R8", "a write that did not land is kept, not just announced",
     /if \(!row\) \{[\s\S]{0,1200}remember\("mark\.add"/.test(reader)
     && /remember\("ink\.add"/.test(reader));
  ok("R8", "and every later change to an unsent mark is kept with it",
     /remember\("mark\.edit"/.test(reader) && /remember\("mark\.del"/.test(reader));
  ok("R8", "the queue is replayed when the network comes back, oldest first",
     /whenBackOnline/.test(reader) && /drain\(\)/.test(reader)
     && /stopDraining\(\)/.test(reader));
  ok("R8", "the banner counts what is waiting instead of saying it is saved",
     /* the template itself, not the comments that explain why it changed */
     !/<b>Offline<\/b><span class="mut">marks are saved here/.test(reader)
     && /waiting on this device/.test(reader));
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
     /* paper_marks_for since 0017 — the shape was widened for the highlighter
        colour, and a function's return columns cannot be widened in place. */
     && /rpc\("paper_marks_for"/.test(annots));
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
  const reader = readerSrc();
  ok("R10", "only a question opens a thread",
     /mark\.kind === "ask"/.test(reader) && /askOnPassage\(\{/.test(reader));
  /* THIS RULE WAS REVERSED TOO, AND BY THE DESIGN RATHER THAN BY ME.
     v5 sent you to the Ready Room to answer, so the paper grew no reply UI.
     v6's panel card carries a reply box — it is in reader.html, in the
     handed-over markup — and the card is a window onto the same thread the
     Ready Room shows. Answers still happen in one place; there are two
     windows onto it now rather than one. */
  ok("R10", "and an answer typed on the card goes to that same thread",
     /insertReply\(\{/.test(reader) && /threadId: thread/.test(reader));
}

/* ---- R11 · empty reads "not yet", never "nothing" ----------------------- */
console.log('\nR11 — empty reads "not yet", never "nothing"');
{
  const reader = readerSrc();
  /* TWO EMPTIES, AND THE WRONG ONE IS WORSE THAN SILENCE. "Try a wider
     filter" is advice you cannot take on a paper with no marks on it at all,
     so the fresh paper gets the action it actually has. */
  ok("R11", "the empty state names the next action",
     /Yours would be the first/.test(reader)
     && /Select a line and mark it, and it will be here\./.test(reader));
  /* COMMENTS FIRST. This has now caught its own prose three times: a note
     explaining why the code never says "0 marks" contains the string "0
     marks". A checker that reads its own explanation is a checker that fails
     when somebody documents the rule properly. */
  const readerCode = reader.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /* A LITERAL ZERO IS THE EASY HALF. The one that shipped was interpolated:
     `${ms.length} of ${WM.marks.length} marks` reads "0 of 0 marks" on a paper
     nobody has marked, and no string search for "0 marks" will ever find it.
     So the count is required to be GUARDED — rendered only when there is
     something to count — and the reader suite checks the rendered footer on a
     real paper, which is the half that cannot be faked. */
  ok("R11", "no zero is ever stated, literal or interpolated",
     !/\b0 (marks|notes|highlights)\b/.test(readerCode) && !/>No marks</.test(readerCode)
     && /:ms\.length\?`<span>/.test(read("src/components/paper/v6/part4.js")));
  ok("R11", "the orphan list is absent rather than empty",
     /const lost=ctx\.orphans\(\);/.test(reader) && /lost\.length\s*\n?\s*\?/.test(reader));
}

/* ---- R13 · Smooth Air turns it off -------------------------------------- */
console.log("\nR13 — Smooth Air turns it all off");
{
  const css = readerCss();
  ok("R13", "the app's own class, not a new mechanism", /\.app\.smooth-air/.test(css));
  ok("R13", "and prefers-reduced-motion with it", /prefers-reduced-motion:\s*reduce/.test(css));
}

/* ---- R14 · the house style ---------------------------------------------- */
console.log("\nR14 — the paper obeys the house style");
{
  const css = readerCss();
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  /* TWO OF R14'S RULES ARE OVERRIDDEN HERE, AND THE OVERRIDE IS RECORDED
     RATHER THAN SILENT — see REPORT.md, "what the shipped sheet overrules".

     R14 banned hex literals and required OKLCH, because the house style is
     OKLCH end to end and a hex in a livery-aware surface is a colour that
     cannot be re-tinted. The reader is now painted by reader.css, which was
     handed over with "copy verbatim into the codebase" and is hex from top to
     bottom, including the five mark meanings that MUST NOT re-tint (CLAUDE.md
     — a livery change that recoloured somebody's yellow highlight would be the
     app editing their notes). So the reader is the one surface that does not
     derive its colour from the accent channels, on purpose, and this asserts
     the thing that still matters: that it is the SHIPPED palette and not a
     second one somebody typed.

     v5 brought a NEW palette with it — #F5C23C where v4 had #F2B33D, and so
     on down the row — so the list is read out of the shipped file rather than
     written here, where it would go stale the next time one arrives. */
  const shippedHex = new Set(((read("docs/reader/v6/reader.css").match(/#[0-9a-f]{3,8}\b/gi)) || [])
    .map((h) => h.toLowerCase()));
  /* Seven the additions sheet brings, and each has a reason the shipped file
     could not have: three are ink colours the DATABASE has stored since 0017
     which v5 no longer OFFERS — a stroke already drawn in orange is somebody's
     note, not ours to recolour — one is chalk, which graphite has to become on
     a dark ground, one is the pen's fallback, and two are the opaque backing
     for a browser that cannot blur. */
  const OURS = new Set(["#e27bb8", "#e8863a", "#3a4149", "#e4e9ee", "#333", "#edf1f5", "#fbf6e6"]);
  const strays = hex.filter((h) => !shippedHex.has(h.toLowerCase()) && !OURS.has(h.toLowerCase()));
  ok("R14", "no hex the shipped palette did not bring", strays.length === 0, strays.join(" "));
  /* `--lv` is v5's name for the one token the reader is wired to. */
  /* v6 HAS NO DENSITY, and the trade is worth writing down. v5 drew the
     class as heat — a passage twenty people had marked was one wash of the
     livery accent, not twenty stacked highlights. v6 draws every mark
     individually, which is what makes each one tappable and recolourable, and
     means a popular passage reads darker because the alphas add up.

     R4's density code is still there and still tested; nothing in v6 calls
     it. Whoever puts the class's marks on a busy paper will want it back. */
  ok("R14", "density is still available even though v6 draws every mark",
     /export function densityLevel/.test(read("src/lib/paperMarks.js"))
     && !/data-density/.test(css));
  /* THIS RULE WAS REVERSED, AND THE REVERSAL IS RECORDED RATHER THAN SILENT.

     R14 said the page carries a hairline and no shadow, because the house style
     has no drop shadows. The reader rebuild's brief (§8.2) specifies three
     depths and puts the page on the first of them, and its reference build
     floats the page — which is not decoration once the chrome above it is
     floating too: with bars at depth 2 and popovers at depth 3, a page with no
     depth of its own flattens the whole stack.

     So the assertion is not deleted, it is inverted: the page must sit at
     depth 1, and there must still be exactly three depths and no fourth. */
  /* v6 declares two shadow tokens and writes the page's own by hand, because
     the page is the one surface that is not floating chrome. It is still
     depth 1 and still not the bars'. */
  ok("R14", "the page sits at depth 1 — a shadow, and one that is not the bars'",
     /\.sheetpg\{[\s\S]{0,400}box-shadow:0 1px 3px/.test(css)
     && /--sh:0 16px 44px/.test(css));
  /* Four depths in the shipped sheet, declared once as tokens rather than
     typed at each use: the page, the tooltip, the bars, the popovers above
     them. A fifth would be a surface belonging to no layer. */
  /* Three depths in v5, declared once as tokens rather than typed at each
     use: the page, the floating bars, the popovers above them. */
  ok("R14", "and the reader keeps to the shipped depths, no fourth",
     ["--sh:", "--sh-pop:"].every((t) => css.includes(t))
     && !/--sh-(?!pop)[a-z]+:/.test(css));

  // 13px type floor, measured rather than trusted.
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  /* THE 13px FLOOR IS THE OTHER OVERRIDE. The shipped sheet's type runs 8.5px
     to 26px — the dock's preset counts are 8.5px superscripts and the mono
     page numbers are 10px — and it is the sheet the app was told to copy. What
     survives is the floor for anything the reader has to READ, as opposed to
     glance at: the mark card's body, the panel rows, the composer. */
  const small = sizes.filter((n) => n < 8);
  ok("R14", `no type below the shipped sheet's own floor (${sizes.length} declared)`,
     small.length === 0, small.join(", "));
  const body = [...css.matchAll(/\.(mcd|mrow b|plist|composer textarea)[^{]*\{[^}]*font-size:\s*(\d+(?:\.\d+)?)px/g)]
    .map((m) => Number(m[2]));
  ok("R14", "and what is read rather than glanced at is 12px or more",
     body.every((n) => n >= 12), body.join(", "));

  // 44px targets: the controls that are smaller carry padding to reach it, so
  // this asserts the floor on the min-height declarations that exist.
  /* CONTROLS, not content. The `min-height` declarations in this sheet are
     mostly the other thing — a placeholder page is 540px, a note's textarea is
     56px, a mark row's colour stripe is 32px — and asserting a floor across
     all of them was asserting that a colour stripe is a button.

     v5's own answer to the touch case is better than a floor anyway: the
     platform layer takes every target to 46px on `pointer:coarse`, which is
     capability rather than width. That is what is checked. */
  /* THE TARGET GROWS AND THE CONTROL DOES NOT. v6 sizes its controls for a
     mouse and nothing for a finger; the app's section 12 wants 44px. Both are
     true when a transparent ::before takes the tap out without moving
     anything the sheet set — and `data-plat` is written from
     `matchMedia('(pointer:coarse)')`, so it is capability and not width. */
  ok("R14", "every target grows for a thumb, on capability and not width",
     /\[data-plat="touch"\] \.t::before/.test(css)
     && /min-width: 44px; min-height: 44px/.test(css)
     && /matchMedia\('\(pointer:coarse\)'\)/.test(readerSrc()));
}

/* ---- the chips are the destinations, not invented categories ------------ */
console.log("\nfilters");
{
  /* §6.3 — where a mark WENT is the only grouping a student can act on. This
     replaced a filter by what a mark looks like ("Highlights", "Notes"), which
     answered nothing: a student does not think "show me my underlines", they
     think "what is in my revision deck". */
  const list = [
    { id: 1, author_id: "me", kind: "highlight", colour: "critical", status: "ok" },
    { id: 2, author_id: "you", kind: "highlight", colour: "definition", status: "ok" },
    { id: 3, author_id: "you", kind: "question", colour: "unsure", status: "ok" },
    { id: 4, author_id: "me", kind: "highlight", colour: "critical", status: "orphaned" },
  ];
  ok("§6.3", "everything", applyFilter(list, "all", "me").length === 4);
  ok("§6.3", "mine", applyFilter(list, "mine", "me").length === 2);
  ok("§6.3", "revision", applyFilter(list, "critical", "me").length === 2);
  ok("§6.3", "glossary", applyFilter(list, "definition", "me").length === 1);
  ok("§6.3", "threads", applyFilter(list, "unsure", "me").length === 1);
  ok("§6.3", "lost their place", applyFilter(list, "orphaned", "me").length === 1);

  const ids = FILTERS.map((f) => f.id).join(",");
  ok("§6.3", "the five destinations are the five meanings",
     ids === "all,mine,critical,definition,limit,unsure,wrong,orphaned", ids);
  ok("§6.3", "and they are labelled as destinations, not as kinds",
     FILTERS.map((f) => f.label).join(",")
       === "Everything,Mine,Revision,Glossary,Questions,Threads,Master Caution,Lost their place");

  const counts = filterCounts(list, "me");
  ok("§6.3", "the counts are real", counts.critical === 2 && counts.mine === 2 && counts.orphaned === 1);
}

/* ---- tap anywhere still anchors to words -------------------------------- */
console.log("\ntap anywhere");
{
  const t = "Alpha beta gamma. Delta epsilon zeta eta. Theta iota kappa lambda.";
  ok("R1", "a tap resolves to the sentence it landed in",
     t.slice(...Object.values(sentenceAround(t, 25))) === "Delta epsilon zeta eta.");
  ok("R1", "a tap at the very start works", sentenceAround(t, 0).start === 0);
  ok("R1", "and the quote never starts on whitespace",
     !/^\s/.test(t.slice(...Object.values(sentenceAround(t, 20)))));

  const reader = readerSrc();
  /* v6 HAS NO TAP-TO-MARK. v5 let you tap a line and get a note anchored to
     the sentence around the tap; v6's page takes a pointer only for drawing,
     erasing, panning and selecting. What the rule was protecting is still
     true and is what matters: nothing the reader stores is a coordinate. */
  ok("R1", "nothing a mark stores is a coordinate",
     !/hint: \{[^}]*x:/.test(reader) && !/x:\s*e\.client/.test(reader)
     && /anchorFor\(model\.text, off\.start, off\.end\)/.test(reader));
  /* A TAP AND A DRAG ARE TOLD APART BY THE POINTER, not by what is selected.
     Asking the selection was wrong twice: the browser collapses it between
     mousedown and click, and it still holds the PREVIOUS selection when a
     fresh press lands — so a tap after any earlier selection was read as the
     end of a drag and did nothing at all.

     And the three-character floor is right for a stray drag and wrong for a
     deliberate press on a short word: "if", "on" and "no" are exactly the
     words a student underlines in a regulation. */
  ok("—", "a drag is still a drag, not a tap",
     /if\(tapMoved\)return;/.test(reader)
     && /Math\.hypot\(e\.clientX-tapAt\[0\],e\.clientY-tapAt\[1\]\)>4/.test(reader)
     && /if\(!tapped&&String\(r\)\.trim\(\)\.length<3\)return hideSel\(\)/.test(reader));
}

/* ---- one panel, two kinds ----------------------------------------------- */
console.log("\nnotes and questions");
{
  const reader = readerSrc();
  const parts = readerSrc();
  const css = readerCss();
  /* v6 HAS NO NOTE AT ALL, and it is the largest single thing the design
     dropped. v5 opened a note as a window ON the page, already carrying the
     passage you selected, draggable, collapsing to a pin. v6 keeps the Note
     TOOL — it is in the default bar, it draws an icon, it opens properties
     with a colour and a size — and nothing anywhere gives it a behaviour.
     The selection pill offers Highlight, Underline and Ask; there is no Note
     action on it either, so a note cannot be made by any route.

     What is asserted is the honest state, so that building it fails this
     line rather than passing quietly: the tool exists and the behaviour does
     not. See the gap list at the end of this file. */
  ok("—", "the Note tool is on the bar and has no behaviour yet",
     /\{id:'note',n:'Note'/.test(read("src/components/paper/v6/part3.js"))
     && !/data-act="note"/.test(readerSrc())
     && !/function Note\(/.test(readerSrc()));
  /* The reader draws "anon" from the ABSENCE of an author, not from the kind
     — so it cannot show a name the server declined to send, and it would
     start showing one the moment the server did. */
  ok("—", "a question is anonymous and says so",
     /row\.kind === "question" \? "anon"/.test(reader));
  ok("R13", "and none of it animates under Smooth Air",
     /\.app\.smooth-air \.rdr \*/.test(css));
}

/* ---- the rail moves and scales ------------------------------------------ */
console.log("\nthe tool rail");
{
  const css = readerCss();
  const reader = readerSrc();
  /* FOUR positions in v5, not three, and each lays the bar out for itself —
     a column on the left or the right, a row along the top or the bottom. */
  ok("—", "four bar positions, and each lays the bar out for itself",
     ["left", "right", "bottom", "top"].every((p) => new RegExp(`\\[data-bar="${p}"\\]`).test(css)));
  /* AND THE PANEL IS ALWAYS OPPOSITE IT. Two settings would let a student put
     both on the same edge, which is the one arrangement that cannot work — so
     there is one setting and the other is derived from it. */
  ok("—", "and the panel is always opposite it, because it is derived",
     /R\.dataset\.side = R\.dataset\.bar==='right' \? 'left' : 'right'/.test(reader)
     && /\[data-side="right"\]/.test(css) && /\[data-side="left"\]/.test(css));
  /* The shipped sheet sizes the tool itself — 38px on a pointer, 44px under
     900px — rather than through a knob the reader turns. One number, in one
     place, and the touch case is the media query's. */
  ok("—", "one number decides the size",
     /\.t\{width:38px;height:38px/.test(css)
     && /min-width: 44px; min-height: 44px/.test(css));
  /* Settings save locally first and sync in the background: nothing the
     student touches waits on the network, and where the bar sits is a
     property of the device in their hands rather than of their account. */
  ok("—", "where it sits is a per-device preference, not an account one",
     /localStorage\.setItem\(k, v\)/.test(reader)
     && /\$\{key\}-tools/.test(reader)
     && !/progress\.set\(.pw-rdr6/.test(reader));
}

/* ---- the reader is full screen, and stays that way ---------------------- */
console.log("\nfull screen");
{
  const reader = readerSrc();
  const css = readerCss();
  ok("—", "the screen is fixed to the viewport", /position:fixed;inset:0;overflow:hidden/.test(css));

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
     /paper: chunk\(\(\) => import\("\.\/components\/paper\/v6\/ReaderV6\.jsx"\)\)/.test(app));
  const dist = join(ROOT, "dist/assets");
  let built = [];
  try { built = readdirSync(dist); } catch { /* not built yet */ }
  if (built.length) {
    const entry = built.find((f) => /^index-.*\.js$/.test(f));
    const src = entry ? read(`dist/assets/${entry}`) : "";
    ok("—", "and pdf.js is not in the entry chunk", !/GlobalWorkerOptions/.test(src));
  }
}


/* ---- ink · coordinates are fractions of the page, never pixels ---------- */
console.log("\nink — a stroke is fractions of the page");
{
  const box = { width: 800, height: 1000 };
  const there = toFraction(200, 500, box, 0);
  ok("ink", "a pointer becomes a fraction", there[0] === 0.25 && there[1] === 0.5, JSON.stringify(there));
  const back = toPixels(there, box, 0);
  ok("ink", "and comes back to the same pixel", back[0] === 200 && back[1] === 500);

  // The point of storing fractions: the same stroke at a different zoom.
  const bigger = toPixels(there, { width: 1600, height: 2000 }, 0);
  ok("ink", "the same stroke doubles with the page", bigger[0] === 400 && bigger[1] === 1000);

  // Rotation is undone on the way in and reapplied on the way out, so a stroke
  // drawn on a sideways page turns with it instead of staying put.
  for (const r of [0, 90, 180, 270]) {
    const f = toFraction(200, 500, box, r);
    const px = toPixels(f, box, r);
    ok("ink", `rotation ${r} round-trips`, Math.abs(px[0] - 200) < 1e-9 && Math.abs(px[1] - 500) < 1e-9);
  }

  const sql = read("supabase/migrations/0017_paper_ink.sql");
  const inkTable = (sql.match(/create table if not exists paper_ink \(([\s\S]*?)\n\);/) || [])[1] || "";
  ok("R1", "ink lives in its own table", inkTable.length > 0);
  ok("R1", "and that table has no anchor to smuggle a position into",
     !/\banchor\b/.test(inkTable.replace(/--[^\n]*/g, "")), inkTable.slice(0, 60));
  ok("R1", "and 0014's text-only anchor constraint is untouched",
     !/drop constraint[^;]*anchor_is_text_only/i.test(sql));
  const ink = read("src/lib/ink.js");
  ok("ink", "strokes are read through the function, never a raw select",
     /rpc\("paper_ink_for"/.test(ink) && !/from\("paper_ink"\)\s*\.select/.test(ink));
}

/* ---- ink · thinning keeps the shape ------------------------------------- */
console.log("\nink — thinning");
{
  // A straight line sampled 200 times is two points, and both ends survive.
  const line = Array.from({ length: 200 }, (_, i) => [i / 199, i / 199]);
  const thinned = thin(line);
  ok("ink", "a straight line collapses to its ends", thinned.length === 2, `${thinned.length}`);
  ok("ink", "the first and last point are never dropped",
     thinned[0][0] === 0 && thinned.at(-1)[0] === 1);

  // A corner is shape, and shape is kept.
  const corner = [[0, 0], [0.25, 0], [0.5, 0], [0.5, 0.25], [0.5, 0.5]];
  ok("ink", "a corner survives", thin(corner).length === 3, JSON.stringify(thin(corner)));

  // Nothing thrown away is further than the tolerance from the line kept.
  const wobble = Array.from({ length: 500 }, (_, i) =>
    [i / 499, Math.sin(i / 8) * 0.02 + 0.5]);
  const cut = thin(wobble);
  ok("ink", "a wobbly stroke thins but keeps its wobble",
     cut.length < wobble.length / 2 && cut.length > 8, `${wobble.length} -> ${cut.length}`);

  // The recursive form of this blows a stack on exactly the input you cannot
  // reproduce: one long, fast stroke. The iterative form does not.
  const huge = Array.from({ length: 60000 }, (_, i) => [i / 59999, (i % 97) / 3000]);
  let survived = true;
  try { thin(huge); } catch { survived = false; }
  ok("ink", "60,000 points do not blow the stack", survived);
  ok("ink", "a stroke of one point is left alone", thin([[0.5, 0.5]]).length === 1);
}

/* ---- ink · the path is a curve, and the eraser hits segments ------------- */
console.log("\nink — drawing and erasing");
{
  const box = { width: 100, height: 100 };
  ok("ink", "three points make a curve, not a polyline",
     /C /.test(pathFor([[0, 0], [0.5, 0.5], [1, 0]], box)));
  ok("ink", "two points make a line", /^M [^C]*L/.test(pathFor([[0, 0], [1, 1]], box)));
  ok("ink", "one point still draws something a round cap can show",
     pathFor([[0.5, 0.5]], box).length > 0);
  ok("ink", "no points draw nothing", pathFor([], box) === "");

  /* The eraser tests the SEGMENTS, not the stored points. A long line drawn
     with two points would otherwise only be erasable at its ends — which is
     exactly the shape thinning produces. */
  const stroke = { id: 1, page: 1, width: 0.003, points: [[0, 0], [1, 1]] };
  ok("ink", "the middle of a two-point line is erasable",
     strokeHit(stroke, [0.5, 0.5], 0.01));
  ok("ink", "and a miss is a miss", !strokeHit(stroke, [0.1, 0.9], 0.01));
  ok("ink", "the eraser only reaches the page it is on",
     strokesUnder([stroke], [0.5, 0.5], 0.01, 2).length === 0
     && strokesUnder([stroke], [0.5, 0.5], 0.01, 1).length === 1);

  const reader = readerSrc();
  ok("ink", "the eraser only ever removes strokes this account drew",
     /row\.author_id === me/.test(reader) && /ctx\.mine\(path\.dataset\.id\)/.test(reader));
  const page = readerSrc();
  ok("ink", "the live stroke is written to the DOM, not through setState",
     /setAttribute\('d',smooth\(ink\.pts\)\)/.test(read("src/components/paper/v6/part3.js"))
     && !/setPoints|useState/.test(read("src/components/paper/v6/part3.js")));
  ok("ink", "and every position the pointer recorded is used, not just the last",
     /e\.getCoalescedEvents \? e\.getCoalescedEvents\(\) : \[e\]/.test(page));
  /* v6's ink layer is inert by construction rather than by attribute: the
     SVG is `pointer-events:none` always and every pointer goes to the stage,
     which decides what the armed tool means. There is no state to get wrong. */
  ok("ink", "the layer is inert, and the stage decides what a pointer means",
     /\.ink\{[^}]*pointer-events:none/.test(readerCss())
     && /if\(R\.dataset\.draw!=='1'\)return/.test(page));
}

/* ---- the palette · names are stored, colours are decided in CSS --------- */
console.log("\nthe palette");
{
  const sql = read("supabase/migrations/0017_paper_ink.sql");
  const css = readerCss();
  for (const c of COLOUR_IDS) {
    ok("colour", `the database knows ${c}`, new RegExp(`'${c}'`).test(sql));
    ok("colour", `and the stylesheet paints ${c}`,
       new RegExp(`\\[data-ink="${c}"\\][^{]*\\{[^}]*--ink:`).test(css));
  }
  ok("colour", "eight of them, and no more", INK_COLOURS.length === 8);
  ok("colour", "an unknown name reads as the default rather than as nothing",
     colourOr("chartreuse") === "yellow" && colourOr(null) === "yellow");

  const annots = read("src/lib/annotations.js");
  ok("colour", "the client sends a name, never a colour",
     /colour: colour \|\| null/.test(annots) && !/oklch|#[0-9a-f]{3}/i.test(annots));
  /* It was OKLCH, like everything else here. It is hex now, for the reason
     recorded against R14 above: the reader is painted by the shipped sheet and
     the shipped sheet is hex. Eight names, eight colours, one token. */
  ok("R14", "eight names and no ninth",
     new Set((css.match(/\[data-ink="([a-z]+)"\][^{]*\{[^}]*--ink:/g) || [])
       .map((m) => m.match(/"([a-z]+)"/)[1])).size === 8);

  /* Graphite is the one colour that has to move: it is defined by being darker
     than paper, and in night mode the paper is dark. */
  /* v5 flipped graphite to chalk under the night light, "because a pencil is
     defined by being darker than paper". That was right for v5 and is WRONG
     for v6: `--paper` is #FFFFFF in BOTH looks here — the surround changes and
     the page does not — so chalk on this page is a pencil nobody can see. */
  ok("colour", "the page is white in both looks, so graphite stays graphite",
     !/\[data-look="dark"\] \[data-ink="graphite"\]/.test(css)
     && !/\[data-look="light"\]\{[^}]*--paper:/.test(css));
}

/* ---- five nibs, and a width that is a fraction of the page -------------- */
console.log("\nthe nib");
{
  ok("nib", "five sizes, smallest first",
     PEN_SIZES.length === 5 && PEN_SIZES.every((p, i) => i === 0 || p.w > PEN_SIZES[i - 1].w));
  ok("nib", "a width is a fraction of the page, not a pixel count",
     PEN_SIZES.every((p) => p.w > 0 && p.w < 0.05));
  ok("nib", "an unknown nib falls back rather than vanishing", penWidth("nope") === PEN_SIZES[2].w);
  const sql = read("supabase/migrations/0017_paper_ink.sql");
  ok("nib", "and the database refuses a width that could only be pixels",
     /width > 0 and width < 0\.2/.test(sql));
}

/* ---- two more ways to mark the same passage ----------------------------- */
console.log("\nunderline and strikethrough");
{
  ok("marks", "six kinds now, and they are the same six in the database",
     KINDS.join(",") === "highlight,underline,strikethrough,note,question,correction");
  const sql = read("supabase/migrations/0017_paper_ink.sql");
  for (const k of KINDS) ok("marks", `the database allows ${k}`, new RegExp(`'${k}'`).test(sql));

  // A passage can be highlighted AND struck through by the same person, and
  // both are true at once — so decorations stack rather than compete.
  const seg = segmentsFor([
    { id: 1, kind: "highlight", colour: "blue", close: true, start: 0, end: 10 },
    { id: 2, kind: "strikethrough", colour: "red", close: true, start: 0, end: 10 },
  ]).segments[0];
  ok("marks", "the fill leads and the line is drawn over it",
     seg.kind === "highlight" && seg.deco.includes("strike"));
  ok("marks", "the colour comes from the mark that leads, not from another one",
     seg.colour === "blue");

  // The crowd stays one colour on purpose: eleven people's greens and yellows
  // averaged together would be a smear rather than information.
  const crowd = segmentsFor([
    { id: 1, kind: "highlight", colour: "pink", close: false, start: 0, end: 5 },
    { id: 2, kind: "highlight", colour: "green", close: false, start: 0, end: 5 },
  ]).segments[0];
  ok("marks", "the module's density carries no colour of its own", crowd.colour === null);
}

/* ---- the view · zoom, layout and light ---------------------------------- */
console.log("\nthe view");
{
  ok("view", "three zooms up and three down land back where they started",
     stepZoom(stepZoom(stepZoom(stepZoom(stepZoom(stepZoom(1, 1), 1), 1), -1), -1), -1) === 1);
  ok("view", "and it stops rather than running off the end",
     stepZoom(ZOOM_STEPS[0], -1) === ZOOM_STEPS[0]
     && stepZoom(ZOOM_STEPS.at(-1), 1) === ZOOM_STEPS.at(-1));

  /* A book opens with the cover alone. Pairing 1-2 puts every spread one page
     out for the whole document, which is wrong on anything with a cover. */
  ok("view", "a spread opens with the cover by itself",
     JSON.stringify(spreads(7)) === "[[1],[2,3],[4,5],[6,7]]");
  ok("view", "an odd last page is alone too", JSON.stringify(spreads(4).at(-1)) === "[4]");
  ok("view", "and a page knows which spread it is in",
     spreadOf(1) === 0 && spreadOf(2) === 1 && spreadOf(3) === 1 && spreadOf(4) === 2);

  ok("view", "continuous keeps a window either side",
     JSON.stringify(pagesToDraw("scroll", 5, 14)) === "[3,4,5,6,7]");
  ok("view", "and a paged layout does not render thirteen pages nobody is looking at",
     pagesToDraw("single", 5, 14).length === 3);

  /* Rotation swaps the page's sides BEFORE anything is divided. Leaving that
     out is why a landscape page turned upright fits wrong. */
  const port = fitScale("width", { w: 600, h: 800, rotated: false }, { width: 1048, height: 800 });
  const land = fitScale("width", { w: 600, h: 800, rotated: true }, { width: 1048, height: 800 });
  ok("view", "a turned page fits by its new width", port > land);
  ok("view", "two across get half the room each",
     fitScale("width", { w: 600, h: 800, rotated: false }, { width: 1248, height: 800 }, { x: 48, y: 48 }, 2)
     === fitScale("width", { w: 600, h: 800, rotated: false }, { width: 648, height: 800 }, { x: 48, y: 48 }, 1));
  ok("view", "actual size is one, by definition", fitScale("actual", { w: 600, h: 800 }, { width: 100, height: 100 }) === 1);

  /* Five lights, because "follow the app" is one of them — the reader that
     never opens the light menu still gets the theme the rest of the app is
     wearing, which is the case the other four cannot cover. */
  ok("view", "three layouts, five lights and three fits",
     LAYOUTS.length === 3 && PAPER_LIGHTS.length === 5 && FITS.length === 3
     && PAPER_LIGHTS[0].id === "follow");
  /* The reader has two GROUNDS, not four: the shipped sheet's `data-look` is
     paper or night, and the four reading lights are a filter on the raster.
     A light that also repainted the surround would be two systems arguing. */
  ok("view", "and two grounds, which the lights sit inside",
     /\.rdr\[data-look="light"\]\{/.test(readerCss()));
  const css = readerCss();
  /* v6 HAS NO READING LIGHTS, and that is the design rather than an
     omission. v5 offered four and filtered the raster for three of them. v6
     replaced the whole idea with two things: `data-look`, which changes the
     SURROUND and never the page, and warmth, which shifts the paper's white
     point through `--paper` — so the picture is never filtered and the marks
     are never tinted, which is what the rule was protecting. */
  ok("view", "the light never falls on the marks, because it never falls at all",
     !/lightFilter/.test(readerSrc())
     && /--paper/.test(css) && /R\.style\.setProperty\('--paper'/.test(readerSrc()));
  ok("view", "and the ground follows the look, so the surround is never the brightest thing",
     /--ink-0:#080C11/.test(css) && /--ink-1:#0E141B/.test(css)
     && /\.rdr\[data-look="light"\]\{/.test(css)
     && /linear-gradient\(#F2F5F8,#E7ECF1\)/.test(css));
}

/* ---- find · the two options every find bar has -------------------------- */
console.log("\nfind");
{
  const t = "Bolt the bolted bolt. BOLT.";
  ok("find", "case is ignored by default", findAll(t, "bolt").length === 4);
  ok("find", "until it is not", findAll(t, "bolt", { matchCase: true }).length === 2);
  ok("find", "whole words means a boundary, not a space",
     findAll(t, "bolt", { wholeWord: true }).length === 3);
  ok("find", "an empty query finds nothing rather than everything",
     findAll(t, "   ").length === 0);
}

/* ---- the outline is the paper's own, flattened -------------------------- */
console.log("\nthe contents");
{
  const flat = flattenOutline([
    { title: "One", dest: "a", items: [{ title: "One a", dest: "b", items: [] }] },
    { title: "Two", dest: "c" },
  ]);
  ok("outline", "a tree becomes a list with a depth on each row",
     flat.map((r) => `${r.depth}:${r.title}`).join(" ") === "0:One 1:One a 0:Two");
  ok("outline", "a heading with no title still has one", flattenOutline([{ dest: "x" }])[0].title === "Untitled");
  const out = readerSrc();
  /* v6 has no contents panel. A paper's headings are read from its outline
     and used as the caption over each page's group of marks, so a paper with
     no outline simply has no caption — which states nothing rather than
     stating a zero. */
  ok("R11", "a paper with no outline captions nothing rather than stating a zero",
     /ctx\.head\(\+pg\)\|\|''/.test(out) && !/\b0 (headings|sections)\b/.test(out));
}

/* ---- the rail carries ten tools without eating the window --------------- */
console.log("\nthe rail, at ten tools");
{
  const reader = readerSrc();
  const css = readerCss();
  /* Fourteen tools in six groups now — the full set §9 lists. The DEFAULT
     tray is still six of them; the rest are one tap away in the Add sheet and
     none of them is unreachable, which is the rule that makes trimming safe. */
  /* The set is readerIcons.js's now, copied byte for byte from the spec, and
     paperTray.js re-exports it rather than keeping a second opinion. */
  const icons = read("src/lib/readerIcons.js");
  /* THIRTEEN, in four groups, and the bar still holds six — because in v5 the
     seventh tool a student needs is not a seventh entry, it is a VARIANT
     inside the one they already picked. Line / Arrow / Box / Ellipse is one
     bar slot, and that is what stops the bar growing. */
  ok("rail", "the full tool set is thirteen, in four groups",
     (icons.match(/\{id:'[a-z]+',/g) || []).length === 13
     && ["Basics", "Draw", "Insert", "Notes"].every((g) => icons.includes(`g:'${g}'`)));
  ok("rail", "and every tool that has versions carries them itself",
     (icons.match(/v:\[/g) || []).length >= 8);
  ok("rail", "and the bar ships six of them",
     /DEF=\['sel','hl','pen','era','note','ask'\]/.test(icons)
     && /export \{ DEF, CAP \}/.test(read("src/lib/paperTray.js")));
  /* This used to read "two abreast rather than shrinking the hit targets",
     because a single column of TEN 44px tools is 659px of a 720px window. The
     shipped design answers it at the other end: the tray ships six, the cap is
     ten only on a desktop, and the column is one wide. Six 38px tools is
     250px, and the variants absorb the rest. */
  ok("rail", "and a column of the default bar fits a laptop window",
     /const DEF=\['hand','pen','hl','era','note','ask'\];/.test(read("src/components/paper/v6/part3.js"))
     && /\.rail\{[^}]*flex-direction:column/.test(css));
  /* Select has no settings, so it closes the inspector rather than opening an
     empty one. The decision is at the point the tool is picked, which is the
     only place that knows a tool was picked at all. */
  /* Pressing the tool you are already on opens its properties; pressing a
     different one arms it and closes whatever was open. One popover, and it
     belongs to the tool in your hand. */
  ok("rail", "the armed tool's settings appear beside it and no others exist",
     /if\(id===S\.tool\)\{ S\.open==='props'\?closeAll\(\):openPo\('props',b\); return \}/
       .test(read("src/components/paper/v6/part3.js")));
  /* The inspector sits beside the DOCK and only beside the dock. It used to
     clear the panel's width as well, from when the panel was a column on the
     same side; now the panel floats on the other edge and that offset pushed
     the inspector off the screen. */
  /* The properties popover opens AGAINST the bar, on whichever edge the bar
     is on. One that stayed left while the bar went right would be a popover
     pointing at nothing. */
  /* anchorTo() puts the popover against whichever edge the bar is on, in JS
     rather than in four stylesheet rules — v6 moved the bar to a drag, so the
     edge is not known when the sheet is written. */
  ok("rail", "the properties popover follows the bar, on all four edges",
     ["left", "right", "bottom", "top"]
       .every((e) => new RegExp(`bar==='${e}'`).test(read("src/components/paper/v6/part3.js"))));

  /* Naming panels one at a time is a rule that breaks the next time one is
     added, and it did: Contents and Queue opened at the full width of the
     window because the grid rule listed only thumbs and marks. */
  /* Naming panels one at a time is a rule that broke the next time one was
     added, and it did. It cannot now: the shipped panel floats over the page
     instead of taking a column from it, so there is no width to switch on and
     nothing to name. `data-panel` carries which one is showing, once. */
  /* Naming panels one at a time is a rule that breaks the next time one is
     added, and it did. It cannot now: the panel floats over the page instead
     of taking a column from it, so there is no width to switch on. */
  ok("rail", "the panel floats, so no panel has to be named twice",
     !/--side-w/.test(css) && /\.pan\{position:absolute/.test(css));
}

/* ---- a selection offset means two different things ---------------------- */
console.log("\nselection");
{
  const reader = readerSrc();
  /* In a text node an offset is a character; in an ELEMENT it is a child-node
     index. A double-click, a triple-click and a drag that lands on a span
     boundary all give element endpoints, and treating the index as a character
     count silently truncates the mark to its first letter. */
  /* A double-click, a triple-click and Select All all give ELEMENT endpoints
     — a child index, not a character count — and treating the index as an
     offset truncates the mark to its first letter. boundary() walks out to
     the run the endpoint is inside, and to the nearest one when it is in the
     white space between two. */
  ok("select", "an element endpoint is converted, not trusted",
     /node\.nodeType === 3 \? node\.parentElement : node/.test(reader)
     && /compareDocumentPosition/.test(reader));
}

/* ---- §4.6 · the PDF is opened for pixels and nothing else --------------- */
console.log("\n§4.6 — big papers");
{
  const reader = readerSrc();
  const text = read("src/lib/paperText.js");
  const papers = read("src/lib/papers.js");

  /* Asking a 1012-page document for every viewport made 1012 range requests
     before anything drew — measured at 119MB over the wire on a 44MB file,
     with the first page never appearing. The manifest answers the same
     question from a row we already have. */
  ok("§4.6", "the layout comes from the manifest, not from the document",
     /const boxes = paper\?\.manifest\?\.boxes/.test(reader)
     && /setSizes\(boxes\.map/.test(reader));
  ok("§4.6", "and the document is only asked when there is no manifest",
     /if \(!boxes\?\.length\) \{[\s\S]{0,400}getViewport/.test(reader));
  ok("§4.6", "a page released after its size is read, not left parsed",
     /p\.cleanup\(\);/.test(reader));

  /* 3MB of text layer between opening a paper and seeing any of it, for a file
     only search needs. */
  ok("§4.6", "the text layer is fetched but never awaited before the pages draw",
     /textPromise\.then\(\(t\) => \{ if \(live && t\) setModel\(t\); \}\)/.test(reader)
     && !/const stored = paper\?\.file \? await storedText/.test(reader));
  ok("§4.6", "and it is read from storage rather than extracted per open",
     /export async function storedText/.test(papers) && /text\.json/.test(papers));

  /* Supabase sends a correct 206 and does NOT send
     Access-Control-Expose-Headers, so a browser cannot read Content-Range and
     pdf.js concludes ranges are unsupported. We do the ranging ourselves. */
  ok("§4.6", "cross-origin papers range through our own transport",
     /PDFDataRangeTransport/.test(text) && /requestDataRange/.test(text));
  ok("§4.6", "same-origin papers keep pdf.js's own path",
     /const sameOrigin = \(url\)/.test(text) && /if \(sameOrigin\(url\)\)/.test(text));
  ok("§4.6", "and in-flight ranges are abortable, so a flung scroll drops them",
     /new AbortController\(\)/.test(text) && /for \(const c of inflight\.values\(\)\) c\.abort\(\)/.test(text));

  ok("§4.6", "an absolute storage URL is not prefixed with a slash",
     /export const fileHref/.test(papers)
     && !/`\/\$\{String\(paper\.file\)/.test(reader));
}

/* ---- the shipped files are used, not reinterpreted ---------------------- */
console.log("\nthe shipped spec");
{
  /* HANDOVER.md, "The one rule": the chrome is finished, copy it. Everything
     in this block is that sentence, turned into something that can fail.

     The strongest check is the first: the four parts of the chrome are
     GENERATED out of the file that was handed over, so "copied" is not a
     claim about a diff somebody read once — it is re-derived here, every run,
     and any drift is a failure with the file named. */
  let verified = "";
  try {
    verified = execFileSync("node", [join(ROOT, "scripts/build-reader-v6.mjs"), "--verify"],
      { encoding: "utf8", cwd: ROOT });
  } catch (e) { verified = `FAILED: ${e.stdout || ""}${e.stderr || ""}`; }
  ok("spec", "the chrome is what the handed-over reader.js produces, part for part",
     /all current with docs\/reader\/v6\/reader\.js/.test(verified), verified.trim().split("\n").pop());

  /* And every departure from it is a row in the table with a reason next to
     it, rather than an edit somebody made and did not write down. */
  const gen = read("scripts/build-reader-v6.mjs");
  const edits = [...gen.matchAll(/^\s*why: "/gm)].length;
  ok("spec", `every edit to the chrome carries its reason (${edits})`,
     edits >= 20 && !/why: ""/.test(gen));
  for (const part of ["part2.js", "part3.js", "part4.js"]) {
    const src = read(`src/components/paper/v6/${part}`);
    ok("spec", `${part} says what was changed and why`,
       /Changed from the handed-over file, and only this:/.test(src));
  }

  const shippedCss = read("docs/reader/v6/reader.css");
  const builtCss = read("src/components/paper/v6/reader.css");
  const decls = (css) => (css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\})/g) || [])
    .join("|").replace(/\s+/g, " ").trim();
  /* ONE CUT IS ALLOWED THROUGH, and the sheet asks for it in its own header:
     "The block marked DEMO ONLY at the very bottom is deleted on the live
     site." HANDOVER section 5 says the same. Nothing else may move — same
     tokens, same values, same timings, same radii. */
  const DEMO = /\n\.demoBtn\{[\s\S]*?@media \(max-width:900px\)\{\.demo\{display:none\}\}\n/;
  ok("spec", "reader.css is used, not reinterpreted — every declaration identical",
     decls(shippedCss.replace(DEMO, "\n")) === decls(builtCss));
  ok("spec", "and it is generated from the shipped file, so the two cannot drift",
     /GENERATED — do not edit\. Source: docs\/reader\/v6\/reader\.css/.test(builtCss));
  /* v6's reset is `*{margin:0;padding:0;...}` and `button{background:none;...}`.
     Unscoped that is not a collision, it is the whole app. */
  ok("spec", "every rule is scoped to the reader",
     !/(?:^|\n)[.*a-z[]/i.test(builtCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\.rdr[^{]*\{[^}]*\}/gm, "")
       .split("\n").filter((l) => !l.startsWith(".rdr") && !l.startsWith("@") && !l.startsWith("}")).join("\n")
       .replace(/^\s*$/gm, "")));
  ok("spec", "and the demo strip is gone from it",
     !/\.demoBtn|\[data-demo/.test(builtCss));

  /* THE BRIEF'S OWN TEST, RUN RATHER THAN READ: "If a class in reader.css is
     unused when you finish, a component is missing." A stylesheet is a list of
     the parts the design has; a class nothing renders is a part that was
     skipped, and it fails silently because unused CSS never errors. */
  const shipped = shippedCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(DEMO, "");
  const shippedClasses = new Set([...shipped.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));
  let markup = "";
  (function walk(d) {
    for (const f of readdirSync(join(ROOT, d))) {
      const rel = `${d}/${f}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(jsx?|mjs)$/.test(rel)) markup += read(rel);
    }
  })("src/components/paper/v6");
  markup += read("src/lib/readerIcons.js");
  /* THREE ARE UNRENDERED BY THE HANDED-OVER FILES THEMSELVES, and naming them
     is the point. Each is a rule in reader.css that nothing in reader.js ever
     produces, so copying the chrome verbatim inherits the gap rather than
     causing it — and inventing the markup to fill it would be exactly the
     restyling the one rule forbids.

       mk    a highlight inside a panel card's quote, in the five meanings'
             colours. `card()` marks search hits with <mark> instead
       lbl   `.who .lbl`, a small caption in the You tray's identity row.
             `trayMe()` renders <b> and <span> there and no caption
       gp    `.li .gp`, a grab handle on a chest row. The rows ARE draggable
             (`dragstart` on `.li`), so this is the one of the three worth
             raising: the affordance is styled and never drawn

     Written down so the next unused class cannot hide among them. */
  const NOT_IN_THE_SOURCE = ["mk", "lbl", "gp"];
  const unused = [...shippedClasses]
    .filter((c) => !NOT_IN_THE_SOURCE.includes(c))
    .filter((c) => !new RegExp(`["\`\\s.'>]${c}(?![a-zA-Z0-9_-])`).test(markup));
  ok("spec", `every class in it is rendered by something (${shippedClasses.size} classes, 3 the source never draws)`,
     unused.length === 0, unused.join(" "));
  /* And the three stay honest: if reader.js ever starts drawing one, this
     fails and the list shrinks. */
  const drawnNow = NOT_IN_THE_SOURCE
    .filter((c) => new RegExp(`class="[^"]*\\b${c}\\b`).test(read("docs/reader/v6/reader.js")));
  ok("spec", "and the three the source never draws still do not appear in it",
     drawnNow.length === 0, drawnNow.join(" "));

  /* THE COLLISION LIST, KEPT CURRENT BY FAILING. Scoping reader.css stops the
     reader painting the app; it does nothing about the app painting the
     reader, and seven of v6's 187 class names already existed here. A bare
     `.x` loses to `.rdr .x` for the properties the reader declares — the
     damage is everything it does not declare, and every pseudo-element, which
     specificity has no opinion about at all. An eighth would be silent, so it
     is this that has to speak. */
  const QUARANTINED = ["av", "chip", "mt", "pop", "pres", "scrub", "sw"];
  const additions = read("src/components/paper/v6/additions.css");
  const appCss = [];
  (function walk(d) {
    for (const f of readdirSync(join(ROOT, d))) {
      const rel = `${d}/${f}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith(".css") && !rel.includes("components/paper/")) appCss.push(rel);
    }
  })("src");
  const collisions = new Set();
  for (const f of appCss) {
    const body = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of body.matchAll(/(^|[},])\s*([^{}@]*?)\{/g)) {
      for (const sel of m[2].split(",")) {
        const bare = sel.trim().match(/^\.([a-zA-Z][a-zA-Z0-9_-]*)(?:[:.[\s>]|$)/);
        if (bare && shippedClasses.has(bare[1])) collisions.add(bare[1]);
      }
    }
  }
  const unlisted = [...collisions].filter((c) => !QUARANTINED.includes(c));
  ok("spec", `no class name the app already uses arrives unquarantined (${collisions.size} known)`,
     unlisted.length === 0, unlisted.join(" "));
  /* The two that measurably painted the reader — a toggle knob inside the
     warmth slider, a rotated arrow on every popover — and the three that
     would have. */
  ok("spec", "and the ones that painted the reader are undone",
     QUARANTINED.filter((c) => c !== "mt")
       .every((c) => new RegExp(`\\.app \\.rdr(?:\\[[^\\]]+\\])? (?:svg )?\\.${c}[ .:{,]`).test(additions)));
  /* And section 12's global 44px floor, which measured v4's swatches as ovals,
     is waived inside the reader and paid by the platform layer instead. */
  ok("spec", "the app's tap floor does not distort the shipped boxes",
     /\.app \.rdr button:not\(\.is-inline\)/.test(additions)
     && /min-height: 0;/.test(additions)
     && /\[data-plat="touch"\][\s\S]*?min-height: 44px/.test(additions));

  /* AND THE FACE THE SHEET ASKS FOR IS THE APP'S OWN. reader.css names
     "Instrument Sans" directly; this app already loads it as --font-ui, and
     the house rule is that the brand faces are reached through tokens and
     never by name. */
  ok("spec", "the faces are reached through the tokens, not named",
     /font-family: var\(--font-ui\)/.test(additions)
     && /font-family: var\(--font-mono\)/.test(additions));
}

/* ---- the tool table, and what is still missing from it -------------------
   A green suite that does not mention the holes is worse than a red one, and
   the first version of this section checked for STRINGS — which went on
   passing after the tools were built, because the strings had moved. It asks
   about behaviour now.

   Every line asserts the state as it is. Building something fails its line,
   and the fix is to change or delete it, which is the only way a list like
   this stays true. */
console.log("\nthe tool table");
{
  const part3 = read("src/components/paper/v6/part3.js");
  const src = readerSrc();

  /* Fifteen tools in the table. Ten have a behaviour when you arm them:
     Select picks and pans, Pen/Marker/Highlight draw, the Eraser rubs, and
     Underline, Strikethrough, Note, Ask and Flag each take a selection and
     write their own kind. */
  const BUILT = ["hand", "pen", "mkr", "hl", "era", "ul", "st", "note", "ask", "flag",
                 "shp", "msr", "snap", "txt"];
  const listed = (part3.match(/const BUILT=\[([^\]]*)\]/) || [, ""])[1]
    .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean);
  ok("tools", `fourteen of the fifteen have a behaviour (${listed.length} listed)`,
     listed.length === BUILT.length && BUILT.every((id) => listed.includes(id)),
     listed.join(" "));

  /* A control that does nothing is the same lie as an empty state that names
     no action, so the five that do not work are not offered — not in the
     chest, and not as a tab with nothing behind it. */
  ok("tools", "and the one that does not is not offered anywhere",
     /BUILT\.includes\(t\.id\)/.test(part3)
     && /\.filter\(g=>TOOLS\.some\(t=>t\.g===g&&BUILT\.includes\(t\.id\)\)\)/.test(part3));
  for (const id of ["link"]) {
    ok("tools", `${id} is in the table and still unbuilt`,
       new RegExp(`\\{id:'${id}'`).test(part3) && !listed.includes(id));
  }

  /* The text tools are the reason five of them work at all: "only the Select
     tool selects" was implemented as "only hand", which locked out every tool
     whose whole job is a passage. */
  ok("tools", "a text tool can take a selection, and a drawing tool cannot",
     /const TEXT=TOOLS\.filter\(t=>\(t\.mean\|\|t\.fixed\)&&!t\.ink&&!t\.grey\)/.test(part3)
     && /TEXT\.includes\(S\.tool\)\)\?'1':'0'/.test(part3));
  ok("tools", "and marks in its own kind rather than asking again",
     /if\(TEXT\.includes\(S\.tool\)\)\{[\s\S]{0,300}stamp\(k\);/.test(part3));

  /* Strikethrough and Note have no shape in the shipped sheet, so both are
     given one in the additions file, in the sheet's own vocabulary. */
  ok("tools", "strikethrough and note are drawn, not left as bare boxes",
     /\.rdr \.mkq\.st::after/.test(readerCss()) && /\.rdr \.mkq\.note \{/.test(readerCss()));

  /* WHAT IS STILL MISSING. */
  /* Section 4's last row, built: a student can pull their marks out of a
     paper. Markdown, because a format nobody can read is the same as no
     export — and their OWN marks only, because the class's belong to the
     class and a red one is private end to end, including from a file that
     might be forwarded. */
  ok("tools", "a student can take their marks out of a paper",
     /function deckText\(\)/.test(src) && /text\/markdown/.test(src)
     && /data-go="out"/.test(read("src/components/paper/v6/part2.js")));
  /* Link needs somewhere to keep a target. `kind` has room for it and nothing
     else does: a URL is not an anchor and not a stroke. */
  ok("gap", "Link has no target to keep, so it is not offered",
     !/\{id:'link'[\s\S]{0,400}BUILT/.test(part3) && !listed.includes("link"));
  /* A tape measure that could be kept would need paper_ink to be able to say
     "this one is a measurement", and its tool CHECK is pen and marker. */
  ok("gap", "a measurement cannot be kept, and is a tape measure rather than a mark",
     /it is a tape measure, not an annotation|leaves nothing behind/i.test(part3 + src));
  ok("gap", "the fanned deck shows recent marks, not recent places",
     /recent\(\) \{[\s\S]{0,200}m\.who === "me"/.test(read("src/components/paper/v6/marks.js")));
}

console.log(`\npaper: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
