/* THE THREE-CHARACTER CODE.
 *
 * It is an identity people say out loud and read off a photograph, and it is
 * unique — so the two things worth checking are the alphabet and the claim.
 *
 * Run: npm run check:code
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  CODE_ALPHABET, CODE_LENGTH, CODE_SPACE,
  normaliseCode, isCode, randomCode, refusedCharacters,
} from "../src/lib/code.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(name); console.log(`  FAIL ${name}  ${detail}`); }
};

console.log("\nthe alphabet");
{
  ok("three characters", CODE_LENGTH === 3);
  /* ANY LETTER, ANY DIGIT (owner, 2026-09-21). This used to assert that O, 0,
     I, 1 and L were NOT in the alphabet, so a code read off a photograph could
     not be misread. They were dropped as they were typed, and a student typing
     "A10" watched two characters vanish and read the field as letters only.
     The reading-back argument survives in the suggestions, below: nobody is
     HANDED an ambiguous code, and anybody may CHOOSE one. */
  for (const c of "O0I1L") {
    ok(`${c} can be typed`, CODE_ALPHABET.includes(c));
  }
  ok("all twenty-six letters and ten digits", CODE_ALPHABET.length === 36, String(CODE_ALPHABET.length));
  ok("which is 46,656 codes", CODE_SPACE === 46656, String(CODE_SPACE));
  ok("uppercase only", CODE_ALPHABET === CODE_ALPHABET.toUpperCase());
}

console.log("\nreading what somebody typed");
{
  ok("lowercase is lifted", normaliseCode("a7k") === "A7K");
  ok("a mix of digits and letters is kept whole", normaliseCode("a10") === "A10");
  ok("punctuation and spaces are dropped, not refused", normaliseCode(" a-7 k ") === "A7K");
  ok("it never runs past three", normaliseCode("ABCDEF") === "ABC");
  ok("a short code is not a code", !isCode("A7") && !isCode("") && isCode("A7K") && isCode("A10"));
  ok("and it can say which characters it refused",
     refusedCharacters("A#0").join("") === "#", refusedCharacters("A#0").join(""));
}

console.log("\nsuggestions");
{
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randomCode());
  ok("every suggestion is a valid code", [...seen].every(isCode));
  ok("and none is one you could misread", [...seen].every((c) => !/[O0I1L]/.test(c)));
  ok("and they are not all the same one", seen.size > 400, `${seen.size} of 500`);
}

console.log("\nuniqueness is the database's job, not the client's");
{
  const sql = read("supabase/migrations/0016_pilot_code.sql");
  ok("a unique index, so two people cannot hold one code",
     /create unique index if not exists pilot_profiles_code_key/.test(sql));
  const sql35 = read("supabase/migrations/0035_the_code_is_the_stamp.sql");
  ok("the shape is a CHECK, with the same alphabet",
     /check \(code is null or code ~ '\^\[A-Z0-9\]\{3\}\$'\)/.test(sql35));
  /* 0035 — THE CODE IS THE STAMP. One statement claims the code and issues
     the stamp around it, so the two can never differ, and after that the code
     is as permanent as the stamp. */
  ok("the code and the stamp are issued in one statement",
     /create or replace function issue_licence/.test(sql35)
     && /code = want,\s*\n\s*stamp_code = want/.test(sql35));
  ok("and an issued code cannot be moved",
     /p\.stamp_issued_at is not null\s*\n\s*and p\.code is distinct from want/.test(sql35)
     && /or new\.code\s+is distinct from old\.code/.test(sql35));
  ok("the column is nullable, so accounts that predate it still work",
     !/add column if not exists code text not null/i.test(sql));

  /* The race this exists to lose safely. Checking then writing from the client
     leaves a gap two people signing up together will walk through at the same
     moment, and signup is exactly when everybody arrives at once. */
  ok("claiming is one statement, not a check and then a write",
     /create or replace function claim_code/.test(sql)
     && /when unique_violation then return null/.test(sql));

  const lib = read("src/lib/squadron.js");
  ok("and the client goes through it rather than upserting a code",
     /rpc\("claim_code"/.test(lib)
     && !/upsert\(\{ user_id: userId, code/.test(lib));
}

console.log("\nwhere it shows");
{
  /* THE CREATOR ASKS FOR IT NOW, NOT SIGNUP. First Flight had a code field of
     its own; the code is chosen in the stamp creator and issued with the stamp
     (owner, 2026-09-21), so these four are the same four facts, where the code
     now lives. */
  const sc = read("src/components/licence/StampCreator.jsx");
  ok("the stamp creator asks for one, and issues it with the stamp",
     /Your code, three letters or numbers/.test(sc) && /issueLicence\(/.test(sc));
  ok("and will not issue without a valid one", /if \(!isCode\(draft\.code\)\)/.test(sc));
  ok("a suggestion is waiting, so the required field starts satisfied",
     /freeCode\(\)\.then/.test(sc));
  ok("a code taken a second ago keeps you in the creator with another",
     /is already somebody's code/.test(sc) && /if \(taken\)/.test(sc));

  const profile = read("src/components/Profile.jsx");
  /* THE LICENCE NO LONGER SHOWS IT IN A BOX OF ITS OWN. This used to assert
     that it did. §2 of the handoff: "The YOUR CODE box is still a separate
     card. Delete it. The code is chosen inside the creator." So the assertion
     is now the opposite one, plus the thing that makes deleting the box safe —
     the creator opens on the code the account already has, rather than asking
     a pilot to type it again from memory. */
  ok("no box of its own on the licence", !/codeblock/.test(profile));
  /* AND THE PLACEHOLDER IS GONE FROM THE CODEBASE. §2: "Grep the codebase for
     the placeholder and remove every hit." It was three letters on every row on the
     live site, and then it was three letters in the comments that explained
     why it was not on the live site any more. The launch pack's own files and
     the bug tracker are the handover and are left alone; what is asserted here
     is everything this repo writes. */
  {
    /* Split so this file is not its own first hit. */
    const PLACEHOLDER = new RegExp("\\bT" + "ST\\b");
    const hits = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) { if (!/node_modules|dist|ref-diff-out/.test(e.name)) walk(f); continue; }
      if (!/\.(m?js|jsx|css|sql|md|json)$/.test(e.name)) continue;
      if (PLACEHOLDER.test(readFileSync(f, "utf8"))) hits.push(f);
    }};
    for (const d of ["src", "scripts", "tests", "tools", "supabase"]) walk(d);
    ok("and the placeholder is nowhere in the codebase", hits.length === 0, hits.join(", "));
  }
  ok("the creator is handed it", /<StampCreator userId=\{user\?\.id\} code=\{code\}/.test(profile));
  ok("and opens on it", /code: normaliseCode\(code\)/.test(sc));
  /* This used to assert the opposite: an account without a code was handed a
     random one the first time it opened the licence. Claimed then, a code
     could differ from the stamp typed a minute later. It is claimed with the
     stamp now, and nowhere else. */
  ok("the licence no longer claims one on sight", !/claimCode\(/.test(profile));

  /* THE LESSON ROW DRAWS A STAMP NOW, NOT THE CODE. It used to put the three
     characters in a bordered box, the same three on every row — and §4 of the
     launch handoff makes inspStamp the one renderer wherever a sign-off
     appears. The code is still what the stamp CENTRES on, so it has not left
     the row; it is drawn rather than spelled. These two assertions are the
     same two facts, against the design that replaced it. */
  const row = read("src/components/module/RouteTab.jsx");
  ok("a finished lesson carries the pilot's drawn stamp",
     /<Stamp stamp=\{stamp\}/.test(row) && /size=\{46\}/.test(row));
  /* The angle is the ANGLE THAT SIGN-OFF WAS MADE AT, stored beside the flag
     when the button was pressed (signoff.js), because it is a fact about that
     press rather than a function of anything. A derived one is the fallback,
     for every lesson signed off before the key existed — drop it and those
     stamps all snap square on the same render. */
  ok("and it sits at that sign-off's own angle rather than square",
     /rot=\{tilts\?\.\[lesson\.id\] \?\? stampTilt\(/.test(row));
  ok("an account with no stamp of its own still gets one",
     /stamp \? "Your stamp" : "Finished"/.test(row)
     && /HOUSE_STAMP/.test(read("src/components/Stamp.jsx")));
}

console.log(`\ncode: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
