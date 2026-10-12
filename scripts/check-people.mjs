/* =============================================================================
   FINDING PEOPLE, AND THE PEOPLE LIST.
   -----------------------------------------------------------------------------
   0041's rules, driven for real rather than grepped: the PostgREST emulation
   in src/demo/pgcore.js is the same code the harness serves and the demo runs
   in the tab, so importing it and calling the RPC is as close to the function
   as anything can get without a Postgres. The SQL in
   supabase/migrations/0041 is the other copy, and the two are written to say
   the same thing — this file is what notices when they stop.

   WHY THIS ONE IS IN `npm run check`. It needs no browser and no credentials.
   The three suites that would otherwise have caught a search returning nothing
   — test:rr, test:bm, test:exam — all need the harness and are all outside the
   gate, and on 2026-10-10 all three turned out to have been red for days. A
   rule nobody runs is not a rule.

   Run: npm run check:people
   ========================================================================= */
import { readFileSync } from "node:fs";
import { makeStore, RPC } from "../src/demo/pgcore.js";
import { byLetter } from "../src/lib/roomModel.js";

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${group} · ${what}`); return; }
  fails.push(`${group} · ${what}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`);
};
const signs = (rows) => rows.map((r) => r.callsign);
const named = (rows) => rows.filter((r) => r.real_name).map((r) => r.real_name);

/* --------------------------------------------------------------- a class
   ME shares a squadron with MATE and nobody else. STRANGER has done nothing
   with ME at all — before 0041 that made them unfindable by any spelling of
   their own name, which is the bug this migration exists for. */
const days = (n) => new Date(Date.now() - n * 86400000).toISOString();
const store = () => makeStore({
  pilot_profiles: [
    { user_id: "me",       callsign: "ALX", real_name: "Alex Mercer" },
    { user_id: "mate",     callsign: "DNA", real_name: "Dana Okafor" },
    { user_id: "stranger", callsign: "RVN", real_name: "Rowan Vance" },
    { user_id: "kai",      callsign: "KAI", real_name: "Kai Lindqvist" },
    { user_id: "byname",   callsign: "ARC", real_name: "Priya Patel" },
    { user_id: "solo",     callsign: "QNN", real_name: "Quinn Adeyemi", invisible: true },
    { user_id: "blocked",  callsign: "MGN", real_name: "Morgan Reyes" },
    { user_id: "iblock",   callsign: "BRT", real_name: "Bert Ashby" },
    { user_id: "hidden",   callsign: "HID", real_name: "Hide Mee", discoverable: false },
    { user_id: "nohandle", callsign: "",    real_name: "Noah Handle" },
    { user_id: "digit",    callsign: "7UP", real_name: "Seven Upton" },
    { user_id: "stale",    callsign: "OLD", real_name: "Olive Dormant" },
  ],
  user_prefs: [{ user_id: "byname", identity_display: "username" }],
  blocks: [
    { user_id: "me", blocked_id: "blocked" },      // I blocked them
    { user_id: "iblock", blocked_id: "me" },       // they blocked me
  ],
  squadron_members: [
    { squadron_id: "sq1", user_id: "me" },
    { squadron_id: "sq1", user_id: "mate" },
  ],
  chapter_completions: [
    { user_id: "mate", module_code: "M1", chapter_id: "M1.T1", completed_at: days(2) },
    { user_id: "stranger", module_code: "M2", chapter_id: "M2.T1", completed_at: days(3) },
  ],
  presence: [{ user_id: "byname", last_seen: days(1) }],
  quiz_runs: [{ user_id: "stale", quiz_id: "q", total: 40, score: 30, submitted_at: days(40) }],
});
const s = store();
const find = (q, me = "me") => RPC.people_search(s, { p_me: me, p_q: q });
const browse = (me = "me", body = {}) => RPC.people_browse(s, { p_me: me, ...body });

/* ------------------------------------------------- 1 · a name finds anybody */
console.log("\na name finds anybody");
ok("search", "a stranger by their real name — the bug 0041 exists for",
  signs(find("rowan")).includes("RVN"), JSON.stringify(signs(find("rowan"))));
ok("search", "a stranger by their callsign", signs(find("RVN")).includes("RVN"));
ok("search", "case does not matter either way",
  signs(find("ROWAN")).includes("RVN") && signs(find("rvn")).includes("RVN"));
ok("search", "a partial matches, the way a suggestion list does",
  signs(find("row")).includes("RVN") && signs(find("vanc")).includes("RVN"));
ok("search", "somebody you share a squadron with is still found",
  signs(find("dana")).includes("DNA"));
ok("search", "a blank term finds nothing rather than everything",
  find("").length === 0 && find("   ").length === 0);

/* ------------------------------------------------------ 2 · what it refuses */
console.log("\nwhat it still refuses");
ok("refuse", "you never find yourself", find("alex").length === 0, JSON.stringify(signs(find("alex"))));
ok("refuse", "Fly solo, by name", find("quinn").length === 0);
ok("refuse", "Fly solo, by callsign — the half a name-only rule would miss", find("QNN").length === 0);
ok("refuse", "somebody you blocked", find("morgan").length === 0);
ok("refuse", "somebody who blocked you — blocking is symmetric",
  find("bert").length === 0 && find("BRT").length === 0);
ok("refuse", "an account that opted out of being put forward", find("hide").length === 0);
ok("refuse", "a profile with no callsign — the list has nothing to draw",
  find("noah").length === 0 && !signs(browse()).includes(""));
ok("refuse", "a real name its owner chose not to show is not matchable",
  find("patel").length === 0, JSON.stringify(signs(find("patel"))));
ok("refuse", "...but they are NOT hidden — their callsign finds them",
  signs(find("ARC")).includes("ARC"));
/* `pilot_profiles.discoverable` is `not null default true`, so a row that
   never mentions it IS discoverable. A truthiness test here would make every
   seeded profile unfindable and read exactly like the bug being fixed. */
ok("refuse", "an UNSET discoverable is true, as the column's default says",
  signs(find("rowan")).includes("RVN")
  && s.pilot_profiles.find((p) => p.user_id === "stranger").discoverable === undefined);

/* ------------------------------------ 3 · a list shows callsigns, not names */
console.log("\na list shows callsigns; a name is something you asked for");
ok("name", "every row carries a callsign", find("a").every((r) => !!r.callsign));
ok("name", "searching a CALLSIGN hands back no name at all",
  find("RVN").every((r) => r.real_name === null), JSON.stringify(named(find("RVN"))));
ok("name", "searching the NAME hands back that name",
  find("vance")[0]?.real_name === "Rowan Vance");
ok("name", "a later word of the name counts as asking for it",
  find("lindqv")[0]?.real_name === "Kai Lindqvist");
/* DISCLOSURE IS STRICTER THAN MATCHING, and this is the pair that proves it:
   two letters of a CALLSIGN happen to start somebody's name, and a plain
   substring reveal handed "Kai Lindqvist" back for "KA". */
ok("name", "two letters find somebody and tell you nothing about them",
  signs(find("KA")).includes("KAI") && named(find("KA")).length === 0,
  JSON.stringify(named(find("KA"))));
ok("name", "one letter cannot harvest names off the whole class",
  find("a").length > 2 && named(find("a")).length === 0,
  `${find("a").length} rows, ${named(find("a")).length} names`);
ok("name", "a fragment from the MIDDLE of a word is not asking for the name",
  named(find("owan")).length === 0, JSON.stringify(named(find("owan"))));
ok("name", "three letters that start a word is",
  find("row")[0]?.real_name === "Rowan Vance");
ok("name", "a hidden name never travels, however it was asked for",
  find("ARC").every((r) => r.real_name === null) && !JSON.stringify(find("pri")).includes("Priya"));
ok("name", "the browse list has no column for a name",
  browse().every((r) => !("real_name" in r)), JSON.stringify(Object.keys(browse()[0] || {})));

/* ------------------------------------------------------------ 4 · the order */
console.log("\nwhat you typed comes first, and the list is A-Z");
ok("order", "an exact callsign leads", find("ARC")[0]?.callsign === "ARC");
ok("order", "a squadron-mate breaks a tie ahead of a stranger",
  signs(find("a")).indexOf("DNA") < signs(find("a")).indexOf("RVN"), JSON.stringify(signs(find("a"))));
ok("order", "browse is alphabetical by callsign",
  JSON.stringify(signs(browse())) === JSON.stringify([...signs(browse())].sort()),
  JSON.stringify(signs(browse())));
{
  /* SCOPED TO THE PEOPLE BLOCK, not to the file. Written as "`everyone` or
     `foundPeople` within 200 characters of a `.sort(`" this matched the
     SQUADRON list's own sort further down — a legitimate, unrelated one — and
     failed on correct code. An assertion that fires on something it is not
     about is worse than none: it gets relaxed, and then it is about nothing. */
  const rail = readFileSync(new URL("../src/components/room/rr/Rail.jsx", import.meta.url), "utf8");
  const from = rail.indexOf("const peopleRows");
  const block = rail.slice(from, rail.indexOf("})();", from));
  ok("order", "the client is handed an order, so it never re-sorts people",
    from > 0 && !block.includes(".sort("), block.match(/.*\.sort\(.*/)?.[0] || "");
}

/* -------------------------------------------------------- 5 · the whole list */
console.log("\nthe people list");
ok("browse", "everybody findable is in it, not just your orbit",
  signs(browse()).includes("RVN") && signs(browse()).includes("DNA") && signs(browse()).includes("KAI"));
ok("browse", "Fly solo, blocks and the opt-out are refused here too",
  !signs(browse()).some((c) => ["QNN", "MGN", "BRT", "HID"].includes(c)));
ok("browse", "and never yourself", !signs(browse()).includes("ALX"));
ok("browse", "a dormant account is still a current person", signs(browse()).includes("OLD"));
ok("browse", "a window is available for a class big enough to want one",
  !RPC.people_browse(s, { p_me: "me", p_since: "14 days" }).map((r) => r.callsign).includes("OLD"));
ok("browse", "the limit is the server's", browse("me", { p_limit: 2 }).length === 2);

/* ----------------------------------------------------- 6 · grouped by letter */
console.log("\ngrouped by letter, and by callsign");
{
  const g = byLetter(browse());
  ok("letter", "the letter is the CALLSIGN's, never the name's",
    g.find((x) => x.letter === "R")?.rows[0]?.callsign === "RVN");
  ok("letter", "letters come in order", JSON.stringify(g.map((x) => x.letter))
    === JSON.stringify([...g.map((x) => x.letter)].sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b))));
  ok("letter", "a callsign starting with a digit lands under #",
    !!g.find((x) => x.letter === "#")?.rows.some((r) => r.callsign === "7UP"),
    JSON.stringify(g.map((x) => x.letter)));
  ok("letter", "# sorts last, after the letters", g.at(-1)?.letter === "#");
  ok("letter", "a group carries rows and no tally",
    g.every((x) => Object.keys(x).join() === "letter,rows"));
}

/* ------------------------------------------- 7 · AND NOTHING IS EVER COUNTED
   The owner's first requirement for this screen, and it still holds: a
   directory that shows people are around "in a way that doesn't expose if we
   have small users". The guard is that there is no number to print — not that
   today's screen happens not to print one. */
console.log("\nnothing here is counted");
ok("count", "the rows carry no total, no headcount, no `of`",
  browse().every((r) => !("count" in r) && !("total" in r) && !("members" in r)));
ok("count", "there is no count RPC beside it for a screen to reach for",
  !Object.keys(RPC).some((k) => /(people|students).*count|count.*(people|students)/i.test(k)));
{
  const rail = readFileSync(new URL("../src/components/room/rr/Rail.jsx", import.meta.url), "utf8");
  const block = rail.slice(rail.indexOf("PEOPLE IS ITS OWN VIEW"), rail.indexOf("</aside>"))
    /* `.length` as a TEST of whether to draw at all is not a rendered value;
       taken out before looking, or the view could never be written. */
    .replace(/\w+(\.\w+)*\.length \? /g, "")
    .replace(/\w+(\.\w+)*\.length > 0/g, "");
  const counted = block.match(/\{[^{}]*\.(length|size|count)[^{}]*\}/g) || [];
  ok("count", "the rail's people view renders no number at all",
    block.length > 200 && counted.length === 0, counted.join(" "));
}

console.log(`\npeople: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
