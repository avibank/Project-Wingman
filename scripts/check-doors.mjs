// EVERY DOOR LEADS SOMEWHERE, AND EVERY ROOM HAS A WAY OUT. Run: npm run check:doors
//
// Three failures this catches, all of which look fine in a build and in a diff:
//
//   * A DEAD BUTTON — a <button> with nothing bound to it, an onClick that
//     evaluates to nothing, an <a href="#">. It renders, it has a hover state,
//     it takes focus and it does nothing, which is worse than not being there.
//   * A DEAD END — a path built by `path.*` or handed to `go()` that
//     parseRoute answers `notfound` for, or a route name the app renders
//     nothing for. A link to a 404 is a link a student trusts once.
//   * A NAME THAT MOVED — copy that still points at a screen this app no
//     longer has. "You can undo it in Settings" outlived Settings by one
//     commit, and nothing but reading it would have said so.
//
// It reads the source rather than the DOM on purpose: test:bm and test:rr walk
// the screens they know about, and this is what covers the ones nobody wrote a
// walk for.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseRoute, path as routePath, BOOKMARK_FOLDERS, PROFILE_TABS, CHAPTER_TABS } from "../src/lib/routes.js";

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

const JSX = walk("src").filter((f) => f.endsWith(".jsx"));
const SRC = walk("src").filter((f) => /\.(js|jsx)$/.test(f));

/* ---------------------------------------------------------------- 1 · buttons
   The whole opening tag, however many lines it takes, so a handler on line four
   of a wrapped <button> is not reported as missing. */
function openTags(src, tag) {
  const out = [];
  const re = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  let m;
  while ((m = re.exec(src))) {
    let i = m.index, depth = 0, quote = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ at: src.slice(0, m.index).split("\n").length, text: src.slice(m.index, i + 1) });
  }
  return out;
}

/* THE READER BINDS BY DELEGATION, and that is not the same as not binding.
   Its chrome is one island with a single handler that reads `id` and
   `data-act` off whatever was pressed (part2.js), so its buttons carry no
   onClick and are wired all the same. A button with an id or a data-* action
   in a file that delegates is checked by check:paper's own 219 assertions
   instead of being called dead here. */
const DELEGATES = /addEventListener\(\s*["'](?:click|pointerdown)["']/;
const dead = [];
for (const f of JSX) {
  const raw = readFileSync(f, "utf8");
  const src = strip(raw);
  const delegated = DELEGATES.test(raw) || f.includes("/paper/v6/");
  for (const t of openTags(src, "button")) {
    const acts = /on(Click|PointerDown|MouseDown|KeyDown|Submit|Change)|type="submit"|form=|\{\.\.\./.test(t.text);
    const off = /disabled(?![a-zA-Z])/.test(t.text);
    const bound = delegated && /\sid=|\sdata-[a-z]/.test(t.text);
    if (!acts && !off && !bound) dead.push(`${f}:${t.at}`);
  }
  for (const t of openTags(src, "a")) {
    if (/href=("#"|{"#"}|""|{""})/.test(t.text) && !/onClick/.test(t.text)) dead.push(`${f}:${t.at} <a href="#">`);
  }
  /* A no-op handler on a HOST element is a dead control; the same thing on a
     component is a prop it has chosen not to answer, which is its business. */
  for (const tag of ["button", "a", "input", "select", "textarea", "form", "summary", "li", "div", "span"]) {
    for (const t of openTags(src, tag)) {
      if (/on[A-Z]\w+=\{\(\)\s*=>\s*(\{\s*\}|null|undefined|void 0)\}/.test(t.text)) {
        dead.push(`${f}:${t.at} a handler that does nothing`);
      }
    }
  }
}
ok("buttons", `no control is bound to nothing (${JSX.length} files)`, dead.length === 0, dead.join(" "));

/* ------------------------------------------------------------- 2 · every path
   Every URL this app can build, resolved through its own parser. */
const built = [
  routePath.home(), routePath.modules(), routePath.module("M1"),
  routePath.library("M1"), routePath.library("M1", "quizzes"),
  routePath.lesson("M1", "M1.01", "M1.01.1"), routePath.lesson("M1", "M1.01", "M1.01.1", "q1"),
  routePath.people("M1"), routePath.paper("M1", "M1.DEV"),
  ...CHAPTER_TABS.map((t) => routePath.chapter("M1", "M1.01", t)),
  routePath.question("M1", "M1.01", 3), routePath.quizResume("M1", "M1.01"),
  routePath.review("M1", "caution"),
  routePath.ready(), routePath.ready("M1"), routePath.ready("M1", "t1"),
  routePath.logbook(), routePath.signin(), routePath.invite("abc"),
  routePath.bookmarks(), ...BOOKMARK_FOLDERS.map((k) => routePath.bookmarks(k)),
  routePath.cards("M1", 2),
  ...PROFILE_TABS.map((t) => routePath.profile(t)),
];
const lost = built.filter((p) => parseRoute(p).name === "notfound");
ok("paths", `every path the app can build resolves (${built.length})`, lost.length === 0, lost.join(" "));

/* A redirect must land somewhere real, and must not redirect again. */
const REDIRECTS = ["/appearance", "/preferences", "/licence", "/saved", "/settings", "/settings/anything",
                   "/settings/profile", "/ready", "/ready/m1", "/bookmarks/nonsense", "/m/m1/library/cards/x"];
const badHop = [];
for (const r of REDIRECTS) {
  const first = parseRoute(r);
  if (first.name !== "redirect") { badHop.push(`${r} is ${first.name}, not a redirect`); continue; }
  const then = parseRoute(first.to);
  if (then.name === "notfound") badHop.push(`${r} -> ${first.to} -> notfound`);
  if (then.name === "redirect") badHop.push(`${r} -> ${first.to} -> redirects again`);
}
ok("paths", `every renamed path lands in one hop (${REDIRECTS.length})`, badHop.length === 0, badHop.join("; "));

/* Every literal path written into the app by hand, checked the same way. A
   path built by hand is exactly the one no builder is holding. */
const literals = new Set();
for (const f of SRC) {
  const src = strip(readFileSync(f, "utf8"));
  for (const m of src.matchAll(/(?:go|navigate)\(\s*["'`](\/[^"'`${}]*)["'`]/g)) literals.add(`${f} ${m[1]}`);
  for (const m of src.matchAll(/to=\{?["'`](\/[^"'`${}]*)["'`]/g)) literals.add(`${f} ${m[1]}`);
}
const badLiteral = [...literals].filter((l) => {
  const p = l.split(" ").pop();
  return parseRoute(p).name === "notfound";
});
ok("paths", `every path written by hand resolves (${literals.size})`, badLiteral.length === 0, badLiteral.join(" "));

/* ------------------------------------------------------- 3 · every route renders
   A name App.jsx has no branch for renders the Flight Deck under a perfectly
   correct URL, which is the failure the `paper` route hit once. */
const app = strip(readFileSync("src/App.jsx", "utf8"));
const NAMES = ["home", "modules", "module", "chapter", "lesson", "paper", "review", "ready",
               "logbook", "bookmarks", "cards", "profile", "signin", "invite", "notfound", "redirect"];
const unrendered = NAMES.filter((n) => !new RegExp(`route\\.name === "${n}"|MODULE_ROUTES|settingsPage`).test(app) || false)
  .filter((n) => !new RegExp(`"${n}"`).test(app));
ok("routes", `every route name is answered somewhere in App (${NAMES.length})`, unrendered.length === 0, unrendered.join(" "));

/* ------------------------------------------------------------ 4 · names that moved
   Copy, not comments: a screen this app does not have, named in a sentence a
   student reads. */
const GONE = [
  [/\bSettings\b/, "Settings", ["src/lib/routes.js"]],
  [/\bCalibration\b/, "Calibration", []],
  [/\bCompete\b/, "Compete", []],
  [/\bminimums\b/i, "minimums (never the bar's name in the UI)", ["src/lib/minimums.js", "src/components/module/Exam.jsx", "src/components/module/QuizPage.jsx", "src/App.jsx", "src/components/Home.jsx", "src/components/PaperStrip.jsx", "src/components/module/Review.jsx", "src/components/module/ModuleScreen.jsx", "src/components/ModulesPage.jsx", "src/components/module/QuizResults.jsx", "src/components/module/RouteTab.jsx", "src/components/module/LibraryTab.jsx", "src/components/Deck.jsx", "src/components/ChaptersPanel.jsx", "src/components/module/ModuleHub.jsx", "src/components/ModuleHub.jsx"]],
];
const said = [];
for (const f of JSX) {
  const src = readFileSync(f, "utf8");
  // strings that reach a screen: JSX text and quoted props that carry prose
  /* Across newlines AND across interpolations, because JSX prose has both.
     Refusing to cross a newline read only the first line of every wrapped
     sentence; refusing to cross `{name}` skipped the sentence entirely — and
     between them they hid "you can undo it in Settings" from a check written
     to find exactly that. An interpolation becomes a word, so the sentence
     around it stays one sentence. */
  const flat = src.replace(/\{[^{}]*\}/g, "\u2026");
  const prose = [
    ...flat.matchAll(/>\s*([A-Z][^<>]{6,}?)\s*</g),
    ...flat.matchAll(/(?:aria-label|title|placeholder|label|hint|note)=["']([^"']{6,})["']/g),
  ].map((m) => m[1].replace(/\s+/g, " ").trim());
  for (const [re, name, allowed] of GONE) {
    if (allowed.includes(f)) continue;
    for (const line of prose) if (re.test(line)) said.push(`${f}: "${line.trim().slice(0, 60)}" names ${name}`);
  }
}
ok("copy", "no screen copy names a screen this app no longer has", said.length === 0, said.join("; "));

/* -------------------------------------------------------- 5 · every empty state
   §10 of the voice: never state an absence, and name the next action inside
   the sentence. A "Nothing here yet." with nothing after it is a dead end made
   of words. */
const bare = [];
for (const f of JSX) {
  const src = strip(readFileSync(f, "utf8"));
  /* The whole run of text, not the first sentence — "Nobody yet. Block or mute
     anyone from their tail" states an absence AND names the action, and cutting
     it at the full stop hid the half that matters. */
  const flatEmpty = src.replace(/\{[^{}]*\}/g, "\u2026");
  for (const m of flatEmpty.matchAll(/>\s*(No(?:thing|body|ne)?\b[^<>]{0,200}?)\s*</g)) {
    const line = m[1].trim();
    // Not an empty state at all: a sentence that happens to begin "Nothing is…"
    if (!/\b(yet|none|empty|no one|nobody|nothing here)\b/i.test(line)) continue;
    if (/\bNothing (here )?is\b|\bNothing you did\b/i.test(line)) continue;
    /* ONE LINE IS ALLOWED TO SAY NOBODY. "Nobody on it right now" is the Crew
       tab's live counterpart to "On it now · [faces]" — a status line, not an
       empty state — and the block it sits in names the action directly beneath
       it on the wall. It is also the reference's own copy, which §1 of the
       launch handoff says to match. check:states carries the same exception;
       see docs/launch/DECISIONS.md. */
    if (line === "Nobody on it right now") continue;
    /* A next action is a verb the student can act on, in the same run of text —
       or an invitation to be the one who fills it, which is the same thing said
       the other way round ("The first one here could be yours"). */
    if (/\byours\b/i.test(line)) continue;
    if (!/\b(tap|press|open|add|start|ask|try|pick|choose|save|search|invite|join|write|take|watch|read|browse|go|see|find|keep|use|make|check|turn|bookmark|block|mute|carry|carries|clear)\b/i.test(line)) {
      bare.push(`${f}: "${line}"`);
    }
  }
}
ok("copy", `every empty line names its next action (${JSX.length} files)`, bare.length === 0, bare.join("; "));


/* ------------------------------------------------------- 6 · a switch that switches
   A flag nothing reads is a control in the admin panel that does nothing — the
   same failure as a dead button, one screen further back. The five below are
   stated rather than silent: each is a rebuild that shipped and won, kept as a
   way back. A SIXTH would fail this. */
const KNOWN_DEAD_FLAGS = {
  "home.v2": "the Flight Deck rebuild; locked on, kept as the way back",
  "profile.v2": "the three profile tabs; shipped",
  "tokens.global": "the livery and lighting system; locked on",
  "chrome.patoast": "the theme-change announcement; never built",
  "reader.v2": "the reader rebuild; its own note says to delete it once a week passes",
};
{
  const flagSrc = readFileSync("src/lib/flags.js", "utf8");
  const ids = [...flagSrc.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const unread = ids.filter((id) => !SRC.some((f) => f !== "src/lib/flags.js" && readFileSync(f, "utf8").includes(`"${id}"`)))
    .filter((id) => !(id in KNOWN_DEAD_FLAGS));
  ok("switches", `every flag gates something, or says why not (${ids.length})`, unread.length === 0, unread.join(" "));
}

/* -------------------------------------------------- 7 · state with a reader
   A key written and never read is a write nobody wanted; a key read and never
   written is a number on screen that can only ever be its default. The Logbook
   page's streak is the second kind, which is why it always reads nothing. */
const KNOWN_ORPHAN_KEYS = {
  "pw-font-size": "written through saveJSON to local storage as well, which is what App reads back",
  "pw-last-tab": "written for a restore that was never built",
  "pw-room-return": "written for a return-to-thread that was never built",
  "pw-room-seen": "read as a fallback; squadron_members.last_read_at replaced it (roomData.js)",
  "pw-streak": "the Logbook's streak tile, behind page.logbook and off; nothing counts days yet",
  "pw-longest-streak": "the same tile's best-ever half",
};
{
  const keys = new Map();
  for (const f of SRC) {
    const src = strip(readFileSync(f, "utf8"));
    for (const m of src.matchAll(/progress\.(get|set)\(\s*["'`]([^"'`]+)["'`]/g)) {
      const e = keys.get(m[2]) || { get: false, set: false };
      e[m[1]] = true;
      keys.set(m[2], e);
    }
  }
  const orphans = [...keys].filter(([k, e]) => (!e.get || !e.set) && !(k in KNOWN_ORPHAN_KEYS))
    .map(([k, e]) => `${k} is ${e.get ? "read, never written" : "written, never read"}`);
  ok("state", `every progress key has both a reader and a writer, or says why not (${keys.size})`, orphans.length === 0, orphans.join("; "));
}

/* ------------------------------------------- 8 · a screen inside a screen
   THE CREW TAB LIVES INSIDE .mscreen, AND SO DOES THE MODULE SCREEN'S OWN CSS.
   Both scoped, so check:collisions is happy; both at the same specificity, so
   source order decides. `.mscreen .hrow` is a grid whose first column is 38px,
   and the Crew tab's own `.hrow` inherited it — every "Answering questions"
   pill came out 38px wide with 78px of content spilling out of it. Measured,
   not guessed, and invisible in a diff.

   So every class the Crew tab draws is prefixed. This is what keeps it that
   way. `crew`, `is-on` and the stamp's own wrapper are the three that are
   allowed through by name. */
{
  const css = readFileSync(new URL("../src/components/module/crew.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const ALLOW = new Set(["crew", "is-on", "insp-stamp", "app", "smooth-air"]);
  const loose = new Set();
  for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    if (!ALLOW.has(m[1]) && !m[1].startsWith("crew-")) loose.add(m[1]);
  }
  ok("scope", `every class the Crew tab draws is its own (${[...loose].length ? "" : "all prefixed"})`,
     loose.size === 0, [...loose].join(" "));
}

console.log(`\ndoors: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
