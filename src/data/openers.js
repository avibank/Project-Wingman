// §8.1 — the app speaks first.
//
// One authored opener per chapter, written down here rather than generated at
// runtime, so the same sentence is never invented twice and a person can edit
// it. Each one is a real question about that chapter's material, not a prompt
// template with a code substituted in.
//
// Posted at most once per channel per 48 hours, and suppressed entirely once a
// channel carries twenty human messages in a week. Attributed to Wingman, with
// a system badge and never a tail — it is not a person.

export const WINGMAN_ID = "wingman";
export const WINGMAN_NAME = "Wingman";

export const CHAPTER_OPENERS = {
  ch1:  "Compressor stall and compressor surge get used interchangeably and they are not the same event. Anyone want to have a go at separating them?",
  ch2:  "The flame in a combustion chamber sits still while air moves past it at speed. What is actually holding it in place?",
  ch3:  "Turbine blades and compressor blades are both aerofoils, but only one of them is extracting work. Which way does the energy go, and how would you tell from the shape?",
  ch4:  "Thrust is mass flow times the change in velocity — so why does a bypass engine, which throws its air out slower, end up making more of it?",
  ch5:  "A propeller blade is twisted from root to tip. If you had to explain why to someone on their first day, where would you start?",
  ch6:  "Detonation and pre-ignition both sound like the engine complaining. What is the actual difference between them, and which one is worse?",
  ch7:  "A turboprop and a turbofan are closer relatives than they look. What is the one design decision that separates them?",
  ch8:  "Specific fuel consumption is the number everyone quotes and the one most people cannot define cleanly. Anyone want to try?",
  ch9:  "In level unaccelerated flight the four forces balance. In a steady climb they still balance — but not the way most first explanations suggest. What changes?",
  ch10: "Bernoulli or Newton is a false choice, and both explanations get taught badly. What actually creates the pressure difference?",
  ch11: "A wing stalls at an angle of attack, not at a speed. So why does every aircraft still have a published stall speed?",
  ch12: "Static stability and dynamic stability can point opposite ways in the same aircraft. Can you picture one that has the first and not the second?",
  ch13: "Sectional charts hide a lot in the blue and magenta edges around an airport. Which boundary confused you first?",
  ch14: "A VOR radial is measured outbound from the station no matter which way you are flying. What goes wrong when you forget that?",
  ch15: "Dead reckoning works right up until the wind is not what the forecast said. How do you notice, mid-leg, that your ground speed is off?",
  ch16: "RNAV lets you fly direct to a point that is not a physical station. What does that change about how you plan a diversion?",
  ch17: "METARs are dense on purpose. Which group took you longest to stop decoding character by character?",
  ch18: "Warm fronts and cold fronts bring different weather because of how each one lifts the air ahead of it. What is the difference in that lift?",
  ch19: "A thunderstorm's most dangerous stage is not the one that looks worst from outside. Which is it, and why?",
  ch20: "Go/no-go is a decision made before you are tired and under pressure, not during. What is on your personal minimums list?",
};

// A channel with recent human activity does not need the app talking.
export const QUIET_HOURS = 48;
export const SUPPRESS_AFTER_HUMAN_MESSAGES = 20;
export const SUPPRESS_WINDOW_DAYS = 7;

// Pure so the whole rule can be checked without a database. `messages` are the
// channel's; order is not assumed.
export function shouldSpeak(messages = [], chapterId, now = Date.now()) {
  if (!chapterId || !CHAPTER_OPENERS[chapterId]) return false;

  const quietCutoff = now - QUIET_HOURS * 3600e3;
  const weekCutoff = now - SUPPRESS_WINDOW_DAYS * 86400e3;

  let humanThisWeek = 0;
  for (const m of messages) {
    const at = new Date(m.created_at).getTime();
    // Anything at all inside 48 hours means the channel is not quiet —
    // including a previous opener, which is what caps this at one per 48h.
    if (at > quietCutoff) return false;
    if (!m.is_system && at > weekCutoff) humanThisWeek += 1;
  }
  return humanThisWeek < SUPPRESS_AFTER_HUMAN_MESSAGES;
}
