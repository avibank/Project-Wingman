/* =============================================================================
   THE ONE-TIME NOTICE.
   -----------------------------------------------------------------------------
   `lib/notice.js` is a plain module so this can drive it for real rather than
   grep the JSX for it — the same split quiz.js, cardSession.js and
   studioModel.js already make between a rule and the screen that draws it.

   Run: npm run check:notice
   ========================================================================= */
import { readFileSync } from "node:fs";
import { NOTICE, NOTICE_KEY, noticeFor } from "../src/lib/notice.js";

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${group} · ${what}`); return; }
  fails.push(`${group} · ${what}`);
  console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("\nonce, and then never again");
ok("rule", "an account that has never dismissed one sees it",
  noticeFor(null) === NOTICE && noticeFor(undefined) === NOTICE);
ok("rule", "an account that dismissed THIS one does not",
  noticeFor(NOTICE.id) === null);
ok("rule", "an account that dismissed an EARLIER one sees this one",
  noticeFor("some-older-notice") === NOTICE,
  "a stored id must be compared, not merely present");
/* The key is new. An older client that wrote something else here must not be
   able to suppress a notice by accident. */
ok("rule", "anything that is not a string counts as unseen",
  [true, 1, {}, [], 0].every((v) => noticeFor(v) === NOTICE));

console.log("\nwhich notice, not whether");
ok("shape", "the stored value is an id rather than a boolean",
  typeof NOTICE.id === "string" && NOTICE.id.length > 3);
ok("shape", "and it is the one the component writes back",
  /progress\.set\(NOTICE_KEY, notice\.id\)/.test(read("src/components/module/ModuleNotice.jsx")));
ok("shape", "the notice says something in two parts, so the strip can quieten one",
  typeof NOTICE.lead === "string" && typeof NOTICE.rest === "string"
  && NOTICE.lead.trim() !== "" && NOTICE.rest.trim() !== "");

console.log("\nper account, and on every branch that draws a module");
{
  const c = read("src/components/module/ModuleNotice.jsx");
  ok("where", "what has been seen is a PROGRESS key, not localStorage",
    c.includes("useUserProgress") && !/localStorage/.test(c)
    && NOTICE_KEY.startsWith("pw-"));
  ok("where", "nothing is drawn until the progress document has arrived",
    /if \(!progress\.loaded\) return null;/.test(c),
    "or it flashes at everybody who dismissed it long ago");
  const screen = read("src/components/module/ModuleScreen.jsx");
  const uses = (screen.match(/<ModuleNotice \/>/g) || []).length;
  /* ModuleScreen returns early for the ported screen and again for the app's
     own. A notice on one of them vanishes the day `library.batches` moves. */
  ok("where", "both branches of the module screen render it", uses === 2, `${uses} call sites`);
}

console.log("\nit asks for nothing and counts nothing");
{
  const c = read("src/components/module/ModuleNotice.jsx");
  ok("quiet", "it is a status, not a dialog — nothing is blocked",
    /role="status"/.test(c) && !/role="(dialog|alertdialog)"/.test(c));
  ok("quiet", "the dismiss control says what it does",
    /aria-label="Dismiss this notice"/.test(c));
  /* §12: every button has a 44px floor and `.is-inline` is the opt-out;
     app.css keeps a named list of the controls that take it and restore the
     TARGET with a pseudo-element. This one does that for itself. */
  ok("quiet", "the small control pays for its own opt-out",
    /is-inline/.test(c) && /--tap, 44px/.test(c));
  ok("quiet", "nothing in it renders a number",
    !/\{[^{}]*\.(length|size|count)[^{}]*\}/.test(c));
}

console.log(`\nnotice: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
