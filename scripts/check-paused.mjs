/* The pause holds. Run: npm run check:paused
 *
 * The papers reader is paused, not cancelled (docs/launch/PAUSE-READER.md).
 * Every line of its code and every row of its data is still here; one
 * build-time boolean decides whether any of it is reachable. That is a shape a
 * tidy-up breaks silently, in three different ways:
 *
 *   · A SECOND READ OF THE ENV VAR. Two places asking the same question is two
 *     answers the day one of them is edited. The switch is `papersOn` in
 *     src/lib/flags.js and nothing else reads VITE_PAPERS_READER.
 *   · A PAPER LIST THAT SAYS "NONE" INSTEAD OF "NOT KNOWN". `content.paper()`
 *     answers undefined until a module's papers are listed and null once a list
 *     came back without one — and null PRUNES, which DELETES the row from the
 *     server. Handing the adapter an empty list while papers are paused would
 *     be that second answer about every page anybody ever bookmarked. This is
 *     the assertion that is worth the whole file.
 *   · A GUARD THAT MOVED. The route 404s in App's own notFound list, above the
 *     title and before anything is fetched; the chunk folds away; the Pages
 *     folder is not one of KINDS.
 *
 * The last section runs only when dist/ exists, like check:paper's: with the
 * switch off, Rollup folds the ternary in the CHUNK map and the reader, pdf.js
 * and its worker are not built at all. That is the §7 the brief asked for, and
 * it is measured rather than asserted in prose.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/* CODE ONLY, for the assertions that count where a thing is MENTIONED. Files
   that explain the pause name the switch in their headers, and a check that
   reads the prose fails on the explanation of the rule it is checking. */
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* Every .js/.jsx under src, so "nowhere else" means nowhere else. */
const SRC = [];
(function walk(dir) {
  for (const name of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${name.name}`;
    if (name.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(name.name)) SRC.push(p);
  }
})("src");

/* ---- 1 · one switch, read in one place ---------------------------------- */
console.log("\none switch");
{
  const named = SRC.filter((f) => code(read(f)).includes("VITE_PAPERS_READER"));
  ok("switch", "VITE_PAPERS_READER is read in exactly one module",
     named.length === 1 && named[0] === "src/lib/flags.js", named.join(" "));

  const flags = read("src/lib/flags.js");
  ok("switch", "and it is a plain exported boolean, defaulting to off",
     /export const papersOn = import\.meta\.env\.VITE_PAPERS_READER === "true";/.test(flags));
  ok("switch", "the two reader flags cannot outlive it",
     /READER_FLAGS = new Set\(\["library\.reader", "reader\.v2"\]\)/.test(flags)
     && /if \(!papersOn && READER_FLAGS\.has\(id\)\) return false;/.test(flags)
     && /!\(!papersOn && READER_FLAGS\.has\(f\.id\)\)/.test(flags));
  ok("switch", "and it is discoverable in .env.example",
     read(".env.example").includes("VITE_PAPERS_READER"));

  /* Nobody says papersOn without importing it — which is the same rule from
     the other side: there is no second local definition of the word. */
  const users = SRC.filter((f) => f !== "src/lib/flags.js" && /\bpapersOn\b/.test(read(f)));
  const unimported = users.filter((f) => !/import \{[^}]*\bpapersOn\b[^}]*\} from "[^"]*flags\.js"|import \{[^}]*\bpapersOn\b[^}]*\} from '[^']*flags\.js'/.test(read(f)));
  ok("switch", `every file that reads it imports it (${users.length})`, unimported.length === 0, unimported.join(" "));
}

/* ---- 2 · the rows are never touched ------------------------------------- */
console.log("\nnothing is deleted");
{
  const app = read("src/App.jsx");
  /* THE ASSERTION IS UNCHANGED IN SUBSTANCE and its guard has grown a second
     answer. "Not known" and "none" are different: `content.paper()` answers
     `null` once a module's papers have been LISTED without one, and `null`
     PRUNES, which DELETES the row from the server. Providing an empty list
     while nothing can open a paper would be that second answer about every
     page anybody ever saved. With the viewer on the list is real, so it may
     be provided — the guard now reads "neither can open one" rather than
     "the reader is paused". */
  ok("data", "the papers adapter is told NOTHING while nothing can open one, never an empty list",
     /if \(!papersOn && !viewerOn\) return;\s*\n\s*if \(!papersLoading\) providePapers\(/.test(app),
     "providePapers must sit behind the guard, not receive []");

  /* PAGES IS A FOLDER AGAIN, because a page saved in the viewer has somewhere
     to go. What has NOT changed is the rule underneath it: a `page` row is
     never resolved while there is nowhere for it to lead, because resolving it
     can answer `null`, and `null` PRUNES — which DELETES the row from the
     server. That is the assertion worth keeping, now written against the
     viewer's switch rather than the paused reader's. */
  const saves = read("src/features/bookmarks/useSaves.js");
  ok("data", "the folder follows the VIEWER, not the paused reader",
     /const pagesOn = papersOn \|\| flagDefault\('paper\.viewer', false\);/.test(saves)
     && /export const KINDS = ALL_KINDS\.filter\(\(k\) => pagesOn \|\| k !== 'page'\)/.test(saves));
  ok("data", "and with nowhere for a page to go it is skipped before it is resolved, so it cannot prune",
     /if \(!pagesOn && row\.kind === 'page'\) continue;/.test(saves)
     && saves.indexOf("row.kind === 'page') continue") < saves.indexOf("const it = resolve(row)"));

  const place = read("src/lib/lastPlace.js");
  ok("data", "a paper place is hidden on read and kept on write",
     /export const placeList = \(stored\) =>\s*\n\s*storedPlaces\(stored\)\.filter\(\(p\) => papersOn \|\| p\?\.kind !== "paper"\)/.test(place)
     && /export const pushPlace = \(stored, place\) =>\s*\n\s*\[place, \.\.\.storedPlaces\(stored\)/.test(place));

  const att = read("src/lib/attachments.js");
  ok("data", "a passage attachment stops being drawn, and its row stays",
     /export const visibleAttachments = \(rows\) =>\s*\n\s*\(rows \|\| \[\]\)\.filter\(\(a\) => papersOn \|\| a\.kind !== "passage"\)/.test(att)
     && read("src/lib/roomData.js").includes("visibleAttachments(r.attachments)"));

  /* THE BRIEF'S HARDEST RULE, AND THE ONE A LATER TIDY-UP WOULD BREAK: not a
     migration, not even a harmless one. Written as what it forbids rather than
     as a file count, so it keeps meaning something after the next unrelated
     migration lands. */
  const migDir = join(ROOT, "supabase/migrations");
  const OWNED = /\b(papers|paper_annotations|paper_ink|paper_versions|saves)\b/i;
  const DESTRUCTIVE = /\b(drop\s+table|drop\s+column|truncate|delete\s+from)\b/i;
  /* Function BODIES are stripped first. `delete from paper_annotations where
     id = p_id and author_id = uid` inside delete_annotation() is the reader
     doing its job — a student unmarking their own line. What this rule is
     about is a migration that razes the table from the top level. */
  const razed = (existsSync(migDir) ? readdirSync(migDir) : []).filter((f) => {
    if (!f.endsWith(".sql")) return false;
    const sql = readFileSync(join(migDir, f), "utf8").replace(/\$\$[\s\S]*?\$\$/g, " BODY ");
    return sql.split(/;\s*\n/).some((stmt) => DESTRUCTIVE.test(stmt) && OWNED.test(stmt));
  });
  ok("data", "no migration drops, truncates or empties anything the reader owns",
     razed.length === 0, razed.join(" "));
}

/* ---- 3 · every way in is gone ------------------------------------------- */
console.log("\nno way in");
{
  const app = read("src/App.jsx");
  ok("doors", "a paper's address 404s only when NEITHER can open it",
     /\|\| \(route\.name === "paper" && !papersOn && !flags\["paper\.viewer"\]\);/.test(app));
  ok("doors", "the reader's chunk is behind the switch, so it folds away",
     /paper: papersOn \? chunk\(\(\) => import\("\.\/components\/paper\/v6\/ReaderV6\.jsx"\)\) : null/.test(app)
     && /addPaper: papersOn \? chunk/.test(app));
  ok("doors", "and nothing warms it",
     /if \(!papersOn\) return;\s+\/\/ the READER is paused; nothing of it to warm/.test(app));
  /* THE SHELF STAYS; NOTHING ON IT DOES.
     This used to assert that the Papers section was not rendered at all. The
     owner reversed that half: the Library has two shelves and the second one
     staying visible is what stops the pause reading as a missing feature.
     What must not come back is anything that can open, upload or mark a file,
     so that is what is tested now — the real section still behind the switch,
     the paused one made of markup and nothing else. */
  const lib = read("src/components/module/LibraryTab.jsx");
  /* `PapersSlot` ITSELF, NOT THE FILE IT LIVES IN. This read the whole of
     ModuleWaiting.jsx, which also holds the Lessons states — and one of those
     now has a button to the Library, because with no video the Lessons tab is
     a permanent waiting state and a student who lands on it must not have to
     find their own way out. That `onClick` is nothing to do with papers. The
     rule is about the papers slot: it may not open, add or mark a file. */
  const waiting = read("src/components/module/ModuleWaiting.jsx");
  const slot = (waiting.split("export function PapersSlot")[1] || "").split("\nexport ")[0];
  /* THE SHELF FOLLOWS THE VIEWER NOW. Three states, not two, and the middle
     one is the point: reader paused + viewer on is what ships. */
  ok("doors", "the Library's real Papers section is drawn when something can open one",
     /const shelfOn = papersOn \|\| flagDefault\("paper\.viewer", false\);/.test(lib)
     && /\{shelfOn && \(\n\s*<section aria-labelledby="lsec-papers"/.test(lib));
  ok("doors", "and the slot is what shows when NEITHER can",
     /\{!shelfOn && <PapersSlot \/>\}/.test(lib));
  ok("doors", "the slot still cannot open, add or mark a paper",
     !/onClick|onOpenPaper|onAddPaper|href=|paperIngest|uploadPaper|ReaderV6/.test(slot));
  ok("doors", "the search field offers what the shelf is showing",
     /placeholderFor\(tab, shelfOn\)/.test(read("src/components/module/ModuleScreen.jsx")));
  ok("doors", "the room's composer has no Paper passage option",
     /onAttachPassage=\{papersOn \? attachPassage : null\}/.test(read("src/components/room/ReadyRoom.jsx"))
     && /\{onAttachPassage && \(/.test(read("src/components/room/rr/Chat.jsx")));

  /* NOTHING SAYS "PAUSED". Things are simply absent — no banner, no "coming
     soon", no disabled control with a tooltip. ("paused" on its own is a
     player's vocabulary and is left alone; these are the phrases that only
     ever mean an apology.) */
  const APOLOGY = /coming soon|temporarily unavailable|under maintenance|currently unavailable|is paused|are paused|on hold for now/i;
  const said = SRC.filter((f) => APOLOGY.test(read(f).replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, " ")));
  ok("doors", "no screen apologises for the absence", said.length === 0, said.join(" "));
}

/* ---- 4 · the viewer is a different thing, and must stay one -------------- */
console.log("\nthe viewer is not the reader");
{
  const viewer = read("src/components/paper/viewer/PaperViewer.jsx");
  const island = read("src/components/paper/island/Island.jsx");
  const islandCss = read("src/components/paper/island/island.css");
  /* CODE ONLY. Both files' headers say what the viewer is NOT — "no marking,
     no highlighting", "no tool bar, no rail" — so a check that reads the prose
     fails on the sentence explaining the rule it is checking. Fourth time
     today; every check that counts a mention strips comments first. */
  const both = code(viewer) + code(island);

  /* THE RULE THIS SECTION EXISTS FOR. `paper/v6/` IS the editor — tools,
     marks, ink, the outbox. Reaching into it for "just the island" or "just
     the page renderer" puts the paused code back in the build, which is the
     one thing the pause was for. */
  /* ANY PATH INTO v6/, not just one spelled "paper/v6". The first version of
     this line required that literal, and an import from `paper/viewer/` is
     `../v6/part2.js` — no "paper/" in it at all. Planted and missed, which is
     how a check that guards the most important rule in the brief turned out
     to guard a spelling. */
  const intoV6 = /from\s+["'][^"']*\bv6\//;
  const intoReaderLibs = /from\s+["'][^"']*\b(paperText|paperMarks|paperInk|paperTray|paperView|paperIngest|annotations|anchor)\.js["']/;
  ok("viewer", "it imports nothing from the paused reader",
     !intoV6.test(both) && !intoReaderLibs.test(both)
     && !/import\(["'][^"']*\bv6\//.test(both));
  ok("viewer", "and the island was lifted rather than imported",
     /\.pvw \.isl\{/.test(islandCss) && !/\.rdr /.test(islandCss));

  /* IT CANNOT MARK. Not "does not today" — there is nothing in it that could.
     The owner's instruction was "not a editor but a reader and saver". */
  ok("viewer", "there is no way to mark, highlight, ink or annotate",
     !/highlight|annotat|paper_ink|paper_annotations|mark_add|selection|getSelection/i.test(both));
  ok("viewer", "and it writes nothing but a page bookmark",
     !/supabase|\.rpc\(|\.from\(/.test(both));

  /* THE CHROME IS THE ISLAND — no second bar, no rail, no scrubber. */
  ok("viewer", "the chrome is the island and nothing else",
     !/className="rail"|className="chest"|toolbar|scrubber/i.test(both)
     && /<Island/.test(viewer));

  /* THE FACE, AS THE OWNER DREW IT: bookmark far left, counter centred, you
     far right. The bookmark used to sit beside the profile. */
  const face = (island.split('className="base"')[1] || "").split("</div>")[0];
  ok("viewer", "the bookmark is far left, the counter centred, you far right",
     face.indexOf("bmkface") < face.indexOf("<Counter")
     && face.indexOf("<Counter") < face.indexOf('className="you"'));
  ok("viewer", "the counter is padded to the paper's own length",
     /String\(Math\.max\(1, total \| 0\)\)\.length/.test(island));
  ok("viewer", "and pressing the bookmark gives out the message",
     /flash\(nowSaved \? `Page \$\{page\} saved`/.test(island));
  ok("viewer", "which takes the whole pill over, rather than expanding around the counter",
     /data-msg=\{msg \? "1" : "0"\}/.test(island)
     && /\.pvw \.isl\[data-msg="1"\] \.base\{opacity:0/.test(islandCss));

  /* The two that had to go somewhere and were not named in the instruction. */
  ok("viewer", "download is in the page tray", /Download<\/button>/.test(island)
     && island.indexOf("This paper") < island.indexOf("Download</button>"));
  ok("viewer", "and the way out is the first row of the You panel",
     /Back to the Library/.test(island)
     && island.indexOf("Back to the Library") < island.indexOf("Warmth"));

  /* The page never narrows for chrome — a locked decision. */
  /* The island is positioned OVER the stage, and the stage's own width is
     never touched by it — which is what "the page never narrows for chrome"
     means in CSS. */
  ok("viewer", "panels float; the page never narrows for them",
     /\.pvw \.isl\{position:absolute/.test(islandCss)
     && !/\.pvw \.isl\[data-open\][^}]*~[^}]*stage/.test(islandCss));

  /* Virtualised, or a three-hundred-page manual allocates three hundred
     canvases and takes a phone's whole memory doing it. */
  ok("viewer", "only the pages near the viewport are drawn",
     /const NEAR = /.test(viewer) && /near\.has\(n\) && <PageCanvas/.test(viewer));
  ok("viewer", "and every page has its box from the first frame, so the bar never jumps",
     /aspectRatio: `\$\{w\} \/ \$\{h\}`/.test(viewer));

  /* `?page=N`, so the Pages folder lands where it says it will. */
  ok("viewer", "it honours ?page=N on arrival", /startPage/.test(viewer)
     && /scrollIntoView\(\{ block: "start"/.test(viewer));
}

/* ---- 5 · and it is not in the build ------------------------------------- */
const dist = join(ROOT, "dist/assets");
if (existsSync(dist)) {
  console.log("\nnot shipped");
  const built = readdirSync(dist);
  /* The build under test is whichever one `npm run build` last made. With the
     switch on, the reader SHOULD be there and asserting its absence would be
     asserting the reader is broken. */
  if (process.env.VITE_PAPERS_READER !== "true") {
    /* THE READER'S CHUNK IS STILL NOT BUILT, and that is the assertion that
       matters: `papersOn` is a build-time constant, so Rollup folds the
       ternary in the CHUNK map and the whole subtree goes. */
    ok("build", "no reader chunk", !built.some((f) => /^ReaderV6-/.test(f)),
       built.filter((f) => /^ReaderV6/.test(f)).join(" "));
    ok("build", "and none of the reader's own libraries",
       !built.some((f) => /^paperText-/.test(f)), built.filter((f) => /^paperText/.test(f)).join(" "));

    /* PDF.JS DOES SHIP NOW, and asserting its absence would be asserting the
       viewer is broken — it is what draws a page. What must stay true is that
       nobody who never opens a paper pays for it: it is its own chunk, the
       viewer is its own chunk, and the ENTRY names neither. */
    const viewer = built.find((f) => /^PaperViewer-.*\.js$/.test(f));
    ok("build", "the viewer is its own chunk", !!viewer, String(viewer));
    ok("build", "and pdf.js is its own, not the viewer's",
       built.some((f) => /^pdf-.*\.js$/.test(f)));
    const entry = built.find((f) => /^index-.*\.js$/.test(f));
    const entrySrc = entry ? read(`dist/assets/${entry}`) : "";
    ok("build", "the entry chunk names no part of the paused reader",
       !!entry && !/ReaderV6|paperText/.test(entrySrc));
    ok("build", "and pdf.js is not in the entry either",
       !!entry && !/GlobalWorkerOptions/.test(entrySrc));

    /* The worker is only there because something asks for it. A worker with no
       importer is 1.3MB of unreachable pdf.js on the deploy — vite.config.js
       removes that one, and this is what would notice if it stopped. */
    const workers = built.filter((f) => /^pdf\.worker/.test(f));
    const asked = (w) => built.some((f) => f !== w && !f.endsWith(".map")
      && read(`dist/assets/${f}`).includes(w));
    ok("build", "every pdf.js worker in the build is asked for by something",
       workers.every(asked), workers.filter((w) => !asked(w)).join(" "));
  } else {
    console.log("  --   VITE_PAPERS_READER=true, so the reader SHOULD be built; skipped");
  }
}

console.log(`\npaused: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
