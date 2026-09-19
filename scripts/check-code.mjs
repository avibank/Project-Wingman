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
  /* The whole reason this alphabet is not A-Z0-9. A code is read back off a
     card, a slide or a photograph, and O/0 and I/1/L are the pairs that get
     read back wrong. Dropping them costs 5 characters and buys the code its
     one job. */
  for (const c of "O0I1L") {
    ok(`${c} is not in the alphabet`, !CODE_ALPHABET.includes(c));
  }
  ok("everything else is", CODE_ALPHABET.length === 31, String(CODE_ALPHABET.length));
  ok("which is 29,791 codes", CODE_SPACE === 29791, String(CODE_SPACE));
  ok("uppercase only", CODE_ALPHABET === CODE_ALPHABET.toUpperCase());
}

console.log("\nreading what somebody typed");
{
  ok("lowercase is lifted", normaliseCode("a7k") === "A7K");
  ok("punctuation and spaces are dropped, not refused", normaliseCode(" a-7 k ") === "A7K");
  ok("it never runs past three", normaliseCode("ABCDEF") === "ABC");
  ok("confusables leave nothing behind", normaliseCode("O0IL1") === "");
  ok("a short code is not a code", !isCode("A7") && !isCode("") && isCode("A7K"));
  ok("and it can say which characters it refused",
     refusedCharacters("A0O").join("") === "0O", refusedCharacters("A0O").join(""));
}

console.log("\nsuggestions");
{
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randomCode());
  ok("every suggestion is a valid code", [...seen].every(isCode));
  ok("and they are not all the same one", seen.size > 400, `${seen.size} of 500`);
}

console.log("\nuniqueness is the database's job, not the client's");
{
  const sql = read("supabase/migrations/0016_pilot_code.sql");
  ok("a unique index, so two people cannot hold one code",
     /create unique index if not exists pilot_profiles_code_key/.test(sql));
  ok("the shape is a CHECK, with the same alphabet",
     /check \(code is null or code ~ '\^\[23456789ABCDEFGHJKMNPQRSTUVWXYZ\]\{3\}\$'\)/.test(sql));
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
  const ff = read("src/components/FirstFlight.jsx");
  ok("signup asks for one", /Your code/.test(ff) && /claimCode\(/.test(ff));
  ok("and will not go on without a valid one", /disabled=\{busy \|\| !isCode\(code\)\}/.test(ff));
  ok("a suggestion is waiting, so the required field starts satisfied",
     /freeCode\(\)\.then/.test(ff));
  ok("a code taken a second ago keeps you on the screen with another",
     /has just been taken/.test(ff));

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
  ok("and opens on it", /code: cleanCode\(code\)/.test(read("src/components/licence/StampCreator.jsx")));
  ok("an account from before this gets one on sight", /claimCode\(user\.id, await freeCode\(\)\)/.test(profile));

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
