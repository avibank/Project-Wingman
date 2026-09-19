/* The gyro reads your bar — asserted.
 *
 * The first two halves are arithmetic, and the numbers are the brief's: the
 * rim's geometry, three states with a point of tolerance, the caption and the
 * accessible name word for word, and the tilt that replaced reading gamma
 * straight off the sensor. The last half reads source, for what is wiring
 * rather than arithmetic: the Library's dial is gone and the results dial is
 * not, the bar is set in one place, and paper inks the notch and the surplus.
 */
import { readFileSync } from "node:fs";
import * as A from "../src/lib/attitude.js";
import * as T from "../src/lib/tilt.js";
import * as M from "../src/lib/minimums.js";

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const read = (f) => readFileSync(f, "utf8");

console.log("gyro: the rim reads your bar\n");

ok("the rim is radius 49 at width 3", A.RIM_R === 49 && A.RIM_W === 3);
ok("its circumference is 307.876", near(A.RIM_C, 307.876), A.RIM_C.toFixed(3));
ok("a point is 3.6 degrees", A.DEG_PER_POINT === 3.6 && near(A.notchAngle(67), 241.2));
ok("the notch runs 45.6 to 54.4 at 1.7", A.NOTCH_IN === 45.6 && A.NOTCH_OUT === 54.4 && A.NOTCH_W === 1.7);
ok("the last-quiz dot is r 2.6", A.LAST_R === 2.6);

ok("R1  0 leaves the rim empty", A.rimLength(0) === 0);
ok("R1  50 draws half of it", near(A.rimLength(50), 153.938));
ok("R1  100 closes it", near(A.rimLength(100), 307.876));
ok("R2  the notch sits at the bar", near(A.notchAngle(40), 144) && near(A.notchAngle(95), 342));

const bar = 67;
ok("R3  66, 67 and 68 are on a bar of 67", [66, 67, 68].every((a) => A.gyroState(a, bar) === "on"));
ok("R3  65 is under and 69 over", A.gyroState(65, bar) === "under" && A.gyroState(69, bar) === "over");
ok("R3  50 is under", A.gyroState(50, bar) === "under");
ok("R3  81 is over", A.gyroState(81, bar) === "over");
const s = A.surplusArc(81, bar);
ok("R3  over draws a surplus from the notch to the average",
   s !== null && near(-s.offset, 0.67 * A.RIM_C) && near(s.length, 0.14 * A.RIM_C));
ok("R3  on and under draw none", A.surplusArc(68, bar) === null && A.surplusArc(50, bar) === null);
ok("R4  nothing flown is nodata", A.gyroState(null, bar) === "nodata" && A.gyroState(undefined, bar) === "nodata");
ok("R4  and a zero is a score, not nothing", A.gyroState(0, bar) === "under");

ok("R5  under", A.gyroCaption(50, 67) === "50% · 17 under your bar", A.gyroCaption(50, 67));
ok("R5  on", A.gyroCaption(67, 67) === "67% on your bar", A.gyroCaption(67, 67));
ok("R5  over", A.gyroCaption(81, 67) === "81% · 14 over your bar", A.gyroCaption(81, 67));
ok("R5  before the first quiz", A.gyroCaption(null, 67) === "First quiz fills the ring");
ok("R18 the accessible name",
   A.gyroLabel(50, 3, 67) === "Attitude indicator, 50 per cent average across 3 quizzes, 17 under your bar of 67",
   A.gyroLabel(50, 3, 67));
ok("R18 on the bar, one quiz",
   A.gyroLabel(67, 1, 67) === "Attitude indicator, 67 per cent average across 1 quiz, on your bar of 67");
ok("R18 with nothing flown", A.gyroLabel(null, 0, 67) === "Attitude indicator, no quiz flown yet");

/* §6 of the launch handoff moved the floor to the pass mark: 75 to 100, not
   40 to 95. The key and the default are unchanged, and the default now sits
   ON the floor — see minimums.js for what that trades away. */
ok("R11 the bar is pw-minimums, the pass mark to 100, default the pass mark",
   M.MINIMUMS_KEY === "pw-minimums" && M.clampMinimums(20) === 75 && M.clampMinimums(120) === 100
   && M.DEFAULT_MINIMUMS === 75);

console.log("\ngyro: the ball\n");
const tilt = (beta, gamma, angle = 0, held = 0) => T.readTilt(beta, gamma, angle, held);

ok("R13 upright in portrait is level", near(tilt(90, 0).bank, 0));
ok("R13 upright in landscape is level, not pinned at a stop",
   near(tilt(0, -90, 90).bank, 0) && near(tilt(0, 90, 270).bank, 0));
// The same 10-degree clockwise roll, held upright in portrait and in landscape.
// Read straight off gamma, the first is 90 and the second -90: both at a stop.
ok("R13 a roll reads the same in portrait and landscape",
   near(tilt(80, 90).bank, 10, 1e-6) && near(tilt(10, -90, 90).bank, 10, 1e-6),
   `${tilt(80, 90).bank.toFixed(2)} ${tilt(10, -90, 90).bank.toFixed(2)}`);
ok("R13 and the horizon turns against it", T.bankFromTilt(10, 0) === -10);
ok("R13 lying flat holds the last bank", tilt(2, 3, 0, 7).flat && tilt(2, 3, 0, 7).bank === 7);
ok("R13 flat is 0.12 of gravity in the glass", T.FLAT === 0.12);

const held = (ms) => T.settle(0, 20, ms);
ok("R14 a held angle has levelled by 3.5 seconds", held(3500) > 19 && held(3500) < 20, held(3500).toFixed(2));
ok("R14 and has barely begun after a frame", held(16) < 0.3, held(16).toFixed(3));
ok("R14 settling crosses 180 the short way", near(T.settle(170, -170, 1e9, { wraps: true }), -170, 1e-6));
ok("R14 half a degree is the deadband", T.deadband(0, 0.4) === 0 && T.deadband(0, 0.6) === 0.6);

const pointer = (x, y) => T.fromPointer(x, y, 300, 200, 1000, 800);
ok("R15 the pointer over the instrument is level", pointer(300, 200).bank === 0 && pointer(300, 200).pitch === 0);
ok("R15 half a viewport away is full deflection",
   near(pointer(800, 200).bank, -T.BANK_RANGE) && near(pointer(300, 600).pitch, T.PITCH_RANGE));
ok("R15 and further is still full", near(pointer(1300, 200).bank, -T.BANK_RANGE));
ok("R15 a still pointer levels after 2.2 seconds", T.IDLE_MS === 2200);

console.log("\ngyro: the wiring\n");
const home = read("src/components/Home.jsx");
const paper = read("src/components/PaperStrip.jsx");
const gyro = read("src/components/Gyro.jsx");
const css = read("src/components/gyro.css");
const hook = read("src/lib/useAttitude.js");
const lib = read("src/components/module/LibraryTab.jsx");
const mcss = read("src/components/module/module.css");
const results = read("src/components/module/QuizResults.jsx");
const profile = read("src/components/Profile.jsx");
const app = read("src/App.jsx");
const screen = read("src/components/module/ModuleScreen.jsx");
const lit = (home.match(/<Gyro [^>]*\/>/) || [""])[0];

ok("R3  the state is an attribute on the svg", /data-state=\{state\}/.test(gyro) && /data-state=\{gyroState\(/.test(paper));
ok("R3  under takes the caution colour, in CSS",
   /\[data-state="under"\] \.gy-rim \{ stroke: var\(--caution\); \}/.test(css));
ok("R5  caution as words steps down in Day, where the lamp amber is 2.49:1",
   /\.app\.theme-light \.deck \.gy-phrase\[data-state="under"\] \{ color: color-mix\(in oklab, var\(--caution\) 50%, var\(--t1\)\); \}/.test(css));
ok("R4  no data dims the instrument", /\[data-state="nodata"\] \{[^}]*opacity/.test(css));
ok("R4  and parks the horizon", /useAttitude\(still \|\| average == null/.test(home));
ok("R5  the chop band is no longer under the gyro", !/chop\(/.test(home));
ok("R6  the new marks paint from the runtime palette",
   /stroke=\{palette\.active\}/.test(gyro) && /stroke=\{palette\.lit\}/.test(gyro) && /stroke=\{palette\.t1\}/.test(gyro));
ok("R7  the lit strip gets the bar", /bar=\{minimums\}/.test(lit));
ok("R7  the paper strip gets the bar", /<PaperStrip[^>]*bar=\{minimums\}/.test(home) && /<GyroMarks /.test(paper));
ok("R7  both take the caption as nodes", (home.match(/<GyroCaption /g) || []).length === 2);
ok("R8  paper inks the notch and the surplus",
   /\[data-paper="1"\] \.deck \.gy-notch,\n\.app\[data-paper="1"\] \.deck \.gy-surplus[^{]*\{ stroke: var\(--sketch-ink\); \}/.test(css));
ok("R9  the Library header has no dial", !/Dial|MinimumsPop|dialwrap|dialbtn|dialread/.test(lib));
ok("R9  and its CSS is gone", !/\.dialwrap|\.dialread|\.dialbtn|minpop/.test(mcss));
ok("R10 the results dial stays, at 170, sweeping, with its dot",
   /<Dial size=\{170\}/.test(results) && /animate=\{moved\}/.test(results) && /last=\{pct\}/.test(results));
/* §6 MOVED IT AND REWORDED IT. It was a row on the Appearance tab, labelled
   "Your bar / Below this, Master Caution lights up" — a slider filed with the
   text size because both are sliders, which is a reason about controls rather
   than about meaning. It is its own box on Preferences now, and the sentence
   under it says where the lamp lights and where it does not, because a number
   whose consequence is unstated is a number people set at random. The rule
   this assertion is really holding is unchanged: ONE place sets it, and it is
   this one. */
/* The heading is the reference's `<p className="lab">Your bar</p>` now, not
   this app's `.eyebrow` — Preferences was rebuilt from 09-preferences.html on
   2026-09-19 and every box on it is the design's markup. The rule is the same
   rule; only the element carrying the words changed. */
ok("R11 the bar is set in settings",
   /<p className="lab">Your bar<\/p>/.test(profile)
   && /The score you&rsquo;re aiming for/.test(profile)
   && /Master Caution lights up on/.test(profile)
   && /progress\.set\(MINIMUMS_KEY, clampMinimums\(/.test(profile));
ok("R11 and it says where the lamp does NOT light",
   /and nowhere else/.test(profile));
ok("R11 and in no second place", !/onMinimums/.test(app) && !/onMinimums/.test(screen));
ok("R11 never called minimums on screen", !/Your minimums/.test(profile + lib + home));
ok("R12 the deck reads the bar on every render", /const minimums = readMinimums\(progress\);/.test(home));
ok("R16 the tilt prompt lives in settings, not on the deck",
   /useTiltPermission\(reduceMotion\)/.test(profile) && !/useTiltPermission|aiask/.test(home));
ok("R17 one loop", !/requestAnimationFrame\((?!tick\))/.test(hook));
ok("R17 stopped off screen", /new IntersectionObserver/.test(hook) && /cancelAnimationFrame\(frame\)/.test(hook));
ok("R17 and never started when still", /if \(still \|\| systemStill\)/.test(hook));
ok("R17 writes only on change", /if \(next !== written\)/.test(hook));
ok("R19 the last-quiz dot is built and not wired on the deck", /gy-last/.test(gyro) && !/last=/.test(lit));

/* -------------------------------------------------------------- the meter
   IT READS HOURS AND MINUTES NOW, and that reverses what hobbs.js used to
   argue: tenths on a drum, "because that is what an hour meter reads". What
   the owner answered is that nobody outside a cockpit reads a tenth. The rule
   that survives is that it only ever rounds DOWN — a meter that credited time
   nobody had flown would be worse than one nobody could read. */
{
  const H = await import("../src/lib/hobbs.js");
  ok("meter · it counts down to the minute, never up",
     H.hobbsClock(119).reads === "1m" && H.hobbsClock(3599).reads === "59m");
  ok("meter · an hour reads in hours and minutes", H.hobbsClock(3600 * 13 + 54 * 60).reads === "13h 54m");
  ok("meter · under an hour it is minutes alone, never 0h",
     !H.hobbsClock(60 * 54).reads.includes("h"));
  ok("meter · under a minute it is a dash, never a zero count",
     H.hobbsClock(0).reads === "—" && H.hobbsClock(59).reads === "—"
     && H.hobbsClock(0).flown === false);
  ok("meter · and what a screen reader hears agrees in number",
     H.hobbsClock(60).spoken === "1 minute" && H.hobbsClock(3600).spoken === "1 hour"
     && H.hobbsClock(7200).spoken === "2 hours");
  ok("meter · there is no drum left to read", H.hobbsDrum === undefined);

  const app = read("src/App.jsx");
  /* WHERE IT COUNTS. The module and everything inside it, plus the paper
     reader — and nothing else. The Flight Deck is not time in a module. */
  ok("meter · it runs inside a module and the paper reader, and nowhere else",
     /const MODULE_ROUTES = new Set\(\["module", "chapter", "lesson", "review", "paper", "cards"\]\)/.test(app)
     && /useHobbsMeter\(view === "module" \? activeModuleCode : null, progress\)/.test(app));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
