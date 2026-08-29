// Part 13's pure functions, against the seed content.
//
// The checks that matter here are the ones the brief says were got wrong once
// already: hues must not land NEAR each other for people who share initials,
// tiles must not share the avatar palette, and the unread rule must still be
// two of seven.
//
// Run: npm run check:familiar
import * as F from "../src/lib/familiar.js";
import { readFileSync } from "fs";
const d = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url)));
const { people, threads, replies, presence, modules } = d;
const lessons = modules.flatMap(m => m.chapters.flatMap(c => c.lessons));
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
