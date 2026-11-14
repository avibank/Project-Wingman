/* AN OPEN-ENDED STUDY CARD, and the one place that says what one is.
   -----------------------------------------------------------------------------
   Until Module 13e a card was a multiple-choice question read the other way
   round: `{ question, options, correct, explain }`, whose back was drawn from
   `options[correct]`. Module 13e's cards arrive as a question and the author's
   own answer — `{ id, front, back }` — and there is no honest way to give one
   options without inventing wrong answers.

   So a card is EITHER shape, decided per card by this one test, and the older
   one is kept exactly as it was: Module 13d's cards are multiple-choice and
   stay that way. Everything new is open-ended.

   `back` may mark a key term with **double asterisks**, which is the author's
   own convention (the document's note: "**text** marks the key term in bold")
   and is drawn bold by `Rich`. */
export const isOpenCard = (q) => Boolean(q) && typeof q.front === "string";
