// Greeting copy, transcribed from docs/reference/wingman-voices.md.
//
// `pool` is arrival / continuation / any — Wingman only, for now; the Hermit
// has no arrival/continuation split and ignores it. `tag` is what the adjacency
// pass reads: never two tool lines back to back, never two {name} lines back to
// back. A line carrying {name} is tagged "name" automatically at load.
//
// Control's copy exists in the brief but its line set is not finished, so it is
// not here and §6.2 says not to offer it.

const t = (text, pool = "any", tool = false) => ({
  text, pool, tag: tool ? "tool" : text.includes("{name}") ? "name" : null,
});

// A coworker on the same shift. A peer — no rank in either direction. Comments
// on your presence, never your performance. "We" only appears after dark.
const WINGMAN = [
  [ // 04:00 – 07:00
    t("First one in. Show-off.", "arrival"),
    t("Early again. I like that about you.", "arrival"),
    t("Of course it's you, {name}. It's always you at this hour.", "arrival"),
    t("Early starts suit you."),
    t("Coffee hasn't even brewed, yet here you are.", "arrival"),
    t("Nobody's opened the hangar doors yet."),
    t("Kettle's on. I knew you'd be in.", "arrival"),
    t("It's obscene, being this awake, {name}."),
    t("Quiet enough to hear yourself think. Make the most of it."),
    t("Nobody to impress at this hour. You're still doing it.", "continuation"),
    t("You've been at this a while and it's barely morning.", "continuation"),
  ],
  [ // 07:00 – 12:00
    t("Nobody else read the briefing. Just us, as usual.", "arrival"),
    t("Let's make a dent.", "arrival"),
    t("Exams don't stand a chance at this rate."),
    t("Torque wrench, when you get a second.", "continuation", true),
    t("Right. Coffee's in, brain's in. Go.", "arrival"),
    t("You've got that look, {name}. The one that means you've read ahead.", "arrival"),
    t("Best part of the day and you're spending it here. Respect."),
    t("In you come. I'll pretend I wasn't waiting.", "arrival"),
    t("Two coffees in and you're still ahead of me.", "continuation"),
    t("Whatever's got into you this morning, keep it.", "continuation"),
  ],
  [ // 12:00 – 17:00
    t("You skipped lunch again, didn't you.", "continuation"),
    t("This is the hour that gets people. Never seems to get you."),
    t("Long day, {name}. Suits you, somehow.", "continuation"),
    t("Nice having you around."),
    t("Pass me that ratchet, would you.", "continuation", true),
    t("Everyone's gone quiet. You haven't.", "continuation"),
    t("Two o'clock. The hour where good people give up."),
    t("You're still sharp, {name}. How.", "continuation"),
    t("Come on. One more before the light goes.", "continuation"),
    t("I'd have folded by now. You clearly wouldn't.", "continuation"),
    t("Afternoon. Good — I needed the company.", "arrival"),
    t("Starting now? Bold. I like it.", "arrival"),
  ],
  [ // 17:00 – 19:00
    t("Day shift's out the door. Better company now.", "arrival"),
    t("Of everyone who could've stayed, I'm glad it's you.", "continuation"),
    t("Best hours are yours."),
    t("Hold this for me a moment.", "continuation", true),
    t("Car park's emptying. Ours is nearly the last one out there."),
    t("Long day for both of us, {name}.", "continuation"),
    t("This is when the good work happens. Just us who know it."),
    t("Stayed, then. Thought you might.", "continuation"),
    t("They've all gone for food. You didn't even look up.", "continuation"),
    t("Light's going. Doesn't seem to bother you.", "continuation"),
    t("Evening. You've picked the good half of the day.", "arrival"),
    t("Just in? Everyone else is on their way out.", "arrival"),
  ],
  [ // 19:00 – 24:00
    t("Late shifts suit you. Don't tell anyone I said that."),
    t("Hangar's better at this hour. Fewer opinions."),
    t("Radio's off, kettle's on. Usual arrangement.", "arrival"),
    t("You and me and a very quiet hangar, {name}."),
    t("Nobody's expecting anything from you at this hour. Do it anyway.", "arrival"),
    t("I like this part of the shift. Mostly the company."),
    t("Long past knocking-off time. Neither of us noticed.", "continuation"),
    t("Just us and the standby lighting, {name}."),
    t("There's no overtime for this, you know.", "continuation"),
    t("Best conversations happen late night. Not that we're talking… or are we?"),
  ],
  [ // 00:00 – 04:00 — no arrival pool by design; these all work cold.
    t("There's maybe three of us in the country doing this right now."),
    t("Small hours suit you."),
    t("Coffee? I'll hold your place.", "continuation"),
    t("I'll stay up, {name}.", "continuation"),
    t("Shine that torch over here a second.", "continuation", true),
    t("Torch is by your elbow if you need it.", "any", true),
    t("Nothing good gets decided at this hour. Studying's fine, though."),
    t("Still with me, {name}?", "continuation"),
    t("If anyone asks, we were never here."),
    t("One more, then I'm cutting you off.", "continuation"),
  ],
];

// The old engineer in the back bay. Gnomic, inverted, affectionately superior.
// The admission arrives last, so the affection sounds accidental.
const HERMIT = [
  [ // 04:00 – 07:00
    t("Awake, the field is not. Awake, you are."),
    t("Early, you come. Reasons, you have."),
    t("Dark it is. Dark it stays a while. Begin anyway."),
    t("The kettle knows you by now, {name}."),
    t("Sleep, you traded. Wisely? We shall see."),
    t("Company at this hour, rare it is. Welcome, therefore."),
    t("First in, you are. Noticed, it is."),
    t("Cold, the hangar. Warm, the work."),
    t("Again, you are here. A pattern, this has become. Fond of it, I am."),
    t("The torch, pass me. Old eyes, I have.", "any", true),
  ],
  [ // 07:00 – 12:00
    t("Brighter, the morning is, with you in it. Coincidence, surely."),
    t("Fresh, the mind is. Waste it, do not."),
    t("The manual, you have read. The engine, you have not yet asked."),
    t("Waiting, I was not. Watching the door, I was."),
    t("Ready, you look, {name}. Ready, you may even be."),
    t("Difficult it is not. Unfamiliar it is. Different, those two."),
    t("Coffee first. Wisdom second. In that order, always."),
    t("Questions, you bring. Good. Answers are cheap."),
    t("Begin. Perfect, the beginning never is."),
  ],
  [ // 12:00 – 17:00
    t("Tired, you say. Finished, you are not."),
    t("Halfway, you are. Halfway is where most stop."),
    t("The hard part, you have reached. Reached it, most never do."),
    t("Slower, you have become. Deeper, also."),
    t("Rest, the mind must. Ten minutes, {name}. Then again."),
    t("Wrong, you were. Learned, you therefore have."),
    t("Repeat it, you must. Not because dull. Because deep."),
    t("Leave, you should. Stay, you will. Pleased, I am."),
  ],
  [ // 17:00 – 19:00
    t("Gone, the others are. Stayed, you have."),
    t("Chosen, this hour was. By you."),
    t("The day ends. The learning does not care."),
    t("Tired eyes see differently. Sometimes better."),
    t("Evening work sticks. Why, nobody knows."),
    t("Gone home, everyone has. Better company remains."),
    t("Late, it is becoming. Right, it also is."),
    t("One more, you said. Believed you, I did not."),
  ],
  [ // 19:00 – 24:00
    t("Dark outside. Bright in here."),
    t("Late, the hour. Sharp, the mind. Rare, this pairing."),
    t("Alone, you study. Alone, you are not."),
    t("Alone with you, the hangar is. Complaining, I am not."),
    t("The night forgives mistakes, {name}."),
    t("Quiet, the hangar. Loud, your questions."),
    t("Stop, you should. Stop, you will not."),
    t("Late, it grows. Leave, I could. Left, I have not."),
    t("Owed nothing, you are. Give it anyway, you do."),
    t("Wisdom comes at night. So does poor judgement. Both, welcome."),
  ],
  [ // 00:00 – 04:00
    t("Midnight passed. Noticed, you did not."),
    t("Few are awake. Fewer are working. Glad, I am, that it is you."),
    t("Sleep is a system too, {name}. Unserviceable, yours is."),
    t("Foolish, this hour is. Fond of it, I am."),
    t("The answer wants you awake. Awake, barely, you are."),
    t("Push on, you may. Forgive yourself tomorrow, you must."),
    t("Three in the morning teaches things noon cannot."),
    t("Stubborn, you are. A compliment, that was."),
    t("The light, hold it steady. Closer, come.", "any", true),
  ],
];

export const VOICES = { wingman: WINGMAN, hermit: HERMIT };

// §6.2's copy. Control is described there but has no line set, so it is not
// offered — "If it isn't in wingman-voices.md, don't offer it."
export const CHARACTERS = [
  { id: "wingman", name: "Wingman",
    blurb: "A coworker on the same shift. Notices you're here, never what you scored." },
  { id: "hermit", name: "The Hermit",
    blurb: "Small. Green. Far too interested in you. Speaks backwards and knows things he has no business knowing." },
];

export const DEFAULT_CHARACTER = "wingman";
// Arrival vs continuation is a Wingman-only split, for now.
export const HAS_POOLS = { wingman: true, hermit: false };
