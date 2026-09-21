/* =============================================================================
   The three-character code.
   -----------------------------------------------------------------------------
   Every student has one, and it IS their stamp: it is chosen in the stamp
   creator and issued with the stamp, in one statement (0035's issue_licence),
   and after that neither changes. It is meant to be said out loud and written
   down, so it is always upper case: nobody saying "a7k" means something
   different from "A7K".

   ANY LETTER, ANY DIGIT. This used to leave out 0, 1, O, I and L so that a
   code read off a photograph could not be misread, and it dropped them
   silently as they were typed. A student typing "A10" saw the 1 and the 0
   vanish and concluded the field took letters only (owner, 2026-09-21). So
   every character a student types is kept, and only the SUGGESTIONS avoid
   those five: nobody is handed an ambiguous code, but anybody may choose one.

   Pure, no imports: checkable without a browser or a database.
   ========================================================================= */

export const CODE_LENGTH = 3;
export const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/* What a suggestion is drawn from: everything except the pairs that get read
   back wrong. The same set 0016's suggest_code draws from on the server. */
export const SUGGEST_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_SPACE = CODE_ALPHABET.length ** CODE_LENGTH;

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

export const isCode = (input) => normaliseCode(input).length === CODE_LENGTH;

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
