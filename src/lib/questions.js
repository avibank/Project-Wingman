// §9.3.4 — the atom is a question, not a message.
//
// A pure linear chat is worthless a week later: the answer to "why is B wrong"
// is the most valuable object in the room and in a log it scrolls away. Three
// failures follow — it does not accumulate, unanswered questions drown, and an
// empty chat looks deader than an empty list.
//
// So: any message can be marked a question, a reply can be marked as answering
// it, answered questions pin to the top, and chatter is allowed to disappear.

export const SQUAWK = {
  RADIO_FAILURE: "7600",   // "I've read this three times and I don't get it"
  EMERGENCY: "7700",       // "checkride Thursday and I'm lost"
};

export const SQUAWK_LABEL = {
  "7600": "Read it three times and it hasn't landed",
  "7700": "Checkride coming and I'm lost",
};

// A question is open until something answers it. Age is what promotes it to the
// Ready Room (§9.3.4) so nothing dies in a scrollback.
export const SQUAWK_AFTER_HOURS = 3;

export function splitQuestions(messages = [], now = Date.now()) {
  const answersFor = new Map();
  for (const m of messages) {
    if (!m.answers_id) continue;
    (answersFor.get(m.answers_id) || answersFor.set(m.answers_id, []).get(m.answers_id)).push(m);
  }

  const answered = [], open = [], chatter = [];
  for (const m of messages) {
    if (!m.is_question) {
      if (!m.answers_id) chatter.push(m);
      continue;
    }
    const replies = answersFor.get(m.id) || [];
    if (replies.length || m.resolved_at) {
      answered.push({ ...m, answers: replies });
    } else {
      const age = now - new Date(m.created_at).getTime();
      open.push({ ...m, ageHours: Number.isFinite(age) ? age / 3600e3 : 0 });
    }
  }
  return { answered, open, chatter, answersFor };
}

// §9.3.4 — the collapsed strip at the top. Settled knowledge above, live chat
// below, which is how a good study group already works.
export function answeredStrip(messages = [], limit = 6) {
  return splitQuestions(messages).answered
    .sort((a, b) => new Date(b.resolved_at || b.created_at) - new Date(a.resolved_at || a.created_at))
    .slice(0, limit);
}

// Questions old enough to surface in the Ready Room as open squawks.
export function readyRoomSquawks(messages = [], now = Date.now()) {
  return splitQuestions(messages, now).open
    .filter((q) => q.ageHours >= SQUAWK_AFTER_HOURS)
    // §9.4.2 — an emergency outranks a radio failure, then oldest first.
    .sort((a, b) => (b.squawk === SQUAWK.EMERGENCY) - (a.squawk === SQUAWK.EMERGENCY) || b.ageHours - a.ageHours);
}

// §9.4.1 — the boundary between the two discussion surfaces, enforced where
// people actually read instructions: the placeholder.
export function composerPlaceholder(scope, name) {
  if (scope === "chapter") return "Ask about this chapter…";
  if (scope === "team") return `Anything with ${name}…`;
  return `Anything about ${name}…`;
}
