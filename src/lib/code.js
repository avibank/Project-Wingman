/* =============================================================================
   The three-character code.
   -----------------------------------------------------------------------------
   Every pilot has one, it is chosen at signup, and it is the mark that gets
   stamped on a chapter when they finish it. It is meant to be said out loud and
   written down — on a card, in a post, across a room — so two decisions follow
   from that and neither is arbitrary:

   NO CONFUSABLE CHARACTERS. 0 and O, 1 and I and L are gone from the alphabet.
   A code that cannot be read back correctly from a photograph is not an
   identifier, and this is the one place a person will be reading it back from a
   photograph. That leaves 31 characters and 29,791 codes.

   ALWAYS UPPERCASE. There is no meaningful difference between "a7k" and "A7K"
   to anybody saying it, so storing both would make two people think they have
   different codes when they do not.

   Pure, no imports: checkable without a browser or a database.
   ========================================================================= */

export const CODE_LENGTH = 3;
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
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

/* A suggestion, so nobody has to invent one under pressure at signup. The
   caller checks it is free and asks again if it is not. */
export function randomCode(rand = Math.random) {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
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
