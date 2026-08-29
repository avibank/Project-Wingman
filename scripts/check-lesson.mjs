// Part 12's pure functions, against the seed content.
//
// These are the rules the brief says to copy verbatim and not re-derive, so
// the thing worth testing is that they still do what the brief claims — the
// drag maths especially, whose whole purpose is surviving a trip through
// fullscreen, and the typing guard, which is the one thing that ships broken
// if it is missed.
//
// Run: npm run check:lesson
import * as L from "../src/lib/lessonSurface.js";
import { readFileSync } from "fs";
const d = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url)));
const { notes, threads, replies } = d;
let fails = 0;
const ok = (name, cond, detail) => { if (!cond) fails++; console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

// --- the drag maths, the brief's own worked example -------------------------
const player = { width: 900, height: 506 }, bar = { width: 420, height: 96 };
const frac = L.barFraction({ x: 300, y: 300 }, player, bar);
ok("drag fraction from (300,300) in 900x506",
   Math.abs(frac.fx - 0.625) < 0.001 && Math.abs(frac.fy - 0.7317) < 0.001,
   `fx=${frac.fx.toFixed(4)} fy=${frac.fy.toFixed(4)}`);
const fs = { width: 1920, height: 1080 };
const inFs = L.barPosition(frac, fs, bar);
ok("same fraction in fullscreen 1920x1080", inFs.x > 0 && inFs.y > 0,
   `x=${Math.round(inFs.x)} y=${Math.round(inFs.y)}`);
const back = L.barPosition(frac, player, bar);
ok("returns to exactly (300,300) windowed",
   Math.abs(back.x - 300) < 0.5 && Math.abs(back.y - 300) < 0.5,
   `x=${back.x.toFixed(1)} y=${back.y.toFixed(1)}`);
const out = L.barFraction({ x: 5000, y: -400 }, player, bar);
ok("out-of-bounds drag clamps", out.fx === 1 && out.fy === 0, `fx=${out.fx} fy=${out.fy}`);

// --- the typing guard -------------------------------------------------------
const fake = (tag, key) => ({ target: { tagName: tag, isContentEditable: false }, key });
ok("typing 'fine' fires nothing",
   ["f","i","n","e"].every(k => L.keyAction(fake("TEXTAREA", k)) === null));
ok("typing 'jkl mn' fires nothing",
   ["j","k","l"," ","m","n"].every(k => L.keyAction(fake("INPUT", k)) === null));
ok("same keys DO act outside a field",
   L.keyAction(fake("DIV","f"))?.type === "fullscreen" && L.keyAction(fake("DIV","n"))?.type === "note");
ok("guard is the first line of keyAction",
   /^\s*if \(isTypingTarget\(e\.target\)\) return null;/m.test(
     readFileSync(new URL("../src/lib/lessonSurface.js", import.meta.url),"utf8")
       .split("export function keyAction")[1]));

// --- pins, edit, clear ------------------------------------------------------
let s = { ...L.initialSession, notes: [...notes], threads, replies };
s = L.openBar(s, { lessonId: "M1.01.1", seconds: 123.7 });
ok("open pauses and stamps the exact second", s.player.playing === false && s.bar.t === 123, `t=${s.bar.t}`);
s = L.closeBar(s);
const pin = s.notes[s.notes.length - 1];
ok("close with no typing saves a pin", pin.body === "" && L.isPin(pin), `id=${pin.id}`);
const before = pin.id, count = s.notes.length;
s = L.editNote(s, pin.id);
ok("editNote seeks to the moment and pauses", s.player.seconds === pin.t && !s.player.playing);
s = { ...s, bar: { ...s.bar, body: "written on the second watch" } };
s = L.closeBar(s);
const edited = s.notes.find(n => n.id === before);
ok("filled-in pin keeps id, moment, and does not duplicate",
   edited.body === "written on the second watch" && edited.t === pin.t && s.notes.length === count,
   `id=${edited.id} t=${edited.t} n=${s.notes.length}`);
s = L.editNote(s, before);
s = { ...s, bar: { ...s.bar, body: "   " } };
s = L.closeBar(s);
const cleared = s.notes.find(n => n.id === before);
ok("clearing turns it back into a pin, not deleted", cleared && cleared.body === "" && L.isPin(cleared));

// --- badges, still 2 of 7 ---------------------------------------------------
const b = L.badges(threads, replies, "M1", "u_you", {});
ok("badges on a fresh account", b.length === 2, `${b.length} of ${L.orderThreads(threads,replies,"M1").length} — ${b.join(", ")}`);

// --- close means stop, no closedByUser --------------------------------------
let p = L.playerReducer({ ...L.initialSession.player, lessonId: "x", playing: true, seconds: 42 }, { type: "close" });
ok("close stops and keeps the position", p.playing === false && p.dock === "none" && p.seconds === 42);
p = L.playerReducer(p, { type: "slot", visible: false });
ok("a stopped player does not re-dock", p.dock === "none");
ok("no closedByUser anywhere",
   !readFileSync(new URL("../src/lib/lessonSurface.js", import.meta.url),"utf8").includes("closedByUser:"));

// --- upFrom -----------------------------------------------------------------
ok("up from a lesson is the module, labelled",
   L.upFrom({ kind: "lesson", moduleId: "M1", moduleName: "Module 1" })?.label === "Module 1");
ok("no arrow on the Flight Deck", L.upFrom({ kind: "deck" }) === null);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
