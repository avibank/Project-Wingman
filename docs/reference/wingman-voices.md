# Wingman — Character Voices

Greeting copy for the Flight Deck header. One line shows on every home-page view,
chosen by time band and rotated per the spec at the bottom.

---

## Rotation spec

**Bands** — device local time, no gaps:

| Band | Hours |
|---|---|
| Early morning | 04:00 – 07:00 |
| Morning | 07:00 – 12:00 |
| Afternoon | 12:00 – 17:00 |
| Evening | 17:00 – 19:00 |
| Night | 19:00 – 24:00 |
| Small hours | 00:00 – 04:00 |

**Shuffle-bag, never random.** Each band keeps its own bag: shuffle the lines into an
order, store order + cursor, deal one per home view, advance. Reshuffle only when the bag
empties — so every line shows before any repeat. On reshuffle, if the new first card is the
old last card, swap it with the second.

**Dwell — 2 minutes.** Home → chapter → home inside the dwell shows the *same* line; that
was navigation, not an arrival. After the dwell, deal the next card. Without this a normal
session burns the whole bag in twenty minutes and reads as a slot machine.

**Adjacency.** After shuffling, one pass: swap any adjacent pair sharing a tag. Never two
tool lines back to back, never two `{name}` lines back to back.

**Band change punches through the dwell.** Studying at 23:58 and landing on home at 00:03
deals immediately. The app visibly noticing midnight passed is the best moment the system has.

**Arrival vs continuation** (Wingman only, for now):

- Away 8h+ → arrival pool
- Away under 2h → continuation pool
- In between, or that pool's bag is empty → any pool

**`{name}`** — lines carrying the token are excluded from the pool when the user hasn't set
a name. Never substitute a fallback word.

---

# 1 · WINGMAN — 65 lines

**Who:** a coworker on the same shift. A peer — no rank in either direction.

**Rules:**
- Comments on your *presence*, never your performance. Never "great work", never a streak.
- The later it gets, the more it's about company and the less about the task.
- "We" only appears after dark.
- Banter is about the clock and the habits, never the studying.
- The flirt is platonic: being glad it's *them*. Never physical, always deniable, always
  safe to read at work.

### Early morning · 04:00 – 07:00 (11)

| # | Line | Pool |
|---|---|---|
| 1 | First one in. Show-off. | arrival |
| 2 | Early again. I like that about you. | arrival |
| 3 | Of course it's you, {name}. It's always you at this hour. | arrival |
| 4 | Early starts suit you. | any |
| 5 | Coffee hasn't even brewed, yet here you are. | arrival |
| 32 | Nobody's opened the hangar doors yet. | any |
| 33 | Kettle's on. I knew you'd be in. | arrival |
| 34 | It's obscene, being this awake, {name}. | any |
| 35 | Quiet enough to hear yourself think. Make the most of it. | any |
| 62 | Nobody to impress at this hour. You're still doing it. | continuation |
| 74 | You've been at this a while and it's barely morning. | continuation |

### Morning · 07:00 – 12:00 (10)

| # | Line | Pool |
|---|---|---|
| 8 | Nobody else read the briefing. Just us, as usual. | arrival |
| 9 | Let's make a dent. | arrival |
| 10 | Exams don't stand a chance at this rate. | any |
| 37 | Torque wrench, when you get a second. | continuation · tool |
| 38 | Right. Coffee's in, brain's in. Go. | arrival |
| 39 | You've got that look, {name}. The one that means you've read ahead. | arrival |
| 40 | Best part of the day and you're spending it here. Respect. | any |
| 41 | In you come. I'll pretend I wasn't waiting. | arrival |
| 63 | Two coffees in and you're still ahead of me. | continuation |
| 64 | Whatever's got into you this morning, keep it. | continuation |

### Afternoon · 12:00 – 17:00 (12)

| # | Line | Pool |
|---|---|---|
| 11 | You skipped lunch again, didn't you. | continuation |
| 12 | This is the hour that gets people. Never seems to get you. | any |
| 13 | Long day, {name}. Suits you, somehow. | continuation |
| 14 | Nice having you around. | any |
| 15 | Pass me that ratchet, would you. | continuation · tool |
| 42 | Everyone's gone quiet. You haven't. | continuation |
| 43 | Two o'clock. The hour where good people give up. | any |
| 44 | You're still sharp, {name}. How. | continuation |
| 45 | Come on. One more before the light goes. | continuation |
| 46 | I'd have folded by now. You clearly wouldn't. | continuation |
| 70 | Afternoon. Good — I needed the company. | arrival |
| 71 | Starting now? Bold. I like it. | arrival |

### Evening · 17:00 – 19:00 (12)

| # | Line | Pool |
|---|---|---|
| 16 | Day shift's out the door. Better company now. | arrival |
| 18 | Of everyone who could've stayed, I'm glad it's you. | continuation |
| 20 | Best hours are yours. | any |
| 47 | Hold this for me a moment. | continuation · tool |
| 48 | Car park's emptying. Ours is nearly the last one out there. | any |
| 49 | Long day for both of us, {name}. | continuation |
| 50 | This is when the good work happens. Just us who know it. | any |
| 51 | Stayed, then. Thought you might. | continuation |
| 65 | They've all gone for food. You didn't even look up. | continuation |
| 66 | Light's going. Doesn't seem to bother you. | continuation |
| 72 | Evening. You've picked the good half of the day. | arrival |
| 73 | Just in? Everyone else is on their way out. | arrival |

### Night · 19:00 – 24:00 (10)

| # | Line | Pool |
|---|---|---|
| 23 | Late shifts suit you. Don't tell anyone I said that. | any |
| 24 | Hangar's better at this hour. Fewer opinions. | any |
| 52 | Radio's off, kettle's on. Usual arrangement. | arrival |
| 53 | You and me and a very quiet hangar, {name}. | any |
| 54 | Nobody's expecting anything from you at this hour. Do it anyway. | arrival |
| 55 | I like this part of the shift. Mostly the company. | any |
| 56 | Long past knocking-off time. Neither of us noticed. | continuation |
| 67 | Just us and the standby lighting, {name}. | any |
| 68 | There's no overtime for this, you know. | continuation |
| 69 | Best conversations happen late night. Not that we're talking… or are we? | any |

### Small hours · 00:00 – 04:00 (10)

| # | Line | Pool |
|---|---|---|
| 26 | There's maybe three of us in the country doing this right now. | any |
| 27 | Small hours suit you. | any |
| 28 | Coffee? I'll hold your place. | continuation |
| 29 | I'll stay up, {name}. | continuation |
| 31 | Shine that torch over here a second. | continuation · tool |
| 57 | Torch is by your elbow if you need it. | any · tool |
| 58 | Nothing good gets decided at this hour. Studying's fine, though. | any |
| 59 | Still with me, {name}? | continuation |
| 60 | If anyone asks, we were never here. | any |
| 61 | One more, then I'm cutting you off. | continuation |

*No arrival pool by design — 26, 27, 57, 58 and 60 all work cold. A dedicated arrival line
here would mean writing "good evening" at one in the morning.*

---

# 2 · THE HERMIT — 54 lines

**Who:** the old engineer in the back bay. Gnomic, inverted, affectionately superior.
Wisdom is about *learning*, never about destiny.

**Rules:**
- Inverted syntax throughout. The admission arrives last, so affection sounds accidental.
- Never quotes or paraphrases any existing film dialogue.
- Same weights as Wingman: ~1 flirt in 5, one habit-banter line per band, one `{name}`
  per band, tool lines in three bands.

### Early morning · 04:00 – 07:00 (10)

1. Awake, the field is not. Awake, you are.
2. Early, you come. Reasons, you have.
3. Dark it is. Dark it stays a while. Begin anyway.
4. The kettle knows you by now, {name}.
5. Sleep, you traded. Wisely? We shall see.
6. Company at this hour, rare it is. Welcome, therefore.
7. First in, you are. Noticed, it is.
8. Cold, the hangar. Warm, the work.
9. Again, you are here. A pattern, this has become. Fond of it, I am.
10. The torch, pass me. Old eyes, I have. *(tool)*

### Morning · 07:00 – 12:00 (9)

11. Brighter, the morning is, with you in it. Coincidence, surely.
12. Fresh, the mind is. Waste it, do not.
13. The manual, you have read. The engine, you have not yet asked.
15. Waiting, I was not. Watching the door, I was.
16. Ready, you look, {name}. Ready, you may even be.
17. Difficult it is not. Unfamiliar it is. Different, those two.
18. Coffee first. Wisdom second. In that order, always.
19. Questions, you bring. Good. Answers are cheap.
20. Begin. Perfect, the beginning never is.

### Afternoon · 12:00 – 17:00 (8)

22. Tired, you say. Finished, you are not.
23. Halfway, you are. Halfway is where most stop.
24. The hard part, you have reached. Reached it, most never do.
25. Slower, you have become. Deeper, also.
26. Rest, the mind must. Ten minutes, {name}. Then again.
27. Wrong, you were. Learned, you therefore have.
28. Repeat it, you must. Not because dull. Because deep.
30. Leave, you should. Stay, you will. Pleased, I am.

### Evening · 17:00 – 19:00 (8)

31. Gone, the others are. Stayed, you have.
32. Chosen, this hour was. By you.
33. The day ends. The learning does not care.
34. Tired eyes see differently. Sometimes better.
36. Evening work sticks. Why, nobody knows.
37. Gone home, everyone has. Better company remains.
39. Late, it is becoming. Right, it also is.
40. One more, you said. Believed you, I did not.

### Night · 19:00 – 24:00 (10)

41. Dark outside. Bright in here.
42. Late, the hour. Sharp, the mind. Rare, this pairing.
43. Alone, you study. Alone, you are not.
44. Alone with you, the hangar is. Complaining, I am not.
45. The night forgives mistakes, {name}.
46. Quiet, the hangar. Loud, your questions.
47. Stop, you should. Stop, you will not.
48. Late, it grows. Leave, I could. Left, I have not.
49. Owed nothing, you are. Give it anyway, you do.
50. Wisdom comes at night. So does poor judgement. Both, welcome.

### Small hours · 00:00 – 04:00 (9)

51. Midnight passed. Noticed, you did not.
52. Few are awake. Fewer are working. Glad, I am, that it is you.
53. Sleep is a system too, {name}. Unserviceable, yours is.
54. Foolish, this hour is. Fond of it, I am.
55. The answer wants you awake. Awake, barely, you are.
56. Push on, you may. Forgive yourself tomorrow, you must.
57. Three in the morning teaches things noon cannot.
58. Stubborn, you are. A compliment, that was.
59. The light, hold it steady. Closer, come. *(tool)*

---

# 3 · CONTROL — in draft

See the working list in conversation. Not yet approved.
