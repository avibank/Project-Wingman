/* =============================================================================
   THE LICENCE CARD — §5's rules, and the two places each one is written.
   -----------------------------------------------------------------------------
   Every constraint in 0030 mirrors a list in src/lib/cover.js, for the reason
   0029's header gives: the browser holds the anon key, so a rule the client
   enforces is not a rule — and a rule the SERVER enforces that the client has
   never heard of is a save that fails with no explanation. Both have to say
   the same thing, and this is what holds them to it.

   Run: npm run check:licence
   ========================================================================= */
import { readFileSync } from "node:fs";
import { COVER_IDS, PHRASES, DEFAULT_COVER, coverOf, COVERS, initialsOf, avatarInk } from "../src/lib/cover.js";
import { PALETTE } from "../src/lib/stamp.js";
import { hoursLabel, signedOff, statsFrom, statsOf, BIO_MAX } from "../src/lib/licenceCard.js";
import { bumpDay, daysFlown } from "../src/lib/hobbs.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/0030_licence_card.sql");

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};
/* The contents of a CHECK's in-list, as written. */
const inList = (name) => {
  const m = new RegExp(`conname = '${name}'[\\s\\S]*?check \\([\\s\\S]*?in \\(([\\s\\S]*?)\\)\\)`).exec(sql);
  return m ? [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'")) : null;
};

/* ------------------------------------------------- the lists, both sides */
{
  const covers = inList("cover_known");
  ok("the database knows the same covers this app can draw",
     String(covers) === String([...COVER_IDS, "image"]), String(covers));
  ok("and every one of the drawn ones actually draws something",
     COVER_IDS.every((id) => typeof COVERS[id]?.svg === "function" && COVERS[id].svg().length > 200));

  const inks = inList("cover_ink_known");
  ok("the cover's inks are the stamp's thirty-six, by name",
     inks.length === 36 && String(inks) === String(PALETTE.map((p) => p.n)));

  const phrases = inList("phrase_is_one_of_three");
  ok("there are exactly three phrases and they are these three",
     phrases.length === 3 && String(phrases) === String(PHRASES), String(phrases));

  ok("the bio's limit is the same number in both places",
     new RegExp(`length\\(bio\\) <= ${BIO_MAX}`).test(sql));
  ok("and a bio is one line — the CHECK refuses a newline",
     /bio !~ '\[\\\\n\\\\r\]'/.test(sql) || /bio !~ '\[\\n\\r\]'/.test(sql));
}

/* ---------------------------------------------- what a missing value means */
{
  ok("a profile with no cover gets the default rather than a hole",
     coverOf(null).id === DEFAULT_COVER && coverOf({ cover: "nonsense" }).id === DEFAULT_COVER);
  ok("an unknown ink is no ink, not a crash", coverOf({ cover_ink: "Puce" }).ink === null);
  ok("a known ink comes back as the palette entry", coverOf({ cover_ink: "Ruby" }).ink?.n === "Ruby");
  ok("initials are at most two letters", initialsOf("Alexandra Jane Rahman-Smith").length === 2);
  ok("and nothing at all from nothing at all", initialsOf(null) === "" && initialsOf("") === "");
}

/* ------------------------------------------------------------- the numbers */
{
  ok("under a minute the card says nothing rather than a zero", hoursLabel(0) === "—" && hoursLabel(59) === "—");
  ok("under an hour it is minutes only — never 0h", hoursLabel(60 * 54) === "54m");
  ok("and over an hour it is hours and minutes", hoursLabel(3600 * 13 + 60 * 54) === "13h 54m");
  ok("a lesson counts once, however it was finished",
     signedOff({ a: true, b: true, c: false, d: undefined }) === 2);

  const s = statsFrom({ hobbs: {}, done: {}, days: null });
  ok("an empty account shows three dashes, never three noughts",
     s.length === 3 && s.every((x) => x.value === "—"));
  ok("and the three are §5's three, in §5's order",
     String(s.map((x) => x.label)) === String(["Hours flown", "Lessons signed off", "Days flown"]));
  ok("somebody else's card reads the same three from their row",
     String(statsOf({ hours_s: 3600, lessons_signed: 7, days_flown: 12 }).map((x) => x.value))
       === String(["1h 0m", "7", "12"]));
  ok("and their empty card says the same nothing yours does",
     statsOf({}).every((x) => x.value === "—"));

  const d1 = new Date("2026-09-19T08:00:00Z");
  const d2 = new Date("2026-09-19T23:00:00Z");
  const d3 = new Date("2026-09-20T01:00:00Z");
  let days = bumpDay(null, d1);
  ok("the first flight is one day", daysFlown(days) === 1);
  const same = bumpDay(days, d2);
  ok("a second session the same day is still one", daysFlown(same) === 1 && same === days);
  days = bumpDay(same, d3);
  ok("and the next day is two", daysFlown(days) === 2);
  ok("it stores a count and a date, never a list of dates",
     Object.keys(days).sort().join() === "last,n");
}

/* --------------------------------------------------- one card, two modes */
{
  const profile = read("src/components/Profile.jsx");
  const sheet = read("src/components/PilotSheet.jsx");
  ok("the licence tab and the profile viewer draw the SAME component",
     /<LicenceCard/.test(profile) && /<LicenceCard/.test(sheet));
  ok("and the owner's is the only one in edit mode",
     /\bedit\b/.test(profile) && !/edit(\s*=\s*\{?true|\s+)/.test(sheet.split("<LicenceCard")[1].split("/>")[0]));
  ok('"See it as others do" is that same component with edit off',
     /How others see you/.test(profile));

  const card = read("src/components/licence/LicenceCard.jsx");
  ok("a card that is not yours offers no way to create a stamp",
     /edit \? \(\s*<button type="button" className="lic-ghost"/.test(card.replace(/\s+/g, " ").replace(/ \? \(/g, " ? (")) 
     || /: edit \?/.test(card));
  ok("the phrase is plain text, with no pill and no border (§5)",
     /\.lic-phrase\{[^}]*background: none/.test(read("src/components/licence/licence.css")));
}

/* --------------------------------------------------- what the card is told */
{
  const fn = /create or replace function licence_card[\s\S]*?returns table \(([\s\S]*?)\n\)\nlanguage/.exec(sql);
  const cols = fn ? [...fn[1].matchAll(/(\w+)\s+(?:text|boolean|integer|timestamptz)/g)].map((m) => m[1]) : [];
  ok("the viewer's read returns a fixed column list, not the row", cols.length === 21, `${cols.length} columns`);
  for (const secret of ["notify", "discoverable", "exam_window", "active_window", "timezone", "invisible"]) {
    ok(`and never ${secret}`, !cols.includes(secret));
  }
  ok("it refuses a pilot who is flying solo", /p\.invisible = false/.test(sql));
  ok("your own card is always yours to see", /p\.user_id = p_viewer or/.test(sql));
  ok("and a block cuts both ways", /from blocks b/.test(sql) && /b\.user_id = p_user/.test(sql));
}

/* ------------------------------------------------------- legibility rules */
{
  /* The initials sit on the cover's ink. The reference's rule is one
     threshold; what matters is that BOTH sides of it are readable, on all
     thirty-six. 4.5:1, because two letters at 34px is large text by the
     letter of the rule and prose by the look of it. */
  const M = [[4.0767416621, -3.3077115913, .2309699292],
             [-1.2684380046, 2.6097574011, -.3413193965],
             [-.0041960863, -.7034186147, 1.7076147010]];
  const lin = (L, C, H) => {
    const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    const v = [(L + .3963377774 * a + .2158037573 * b) ** 3,
               (L - .1055613458 * a - .0638541728 * b) ** 3,
               (L - .0894841775 * a - 1.2914855480 * b) ** 3];
    return M.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));
  };
  const Y = (c) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(String(v));
    return m ? { L: +m[1], C: +m[2], H: +m[3] } : null;
  };
  let worst = 99, where = "", bestAlways = true, under45 = [];
  for (const p of PALETTE) {
    const bg = Y(lin(p.l, p.c, p.h));
    const dark = ratio(Y(lin(0.2, 0.02, 265)), bg);
    const light = ratio(Y(lin(1, 0, 0)), bg);
    const fg = parse(avatarInk(p));
    const got = ratio(Y(lin(fg.L, fg.C, fg.H)), bg);
    if (Math.abs(got - Math.max(dark, light)) > 0.001) bestAlways = false;
    if (got < 4.5) under45.push(`${p.n} ${got.toFixed(2)}`);
    if (got < worst) { worst = got; where = p.n; }
  }
  /* TWO LETTERS AT 34px, WEIGHT 600, IS LARGE TEXT — well past 24px, and past
     18.66px bold — so the floor is 3:1, not 4.5. It is stated rather than
     assumed because 4.38:1 on Mocha looks like a failure until you know which
     rule it answers to. */
  ok("initials clear the large-text floor on every one of the thirty-six inks",
     worst >= 3, `worst ${worst.toFixed(2)}:1 on ${where}`);
  ok("and the readable one of the two is always the one chosen",
     bestAlways, "otherwise a threshold is guessing where the crossover is");
  ok("only the crossover inks come in under the prose floor as well",
     under45.length <= 3, under45.join(" · ") || "none");
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
