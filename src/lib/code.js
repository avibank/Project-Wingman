/* =============================================================================
   The code: one to three characters.
   -----------------------------------------------------------------------------
   Every student has one, and it IS their stamp: it is chosen in the stamp
   creator and issued with the stamp, in one statement (0035's issue_licence),
   and after that neither changes. It is meant to be said out loud and written
   down, so it is always upper case: nobody saying "a7k" means something
   different from "A7K".

   ONE TO THREE, not exactly three (owner, 2026-09-23: "the stamps are locked
   at three digits, it should be letters and numbers, a max of 3 a min of 1").
   Two students had already issued a stamp with a code they did not want,
   because three was the only length the field would accept. Three is still
   the ceiling and still what a suggestion is, so nothing about a code being
   short, sayable and unique has changed; what has gone is the floor. The
   server agrees in 0039 — the CHECK, claim_code and both arities of
   issue_licence all read `^[A-Z0-9]{1,3}$` — and a client that let somebody
   type a code the database would refuse would be the worse half of the bug.

   ANY LETTER, ANY DIGIT. This used to leave out 0, 1, O, I and L so that a
   code read off a photograph could not be misread, and it dropped them
   silently as they were typed. A student typing "A10" saw the 1 and the 0
   vanish and concluded the field took letters only (owner, 2026-09-21). So
   every character a student types is kept, and only the SUGGESTIONS avoid
   those five: nobody is handed an ambiguous code, but anybody may choose one.

   Pure, no imports: checkable without a browser or a database.
   ========================================================================= */

/** The most a code can be, and what a suggestion is. */
export const CODE_LENGTH = 3;
/** The least it can be. */
export const CODE_MIN = 1;
export const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/* What a suggestion is drawn from: everything except the pairs that get read
   back wrong. The same set 0016's suggest_code draws from on the server. */
export const SUGGEST_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/* Every code of every allowed length: 36 + 36² + 36³. */
export const CODE_SPACE = [...Array(CODE_LENGTH - CODE_MIN + 1)]
  .reduce((n, _, i) => n + CODE_ALPHABET.length ** (CODE_MIN + i), 0);

/* What a person typed, as a code. Lowercase is lifted, anything outside the
   alphabet is dropped rather than rejected — somebody typing "A-7-K" or "a7k "
   means A7K, and telling them off for it would be pedantry. */
export function normaliseCode(input) {
  return String(input ?? "")
    .toUpperCase()
    .split("")
    .filter((c) => CODE_ALPHABET.includes(c))
    .slice(0, CODE_LENGTH)
    .join("");
}

export const isCode = (input) => {
  const n = normaliseCode(input).length;
  return n >= CODE_MIN && n <= CODE_LENGTH;
};

/* A suggestion, so nobody has to invent one on the spot. The caller checks it
   is free and asks again if it is not. */
export function randomCode(rand = Math.random) {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += SUGGEST_ALPHABET[Math.floor(rand() * SUGGEST_ALPHABET.length)];
  }
  return out;
}

/* The characters this code is missing, for a field that says why it will not
   take what was typed. Empty when there is nothing to explain. */
export function refusedCharacters(input) {
  const bad = new Set();
  for (const c of String(input ?? "").toUpperCase()) {
    if (/\s/.test(c)) continue;
    if (!CODE_ALPHABET.includes(c)) bad.add(c);
  }
  return [...bad];
}
