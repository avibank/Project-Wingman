/* =============================================================================
   THE REFERENCE BUILDS, ONE PAGE PER SCREEN, under public/__ref/.
   -----------------------------------------------------------------------------
   tools/ref-diff.mjs photographs a reference page and the live screen and
   diffs them. The two reference builds are single files carrying six screens
   between them behind a demo bar, so each page here is the WHOLE reference
   file — byte for byte, nothing retyped — plus two things appended:

     · a rule hiding the demo bar, which is not part of any screen
     · a boot script that lands on that screen and puts the data-ref attribute
       on the element to compare

   GENERATED, NOT HAND-COPIED. A hand-split page drifts from the reference the
   first time the reference is re-sent, silently, and the diff then measures
   the copy rather than the design. Re-run this after any drop:

       node tools/make-ref-pages.mjs

   DEV ONLY. vite.config.js excludes public/__ref from the production build —
   see the plugin there — so none of it is ever served to a student.
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const REF = (n) => readFileSync(new URL(`../docs/launch/reference/${n}`, import.meta.url), "utf8");
const MODULE_REF = REF("01-module-lesson-crew.html");
const LICENCE_REF = REF("02-licence-stamp-creator.html");

/* Each page: which reference it comes from, and what to run once it has. The
   boot runs after the reference's own inline script, because it is appended
   after it. */
const PAGES = {
  "module.html": [MODULE_REF, `
    go('mod');
    mark('#v-mod .card', 'module-panel');`],

  "library.html": [MODULE_REF, `
    go('mod');
    document.querySelector('[data-mt="library"]').click();
    mark('#v-mod .card', 'module-panel');`],

  "crew.html": [MODULE_REF, `
    go('mod');
    document.querySelector('[data-mt="crew"]').click();
    mark('#v-mod .card', 'module-panel');`],

  /* The same screen with nobody on it. The demo bar's own control empties the
     people list and re-renders, which is how the reference shows it. */
  "crew-empty.html": [MODULE_REF, `
    go('mod');
    document.querySelector('#crewEmpty').click();
    mark('#v-mod .card', 'module-panel');`],

  "lesson.html": [MODULE_REF, `
    go('lesson');
    mark('#v-lesson .lesson', 'lesson');`],

  "licence.html": [LICENCE_REF, `
    mark('#myCard .lic', 'licence-card');`],

  "preferences.html": [LICENCE_REF, `
    document.querySelector('[data-t="pref"]').click();
    mark('#t-pref', 'preferences');`],
};

/* THE APP'S PAGE GUTTER, PUT ON THE REFERENCE PAGE.
   ---------------------------------------------------------------------------
   The reference is a standalone HTML file: `.wrap` has 20px of padding and
   nothing outside it. The app has a chrome — .deck 40px (16 on a phone) and
   .content 22px — on EVERY route, shared by the Flight Deck, the module
   screen, the reader and the Ready Room. Measured at 640px, where .deck
   changes: 62px a side above it, 38px at and below.

   So at 768 the app's column is 644 and the reference's is 680, and at 390
   they are 314 and 350. ref-diff refuses any pair whose widths differ, which
   would have made every screen fail at two of its three widths for a reason
   that has nothing to do with the screen.

   Matching it the other way round — narrowing the app to 20px — would move
   every other screen in the app to fit a demo file's margins. So the gutter
   is put here instead, and what the diff then measures is the SCREEN: the
   same column width on both sides, and everything inside it is the design's
   to be right or wrong about. The one thing this cannot catch is the gutter
   itself, which is why it is written down here rather than folded in
   silently. See docs/launch/DECISIONS.md. */
const GUTTER = `
<style>
  .wrap{padding-inline:62px}
  @media (max-width:640px){.wrap{padding-inline:38px}}
</style>`;

const BOOT = (body) => `
<style>
  /* The demo bar is not part of any screen. */
  .demo{display:none!important}
  /* Neither is a MOVED HERE sticker. The .new class is the reference telling the
     implementer that Fly solo and Your bar have changed tab — a note to a
     reader of the demo, not product copy, and putting it on the live screen
     would ship a label that means nothing to a student. Hidden rather than
     ignored, so the two sides measure the same screen; it costs 2px on the
     Your bar heading's line box, which is where it sat. */
  .new{display:none!important}
</style>${GUTTER}
<script>
  /* DARK, EXPLICITLY. The reference follows prefers-color-scheme, and a
     headless browser reports light — while the app under test is pinned to
     Sky NIGHT by ?fixture=demo, because that is the palette the two share.
     The reference's own [data-theme="dark"] block carries those exact values,
     so this is the reference choosing its own dark, not a value from here. */
  document.documentElement.dataset.theme = 'dark';
  /* The reference paints some of these screens from its own script on a tick,
     so the attribute is set once the element exists rather than immediately. */
  /* SNAP THE MARKED ELEMENT TO A WHOLE PIXEL, and nothing else.
     Playwright clips an element screenshot to its bounding box. Where that
     box starts on a fraction, every glyph inside it rasterises half a device
     pixel away from the same glyph on the other side, and the diff reports
     a screen that is identical as several per cent different: measured on
     the licence card at 390, every child matched the app to within 0.1px
     while the picture came out 3.69% apart, because the reference page put
     the card at y=306.55 and the app put it at y=362.00.

     A margin moves the box. It does not change the box, so nothing inside
     it moves relative to anything else and a real one-pixel difference
     still shows as one. It runs on the reference page only, which exists
     to be photographed. */
  function snap(el) {
    /* The page is pushed down, not the element. A transform on the element
       was tried and worked, but it also promotes it to its own composited
       layer, and the cover's contour drawing then resampled a fraction of a
       pixel off across the whole banner. Padding on an ancestor moves the
       element through ordinary layout and paints it exactly as before.
       A top margin on the element itself was tried first and does nothing:
       inside a padded box it collapses. */
    const page = document.querySelector('.wrap') || document.body;
    const base = parseFloat(getComputedStyle(page).paddingTop) || 0;
    const run = () => {
      page.style.paddingTop = base + 'px';
      const top = el.getBoundingClientRect().top;
      const over = top - Math.floor(top);
      /* Always DOWN to the next whole pixel, never up: a negative padding is
         invalid and is dropped silently, which is how this ran for three
         screens doing nothing at two widths out of three. */
      if (over) page.style.paddingTop = (base + (1 - over)) + 'px';
    };
    /* After the webfonts land, because they move everything above it, and
       once more a beat later for anything the reference draws on a tick. */
    run();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
    setTimeout(run, 400);
  }
  function mark(sel, name) {
    const at = Date.now();
    (function tick() {
      const el = document.querySelector(sel);
      if (el) { el.setAttribute('data-ref', name); snap(el); return; }
      if (Date.now() - at < 4000) requestAnimationFrame(tick);
      else console.error('ref page: never found ' + sel);
    })();
  }
  try { ${body}
  } catch (e) { console.error('ref page boot failed:', e); }
</script>
`;

const dir = new URL("../public/__ref/", import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const [name, [src, boot]] of Object.entries(PAGES)) {
  writeFileSync(new URL(name, dir), src + BOOT(boot));
  console.log("wrote public/__ref/" + name);
}
