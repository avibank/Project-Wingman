// The stamp renderer, held against the reference it was ported from.
// Run: npm run check:stamp
//
// §8 of the handoff asks for exactly this: "Unit tests for inspStamp (every
// shape × pattern × rim on/off renders with no NaN or overflow) and for
// code/callsign validation."
//
// It also holds the port itself honest. The drawing is 150 lines of string
// building copied out of docs/launch/reference/02-licence-stamp-creator.html,
// and the one way a port like that goes wrong is quietly: a digit changed, a
// path shortened, a helper dropped. So the shapes, the palette and the
// per-shape layouts are compared against the reference file on disk, and a
// drift fails the build rather than a review.
import { readFileSync } from "node:fs";
import {
  PALETTE, SHAPES, MARKS, PATTERNS, SHAPE_IDS, PATTERN_IDS,
  inspStamp, drawStamp, validStamp, cleanCode, cleanRim, escapeText,
  inkByName, inkFilterMarkup, inkFilterId, HOUSE_STAMP, MOTTO, DEFAULT_STAMP,
} from "../src/lib/stamp.js";

const REF = readFileSync(new URL("../docs/launch/reference/02-licence-stamp-creator.html", import.meta.url), "utf8");

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* ------------------------------------------------------- 1 · the vocabulary */
/* EIGHT NOW. The 20 Sep engine adds `shield` and `hex`, and both carry the new
   derived rim rather than a hand-placed arc — which is most of what that
   change was for. */
ok("parts", `eight shapes, and each is its own drawing (${SHAPE_IDS.length})`,
   SHAPE_IDS.length === 8 && SHAPE_IDS.every((s) => typeof SHAPES[s]?.o === "function")
   && new Set(SHAPE_IDS.map((s) => SHAPES[s].o())).size === 8);
ok("parts", `six patterns (${PATTERN_IDS.length})`,
   PATTERN_IDS.length === 6 && PATTERN_IDS.every((p) => p in PATTERNS));
ok("parts", `thirty-six inks, every one named and unique (${PALETTE.length})`,
   PALETTE.length === 36 && new Set(PALETTE.map((p) => p.n)).size === 36);
ok("parts", "the motto is the app's", MOTTO === "Never fly alone", MOTTO);
ok("parts", "the default stamp is the reference's",
   DEFAULT_STAMP.shape === "seal" && DEFAULT_STAMP.sym === "tick" && DEFAULT_STAMP.seed === 1);

/* --------------------------------------------- 2 · it still matches the spec
   NOT a checksum of the file — that fails on a comment. The parts that ARE the
   design, compared as SOURCE TEXT against the reference on disk: the palette's
   thirty-six lines, and the body of every shape and every per-shape layout.
   A digit changed anywhere in them fails here. */
{
  /* The port adds three things the reference has no need of: `export` in front
     of the declarations, comments explaining the adaptations, and an
     eslint-disable. None of them is the drawing, so all three are normalised
     away and what is left is compared character for character. */
  /* BOTH SIDES, NOT JUST THE PORT. This stripped comments from the port and
     compared what was left against the RAW reference — which worked only for
     as long as the reference had no comments inside the blocks being read.
     The new engine has them, in `layout` and in `ringPattern`, so the check
     was measuring the reference's prose against the port's code and calling
     it a drift. Comments are not the drawing on either side. */
  const strip = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const MINE = strip(readFileSync(new URL("../src/lib/stamp.js", import.meta.url), "utf8"))
    .replace(/\bexport (const|function|let) /g, "$1 ")
    /* THE PORT'S STATED ADAPTATIONS, PUT BACK so that what is compared is the
       drawing. Each one is written out in src/lib/stamp.js beside the code it
       changes; if one of them stops being needed, this list is where it is
       noticed, because the comparison fails.

       1 · the reference defaults to its own live stamp, which does not exist
           outside the demo;
       2 · it reaches its ink filter through the page's <svg defs>; the app
           renders one <filter> per seed and refers to it by id;
       3 · `pathPts` measures a path with getTotalLength, which needs a real
           SVG element. The reference appends one to the page. This file makes
           a detached one and answers null where there is no DOM at all —
           which is this check, running in Node;
       4 · and every caller of it therefore has to tolerate null, falling back
           to the hand-written arcs that postage and tag use anyway. */
    .replace("st=DEFAULT_STAMP){", "st=MYSTAMP){")
    .replace("inkFilterId(st.seed||1)", "inkFilter(st.seed||1)")
    .replace(/function pathPts\(d\)\{[\s\S]*?return _PS\[d\]=\{pts,N\}\}/,
             "function pathPts(d){if(_PS[d])return _PS[d];\n  const svg=document.querySelector('svg defs').parentNode;\n  const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',d);svg.appendChild(el);\n  const L=el.getTotalLength(),N=480,pts=[];\n  for(let i=0;i<=N;i++){const q=el.getPointAtLength(L*i/N);pts.push([q.x,q.y])}\n  el.remove();return _PS[d]={pts,N}}")
    .replace("function ptAt(d,t){const P=pathPts(d);if(!P)return null;const {pts,N}=P;",
             "function ptAt(d,t){const {pts,N}=pathPts(d);")
    .replace("  const P=pathPts(d);if(!P)return null;\n  const {pts,N}=P,M=360,", "  const {pts,N}=pathPts(d),M=360,")
    .replace("  const RO=radii(out[0]),RI=radii(inn[0]);\n  if(!RO||!RI)return null;\n  const M=1.05,",
             "  const M=1.05,RO=radii(out[0]),RI=radii(inn[0]),")
    .replace("    if(!A||!B)return [20,20];\n", "")
    .replace(/if\(A&&B\)\{Ly\.top=A\.d;Ly\.tl=A\.L;Ly\.bot=B\.d;Ly\.bl=B\.L;RZ=\[A\.f,B\.f\];\s*\n\s*if\(Ly\.stars&&Ly\.stars\.length\)Ly\.stars=\[\[20-A\.rr,20\],\[20\+A\.rr,20\]\]\}\}/,
             "Ly.top=A.d;Ly.tl=A.L;Ly.bot=B.d;Ly.bl=B.L;RZ=[A.f,B.f];\n    if(Ly.stars&&Ly.stars.length)Ly.stars=[[20-A.rr,20],[20+A.rr,20]]}");
  const squash = (v) => String(v).replace(/\s+/g, "");
  /* The named block between a declaration and the next top-level one. */
  const block = (src, decl, until) => {
    const a = src.indexOf(decl);
    if (a < 0) return null;
    const b = src.indexOf(until, a + decl.length);
    return b < 0 ? null : squash(src.slice(a + decl.length, b));
  };
  const pairs = [
    ["the palette's thirty-six inks", "const PALETTE=[", "];", "const PALETTE=[", "];"],
    ["every shape's outline", "const SHAPES={", "const MARKS=", "const SHAPES={", "const MARKS="],
    ["every mark it can carry", "const MARKS={", "const SYMS=", "const MARKS={", "const SYMS="],
    ["every per-shape layout", "function layout(shape){", "function ringPt(", "function layout(shape){", "function ringPt("],
    ["the ring patterns", "function ringPattern(p,R){", "function inspStamp(", "function ringPattern(p,R){", "function inspStamp("],
    ["the renderer itself", "function inspStamp(on,size=40,rot=0,st=", "\n}", "function inspStamp(on,size=40,rot=0,st=", "\n}"],
  ];
  for (const [what, rd, ru, md, mu] of pairs) {
    const a = block(strip(REF), rd, ru);
    const b = block(MINE, md, mu);
    ok("spec", `${what} is the reference's, to the character`, !!a && !!b && a === b,
       !a ? "not found in the reference" : !b ? "not found in the port" : `${a.length} vs ${b.length} chars`);
  }
}

ok("spec", "the ink filter is the reference's, id and all",
   inkFilterId(7) === "ink2_7"
   && /feTurbulence[^>]*baseFrequency="2\.1"/.test(inkFilterMarkup(7))
   && /feDisplacementMap[^>]*scale="\.42"/.test(inkFilterMarkup(7))
   && inkFilterMarkup(7).includes(`seed="${7 * 17 + 3}"`));

/* ----------------------------------- 3 · §8 · every combination, no NaN */
{
  const bad = [];
  let drawn = 0;
  for (const shape of SHAPE_IDS) {
    for (const pattern of PATTERN_IDS) {
      for (const rim of [true, false]) {
        for (const code of ["A", "AR", "ARH"]) {
          for (const sym of [null, "tick", "plane"]) {
            drawn += 1;
            const svg = drawStamp({ shape, pattern, rim, code, sym, ring: rim ? "WINGMAN" : "", ink: "Ruby", seed: 5 }, { size: 40 });
            if (/NaN|Infinity|undefined|null/.test(svg)) bad.push(`${shape}/${pattern}/rim=${rim}/${code}/${sym}`);
            /* Nothing may be drawn outside the 40x40 box: every coordinate the
               renderer emits has to land inside it, or a stamp on a Crew wall
               paints over its neighbour. A little slack for the ink filter,
               which is allowed -6%. */
            for (const m of svg.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) {
              const x = Number(m[1]), y = Number(m[2]);
              if (x < -3 || x > 43 || y < -3 || y > 43) { bad.push(`${shape}/${pattern} draws at ${x},${y}`); break; }
            }
          }
        }
      }
    }
  }
  ok("draw", `every shape x pattern x rim x code x mark renders clean (${drawn})`, bad.length === 0,
     [...new Set(bad)].slice(0, 4).join("; "));
}
ok("draw", "a rim carries the student's word on top and the motto underneath",
   (() => { const s = drawStamp({ ...DEFAULT_STAMP, code: "AR", sym: null, rim: true, ring: "TORQUE", shape: "seal" });
     return s.includes(">TORQUE<") && s.includes(`>${MOTTO.toUpperCase()}<`); })());
ok("draw", "no rim means the pattern fills the whole ring instead",
   (() => { const on = drawStamp({ ...DEFAULT_STAMP, code: "AR", sym: null, rim: false, pattern: "rays", shape: "seal" });
     return !on.includes(`>${MOTTO.toUpperCase()}<`) && on.includes("<mask"); })());
/* §4: "until a student issues their own, sign-offs use the generic seal
   (tick, livery ink)". A null ink IS the livery — inkVal answers var(--accent)
   for it — so the house seal must carry no colour of its own. */
ok("draw", "the house seal draws in the livery, before anyone has made one",
   drawStamp(HOUSE_STAMP).length > 500
   && drawStamp(HOUSE_STAMP).includes("var(--accent)")
   && drawStamp(HOUSE_STAMP).includes(MARKS.tick.slice(0, 40)));
/* THE RIM IS TRACKED TO ITS OWN WIDTH, NOT SHRUNK TO FIT, and that reverses
   what this assertion used to test. `textLength` was the whole path, so `WNG`
   was stretched across a hundred-degree arc and a longer rim had to be set in
   a smaller font to fit. It is `min(pathLength, chars * fontSize * 1.06)` now,
   centred with `text-anchor="middle"` and `startOffset="50%"` — so a short rim
   sits compactly at the crown and a long one grows along the arc, and neither
   ever exceeds it. Changelog item 2, 20 Sep. */
{
  const rim = (ring) => drawStamp({ ...DEFAULT_STAMP, code: "A", sym: null, rim: true, ring });
  const len = (s) => Number(/textLength="([\d.]+)"/.exec(s)?.[1]);
  const two = len(rim("WN")), three = len(rim("WNG")),
        seven = len(rim("WINGMAN")), ten = len(rim("ABCDEFGHIJ"));
  ok("draw", "a longer rim takes more of the arc rather than a smaller font",
     two < three && three < seven && seven < ten, `${two} ${three} ${seven} ${ten}`);
  ok("draw", "and never more of it than there is",
     ten < Number(/textLength="([\d.]+)"/.exec(rim("ABCDEFGHIJ").slice(rim("ABCDEFGHIJ").indexOf("textLength") + 12))?.[1] ?? Infinity)
     || ten < 33.5, String(ten));
  ok("draw", "it is centred on its corridor, not started at one end",
     /text-anchor="middle"/.test(rim("WNG")) && /startOffset="50%"/.test(rim("WNG")));
}

/* ------------------------------------------- 4 · §8 · the code, validated */
ok("code", "a code is 1-3 characters, A-Z or 0-9, and nothing else",
   cleanCode("ar") === "AR" && cleanCode("a-r!") === "AR" && cleanCode("abcd") === "ABC"
   && cleanCode("<b>") === "B" && cleanCode("") === "");
ok("code", "a stamp with no code is not a stamp",
   !validStamp({ shape: "seal", pattern: "none", code: "", seed: 1 }));
ok("code", "a shape or pattern the renderer cannot draw is refused",
   !validStamp({ shape: "hexagon", pattern: "none", code: "AR", seed: 1 })
   && !validStamp({ shape: "seal", pattern: "tartan", code: "AR", seed: 1 }));
ok("code", "an ink is a NAME from the palette, never a colour",
   validStamp({ shape: "seal", pattern: "none", code: "AR", ink: "Ruby", seed: 1 })
   && !validStamp({ shape: "seal", pattern: "none", code: "AR", ink: "oklch(.5 .2 20)", seed: 1 })
   && inkByName("Ruby")?.h === 22 && inkByName("Nope") === null);
ok("code", "a seed is a whole number, because it is an account's for ever",
   validStamp({ shape: "seal", pattern: "none", code: "AR", seed: 3 })
   && !validStamp({ shape: "seal", pattern: "none", code: "AR", seed: 0 })
   && !validStamp({ shape: "seal", pattern: "none", code: "AR", seed: 1.5 }));

/* -------------------------------- 5 · nothing a student types reaches markup
   The drawing is assembled as a STRING, so this is the one place a stamp
   could carry something it should not. Both the alphabet and the escape. */
ok("safe", "rim text is cut to an alphabet before it is drawn",
   cleanRim('a"onload=x') === "AONLOADX" && cleanRim("<script>") === "SCRIPT" && cleanRim("ABCDEFGHIJKL").length === 10);
ok("safe", "and escaped on top of that", escapeText('<a href="x">') === "&lt;a href=&quot;x&quot;&gt;");
ok("safe", "so a code and a rim of pure markup draw nothing but text",
   (() => { const s = drawStamp({ shape: "seal", pattern: "none", code: "<b>", ring: "<img src=x onerror=y>", rim: true, sym: null, ink: null, seed: 1 });
     return !s.includes("<b>") && !s.includes("<img") && !s.includes("onerror"); })());

/* ------------------------------------------------- 6 · the marks it can carry */
ok("marks", `every mark the reference draws is here (${Object.keys(MARKS).length})`,
   ["tick", "plane", "wrench", "prop", "wings", "wheart", "bolt", "sparkle", "star"].every((m) => m in MARKS)
   && Object.keys(MARKS).length === 9);
ok("marks", "inspStamp keeps the reference's own signature",
   typeof inspStamp === "function" && inspStamp.length === 1);

console.log(`\nstamp: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
