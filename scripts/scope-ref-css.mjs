#!/usr/bin/env node
/* The launch pack's stylesheets, scoped into src/ as real files.
 *
 * docs/launch/code/NN-*.css  ->  src/.../ref-*.css
 *
 * START-HERE: "add the reference stylesheet to the repo as a real file and
 * import it — never retype the rules, never adjust a value, never map them
 * onto existing components." Both halves are honoured here, and the one thing
 * that cannot be is recorded rather than fudged.
 *
 * THE SHEETS STYLE BARE CLASS NAMES. `.card`, `.tab`, `.search`, `.pill`,
 * `.box`, `.av`, `.chap`, `.sub` — every one of them already paints something
 * else in this app, and `01-tokens-and-base.css` opens with `*{box-sizing}`
 * and a `button{...}` reset, which unscoped is not a collision but the whole
 * app. check:collisions exists in this repo because that has shipped before.
 *
 * So NOTHING is renamed and NO value is touched. Every selector gets the
 * bundle's root class in front of it, and the sheet simply cannot escape its
 * screen. The class names in the reference markup are produced exactly as
 * written, which is what lets the JSX be copied from it.
 *
 * WHAT IS CUT, AND WHY — each one named, so "verbatim" stays checkable:
 *   · the :root token blocks. The reference was written against THIS app's
 *     vocabulary — --ground, --panel, --raised, --line, --t1/2/3, --copilot,
 *     --ok — and its dark values ARE the app's Sky night livery, to the
 *     decimal. Keeping them would pin every student to one livery. The nine
 *     tokens the app does not emit are aliased below, which is the only new
 *     CSS here and is adaptation, not layout.
 *   · the global reset: *, html, body, button, :focus-visible. A scoped `*`
 *     is still every element on the screen and would restyle the app bar
 *     through it.
 *
 * Generated, not hand-edited, so the two cannot drift:
 *   npm run ref:css
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARK = "C";

/* Cuts, by name. `find` is what comes out; `guard` is what must then be gone
   — if the guard still matches, the shape changed and this refuses rather
   than silently shipping a global reset. */
const CUTS = [
  { why: "the :root token block (the app's livery engine emits these)",
    find: /:root\{[\s\S]*?\n\}\n/g, guard: /:root\{/ },
  { why: "the dark-scheme token block",
    find: /@media \(prefers-color-scheme:dark\)\{:root[\s\S]*?\n\}\}\n/g, guard: /prefers-color-scheme:dark\)\{:root/ },
  { why: "the [data-theme=dark] token block",
    find: /:root\[data-theme="dark"\]\{[\s\S]*?\n\}\n/g, guard: /:root\[data-theme="dark"\]\{/ },
  /* The quiz-stamps sheet carries the reference page's own toggle bar and
     says so: "The `.dbar` block below is demo chrome — do not port it." */
  { why: "the demo bar and its page padding (the sheet says not to port them)",
    /* The guard matches a RULE, not the sentence above it: the sheet's own
       header names `.dbar` while telling you not to port it. */
    find: /\.qs-page\{[^\n]*\n(?:\.dbar[^\n]*\n)+/g, guard: /^\.dbar[^\n]*\{/m },
  { why: "the global reset — *, html, body, button, :focus-visible",
    /* Two shapes, because the two reference builds differ by one selector:
       reference 02's focus rule names `select`, reference 01's does not. */
    find: /\*\{box-sizing:border-box\}\nhtml,body\{[^}]*\}\nbody\{[^}]*\}\nbutton\{[^}]*\}\nbutton:focus-visible[^}]*\}\n/g,
    guard: /^\*\{box-sizing/m },
];

/* THE MODULE PORT'S OWN CUTS. The 2026-10-07 demo's reset is a different shape
   from the launch pack's — `*`, `[hidden]`, `body`, `button`, a shared
   focus-visible rule and a `.wrap` that is the demo PAGE's column rather than
   the screen's — so the shared CUTS above would leave half of it standing and
   then refuse on their own guards. Each one is named and guarded the same way.

   `[hidden]` is deliberately KEPT: `display:none!important` on a hidden
   element is the demo's own behaviour and several of its controls rely on it.
   Scoped, it can only reach the port.

   `.wrap` IS KEPT TOO, and it was cut for one run before being put back. It
   looks like the demo PAGE's layout, and it would be if the port sat inside
   the app's own module screen — but it cannot: `.mscreen` and `.ref-mod` style
   twenty-four of the same bare words the demo does, and a descendant of either
   loses every property the demo does not also declare (measured: 118 foreign
   declarations reaching in, including the app's OWN `.quiz-thumb__sheet i` and
   `.cards-thumb i`, which are the same class names). So the ported screen
   stands on its own, outside both, and `.wrap` is then exactly what it needs
   to be: its column and its 22px rhythm. */
const PORT_CUTS = [
  { why: "the :root token block (the app's livery engine emits these)",
    find: /:root\{[\s\S]*?\n\}\n/, guard: /:root\{/ },
  /* THIS DEMO CLOSES BOTH DARK BLOCKS ON A CONTENT LINE — `…color-scheme:dark}}`
     rather than a brace of its own — so the launch pack's `\n}}` shapes do not
     match it. The guards refused rather than shipping half a token block, which
     is what they are for. */
  { why: "the dark-scheme token block",
    find: /@media \(prefers-color-scheme:dark\)\{:root[\s\S]*?\}\}\n/, guard: /prefers-color-scheme:dark\)\{:root/ },
  { why: 'the :root[data-theme="dark"] token block',
    find: /:root\[data-theme="dark"\]\{[\s\S]*?\}\n/, guard: /:root\[data-theme="dark"\]\{/ },
  { why: "the universal box-sizing (a scoped * is still every element on the screen)",
    find: /\*\{box-sizing:border-box\}\n/, guard: /^\*\{box-sizing/m },
  { why: "the demo page's own body rule (background, type scale and page padding)",
    find: /^body\{[^}]*\}\n/m, guard: /^body\{/m },
  { why: "the bare button reset (replaced by the scoped one in §4.3 below)",
    find: /^button\{[^}]*\}\n/m, guard: /^button\{/m },
  { why: "the focus-visible rule (the app sets its own, with the same 2px accent ring)",
    find: /^button:focus-visible,input:focus-visible\{[^}]*\}\n/m, guard: /^button:focus-visible/m },
];

/* THE TOKEN MAPPING, §3.1 OF THE HANDOFF — mapped to the tokens this app
   actually has rather than to the ones the table names.
   -----------------------------------------------------------------------------
   The table asks for `--bg-ground`, `--text-primary`, `--accent-interactive`.
   This app has no such names: they are `--ground`, `--t1`, `--active`. And the
   demo ALREADY uses `--ground`, `--panel`, `--raised`, `--line` and `--t1/2/3`,
   so two thirds of that table is a rename to what is already there. Only the
   accent family, the two faces, the radius and the easing need declaring.

   `--screen` and `--screen-ink` are declared by the demo and used by none of
   its rules (counted: 0 and 0), so they are not carried over. The player's dark
   base is the hard-coded `rgb(7,13,22)` the handoff says stays. */
const PORT_VARS = `/* GENERATED by scripts/scope-ref-css.mjs — do not edit. */
ROOT{
  --accent: var(--active);
  /* The ink ON the accent, which is what a filled waypoint and a solid button
     carry. The app's own rule for this is \`--ground\` on \`--active-fill\`. */
  --accent-ink: var(--ground);
  --accent-soft: color-mix(in oklch, var(--active) 12%, transparent);
  --ui: var(--font-ui);
  --mono: var(--font-mono);
  --r: 13px;
  --ease: cubic-bezier(.3, .7, .3, 1);
  /* THE TYPE SCALE IS THE SCREEN'S, NOT THE PAGE'S — the one line put back
     from the cut body rule, and the same line the launch pack's own bundles
     needed for the same reason. The demo is 15px over a 1.5 line; without it
     the port inherited the app's and every line box came out a fraction
     shorter. Measured against the demo at 1280: the card 516 against 527, a
     tile 140 against 144, the "more" line 42 against 46 and a tab 38 against
     41 — a consistent three to four pixels on everything with words in it. */
  font: 15px/1.5 var(--font-ui);
}
/* THE ACCENT READ AS WORDS TAKES \`--active-text\` IN DAY, which is this app's
   own three-token rule: \`--active\` for a mark, \`--active-fill\` for a fill,
   \`--active-text\` for the accent read as words (CLAUDE.md, Bookmarks).
   Measured here rather than assumed — six liveries x night and day, and every
   failure was in DAY:

     the Got it label     3.55:1 on Runway, 3.86 Tarmac, 3.89 Amber
     the Got it count     3.96:1 on Sky  (the exact number CLAUDE.md already
                          records for the module picker's name)
     the current set      4.09:1 on Runway, 4.47 Tarmac, 4.49 Amber

   Only the WORDS move. The ring around the tick and the mini cards' accent
   borders are marks and keep \`--active\`, which is what stops this becoming
   the one-hue collapse the design has already reversed once.

   THESE SELECTORS ARE SPELLED OUT RATHER THAN BUILT FROM THE SCOPE TOKEN, and
   that is deliberate: the scope is \`.app .wm-port\`, so putting the token
   after \`.app.theme-light\` expands to a selector with \`.app\` in it twice —
   two nested elements carrying that class, which do not exist. The Manual line
   below was written that way and silently matched nothing from the day it was
   added. (The substitution is textual, so it reaches comments too.) */
/* ONE FOREIGN RULE STILL REACHES THE ROUTE STRIP, AND IT MOVED IT.
   -----------------------------------------------------------------------------
   \`.route { position: sticky; top: 16px; max-height: calc(100vh - 32px);
   flex-direction: column; min-width: 0 }\` — somebody else's \`.route\`, at
   (0,1,0). The port overrides \`position\` and \`display\`, so it loses those, but
   a rule only loses the properties the port ALSO declares: \`top: 16px\` stayed,
   and on a relatively-positioned box it shifts the strip 16px down over the
   first row. Measured against the demo at 1440: the demo leaves a 6px gap
   between the route and the first row, and this left MINUS TEN — the open
   row's focus ring drawn across the waypoints (owner, 2026-10-08).

   Undone at (0,4,0) rather than (0,3,0), because this block is emitted ABOVE
   the ported rules and a tie would go to them on order. The four properties
   are named rather than reset wholesale: the port's own \`display: grid\` and
   \`position: relative\` are doing their job and must not be touched. */
.app .wm-port .card .route{ top: auto; max-height: none; min-width: auto; flex-direction: row; }

/* AND THE ATTEMPT STRIP SITS ON THE CHEVRON'S LINE (owner, 2026-10-08: "align
   the stamp? and the arrow").
   -----------------------------------------------------------------------------
   The demo pins \`.crew\` at a flat \`top: 21px\`, which would centre a bare 26px
   stamp on a 68px head — but \`.crew\` has 3px of padding of its own, so the box
   is 32px and its centre lands 3px BELOW the chevron's. Measured: head centre
   383, chevron centre 383, stamp centre 386.

   This is the demo's own geometry, not a port defect — it measures 3px out
   there too — so it is a change to the design rather than a correction, and it
   is written here where changes to the design live. 21 − 3 = 18 puts the two
   on one line exactly, and it stays a fixed top rather than becoming
   \`top: 50%\`: \`.crew\` is positioned against the ROW, and a row with its drawer
   open is hundreds of pixels tall, so a percentage would drop the stamps into
   the tiles. */
.app .wm-port .row .crew{ top: 18px; }

.app.theme-light[data-paper] .wm-port{ --accent: var(--active-text); }
.app.theme-light .wm-port .setpick .pk.on b,
.app.theme-light .wm-port .side.yes b,
.app.theme-light .wm-port .deckspot.yes .lab{ color: var(--active-text); }

/* §4.3 — THE RESET, AND WHY IT IS IN TWO PARTS.
   -----------------------------------------------------------------------------
   The handoff gives one blanket \`.wm-port button{…}\` rule. It is kept, and it
   is SAFE because it is (0,1,1) — weaker than every rule in the sheet below,
   which are all (0,2,0) or more. A stronger blanket reset is what collapsed
   the tile to 215x47 on 2026-10-06: it beat the port's own padding, border and
   background and took them with it.

   But (0,1,1) is also weaker than the app's §12 hit-area floor, which is
   \`.app button:not(.is-inline)\` at (0,2,1) — so the blanket rule alone does
   NOT undo it, and \`min-height:44px\` against \`height:28px\` is how every
   waypoint was 28x44 for a week. \`min-height\` beats \`height\`. The second
   part is that one property at (0,3,1), which is the least that can reach it,
   and it covers the three other selectors in §12's list because the port has a
   \`[role="tab"]\` strip and a search \`input\` inside it. */
ROOT button{min-height:0;min-width:0;height:auto;padding:0;margin:0;border:0;background:none;box-shadow:none;font:inherit;color:inherit;line-height:inherit;letter-spacing:inherit;text-transform:none;text-align:inherit;appearance:none;-webkit-appearance:none}
ROOT button::before,ROOT button::after{content:none}
ROOT button:not(.is-inline),
ROOT [role="tab"],
ROOT input:not([type="checkbox"]):not([type="radio"]):not(.is-inline),
ROOT select:not(.is-inline),
ROOT textarea:not(.is-inline){min-height:0}
`;

/* A SOURCE IS A FILE IN THE PACK, OR A REFERENCE BUILD'S WHOLE STYLE BLOCK.
   -----------------------------------------------------------------------------
   THE TWO REFERENCES HAVE DIFFERENT BASES, and the pack only extracted one of
   them. `01-tokens-and-base.css` is lifted from reference 02, the licence
   file; `11-module-screen.css` is lines 161-313 of reference 01, the module
   file — so everything reference 01 declares ABOVE line 161 was in neither.
   That is `.card`, `.tabs`, `.tab`, `.chip`, `.log`, `.entry`: the card the
   module screen is, and the tab strip along its top edge. Measured before it
   was noticed: the card had no border and the tabs were 44px of app chrome
   against the design's 52.

   So the module and lesson bundles take reference 01's style block whole.
   11- and 12- are slices of that same block and are not listed again; the
   licence bundle keeps the pack's files, which are reference 02 and complete.
   Nothing is retyped either way — both are read off disk. */
const REF = (name) => {
  const html = readFileSync(join(ROOT, "docs/launch/reference", name), "utf8");
  const a = html.indexOf("<style>");
  const b = html.indexOf("</style>", a);
  if (a === -1 || b === -1) { console.error(`REFUSING: no style block in ${name}`); process.exit(1); }
  return html.slice(a + 7, b);
};
const PACK = (name) => readFileSync(join(ROOT, "docs/launch/code", name), "utf8");
const MODULE_REF = () => REF("01-module-lesson-crew.html");

const BUNDLES = [
  { root: ".ref-mod", out: "src/components/module/ref-module.css",
    from: "reference/01-module-lesson-crew.html (its whole style block)",
    src: [MODULE_REF] },
  { root: ".ref-les", out: "src/components/module/ref-lesson.css",
    from: "reference/01-module-lesson-crew.html (its whole style block)",
    src: [MODULE_REF] },
  /* THE EXAM PACK'S SHEET (2026-09-20). Its own R1 says to copy it verbatim
     and import it once — and 128 of its rules are BARE class names that this
     app already renders elsewhere. Measured, not guessed: `.btn` in 21 other
     components, `.sheet` in 9 (the licence pickers among them), `.who` in 8,
     `.mark` in 5, `.stamp` in the lesson sign-off, plus `.route`, `.score`,
     `.verdict`, `.ans`, `.options`. `.mark{width:36px;height:36px;
     border-radius:50%}` alone would turn every chapter tick in the app into a
     circle, the moment the exam chunk loaded — and a lazy chunk's CSS stays
     loaded (CLAUDE.md, the `.rr` note).

     So the delivered file is committed unedited at docs/launch/code/ and this
     produces the scoped copy, the same way the other four handed-over sheets
     are handled. `git diff` on the delivered file shows it added, not edited,
     and the rules exist in exactly one place in src/ — which is what R1's
     check actually asks for.

     `:root[data-screen="exam"]` blocks pass through untouched: they are token
     declarations already scoped by the attribute, and prefixing them would
     stop them reaching <html>. */
  { root: ".examport", out: "src/components/module/exam-port.css",
    from: "docs/launch/code/17-exam-result-leaderboard.css (the exam pack, as delivered)",
    src: [() => PACK("17-exam-result-leaderboard.css")], keepRoot: /^:root\[data-screen="exam"\]/,
    /* The exam pack declares its own tokens in its `:root[data-screen="exam"]`
       block, so it needs none of the reference builds' aliases — and must not
       have their 15px/1.55 type scale, which is not this design's. Two names
       it reads and this app spells differently, and nothing else. */
    vars: `ROOT{ --font: var(--font-ui); --font-mono: var(--font-mono); }\n` },

  /* THE QUIZ STAMPS SHEET (2026-09-23). Its own header says it "sits ON TOP
     of the module/Library stylesheet" and introduces no token, so it takes
     the same aliases the module bundle does — and its own scope, because the
     board it draws is shown inside the exam screen, which is not `.ref-mod`.
     `.res`, `.br`, `.fin` and `.note` are bare names this app renders
     elsewhere (`.note` alone is in the lesson and the Ready Room), which is
     the same reason every other handed-over sheet is scoped. */
  { root: ".qstamps", out: "src/components/module/quiz-stamps.css",
    from: "docs/launch/code/19-quiz-stamps.css (the quiz-stamps pack, as delivered)",
    src: [() => PACK("19-quiz-stamps.css")] },

  /* THE MODULE SCREEN'S PORT (2026-10-07), from the second handoff. Its §4 is
     explicit about the method and it is NOT the method the first port used:
     "Prefix EVERY selector of the demo stylesheet with `.wm-port`" and "the DOM
     nesting must be exactly `.row > .head(button) + .crew + .drawer > …`". The
     first port RENAMED every class to `.lb-*` so the sheet could sit under
     `.ref-mod`; this one keeps the demo's own names so the markup can be
     copied from the demo line for line, and leans on the prefix to stop the
     sheet escaping. 125 class names, most of them bare words this app already
     paints — `.card`, `.row`, `.head`, `.title`, `.tab`, `.search`, `.btn`,
     `.sheet`, `.face`, `.top`, `.list`, `.more` — so the prefix is doing real
     work in both directions.

     Generated rather than hand-edited, so the sheet and the approved demo
     cannot drift: `npm run ref:css`. */
  /* THE ROOT IS `.app .wm-port`, NOT `.wm-port`, and the extra class is
     load-bearing. §4.2 says to prefix with `.wm-port `, which gives every rule
     (0,2,0) — and this port renders INSIDE two of the app's own scoped designs
     (`.mscreen` from module.css and `.ref-mod` from the reference build), both
     of which style the same bare words at exactly (0,2,0). A tie is decided by
     load order, so the port lost: measured on the way in, `.mscreen .route`
     beat `.wm-port .route` and the ten waypoints stacked into a 483px column
     instead of a 62px strip. One more class puts every rule at (0,3,0), above
     both, and `check:port` then asserts the result rather than trusting it. */
  { root: ".app .wm-port", out: "src/components/module/library/port.css",
    from: "reference/06-library-lessons-cards.html (its whole style block)",
    src: [() => REF("06-library-lessons-cards.html")],
    cuts: PORT_CUTS,
    vars: PORT_VARS },

  { root: ".ref-lic", out: "src/components/licence/ref-licence.css",
    from: "01-tokens-and-base.css + 02-licence-card.css + 03-stamp-creator.css + 04-account-and-preferences.css",
    src: [() => PACK("01-tokens-and-base.css"), () => PACK("02-licence-card.css"),
          () => PACK("03-stamp-creator.css"), () => PACK("04-account-and-preferences.css")] },
];

/* The nine the app does not emit. Values are the reference's own where it has
   one, and the app's token where the app has the same idea under another
   name. This is the adaptation layer — the only lines here that are not the
   reference's, and they set no layout. */
const VARS = `/* GENERATED by scripts/scope-ref-css.mjs — do not edit. */
ROOT{
  /* The app's accent, under the reference's name. */
  --accent: var(--active);
  --accent-soft: color-mix(in oklab, var(--active) 14%, transparent);
  /* The reference's hairline is its --line at 55%; the app emits only --line. */
  --hair: color-mix(in srgb, var(--line) 58%, transparent);
  /* Faces are reached through tokens and never named (CLAUDE.md). */
  --sans: var(--font-ui);
  --mono: var(--font-mono);
  /* THE ONE LINE PUT BACK FROM THE CUT RESET. The reference's own
     body font -- 15px over a 1.55 line -- went with the global reset
     above, because a scoped body selector paints
     nothing — but the type scale is the screen's, not the page's. Without it
     these sheets inherited the app's 14px/1.62 and every line box was a
     fraction taller: measured on the licence card, the bio ran 27px against
     26, the phrase 33 against 32, and the card finished 4px too tall. */
  font: 15px/1.55 var(--font-ui);
  /* The reference's own literals for the ones it defines outright. */
  --r: 13px;
  --wrap: 1010px;
  --video: oklch(.16 .02 255);
  --glow: none;
}
/* AND THE BUTTON RESET, WHICH IS THE SCREEN'S AND NOT THE PAGE'S.
   The cut above takes the whole global reset because a scoped * is still
   every element on the screen. But the reference's button line is the one
   part of it that belongs to these components: they set their own padding
   and their own border per class and assume nothing underneath. Without it
   the app's own button chrome showed through -- measured on the licence
   card, a 2px border round the Cover pill and 1px round the stamp ghost,
   which is 4px of width and 4px of height on two controls that the design
   draws with no border at all. Scoped to the root class, it can only reach
   buttons on this screen, which are the reference's own. */
ROOT button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
`;

function scopeOne(bundle) {
  let source = bundle.src.map((read) => read()).join("\n");
  const cut = [];
  for (const c of (bundle.cuts || CUTS)) {
    c.find.lastIndex = 0;
    if (c.find.test(source)) {
      c.find.lastIndex = 0;
      source = source.replace(c.find, "\n");
      cut.push(c.why);
    }
    if (c.guard.test(source)) {
      console.error(`REFUSING (${bundle.out}): ${c.why} — still there in a shape this does not recognise.`);
      process.exit(1);
    }
  }

  /* Comments out first, back in last: a comma inside prose was being read as
     a selector separator and the prefix landed mid-sentence. */
  const comments = [];
  const masked = source.replace(/\/\*[\s\S]*?\*\//g, (m) => {
    comments.push(m);
    return `${MARK}${comments.length - 1}__`;
  });

  const scopeSelector = (sel) => sel.split(",").map((one) => {
    const bare = one.replace(new RegExp(`${MARK}\\d+__`, "g"), "").trim();
    if (!bare) return one;
    /* A bundle may name selectors that must stay at the root — the exam
       pack's token blocks are `:root[data-screen="exam"]`, which is already
       scoped by the attribute and would stop reaching <html> if prefixed. */
    if (bundle.keepRoot && bundle.keepRoot.test(bare)) return one;
    if (bare.startsWith(bundle.root)) return one;
    if (/^(from|to|[\d.]+%)$/.test(bare)) return one;   // a keyframe step
    if (bare.startsWith("@")) return one;               // an at-rule prelude
    let at = 0;
    const re = new RegExp(`${MARK}\\d+__`, "g");
    let m;
    while ((m = re.exec(one)) !== null) at = m.index + m[0].length;
    while (at < one.length && /\s/.test(one[at])) at += 1;
    return `${one.slice(0, at)}${bundle.root} ${one.slice(at)}`;
  }).join(",");

  let out = "";
  let buffer = "";
  let depth = 0;
  let inAt = 0;
  for (const ch of masked) {
    if (ch === "{") {
      const prelude = buffer.trim();
      /* Inside @media / @supports the next prelude is a selector again; inside
         @keyframes it is a step and must not be touched. */
      if (depth === 0 && /@(media|supports|container)/.test(prelude)) {
        out += `${buffer}{`; inAt = 1;
      } else if (depth === 0 && /@keyframes/.test(prelude)) {
        out += `${buffer}{`; inAt = -1;
      } else if (inAt === -1 && depth === 1) {
        out += `${buffer}{`;
      } else {
        out += `${scopeSelector(buffer)}{`;
      }
      buffer = ""; depth += 1;
    } else if (ch === "}") {
      out += `${buffer}}`; buffer = ""; depth -= 1;
      if (depth === 0) inAt = 0;
    } else buffer += ch;
  }
  out += buffer;

  const text = out.replace(new RegExp(`${MARK}(\\d+)__`, "g"), (_, i) => comments[+i]);
  const head = `/* GENERATED by scripts/scope-ref-css.mjs from ${bundle.from}.
   DO NOT EDIT. Every selector is prefixed with ${bundle.root} so the sheet
   cannot escape its screen; nothing is renamed and no value is changed.
   Cut on the way in:
${cut.map((c) => `     . ${c}`).join("\n")}
   Re-generate with: npm run ref:css */
`;

  writeFileSync(join(ROOT, bundle.out),
    head + (bundle.vars ?? VARS).replaceAll("ROOT", bundle.root) + text.replace(/\n{3,}/g, "\n\n"));
  console.log(`wrote ${bundle.out}  (${text.split("\n").length} lines, ${cut.length} cuts)`);
}

for (const b of BUNDLES) scopeOne(b);
