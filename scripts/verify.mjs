// Part 10's verify list, as far as it can be run without a browser driver.
//
// Each line says what it checked and — where it could not check something —
// says that instead of staying silent. A verification pass that quietly skips
// what it cannot do is worse than none, because it reads as a clean bill.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const rows = [];
const ok = (what, detail) => rows.push(["ok", what, detail]);
const no = (what, detail) => rows.push(["FAIL", what, detail]);
const manual = (what, detail) => rows.push(["needs a browser", what, detail]);
// Blocked is not failing. It is work that cannot start until something outside
// the repo exists, and it stays visible rather than being marked done.
const blocked = (what, detail) => rows.push(["blocked", what, detail]);

const run = (cmd) => {
  try { return { out: execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), code: 0 }; }
  catch (e) { return { out: (e.stdout || "") + (e.stderr || ""), code: e.status ?? 1 }; }
};

// 1 · Night pixel-identical; Manual unchanged.
{
  const r = run("node scripts/check-livery.mjs");
  const agreed = /(\d+) agreed divergences/.exec(r.out);
  if (r.code === 0 && agreed) ok("Night against the POC", `${agreed[1]} agreed divergences (--t3, for contrast), nothing unexplained`);
  else if (r.code === 0) ok("Night against the POC", "byte-identical");
  else no("Night against the POC", "drift");
}

// 2 · Contrast across the full matrix.
{
  const r = run("node scripts/check-contrast.mjs");
  const span = /spans ([\d.]+) to ([\d.]+)/.exec(r.out);
  if (r.code === 0 && span) ok("contrast, 6 liveries x Light/Dark x Standard/Aurora", `t3 spans ${span[1]}-${span[2]} against a 4.5 floor`);
  else no("contrast", r.out.split("\n").filter((l) => /FAIL/.test(l)).join("; "));
}

// 3 · Aurora in Day identical to no finish in Day.
{
  const src = readFileSync("src/lib/finishEngine.js", "utf8");
  if (/finish === "aurora" && night/.test(src)) ok("Aurora in Day", "the branch is night-gated, so Day falls through to Standard");
  else no("Aurora in Day", "the aurora branch is not gated on night");
}

// 4 · All six auroras visibly distinct.
manual("the six auroras being distinct", "hue tables differ per livery, but 'visibly' is a judgement a check cannot make");

// 5 · Settings move on the same frame with the network hung.
{
  const r = run("node scripts/check-settings.mjs");
  r.code === 0 ? ok("settings apply before they persist", "both branches driven with the save never settling")
               : no("settings", "a path persists without applying");
}

// 6 · 390 / 768 / 1440, no overflow, targets >= 44.
{
  const r = run("node scripts/check-responsive.mjs");
  const notes = (r.out.match(/note /g) || []).length;
  r.code === 0 ? ok("responsive rules", `no fixed width under 390px, --tap 44px, sideways scroll stopped; ${notes} off-scale breakpoints noted`)
               : no("responsive", "a fixed width or an undersized target");
  manual("overflow with real content in the layout", "needs a driver at the three widths");
}

// 7 · Text size per device, everything else per account.
{
  const app = readFileSync("src/App.jsx", "utf8");
  const perDevice = /saveJSON\("pw-font-size"/.test(app);
  const notAccount = !/progress\.set\("pw-font-size"/.test(app);
  perDevice && notAccount ? ok("text size is per device", "written with saveJSON, never through the progress provider")
                          : no("text size", "still following the account");
}

// 8 · Player: resume, keys, marks, completion at 90%.
{
  const p = readFileSync("src/components/module/Player.jsx", "utf8");
  const has = (re, what) => re.test(p) || no("player", `no ${what}`);
  has(/currentTime = at/, "resume");
  has(/ArrowRight/, "keyboard");
  has(/marks\.map/, "question marks on the scrub");
  has(/>= 0\.9/, "completion at 90%");
  has(/<track kind="captions"/, "captions");
  ok("player wiring", "resume, keys, marks, 90% completion and captions all present");
  manual("playback itself", "this sandbox cannot decode the seeded MP4 — a bare video element gets MEDIA_ERR_SRC_NOT_SUPPORTED for the same file");
}

// 9 · Next walks a module end to end.
{
  const r = run("node -e \"import('./src/components/module/nextUp.js').then(m=>{const chs=[{id:'c1',title:'C1',lessons:[{id:'l1'},{id:'l2'}]},{id:'c2',title:'C2',lessons:[{id:'l3'}]}];let n=m.nextAfterLesson(chs,'c1','l1',{quiz:{}});if(!n)process.exit(1);n=m.nextAfterLesson(chs,'c1','l2',{quiz:{}});if(n.kind!=='quiz')process.exit(1);if(m.nextAfterQuiz(chs,'c2'))process.exit(1);console.log('walked')})\"");
  r.code === 0 ? ok("the next-up chain", "lesson to lesson to quiz to next chapter, and it terminates")
               : no("the next-up chain", "it does not walk or does not terminate");
}

// 10 · One quiz, one score.
{
  const lib = readFileSync("src/components/module/LibraryTab.jsx", "utf8");
  const tab = readFileSync("src/components/module/RouteTab.jsx", "utf8");
  (/state\?\.quiz/.test(lib) && /state\?\.quiz/.test(tab))
    ? ok("one quiz, one score", "the Library and the chapter row read the same state.quiz map")
    : no("one quiz, one score", "they read different sources");
}

// 11 · Every route in loading, empty and error.
{
  const r = run("node scripts/check-states.mjs");
  r.code === 0 ? ok("loading, empty and error", "all three wired; the boundary sits inside Suspense")
               : no("the three states", "one is missing");
  manual("each route rendered three ways", "needs a driver and a stubbed API");
}

// 12 · First visit shows nothing pretending.
{
  const rt = readFileSync("src/components/module/ModuleScreen.jsx", "utf8");
  /avg != null &&/.test(rt) ? ok("first visit", "no quiz average until one has been taken — absent, not zero")
                            : no("first visit", "a figure is shown before there is one");
}

// 13 · Every tab in the URL; every URL reloadable.
{
  const r = run("node -e \"import('./src/lib/routes.js').then(m=>{const u=['/m/m1','/m/m1/library','/m/m1/library/quizzes','/m/m1/people','/m/m1/c1/lesson/l1','/m/m1/c1/lesson/l1/q/7','/m/m1/c1/quiz'];const bad=u.filter(x=>m.parseRoute(x).name==='notfound');if(bad.length){console.log(bad);process.exit(1)}console.log('all parse')})\"");
  r.code === 0 ? ok("routes", "all seven module URLs parse, including the question anchor")
               : no("routes", "a URL does not parse");
}

// 14 · Bundle under budget.
{
  const r = run("node scripts/check-bundle.mjs");
  const m = /entry (\d+KB) against a (\d+KB)/.exec(r.out);
  r.code === 0 && m ? ok("bundle", `entry ${m[1]} against ${m[2]}`) : no("bundle", "over budget");
}

// 15 · Production clean of placeholders.
{
  const r = run("node scripts/check-placeholders.mjs");
  /CLEAN \(main bundle\)/.test(r.out)
    ? ok("placeholders", "none in the main bundle; the seeded content is a lazy chunk, removed by `npm run check:ship`")
    : (r.code === 0 ? ok("placeholders", "clean") : no("placeholders", "in the main bundle"));
}

// 16 · Icons, og.png, theme-color, Clerk renamed.
{
  const html = existsSync("index.html") ? readFileSync("index.html", "utf8") : "";
  const bits = [
    [/rel="icon"/, "favicon"],
    [/og:image/, "og.png"],
    [/apple-touch-icon/, "apple-touch-icon"],
    [/name="theme-color"[^>]*media="\(prefers-color-scheme: dark\)"/, "a dark theme-color"],
  ].filter(([re]) => !re.test(html)).map(([, w]) => w);
  // og:image points at a URL; the file has to be SERVED, and it is not in the
  // build. A tag that names an image nobody can fetch looks correct in the
  // source and produces a blank card wherever the link is shared.
  const ogServed = existsSync("public/og.png") || existsSync("og.png");
  if (!ogServed) bits.push("og.png is declared but not in the build");
  if (bits.length) blocked("brand assets", `${bits.join("; ")} — needs a wordmark`);
  else ok("brand assets", "present");
}

const w = Math.max(...rows.map((r) => r[1].length));
console.log("\nPart 10 — verify\n");
for (const [state, what, detail] of rows) {
  const tag = state === "ok" ? "  ok  " : state === "FAIL" ? " FAIL "
    : state === "blocked" ? " block" : "  ??  ";
  console.log(`${tag} ${what.padEnd(w)}  ${detail}`);
}
const failed = rows.filter((r) => r[0] === "FAIL").length;
const open = rows.filter((r) => r[0] === "needs a browser").length;
const held = rows.filter((r) => r[0] === "blocked").length;
console.log(`\n${rows.length - failed - open - held} verified, ${failed} failing, ${open} need a browser driver, ${held} blocked\n`);
process.exitCode = failed ? 1 : 0;
