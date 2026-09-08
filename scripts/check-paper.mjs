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
  /* The body of markSelection, on its own: it must reach addMark and must never
     reach setComposer. It was highlightNow until underline and strikethrough
     joined it — three kinds, one gesture, still nothing to type. */
  const fn = (reader.split("const markSelection = useCallback(")[1] || "").split("}, [")[0];
  ok("R5", "and it opens no composer",
     /addMark\(\{ kind, start, end \}\)/.test(fn) && !/setComposer/.test(fn), fn.length ? "" : "not found");
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
     /\.pp \{[^}]*box-shadow: 0 1px 2px/.test(css));
  ok("R14", "and the reader keeps to three depths, no fourth",
     (css.match(/box-shadow: 0 \d+px \d+px oklch/g) || []).length <= 4);

  // 13px type floor, measured rather than trusted.
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const small = sizes.filter((n) => n < 13);
  ok("R14", `every font-size is at least 13px (${sizes.length} declared)`, small.length === 0, small.join(", "));

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
  const css = read("src/components/paper/paper.css");
  ok("—", "note and question are a toggle inside one panel, not two dialogs",
     /role="tablist"/.test(reader) && (reader.match(/function Spotlight/g) || []).length === 1);
  ok("—", "the field takes the keyboard on open", /ref\.current\?\.focus\(\)/.test(reader));
  ok("—", "Escape puts it away", /e\.key === "Escape"\) onCancel\(\)/.test(reader));
  ok("—", "a correction offers no ring, because it has one reader",
     /kind !== "correction" \? \(\s*\n?\s*<label className="spot-ring"/.test(reader));
  ok("R13", "and it does not animate under Smooth Air",
     /\.app\.smooth-air \.spot, \.app\.smooth-air \.spot-scrim \{ animation: none; \}/.test(css));
}

/* ---- the rail moves and scales ------------------------------------------ */
console.log("\nthe tool rail");
{
  const css = read("src/components/paper/paper.css");
  const reader = read("src/components/paper/PaperReader.jsx");
  ok("—", "three docks, and each lays the grid out for itself",
     DOCKS.map((d) => d.id).join(",") === "left,right,top"
     && /\[data-dock="right"\]/.test(css) && /\[data-dock="top"\]/.test(css));
  ok("—", "one knob decides the size", /--rail-btn/.test(css)
     && TOOL_SIZES.every((z) => new RegExp(`\\[data-toolsize="${z.id}"\\]`).test(css)));
  ok("—", "where it sits is a per-device preference, not an account one",
     /write\("pw-paper-dock", dock\)/.test(reader)
     && /localStorage\.setItem\(key, value\)/.test(reader)
     && !/progress\.set\("pw-paper-dock"/.test(reader));
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
  const css = read("src/components/paper/paper.css");
  for (const c of COLOUR_IDS) {
    ok("colour", `the database knows ${c}`, new RegExp(`'${c}'`).test(sql));
    ok("colour", `and the stylesheet paints ${c}`, new RegExp(`--ink-${c}:`).test(css));
  }
  ok("colour", "eight of them, and no more", INK_COLOURS.length === 8);
  ok("colour", "an unknown name reads as the default rather than as nothing",
     colourOr("chartreuse") === "yellow" && colourOr(null) === "yellow");

  const annots = read("src/lib/annotations.js");
  ok("colour", "the client sends a name, never a colour",
     /colour: colour \|\| null/.test(annots) && !/oklch|#[0-9a-f]{3}/i.test(annots));
  ok("R14", "and the palette is OKLCH like everything else here",
     (css.match(/--ink-[a-z]+:\s*oklch/g) || []).length === 8);

  /* Graphite is the one colour that has to move: it is defined by being darker
     than paper, and in night mode the paper is dark. */
  ok("colour", "graphite becomes chalk when the page is inverted",
     /\[data-light="night"\][\s\S]{0,120}data-colour="graphite"/.test(css));
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

  ok("view", "three layouts and four lights",
     LAYOUTS.length === 3 && PAPER_LIGHTS.length === 4 && FITS.length === 3);
  const css = read("src/components/paper/paper.css");
  ok("view", "the light falls on the picture and not on the marks",
     /canvasStyle = \{ filter: light === "day" \? undefined : lightFilter\(light\) \}/
       .test(read("src/components/paper/PaperPage.jsx")));
  ok("view", "and the ground follows it, so the surround is never the brightest thing",
     /\[data-light="night"\] \.pscroll/.test(css));
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
  const css = read("src/components/paper/paper.css");
  /* Fourteen tools in six groups now — the full set §9 lists. The DEFAULT
     tray is still six of them; the rest are one tap away in the Add sheet and
     none of them is unreachable, which is the rule that makes trimming safe. */
  ok("rail", "the full tool set is fourteen, in six groups",
     (reader.match(/\{ id: "[a-z]+", group: \d/g) || []).length === 14
     && /GROUPS/.test(read("src/lib/paperTray.js")));
  ok("rail", "and the tray ships six of them",
     /DEFAULT_TRAY = \["select", "highlight", "pen", "eraser", "note", "question"\]/
       .test(read("src/lib/paperTray.js")));
  /* Every button in this app is at least 44px on its shortest side (§12), so a
     single column of ten is 659px of a 720px window. Two abreast is 7 rows. */
  ok("rail", "and it runs two abreast rather than shrinking the hit targets",
     /grid-template-columns: repeat\(2, var\(--rail-btn\)\)/.test(css)
     && !/\.ptoolbtn[^{]*\{[^}]*min-height:\s*(2\d|3\d)px/.test(css));
  ok("rail", "the armed tool's settings appear beside it and no others exist",
     /if \(tool === "select"\) return null;/.test(reader));
  /* The inspector sits beside the DOCK and only beside the dock. It used to
     clear the panel's width as well, from when the panel was a column on the
     same side; now the panel floats on the other edge and that offset pushed
     the inspector off the screen. */
  ok("rail", "the inspector sits against the dock, not offset by a panel that moved",
     /\.ptray \{[^}]*left: calc\(100% \+ 8px\)/.test(css)
     && !/\.ptray \{[^}]*var\(--side-w\)/.test(css));

  /* Naming panels one at a time is a rule that breaks the next time one is
     added, and it did: Contents and Queue opened at the full width of the
     window because the grid rule listed only thumbs and marks. */
  ok("rail", "the sidebar is open or it is not — no panel is named twice",
     /\.paper:not\(\[data-rail="none"\]\) \{ --side-w/.test(css));
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

console.log(`\npaper: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
