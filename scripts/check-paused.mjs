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
  const named = SRC.filter((f) => read(f).includes("VITE_PAPERS_READER"));
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
  ok("data", "paused means the papers adapter is told NOTHING, never an empty list",
     /if \(!papersOn\) return;\s*\n\s*if \(!papersLoading\) providePapers\(/.test(app),
     "providePapers must sit behind the guard, not receive []");

  const saves = read("src/features/bookmarks/useSaves.js");
  ok("data", "a page save is skipped before it is resolved, so it cannot prune",
     /if \(!papersOn && row\.kind === 'page'\) continue;/.test(saves)
     && saves.indexOf("row.kind === 'page') continue") < saves.indexOf("const it = resolve(row)"));
  ok("data", "Pages is not one of the folders while papers are paused",
     /export const KINDS = ALL_KINDS\.filter\(\(k\) => papersOn \|\| k !== 'page'\)/.test(saves));

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
  ok("doors", "a paper's address is the app's ordinary not-found",
     /\|\| \(route\.name === "paper" && !papersOn\);/.test(app));
  ok("doors", "the reader's chunk is behind the switch, so it folds away",
     /paper: papersOn \? chunk\(\(\) => import\("\.\/components\/paper\/v6\/ReaderV6\.jsx"\)\) : null/.test(app)
     && /addPaper: papersOn \? chunk/.test(app));
  ok("doors", "and nothing warms it",
     /if \(!papersOn\) return;\s+\/\/ paused: nothing to warm/.test(app));
  /* THE SHELF STAYS; NOTHING ON IT DOES.
     This used to assert that the Papers section was not rendered at all. The
     owner reversed that half: the Library has two shelves and the second one
     staying visible is what stops the pause reading as a missing feature.
     What must not come back is anything that can open, upload or mark a file,
     so that is what is tested now — the real section still behind the switch,
     the paused one made of markup and nothing else. */
  const lib = read("src/components/module/LibraryTab.jsx");
  const slot = read("src/components/module/ModuleWaiting.jsx");
  ok("doors", "the Library's real Papers section is still behind the switch",
     /\{papersOn && \(\n\s*<section aria-labelledby="lsec-papers"/.test(lib));
  ok("doors", "and what shows in its place is a slot, drawn only while paused",
     /\{!papersOn && <PapersSlot \/>\}/.test(lib));
  ok("doors", "the slot cannot open, add or mark a paper",
     !/onClick|onOpenPaper|onAddPaper|href=|paperIngest|uploadPaper|ReaderV6/.test(slot));
  ok("doors", "the search field does not offer to find one",
     /placeholderFor\(tab, papersOn\)/.test(read("src/components/module/ModuleScreen.jsx")));
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

/* ---- 4 · and it is not in the build ------------------------------------- */
const dist = join(ROOT, "dist/assets");
if (existsSync(dist)) {
  console.log("\nnot shipped");
  const built = readdirSync(dist);
  /* The build under test is whichever one `npm run build` last made. With the
     switch on, the reader SHOULD be there and asserting its absence would be
     asserting the reader is broken. */
  if (process.env.VITE_PAPERS_READER !== "true") {
    ok("build", "no reader chunk", !built.some((f) => /^ReaderV6-/.test(f)), built.filter((f) => /^ReaderV6/.test(f)).join(" "));
    ok("build", "no pdf.js", !built.some((f) => /^paperText-/.test(f)), built.filter((f) => /^paperText/.test(f)).join(" "));
    ok("build", "no pdf.js worker left behind", !built.some((f) => /^pdf\.worker/.test(f)), built.filter((f) => /^pdf\.worker/.test(f)).join(" "));
    const entry = built.find((f) => /^index-.*\.js$/.test(f));
    ok("build", "and the entry chunk does not name any of it",
       !!entry && !/ReaderV6|paperText|pdf\.worker/.test(read(`dist/assets/${entry}`)));
  } else {
    console.log("  --   VITE_PAPERS_READER=true, so the reader SHOULD be built; skipped");
  }
}

console.log(`\npaused: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
