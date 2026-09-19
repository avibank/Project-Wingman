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

const BOOT = (body) => `
<style>.demo{display:none!important}</style>
<script>
  /* DARK, EXPLICITLY. The reference follows prefers-color-scheme, and a
     headless browser reports light — while the app under test is pinned to
     Sky NIGHT by ?fixture=demo, because that is the palette the two share.
     The reference's own [data-theme="dark"] block carries those exact values,
     so this is the reference choosing its own dark, not a value from here. */
  document.documentElement.dataset.theme = 'dark';
  /* The reference paints some of these screens from its own script on a tick,
     so the attribute is set once the element exists rather than immediately. */
  function mark(sel, name) {
    const at = Date.now();
    (function tick() {
      const el = document.querySelector(sel);
      if (el) { el.setAttribute('data-ref', name); return; }
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
