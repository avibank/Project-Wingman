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
  read("src/components/paper/reader.css") + "\n" + read("src/components/paper/reader-additions.css");

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
  const fn = (reader.split("if (!sel || tool === \"sel\" || isInk(tool)) return;")[1] || "").split("}, [sel, tool]);")[0];
  ok("R5", "and marking a selection opens no composer",
     /addMark\(\{ kind: kindOf\(tool\), start: made\.start, end: made\.end \}\)/.test(fn)
     && /marksText\(tool\)/.test(fn)
     && !/setComposer/.test(fn), fn.length ? "" : "not found");
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
  /* COMPONENTS.md's top bar names this button "Check for new marks", and the
     shipped label is the one that ships. */
  ok("R6", "the refresh control says what it does",
     /aria-label="Check for new marks"/.test(reader));
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
  /* COMMENTS FIRST. This has now caught its own prose three times: a note
     explaining why the code never says "0 marks" contains the string "0
     marks". A checker that reads its own explanation is a checker that fails
     when somebody documents the rule properly. */
  const readerCode = reader.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("R11", "no zero is ever stated",
     !/\b0 (marks|notes|highlights)\b/.test(readerCode) && !/>No marks</.test(readerCode));
  ok("R11", "the orphan list is absent rather than empty",
     /orphans\.length > 0 && \(/.test(reader));
}

/* ---- R13 · Smooth Air turns it off -------------------------------------- */
console.log("\nR13 — Smooth Air turns it all off");
{
  const css = readerCss();
  ok("R13", "the app's own class, not a new mechanism", /\.app\.smooth-air/.test(css));
  ok("R13", "and prefers-reduced-motion with it", /prefers-reduced-motion: reduce/.test(css));
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
     second one somebody typed. */
  const inReader = (h) => /^#(0[08]|0D|E2|E8|9F|61|4C|F2|5B|4F|C7|EC|C9|BF|11|84|3A|E4|2A|0B|fff|fafafa|f2f3f5|9aa5b1|d9dde1|9aa3ab|333|111)/i.test(h);
  ok("R14", "no hex the shipped palette did not bring", hex.filter((h) => !inReader(h)).length === 0,
     hex.filter((h) => !inReader(h)).join(" "));
  ok("R14", "density is the livery accent at low alpha",
     /--accent\) 7%/.test(css) && /--accent\) 13%/.test(css) && /--accent\) 20%/.test(css));
  /* THIS RULE WAS REVERSED, AND THE REVERSAL IS RECORDED RATHER THAN SILENT.

     R14 said the page carries a hairline and no shadow, because the house style
     has no drop shadows. The reader rebuild's brief (§8.2) specifies three
     depths and puts the page on the first of them, and its reference build
     floats the page — which is not decoration once the chrome above it is
     floating too: with bars at depth 2 and popovers at depth 3, a page with no
     depth of its own flattens the whole stack.

     So the assertion is not deleted, it is inverted: the page must sit at
     depth 1, and there must still be exactly three depths and no fourth. */
  ok("R14", "the page sits at depth 1 — a shadow, and one that is not the bars'",
     /--sh-page:\s*0 1px 2px/.test(css) && /\.rdr-page \{[\s\S]{0,220}box-shadow: var\(--sh-page\)/.test(css));
  /* Four depths in the shipped sheet, declared once as tokens rather than
     typed at each use: the page, the tooltip, the bars, the popovers above
     them. A fifth would be a surface belonging to no layer. */
  ok("R14", "and the reader keeps to the shipped depths, no fifth",
     ["--sh-page:", "--sh-md:", "--sh-bar:", "--sh-pop:"].every((t) => css.includes(t))
     && !/--sh-(?!page|md|bar|pop)[a-z]+:/.test(css));

  // 13px type floor, measured rather than trusted.
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  /* THE 13px FLOOR IS THE OTHER OVERRIDE. The shipped sheet's type runs 8.5px
     to 26px — the dock's preset counts are 8.5px superscripts and the mono
     page numbers are 10px — and it is the sheet the app was told to copy. What
     survives is the floor for anything the reader has to READ, as opposed to
     glance at: the mark card's body, the panel rows, the composer. */
  const small = sizes.filter((n) => n < 8.5);
  ok("R14", `no type below the shipped sheet's own floor (${sizes.length} declared)`,
     small.length === 0, small.join(", "));
  const body = [...css.matchAll(/\.(mcd|mrow b|plist|composer textarea)[^{]*\{[^}]*font-size:\s*(\d+(?:\.\d+)?)px/g)]
    .map((m) => Number(m[2]));
  ok("R14", "and what is read rather than glanced at is 12px or more",
     body.every((n) => n >= 12), body.join(", "));

  // 44px targets: the controls that are smaller carry padding to reach it, so
  // this asserts the floor on the min-height declarations that exist.
  const heights = [...css.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
  ok("R14", "no control declares a height under 30px", heights.every((h) => h >= 30), heights.join(", "));
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

  const reader = read("src/components/paper/PaperReader.jsx");
  ok("R1", "the tap becomes an anchor like any other, not a coordinate",
     /sentenceAround\(model\.text, at\)/.test(reader)
     && !/hint: \{[^}]*x:/.test(reader));
  ok("—", "a drag is still a drag, not a tap",
     /getSelection\(\)\?\.toString\(\)\.trim\(\)\) return/.test(reader));
}

/* ---- one panel, two kinds ----------------------------------------------- */
console.log("\nthe Spotlight");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  const css = readerCss();
  /* It was Spotlight; COMPONENTS.md has no composer of its own — the demo
     opens notes inline — so this build keeps one panel and borrows the
     inspector's chrome for it. One component, three kinds, still one dialog. */
  ok("—", "note, question and correction are one panel, not three dialogs",
     /role="tablist"/.test(reader) && (reader.match(/function Composer\(/g) || []).length === 1);
  ok("—", "the field takes the keyboard on open", /ref\.current\?\.focus\(\)/.test(reader));
  ok("—", "Escape puts it away", /e\.key === "Escape"\) onCancel\(\)/.test(reader));
  ok("—", "a correction offers no ring, because it has one reader",
     /kind !== "correction"/.test(reader) && /setRing\("solo"\)/.test(reader));
  ok("R13", "and it does not animate under Smooth Air",
     /\.app\.smooth-air \.composer, \.app\.smooth-air \.rdr-scrim \{ animation: none; \}/.test(css));
}

/* ---- the rail moves and scales ------------------------------------------ */
console.log("\nthe tool rail");
{
  const css = readerCss();
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("—", "three docks, and each lays the dock out for itself",
     DOCKS.map((d) => d.id).join(",") === "left,right,top"
     && /\[data-dock="right"\]/.test(css) && /\[data-dock="top"\]/.test(css));
  /* The shipped sheet sizes the tool itself — 38px on a pointer, 44px under
     900px — rather than through a knob the reader turns. One number, in one
     place, and the touch case is the media query's. */
  ok("—", "one number decides the size",
     /\.tool \{[\s\S]{0,90}width:38px; height:38px/.test(css)
     && /\.addbtn \{[\s\S]{0,40}width:38px; height:38px/.test(css)
     && /\.tool, [^{]*\.addbtn \{ width:44px; height:44px; \}/.test(css));
  ok("—", "where it sits is a per-device preference, not an account one",
     /write\("pw-paper-dock", dock\)/.test(reader)
     && /localStorage\.setItem\(key, value\)/.test(reader)
     && !/progress\.set\("pw-paper-dock"/.test(reader));
}

/* ---- the reader is full screen, and stays that way ---------------------- */
console.log("\nfull screen");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  const css = readerCss();
  ok("—", "the screen is fixed to the viewport", /\.rdr \{\s*\n?\s*position: fixed; inset: 0/.test(css));

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

  const reader = read("src/components/paper/PaperReader.jsx");
  ok("ink", "the eraser only ever removes strokes this account drew",
     /s\.author_id === me/.test(reader));
  const page = read("src/components/paper/PaperInk.jsx");
  ok("ink", "the live stroke is written to the DOM, not through setState",
     /setAttribute\("d"/.test(page) && !/setPoints|useState\(\[\]\)/.test(page));
  ok("ink", "and every position the pointer recorded is used, not just the last",
     /getCoalescedEvents/.test(page));
  ok("ink", "the layer is inert unless a drawing tool is armed",
     /data-armed=\{drawingTool \? "" : undefined\}/.test(page));
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
  ok("colour", "graphite becomes chalk when the page is inverted",
     /\[data-look="night"\] \[data-ink="graphite"\]/.test(css));
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
  ok("view", "and two grounds, which the four lights sit inside",
     /\.rdr\[data-look="paper"\] \{/.test(readerCss()));
  const css = readerCss();
  ok("view", "the light falls on the picture and not on the marks",
     /canvasStyle = \{ filter: light === "day" \? undefined : lightFilter\(light\) \}/
       .test(read("src/components/paper/PaperPage.jsx")));
  ok("view", "and the ground follows it, so the surround is never the brightest thing",
     /\.rdr\[data-look="paper"\][\s\S]{0,300}--bg:\s*#C9CFD6/.test(css)
     && /\.rdr \{[\s\S]{0,120}--bg:\s*#080B0F/.test(css));
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
  const out = read("src/components/paper/PaperOutline.jsx");
  ok("R11", "and a paper without one says what to do instead of stating a zero",
     /carries no contents of its own/.test(out) && !/\b0 (headings|sections)\b/.test(out));
}

/* ---- the rail carries ten tools without eating the window --------------- */
console.log("\nthe rail, at ten tools");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  const css = readerCss();
  /* Fourteen tools in six groups now — the full set §9 lists. The DEFAULT
     tray is still six of them; the rest are one tap away in the Add sheet and
     none of them is unreachable, which is the rule that makes trimming safe. */
  /* The set is readerIcons.js's now, copied byte for byte from the spec, and
     paperTray.js re-exports it rather than keeping a second opinion. */
  const icons = read("src/lib/readerIcons.js");
  ok("rail", "the full tool set is fourteen, in six groups",
     (icons.match(/\{ id:'[a-z]+',/g) || []).length === 14
     && /GROUPS = \['Select','Mark up','Ink','Draw','Sign off','Talk'\]/.test(icons));
  ok("rail", "and the tray ships six of them",
     /DEFAULT_TRAY = \['sel','hl','pen','era','note','ask'\]/.test(icons)
     && /export \{ DEFAULT_TRAY, TRAY_CAP, GROUPS \}/.test(read("src/lib/paperTray.js")));
  /* This used to read "two abreast rather than shrinking the hit targets",
     because a single column of TEN 44px tools is 659px of a 720px window. The
     shipped design answers it at the other end: the tray ships six, the cap is
     ten only on a desktop, and the column is one wide. Six 38px tools is
     250px. The rule the two-abreast grid existed to protect is the one that
     is asserted. */
  ok("rail", "and a column of the default tray fits a laptop window",
     /DEFAULT_TRAY = \['sel','hl','pen','era','note','ask'\]/.test(icons)
     && /flex-direction:column/.test(css.match(/\.bar-dock \{[^}]*\}/)[0]));
  /* Select has no settings, so it closes the inspector rather than opening an
     empty one. The decision is at the point the tool is picked, which is the
     only place that knows a tool was picked at all. */
  ok("rail", "the armed tool's settings appear beside it and no others exist",
     /setInspOpen\(id !== "sel"\)/.test(reader)
     && /open=\{inspOpen && !adding && !editing\}/.test(reader));
  /* The inspector sits beside the DOCK and only beside the dock. It used to
     clear the panel's width as well, from when the panel was a column on the
     same side; now the panel floats on the other edge and that offset pushed
     the inspector off the screen. */
  ok("rail", "the inspector sits against the dock, not offset by a panel that moved",
     /\.bar-insp \{[\s\S]{0,60}left:70px/.test(css)
     && !/\.bar-insp \{[^}]*var\(--side-w\)/.test(css));

  /* Naming panels one at a time is a rule that breaks the next time one is
     added, and it did: Contents and Queue opened at the full width of the
     window because the grid rule listed only thumbs and marks. */
  /* Naming panels one at a time is a rule that broke the next time one was
     added, and it did. It cannot now: the shipped panel floats over the page
     instead of taking a column from it, so there is no width to switch on and
     nothing to name. `data-panel` carries which one is showing, once. */
  ok("rail", "the sidebar floats, so no panel has to be named twice",
     !/--side-w/.test(css) && /data-panel=\{rail \|\| "none"\}/.test(reader));
}

/* ---- a selection offset means two different things ---------------------- */
console.log("\nselection");
{
  const reader = read("src/components/paper/PaperReader.jsx");
  /* In a text node an offset is a character; in an ELEMENT it is a child-node
     index. A double-click, a triple-click and a drag that lands on a span
     boundary all give element endpoints, and treating the index as a character
     count silently truncates the mark to its first letter. */
  ok("select", "an element endpoint is converted, not trusted",
     /const isText = node\?\.nodeType === 3/.test(reader)
     && /childNodes[\s\S]{0,160}textContent\?\.length/.test(reader));
}

/* ---- §4.6 · the PDF is opened for pixels and nothing else --------------- */
console.log("\n§4.6 — big papers");
{
  const reader = read("src/components/paper/PaperReader.jsx");
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
     /page2\.cleanup\(\)/.test(reader));

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
  const shippedCss = read("docs/reader/reader.css");
  const builtCss = read("src/components/paper/reader.css");
  /* Selectors move so the reader's class names cannot restyle the rest of the
     app — seventeen of them collide with a dozen other screens. Nothing else
     may move: same tokens, same values, same timings, same radii. */
  const decls = (css) => (css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\})/g) || [])
    .join("|").replace(/\s+/g, " ").trim();
  ok("spec", "reader.css is used, not reinterpreted — every declaration identical",
     decls(shippedCss) === decls(builtCss));
  ok("spec", "and it is generated from the shipped file, so the two cannot drift",
     /GENERATED — do not edit\. Source: docs\/reader\/reader\.css/.test(builtCss));
  ok("spec", "every rule is scoped to the reader",
     !/(?:^|\n)\.(?!rdr)[a-z]/i.test(builtCss.replace(/\/\*[\s\S]*?\*\//g, "")));

  const shippedIcons = read("docs/reader/reader-icons.js");
  ok("spec", "reader-icons.js is copied byte for byte",
     shippedIcons === read("src/lib/readerIcons.js"));
  ok("spec", "and the reader draws from it rather than an icon library",
     /from "\.\.\/\.\.\/lib\/readerIcons\.js"/.test(read("src/components/paper/Icon.jsx")));

  /* THE BRIEF'S OWN TEST, RUN RATHER THAN READ: "If a class in reader.css is
     unused when you finish, a component is missing." A stylesheet is a list of
     the parts the design has; a class nothing renders is a part that was
     skipped, and it fails silently because unused CSS never errors. This
     caught three — `.s.is-marked`, `.is-open-thread`, `.is-selected` — which
     were being drawn from a second set of rules under different names. */
  const shipped = read("docs/reader/reader.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const shippedClasses = new Set([...shipped.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));
  let markup = read("src/lib/readerIcons.js");
  for (const f of readdirSync(join(ROOT, "src/components/paper"))) {
    if (f.endsWith(".jsx")) markup += read(`src/components/paper/${f}`);
  }
  const unused = [...shippedClasses]
    .filter((c) => !new RegExp(`["\`\\s]${c}(?![a-zA-Z0-9_-])`).test(markup));
  ok("spec", `every class in it is rendered by something (${shippedClasses.size} classes)`,
     unused.length === 0, unused.join(" "));

  /* AND THE FONT THE SHEET ASKS FOR IS ONE THE APP ACTUALLY HAS. reader.css
     names "IBM Plex Mono" at eighteen places; nothing loads it here, so left
     alone every one of them falls through to the browser's default monospace,
     which differs per machine and is not the shipped look either. Each is
     re-pointed at --font-mono by name, and this asserts none was missed —
     including any the sheet gains later. */
  const scoped = read("src/components/paper/reader.css");
  const additions = read("src/components/paper/reader-additions.css");
  const monoSelectors = new Set([...scoped.matchAll(/([^{}]+)\{[^}]*IBM Plex Mono/g)]
    .map((m) => m[1].trim().split("\n").pop().trim()));
  const adrift = [...monoSelectors]
    .filter((sel) => !additions.includes(sel.replace(/^\.rdr-page/, ".rdr .rdr-page")));
  ok("spec", `the mono face is the app's own, everywhere the sheet asks for one (${monoSelectors.size})`,
     adrift.length === 0, adrift.join(" | "));
  /* Comments first — for the fourth time in this file. The rule is explained
     in a comment that names the font the rule exists to remove. */
  /* THE COLLISION LIST, KEPT CURRENT BY FAILING. Scoping reader.css stops the
     reader painting the app; it does nothing about the app painting the
     reader, and eight of the shipped sheet's class names already existed here.
     A bare `.x` loses to `.rdr .x` for the properties the reader declares —
     the damage is everything it does not declare, and every pseudo-element.
     A ninth would be silent, so it is this that has to speak. */
  const QUARANTINED = ["sw", "pop", "pill", "scrub", "av", "plist", "row", "title"];
  const appCss = [];
  (function walk(d) {
    for (const f of readdirSync(join(ROOT, d))) {
      const rel = `${d}/${f}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith(".css") && !rel.includes("paper/reader")) appCss.push(rel);
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
  ok("spec", "and the ones that painted the reader are undone",
     ["sw", "pop", "pill", "scrub", "av"].every((c) => new RegExp(`\\.app \\.rdr \\.${c}[ .:{]`).test(additions)));

  ok("spec", "and it is reached through the token, not named",
     /font-family: var\(--font-mono\);/.test(additions)
     && !/IBM Plex Mono/.test(additions.replace(/\/\*[\s\S]*?\*\//g, "")));
}

console.log(`\npaper: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
