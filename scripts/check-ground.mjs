/* Back on the ground — the data rules, asserted.
 *
 * The pack names two rules that belong to the data and not the component:
 * chapter granularity only, and right seats are squadron mates. Both live in
 * src/lib/ground.js, with everything else the deck turns into the section, so
 * this can hold all of it without a browser. The last part reads source, for
 * the wiring and for copy that has to stay true.
 */
import { readFileSync } from "node:fs";
import * as G from "../src/lib/ground.js";

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const read = (f) => readFileSync(f, "utf8");

console.log("ground: what shows\n");
ok("Quiet skies shows nothing", eq(G.surfacesFor([], true), { seat: false, squad: false, module: false }));
ok("My flight shows the right seat", eq(G.surfacesFor(["form", "wing"], true), { seat: true, squad: false, module: false }));
ok("Open frequency shows all three", eq(G.surfacesFor(["form", "wing", "freq"], true), { seat: true, squad: true, module: true }));
ok("without the Ready Room there is nothing", eq(G.surfacesFor(["form", "wing", "freq"], false), { seat: false, squad: false, module: false }));

console.log("\nground: chapter granularity only\n");
const chapters = [
  { id: "M1.01", lessons: [{ id: "l1" }, { id: "l2" }] },
  { id: "M1.02", lessons: [{ id: "l3" }] },
  { id: "M1.03", lessons: [{ id: "l4" }] },
];
const presence = [
  { user_id: "dana", display_name: "Dana", module_code: "M1", chapter_id: "M1.02", lesson_id: "l3", pct: 0.42, score: 88 },
  { user_id: "stranger", display_name: "Stranger", module_code: "M1", chapter_id: "M1.03" },
  { user_id: "me", display_name: "Me", module_code: "M1", chapter_id: "M1.01" },
];
const people = [{ id: "dana", callsign: "Dana" }, { id: "haddad", callsign: "Haddad" }];
const { person, nameOf } = G.makePeople({
  moduleCode: "M1", chapters, people, presence,
  seatCandidates: [{ user_id: "haddad", module_code: "M1", chapter_id: "M1.03" }],
  seat: { partnerId: "haddad" },
  flights: [{ userId: "dana", lastAt: "2026-09-10T10:00:00Z" }],
});
const dana = person("dana");
ok("a person is id, name, category, chapter, seat and when you last flew", eq(Object.keys(dana).sort(),
  ["category", "chapter", "flewAt", "id", "name", "seat"]), Object.keys(dana).join(","));
ok("the chapter is a 1-based number", dana.chapter === 2);
ok("no lesson, percentage or score gets through", !("lesson_id" in dana) && !("pct" in dana) && !("score" in dana));
ok("somebody who is not studying has no chapter", person("away").chapter === null);
ok("the right seat partner is marked, and nobody else", person("haddad").seat === true && dana.seat === false);
ok("names come from profiles first", nameOf("dana") === "Dana" && nameOf("nobody") === "Pilot");

console.log("\nground: right seats are squadron mates\n");
const squadrons = [
  { id: "sq1", moduleCode: "M1", name: "Night Shift", members: ["me", "dana", "haddad"], lastReadAt: "2026-09-10T09:00:00Z" },
  { id: "sq2", moduleCode: "M1", name: "Day Shift", members: ["me", "x"], lastReadAt: null },
  { id: "sq3", moduleCode: "M2", name: "Elsewhere", members: ["me", "y"], lastReadAt: null },
];
const messages = [
  { id: "a", squadronId: "sq2", authorId: "x", body: "old", createdAt: "2026-09-09T10:00:00Z" },
  { id: "b", squadronId: "sq1", authorId: "dana", body: "hello", createdAt: "2026-09-10T10:00:00Z" },
  { id: "c", squadronId: "sq1", authorId: "me", body: null, createdAt: "2026-09-10T10:05:00Z" },
  { id: "d", squadronId: "sq1", authorId: "haddad", body: null, deletedAt: "2026-09-10T10:06:00Z", createdAt: "2026-09-10T10:06:00Z" },
];
const sq = G.squadronFor({ me: "me", moduleCode: "M1", squadrons, messages, person, nameOf });
ok("the squadron on this module that spoke last", sq?.id === "sq1", sq?.id);
ok("members are the roster, without you", eq(sq.members.map((m) => m.id), ["dana", "haddad"]));
ok("nobody from presence alone becomes a member", !sq.members.some((m) => m.id === "stranger"));
ok("a deleted message is not shown", !sq.messages.some((m) => m.id === "d"));
ok("a photo on its own still says something", sq.messages.find((m) => m.id === "c")?.text === "Sent an attachment");
ok("your own message is marked yours", sq.messages.find((m) => m.id === "c")?.mine === true);
ok("unread counts what others said since you last read", sq.unread === 1, String(sq.unread));
ok("no squadron on the module is null", G.squadronFor({ me: "me", moduleCode: "M4", squadrons, messages, person, nameOf }) === null);

console.log("\nground: the route\n");
const on = (surfaces) => G.routePeopleFor({ me: "me", surfaces, squadron: sq, presence, seat: { partnerId: "haddad" }, person })
  .map((p) => p.id).sort();
ok("My flight draws the right seat only", eq(on({ seat: true, squad: false, module: false }), ["haddad"]));
ok("the squadron adds squadron mates", eq(on({ seat: false, squad: true, module: false }), ["dana", "haddad"]));
ok("the module adds everyone on it, once each and never you", eq(on({ seat: true, squad: true, module: true }), ["dana", "haddad", "stranger"]));

console.log("\nground: threads\n");
const threads = [
  { id: "t1", moduleId: "M1", title: "Older", body: "b", authorId: "me", createdAt: "2026-09-09T10:00:00Z", bestReplyId: "r1" },
  { id: "t2", moduleId: "M1", title: null, body: "First line\nmore", authorId: "dana", createdAt: "2026-09-10T10:00:00Z", bestReplyId: null },
  { id: "t3", moduleId: "M2", title: "Other module", body: "b", authorId: "dana", createdAt: "2026-09-10T11:00:00Z" },
];
const replies = [
  { id: "r1", threadId: "t1", authorId: "dana", parentId: null },
  { id: "r2", threadId: "t2", authorId: "me", parentId: null },
  { id: "r3", threadId: "t2", authorId: "dana", parentId: "r2" },
];
const ts = G.threadsFor({ me: "me", moduleCode: "M1", threads, replies, nameOf });
ok("this module's threads, newest first", eq(ts.map((t) => t.id), ["t2", "t1"]));
ok("a reply to an answer is not an answer, and one is singular", ts[0].answers === 1 && /\b1 answer\b/.test(ts[0].meta), ts[0].meta);
ok("yours, answered, and who answered it", ts[1].mine && ts[1].meta.startsWith("Yours · Answered") && ts[1].answeredBy === "Dana", ts[1].meta);
ok("a thread with no title takes its first line", ts[0].title === "First line");
ok("a thread nobody has answered asks for one rather than counting zero", G.threadsFor({ me: "me", moduleCode: "M1", nameOf,
  threads: [{ id: "t9", moduleId: "M1", title: "x", body: "b", authorId: "z", createdAt: "2026-09-01T00:00:00Z" }] })[0].meta.startsWith("Needs an answer"));

console.log("\nground: you are here\n");
ok("the chapter of the first lesson not done", G.moduleFor({ name: "M", chapters, progress: { done: { l1: true, l2: true } } }).youChapter === 2);
ok("everything done sits at the last chapter", G.moduleFor({ name: "M", chapters, progress: { done: { l1: 1, l2: 1, l3: 1, l4: 1 } } }).youChapter === 3);
ok("content without lessons falls back to the next chapter",
  G.moduleFor({ name: "M", chapters: [{ id: "a" }, { id: "b" }], progress: {}, next: { id: "b" } }).youChapter === 2);

console.log("\nground: wiring and copy\n");
const home = read("src/components/Home.jsx");
const seatCard = read("src/components/ground/RightSeatCard.jsx");
const squadCard = read("src/components/ground/SquadronCard.jsx");
const css = read("src/components/ground/ground.css");
const main = read("src/main.jsx");
ok("the deck renders the section from the preset", /<BackOnTheGround\b/.test(home) && /surfacesFor\(preset\.band, roomOn\)/.test(home));
ok("the three old cells are gone", !/className="cell"|formRef|fetchPartnerSuggestions|fetchMessages/.test(home));
ok("the right seat card reads squadron.members and nothing wider", /squadron\.members/.test(seatCard) && !/routePeople|presence/.test(seatCard));
ok("no day that did not happen", !/tuesday/i.test(seatCard) && /flewAt/.test(seatCard));
ok("no count that was not counted", !/Two on this module/.test(squadCard));
const ground = ["RouteStrip", "RightSeatCard", "SquadronCard", "ModuleThreadCard", "BackOnTheGround"]
  .map((n) => read(`src/components/ground/${n}.jsx`)).join("\n");
ok("every empty state names what fills it", !/No squadron yet|No questions here yet|Nobody else on this route yet|seat beside you is empty|quiet today/.test(ground));
ok("small controls keep a 44px target", /is-inline/.test(seatCard) && /width: max\(100%, var\(--tap, 44px\)\)/.test(css));
ok("controls outside the cards still have a scale", /\.bog \{\n  --k: 1;/.test(css));
ok("the harness cannot open on the live site", /if \(import\.meta\.env\.DEV && /.test(main));
const room = read("src/components/room/ReadyRoom.jsx");
ok("each door names its own place in the room",
  ["person", "thread", "discover", "seat", "ask"].every((k) => new RegExp(`onOpenRoomAt\\?\\.\\(\\{ kind: "${k}"`).test(home)));
ok("the room opens a door once and hands it back", /intent = null, onIntentUsed/.test(room) && /onIntentUsed\?\.\(\);/.test(room));

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
