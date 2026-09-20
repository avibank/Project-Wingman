// Part 13's pure functions, against the seed content.
//
// The checks that matter here are the ones the brief says were got wrong once
// already: hues must not land NEAR each other for people who share initials,
// tiles must not share the avatar palette, and the unread rule must still be
// two of seven.
//
// Run: npm run check:familiar
import * as F from "../src/lib/familiar.js";

/* ITS OWN FIXTURE, NOT THE SHIPPING CONTENT DOCUMENT.
   ---------------------------------------------------------------------------
   Every assertion below used to read src/content/test-content.json, which
   made this a test OF THAT FILE as much as of familiar.js: emptying it for
   the beta turned five passing checks into "0 of 0 — FAIL" with nothing
   wrong in the code, and the failures pointed at the content rather than at
   the rule that had supposedly broken.

   The rules this file exists to defend are stated here instead. Where a
   number used to be counted out of the seed ("still two of seven"), the
   fixture is built so that the number follows from the rule.

   Twenty-four lesson ids, because the tile check is about what a COLUMN of
   them looks like: the bug it guards against was all of them landing on the
   avatar palette's ten buckets and reading as four or five pictures repeated
   down the list. */
const lessons = Array.from({ length: 24 }, (_, i) => {
  const ch = String(Math.floor(i / 2) + 1).padStart(2, "0");
  const n = (i % 2) + 1;
  return {
    id: `M1.${ch}.${n}`,
    durationS: 600,
    // Every state the route row can draw: finished, part way, untouched.
    watchedS: i < 6 ? 600 : i < 12 ? 240 : 0,
  };
});

const people = [
  { id: "u_ah", callsign: "Ali Hassan" },
  { id: "u_ah2", callsign: "Amal Haddad" },   // same initials as above, on purpose
  { id: "u_two", callsign: "Dana" },
  { id: "u_three", callsign: "Saqer" },
  { id: "u_four", callsign: "Bader" },
];

/* THE UNREAD RULE: a row is unread when somebody ELSE has been in it since
   you last looked. Two here, and they are two because of the rule — T1 is
   yours and was answered by somebody else, T2 is theirs and you answered it
   and they came back. T3 is theirs with nobody else's news for you, T4 is
   yours and nobody has replied, T5 belongs to another module. */
const threads = [
  { id: "T1", moduleId: "M1", lessonId: "M1.01.1", t: 12, body: "What sets the datum here?", authorId: "u_you", createdAt: "2026-08-01T09:00:00Z" },
  { id: "T2", moduleId: "M1", lessonId: "M1.01.2", t: 30, body: "Why is the seal fitted this way round?", authorId: "u_two", createdAt: "2026-08-02T09:00:00Z" },
  { id: "T3", moduleId: "M1", lessonId: "M1.02.1", t: 44, body: "Anyone got the torque figure?", authorId: "u_three", createdAt: "2026-08-03T09:00:00Z" },
  { id: "T4", moduleId: "M1", lessonId: "M1.02.2", t: 8, body: "Still stuck on this one.", authorId: "u_you", createdAt: "2026-08-04T09:00:00Z" },
  { id: "T5", moduleId: "M2", lessonId: "M2.01.1", t: 5, body: "Different module.", authorId: "u_two", createdAt: "2026-08-05T09:00:00Z" },
];
const replies = [
  { id: "r1", threadId: "T1", authorId: "u_two", body: "Off the front face.", createdAt: "2026-08-10T09:00:00Z" },
  { id: "r2", threadId: "T2", authorId: "u_you", body: "Chamfer goes inboard.", createdAt: "2026-08-11T09:00:00Z" },
  { id: "r3", threadId: "T2", authorId: "u_two", body: "That was it, thanks.", createdAt: "2026-08-12T09:00:00Z" },
  { id: "r4", threadId: "T3", authorId: "u_four", body: "It is in the manual.", createdAt: "2026-08-13T09:00:00Z" },
];
const presence = [
  { userId: "u_two", lessonId: "M1.02.2", at: "2026-08-29T11:00:00Z" },
  { userId: "u_three", lessonId: "M1.02.2", at: "2026-08-29T10:00:00Z" },
];
let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? "ok  " : "FAIL"}  ${n}${x ? "  " + x : ""}`); };

// --- relative time, the thresholds people already know ----------------------
const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);
const at = (s) => new Date(NOW - s * 1000).toISOString();
ok("30s -> just now", F.ago(at(30), NOW) === "just now", F.ago(at(30), NOW));
ok("3h -> 3 hours ago", F.ago(at(3 * 3600), NOW) === "3 hours ago", F.ago(at(3 * 3600), NOW));
ok("2d -> 2 days ago", F.ago(at(2 * 86400), NOW) === "2 days ago", F.ago(at(2 * 86400), NOW));
const forty = F.ago(at(40 * 86400), NOW);
ok("40d -> a date, not a count", !/ago|days/.test(forty), forty);

// --- avatars: the rule is not uniqueness --------------------------------------
const rows = people.map(p => ({ id: p.id, cs: p.callsign, ini: F.initials(p.callsign), hue: F.hueFor(p.id) }));
console.log("       " + rows.map(r => `${r.cs}=${r.ini}/${r.hue}`).join("  "));
const dup = rows.filter((a, i) => rows.some((b, j) => j !== i && b.ini === a.ini && b.hue === a.hue));
ok("no two people identical on BOTH initials and hue", dup.length === 0,
   dup.length ? dup.map(r => r.cs).join(", ") : "");
const sharedIni = {};
for (const r of rows) (sharedIni[r.ini] ||= []).push(r);
for (const [ini, group] of Object.entries(sharedIni)) {
  if (group.length < 2) continue;
  const gap = Math.min(...group.flatMap((a, i) => group.slice(i + 1).map(b => {
    const dd = Math.abs(a.hue - b.hue); return Math.min(dd, 360 - dd);
  })));
  ok(`shared initials ${ini} are far apart in hue`, gap >= 30, `${gap}deg — ${group.map(g => g.cs).join(" / ")}`);
}
ok("hue is stable for the same id", F.hueFor("u_two") === F.hueFor("u_two"));

// --- tiles must NOT reuse the avatar palette ---------------------------------
const tileHues = lessons.map(l => Number(F.thumbTile(l.id)["--tile-a"]));
const distinct = new Set(tileHues).size;
ok("24 tiles are spread, not 10 buckets", distinct >= 18, `${distinct} distinct hues of ${lessons.length}`);
ok("tiles are deterministic",
   JSON.stringify(F.thumbTile("M1.01.1")) === JSON.stringify(F.thumbTile("M1.01.1")));
ok("tile hues are not the avatar palette",
   !tileHues.every(h => F.AV_HUES.includes(h)));

// --- the route row's state rule ----------------------------------------------
const done = lessons.filter(l => F.isDone(l)).length;
const started = lessons.filter(l => F.isStarted(l) && !F.isDone(l)).length;
ok("seed shows every state", done > 0 && started > 0 && done + started < lessons.length,
   `${done} done, ${started} in progress, ${lessons.length - done - started} untouched`);
ok("progressPct clamps", F.progressPct(999, 100) === 100 && F.progressPct(0, 0) === 0);

// --- People rows --------------------------------------------------------------
const pr = F.peopleRows(threads, replies, people, "M1", "u_you", {}, NOW);
ok("unread on a fresh account", pr.filter(r => r.unread).length === 2,
   `${pr.filter(r => r.unread).length} of ${pr.length}`);
ok("titles are whole thread bodies, never pre-truncated",
   pr.every(r => r.title && !r.title.endsWith("…")));
const groups = F.groupRows(pr);
console.log("       bands: " + groups.map(g => `${g.title}=${g.rows.length}`).join("  "));
ok("bands are ordered in-it, waiting, the rest",
   groups.every((g, i, a) => i === 0 || a[i - 1].band < g.band));

// --- presence -----------------------------------------------------------------
const p22 = F.presenceFor(presence, "M1.02.2", people, "u_you", NOW);
ok("presence on M1.02.2", Boolean(p22), p22 ? p22.label : "none");
ok("presence absent where nobody has been",
   F.presenceFor(presence, "M4.04.2", people, "u_you", NOW) === null);

// --- optimistic posting -------------------------------------------------------
let list = F.optimisticPost([], { id: "tmp", body: "x" });
ok("optimistic row appears pending", list[0].pending === true);
list = F.failPost(list, "tmp");
ok("a failed post STAYS, marked failed", list.length === 1 && list[0].failed === true);
list = F.settlePost(list, "tmp", { id: "T9", body: "x" });
ok("settle replaces it with the saved row", list[0].id === "T9" && !list[0].pending);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
