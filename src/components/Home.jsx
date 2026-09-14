import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CautionMark } from "./module/Instruments.jsx";
import { moduleNeedsYou, readMinimums } from "../lib/minimums.js";
import { useUser } from "@clerk/clerk-react";
import { MODULES as FALLBACK_MODULES, chaptersForModule as fallbackChapters } from "../data.js";
import { deckStateFrom } from "../lib/deckState.js";
import { HOBBS_KEY, hobbsSeconds, hobbsClock } from "../lib/hobbs.js";
import { PLACE_KEY, placeLine, placeVerb, placeList } from "../lib/lastPlace.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { fetchAllPresence, fetchModulePresence } from "../lib/presence.js";
import { fetchFlightLog } from "../lib/partners.js";
import { fetchSeat } from "../lib/rightSeat.js";
import { fetchBlocks, fetchMutes } from "../lib/squadron.js";
import { isFlySolo } from "../lib/flySolo.js";
import { surfacesFor, makePeople, squadronFor, routePeopleFor, threadsFor, moduleFor } from "../lib/ground.js";
import { moduleSegments, chapterCount, nextChapter, SEGMENT, segmentState } from "../lib/progressModel.js";
import { deckVars, engineLivery, rng } from "../lib/liveryEngine.js";
import { profileSVG, phaseName } from "../lib/flightProfile.js";
import { pickGreeting } from "../lib/greeting.js";
import { moduleAverage } from "../lib/attitude.js";
import { useAttitude } from "../lib/useAttitude.js";
import { DEFAULT_CHARACTER } from "../lib/voices.js";
import { useFlags } from "../lib/flags.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import PaperStrip from "./PaperStrip.jsx";
import Gyro, { GyroCaption } from "./Gyro.jsx";
import { BackOnTheGround } from "./ground/BackOnTheGround.jsx";
import "./ground/ground.css";

// The Flight Deck. Ported from the Step 1 reference rig — the colour and
// lighting system, the hero card with the instrument strip inside it, the
// module rail, and Back on the ground — with the bench chrome stripped out.
//
// The rule this build enforces: social never touches the hero card or the
// module cards. Its only foothold in the academic half is the radar, which was
// already an instrument. It reports how busy it is and it is the door to the
// Ready Room. Everything else lives in one band below the modules.

const GREET_KEY = "pw-greeting";
const PRESET_KEY = "pw-social-preset";

// One setting, three values, no individual switches.
const PRESETS = {
  quiet: { band: [] },
  crew: { band: ["form", "wing"] },
  open: { band: ["form", "wing", "freq"] },
};

function Cell({ className, open, onOpen, children, ...rest }) {
  // ...rest so housing's data-press reaches the element. Without it the card
  // gets the class and none of the pressable behaviour.
  return open
    ? <button className={className} type="button" onClick={onOpen} {...rest}>{children}</button>
    : <div className={className} {...rest}>{children}</div>;
}

const CHEV = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
  <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;


function lastFlownPhrase(iso) {
  if (!iso) return "First flight from here.";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "First flight from here.";
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "Last flown today.";
  if (days === 1) return "Last flown yesterday.";
  if (days < 7) return `Last flown ${days} days ago.`;
  const wk = Math.floor(days / 7);
  return wk === 1 ? "Last flown a week ago." : `Last flown ${wk} weeks ago.`;
}




const DECK_CSS = `
/* the deck owns the whole content column on this route. Specificity has to
   beat .content, which the shell declares later in source order. */
/* zoom: 1 because .content still carries the shell's --font-scale zoom, and
   with --scale also driving the instruments the deck was scaling twice. */
.deck .dhead { margin-bottom: 18px; }
.deck .title { font-size: 32px; font-weight: 700; letter-spacing: -.7px; line-height: 1.05; margin: 0; color: var(--t1); }
.deck .greet { font-size: 20px; font-weight: 600; margin-top: 7px; letter-spacing: -.2px; min-height: 24px; }
.deck .since { font-size: 13px; color: var(--t2); margin-top: 2px; }

/* ---------------------------------------------------- hero + instruments */
.deck .card { background: var(--panel); border: 1px solid var(--line); border-radius: 13px;
  border-top-color: var(--edge-hi); border-bottom-color: var(--edge-lo);
  overflow: hidden; display: flex; flex-direction: column; }
/* The card lost its thumbnail, so it runs across rather than down: the words
   on one side, the button on the other, both bigger now that there is room
   for them. It wraps back to a stack when the column is too narrow to hold
   the two side by side. */
.deck .cardbody { padding: 22px; display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.deck .cardtext { flex: 1 1 240px; min-width: 0; }
.deck .chapter { font-size: calc(25px * var(--scale, 1)); font-weight: 600; letter-spacing: -.4px; }
.deck .hcode { font-family: var(--font-mono); font-size: calc(13px * var(--scale, 1)); color: var(--t3);
  letter-spacing: .05em; margin-top: 3px; }
.deck .position { font-size: calc(16px * var(--scale, 1)); color: var(--t2); margin-top: 8px; }
.deck .resume { flex: none; background: var(--active-fill); color: var(--ground); border: 0;
  border-radius: 999px; padding: 14px 30px; font-size: calc(16px * var(--scale, 1)); font-weight: 600;
  cursor: pointer; white-space: nowrap; }
@media (max-width: 430px) { .deck .cardbody { padding: 18px; gap: 16px; }
  .deck .resume { width: 100%; text-align: center; } }

.deck .strip { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 1px;
  background: var(--line); border-top: 1px solid var(--line); }
@media (max-width: 760px) { .deck .strip { grid-template-columns: 1fr 1fr; }
  .deck .strip .cel:first-child { grid-column: 1/-1; } }
@media (max-width: 430px) { .deck .strip { grid-template-columns: 1fr; } }
.deck .cel { background: var(--panel); padding: 17px 10px 13px; display: flex; flex-direction: column;
  align-items: center; gap: 9px; min-height: calc(152px * var(--scale, 1)); justify-content: center; }
/* Sheen. A broad gloss falling from the top edge plus one narrow diagonal
   specular streak, as if the surface has a slight gloss and the light is above.
   It goes into each surface's own background-image rather than an overlay or a
   pseudo-element, so it paints beneath the type, cannot wash out text and
   cannot intercept a pointer.
   These must stay AFTER the .card / .mod / .cel rules above: those use the
   background shorthand, which resets background-image. The ground section's
   cards come from an imported stylesheet, so the .deck prefix is what lets
   the sheen reach them. */
.deck .card, .deck .mod, .deck .cel, .deck .bog-card { background-image: var(--sheen-img, none); }

/* The cast shadow. Nothing read --drop before this: these surfaces were flat
   with a border. Night sets it to none, so this is inert there. */
.deck .card, .deck .mod, .deck .bog-card { box-shadow: var(--drop, none); }

.deck .cap { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .13em; text-transform: uppercase;
  color: var(--t2); text-align: center; }
/* The reticle, and only over the instrument itself. crosshair is the cursor a
   real gunsight or a chart plotter puts under your hand; everywhere else on the
   deck the pointer stays what it was. */
.deck .aiwrap { position: relative; display: inline-block; line-height: 0; }
/* THE DIAL IS CAPPED BY ITS CELL, and it never was. 112px is the size it
   wants, but the strip goes to five columns between 761px and roughly 900px,
   which leaves 106px of content in a cell -- so the instrument hung over the
   edge of its own card at EVERY instrument scale, by 6px at Standard and 42px
   at Large. Measured across all four scales, not reasoned about.
   max-width rather than a breakpoint, because the cell width is a function of
   the viewport AND the column count AND the scale, and enumerating that in
   media queries is how it went wrong in the first place. aspect-ratio keeps it
   circular while it shrinks; a fixed height would have squashed it to an oval
   the moment the width was capped. */
.deck .aiwrap { max-width: 100%; }
.deck .ai { width: calc(112px * var(--scale, 1)); max-width: 100%;
  height: auto; aspect-ratio: 1 / 1; display: block; cursor: crosshair; }
.deck .ladder { font-family: var(--font-mono); font-size: calc(11px * var(--scale, 1)); line-height: 1.55; text-align: center;
  background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 5px 13px; color: var(--t3); }
.deck .ladder b { display: block; font-size: calc(19px * var(--scale, 1)); font-weight: 500; color: var(--on); }
.deck .bagglyph { width: calc(32px * var(--scale, 1)); height: calc(30px * var(--scale, 1)); color: var(--t3); }
/* minmax(0, 1fr), not 1fr. A bare 1fr track is minmax(auto, 1fr), and auto as
   a MINIMUM resolves to the item's min-content — which for a fixed-width item
   is that width. So any width landing on a .lamp becomes a floor this track
   set cannot go below, and the bars march out of the cel. That is exactly what
   a stray width of 68px on .lamp did. The width is gone, but a track that must
   fit should say it must fit.
   NO BACKTICKS IN HERE: this comment lives inside a JS template literal, so a
   backtick ends the string and the build dies. It has done, three times. */
.deck .lamps { display: grid; grid-template-columns: repeat(var(--legs, 3), minmax(0, 1fr)); gap: 5px; width: calc(88px * var(--scale, 1)); }
.deck .lamp { height: calc(17px * var(--scale, 1)); border-radius: 3px; background: var(--raised); border: 1px solid var(--line); }
.deck .lamp.on { background: var(--on); border-color: transparent;
  box-shadow: 0 0 var(--emit) color-mix(in oklab, var(--on), transparent 45%); }
.deck .hobbs { font-family: var(--font-mono); font-size: calc(19px * var(--scale, 1)); letter-spacing: .09em; background: var(--raised);
  border: 1px solid var(--line); border-radius: 5px; padding: 6px 10px; color: var(--t2);
  font-variant-numeric: tabular-nums; }
.deck .hobbs i { font-style: normal; color: var(--on); }

.deck .radarcel { cursor: pointer; border: 0; font-family: inherit; transition: background .18s; }
.deck .radarcel:hover { background: var(--raised); }
.deck .radar { width: calc(82px * var(--scale, 1)); height: calc(82px * var(--scale, 1)); border-radius: 50%; position: relative; background: var(--raised);
  border: 1px solid var(--line); overflow: hidden; }
.deck .radar .ring { position: absolute; inset: 0; margin: auto; border-radius: 50%; border: 1px solid var(--line); }
.deck .radar .r1 { width: 54%; height: 54%; } .deck .radar .r2 { width: 26%; height: 26%; }
.deck .sweep { position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0deg, transparent 300deg,
    color-mix(in oklab, var(--active), transparent 84%) 348deg,
    color-mix(in oklab, var(--active), transparent 34%) 360deg);
  animation: pwspin 4s linear infinite; }
@keyframes pwspin { to { transform: rotate(360deg); } }
.deck .blip { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--lit);
  box-shadow: 0 0 var(--emit) color-mix(in oklab, var(--lit), transparent 40%); }
.deck .radar.quiet .sweep { animation-duration: 11s; opacity: .5; }

/* ------------------------------------------------------------- sections */
.deck .sec, .deck .bog { margin-top: 30px; }
.deck .sechead { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 11px; }
.deck .sechead h2 { font-size: 17px; font-weight: 600; letter-spacing: -.2px; margin: 0; color: var(--t1); }
.deck .sechead .more { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .11em;
  text-transform: uppercase; color: var(--t3); background: none; border: 0; cursor: pointer; padding: 0; }
.deck .sechead button.more:hover { color: var(--t1); }
/* ---------------------------------------------------------- module rail */
.deck .railwrap { position: relative; }
.deck .railwrap::after { content: ""; position: absolute; right: -2px; top: 0; bottom: 0; width: 48px;
  pointer-events: none; z-index: 3; opacity: 0; transition: opacity .22s;
  background: linear-gradient(to left, var(--ground), color-mix(in oklab, var(--ground), transparent 100%)); }
.deck .railwrap.more::after { opacity: 1; }
.deck .rail { display: flex; gap: 13px; align-items: stretch; overflow-x: auto; overflow-y: visible;
  scroll-snap-type: x proximity; scrollbar-width: none; padding: 5px 2px 9px; }
.deck .rail::-webkit-scrollbar { display: none; }
/* Fill, border, radius and shadow all come from the housing tokens now. If a
   value is needed here, the token is missing — it goes in housing.css. */
.deck .mod { container-type: inline-size; flex: 1 1 0; min-width: 180px; scroll-snap-align: start;
  text-align: left; color: inherit; cursor: pointer; padding: 0; overflow: hidden; opacity: .84;
  transition: border-color .22s, background .22s, opacity .22s; }
.deck .modin { padding: 14px; display: flex; flex-direction: column; height: 100%; }
.deck .mcodeline { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 15px; }
/* The right-hand slot: the lamp and the CURRENT badge together, so
   space-between separates code from status rather than spreading three things
   across a 180px card. Both are flex:none — a squeezed lamp reads as a bug,
   and the code beside them may ellipsize instead. */
.deck .mcodeend { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 0 1 auto; }
.deck .mcodeend .lamp-sm { flex: 0 0 auto; }
.deck .mcode { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* THE LAMP AND THE CURRENT BADGE NEVER SHARE THE SLOT — §2, "once, never
   twice in the same view", and §9's specific worry about the two sitting
   beside each other on the amber livery, where the accent-filled badge and
   the amber lamp are close enough in hue to read as one object. The lamp is
   the signal and the badge is a label, so the label is what stands down.
   That resolves the adjacency without moving a livery's hue. */
.deck .mcode { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .11em; color: var(--t3); }
.deck .mchev { display: flex; color: var(--t3); }
.deck .mcur { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: .12em; color: var(--ground);
  background: var(--active-fill); border-radius: 3px; padding: 2px 5px; white-space: nowrap; }
.deck .mname { font-size: 14px; font-weight: 600; line-height: 1.28; color: var(--t2); margin-top: 5px;
  min-height: calc(1.28em * 3); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden; transition: color .22s; }
.deck .mmeta { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--t2); min-height: 13px; padding-top: 9px; opacity: 0; transition: opacity .26s ease;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.deck .prof { display: block; width: 100%; height: 44px; margin-top: auto; padding-top: 8px; }
@container (min-width: 250px) {
  .deck .modin { padding: 17px; } .deck .mname { font-size: 16px; } .deck .prof { height: 58px; }
  .deck .mmeta { font-size: 10px; }
}
@container (min-width: 330px) {
  .deck .modin { padding: 20px; }
  .deck .mname { font-size: 18.5px; -webkit-line-clamp: 2; min-height: calc(1.28em * 2); }
  .deck .prof { height: 76px; } .deck .mcode { font-size: 11.5px; } .deck .mmeta { font-size: 10.5px; }
}
/* No lift. A card that rises on hover is a card that floats, which is the
   thing this build is trying not to do twice. */
.deck .mod:hover, .deck .mod:focus-visible { opacity: 1; border-color: var(--t3);
  background: var(--raised); box-shadow: 0 12px 26px var(--shadow-c); }
.deck .mod:hover .mname, .deck .mod:focus-visible .mname { color: var(--t1); }
.deck .mod:hover .mmeta, .deck .mod:focus-visible .mmeta { opacity: 1; }
.deck .prof .reveal, .deck .prof .plane { opacity: 0; transition: opacity .26s ease; }
.deck .mod:hover .prof .reveal, .deck .mod:hover .prof .plane,
.deck .mod:focus-visible .prof .reveal, .deck .mod:focus-visible .prof .plane { opacity: 1; }


/* everything animated here is decorative */
@media (prefers-reduced-motion: reduce) {
  .deck .sweep { animation: none; }
  .deck .mod, .deck .prof .reveal, .deck .prof .plane { transition: none; }
  .deck .mod:hover { transform: none; }
}
.app.smooth-air .deck .sweep { animation: none; }
.app.smooth-air .deck .mod { transition: none; }
.app.smooth-air .deck .mod:hover { transform: none; }
`;

function Home({ activeModuleCode, livery, variant, reduceMotion, finish, onGoToChapter, onResumePlace, onEnterModule, onOpenReady, content,
  squadrons = [], squadronMessages = [], seatCandidates = [], threads = [], replies = [], people = [], onSquadronPost, onOpenRoomAt }) {
  // One content source for the whole app. When the seeded content is on, the
  // module screen reads ITS ids and this read data.js's — so a lesson finished
  // over there matched nothing over here and the ring, the checklist and the
  // lamps all stayed at zero. Two content sets is the same bug as two stores
  // of completion, one level up.
  const MODULES = content ? content.modules : FALLBACK_MODULES;
  const chaptersForModule = (code) =>
    content ? (content.modules.find((m) => m.code === code)?.chapters || []) : fallbackChapters(code);
  const CHAPTERS = MODULES.flatMap((m) => chaptersForModule(m.code));
  const { user } = useUser();
  const progress = useUserProgress();
  const { flags } = useFlags();

  const railRef = useRef(null);
  const wrapRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [onModule, setOnModule] = useState([]);   // presence rows on the active module
  const [seat, setSeat] = useState(null);          // the right seat you are in, if any
  const [flights, setFlights] = useState([]);      // who you have flown with, and when
  const [greet, setGreet] = useState("");
  const [railOverflows, setRailOverflows] = useState(false);
  const [tick, setTick] = useState(0);

  // The room itself lives in Deck.jsx and its tokens come off :root. What is
  // still needed here is the solid semantic map, which is what the instruments
  // and the flight profiles paint with.
  const { C, surf, night } = useMemo(() => deckVars(engineLivery(livery), variant), [livery, variant]);



  // ------------------------------------------------------------------- state
  // Everything the instruments read comes through one translation. The module
  // screen and the deck grew separate vocabularies — {correct,total} against a
  // percentage, lesson ids against chapter ids — and every instrument was
  // quietly discarding data it could not recognise, which is why they all sat
  // at their defaults no matter what you did.
  const lessonDoneMap = progress.get("pw-lesson-done", {});
  const lessonPosMap = progress.get("pw-lesson-pos", {});
  const quizRuns = progress.get("pw-quiz-run", {});
  const { completed, viewed, answered, scores } = deckStateFrom({
    chapters: CHAPTERS,
    lessonDone: lessonDoneMap,
    lessonPos: lessonPosMap,
    quiz: progress.get("pw-quiz-scores", {}),
    legacyCompleted: progress.get("pw-completed", []),
  });
  const bookmarks = progress.get("pw-bookmarks", []);
  const lastFlown = progress.get("pw-last-flown", null);
  const state = { completed, viewed, answered };

  const active = MODULES.find((m) => m.code === activeModuleCode) || MODULES[0];
  const activeChapters = chaptersForModule(active.code);
  const activeSegments = moduleSegments(activeChapters, state);
  const activeCount = chapterCount(activeSegments);
  const next = nextChapter(activeChapters, state);
  const nextState = next ? segmentState(next.id, state) : SEGMENT.EMPTY;

  // §2 — the launcher answers WHICH MODULE NEEDS YOU. Same fact, same
  // function, same bar as the lamp on the chapter header inside the module:
  // one of this module's quizzes came in below the user's minimums. Nothing
  // is summed and no second flag is stored — moduleNeedsYou reads the scores.
  const minimums = readMinimums(progress);
  const quizScores = progress.get("pw-quiz-scores", {});
  const moduleRows = MODULES.map((m) => {
    const chs = chaptersForModule(m.code);
    const { full, half, total } = chapterCount(moduleSegments(chs, state));
    const pr = total ? Math.min(1, (full + half * 0.5) / total) : 0;
    return {
      ...m, chapters: total, pr, full, first: chs[0]?.title || null,
      caution: moduleNeedsYou(chs, quizScores, minimums),
    };
  });
  const started = moduleRows.filter((m) => m.pr > 0).length;
  const progressKey = moduleRows.map((m) => m.code + m.pr.toFixed(4)).join("|");

  // The two halves of the instrument, on separate clocks. The rim carries the
  // average against your bar; the ball is live, and parks level until there is
  // a first quiz for the rim to read.
  const { average, flown } = moduleAverage(activeChapters.map((c) => scores[c.id]));
  const still = reduceMotion;
  // The Manual finish draws the same instrument on a smaller, differently
  // centred dial, so the attitude is written for whichever one is mounted.
  const paperDial = finish === "manual";
  const ballRef = useAttitude(still || average == null, paperDial ? { cx: 40, cy: 44, travel: 0.8 } : undefined);

  // Hobbs — hours on this module's airframe. Wall-clock time spent inside the
  // module, counted by the meter in lib/hobbs.js while a module is open, not
  // inferred from how much video has played. Reading it off video position
  // showed nothing for an hour spent on the papers, which is most of the work.
  const hobbs = hobbsClock(hobbsSeconds(progress.get(HOBBS_KEY, {}), active.code));


  // §5.3 — "If a feature behind a preset doesn't exist in the backend yet,
  // don't offer that preset and don't render the Ready Room link." Never ship a
  // door to an empty room.
  const chosen = progress.get(PRESET_KEY, "crew");
  const allowed = chosen === "open" && !flags["social.frequency"] ? "crew" : chosen;
  const preset = PRESETS[!flags["social.crew"] ? "quiet" : allowed] || PRESETS.quiet;
  const roomOn = flags["social.readyroom"];

  // ---------------------------------------------------------------- greeting
  // TODO(step-D): `greetName` is §6.1's "What Wingman calls you". Until that
  // field exists it is unset, and lines carrying {name} are excluded rather
  // than given a fallback word — the spec is explicit about that.
  const greetName = progress.get("pw-greet-name", null) || null;
  const character = flags["voice.characters"]
    ? progress.get("pw-voice", DEFAULT_CHARACTER)
    : DEFAULT_CHARACTER;

  useEffect(() => {
    const away = lastFlown ? Date.now() - new Date(lastFlown).getTime() : null;
    const r = pickGreeting(loadJSON(GREET_KEY, null), {
      now: Date.now(),
      hour: new Date().getHours(),
      name: greetName,
      character,
      awayMs: Number.isFinite(away) ? away : null,
    });
    saveJSON(GREET_KEY, r.state);
    setGreet(r.text);
  }, [greetName, character, lastFlown]);

  // -------------------------------------------------------------------- data
  useEffect(() => {
    let live = true;
    fetchAllPresence(user?.id).then((r) => live && setContacts(r || [])).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  useEffect(() => {
    let live = true;
    // Fly solo is symmetric: you see nobody. Blocked and muted people stay off
    // your route, as they stay out of the room.
    if (isFlySolo()) { setOnModule([]); return undefined; }
    Promise.all([
      fetchModulePresence(active.code, user?.id),
      user?.id ? fetchBlocks(user.id) : [],
      user?.id ? fetchMutes(user.id) : [],
    ])
      .then(([rows, blocked, muted]) => {
        if (!live) return;
        const hidden = new Set([...(blocked || []), ...(muted || [])]);
        // Position, never pace: a mark is the chapter somebody is on, which is
        // what presence already carries, and nothing finer.
        const byUser = new Map();
        (rows || []).forEach((p) => { if (!hidden.has(p.user_id)) byUser.set(p.user_id, p); });
        setOnModule([...byUser.values()]);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [active.code, user?.id]);

  // The seat you are in, and who you have flown with, while the right seat shows.
  const wantSeat = surfacesFor(preset.band, roomOn).seat;
  useEffect(() => {
    let live = true;
    if (!wantSeat || !user?.id) { setSeat(null); setFlights([]); return undefined; }
    fetchSeat(user.id).then((r) => { if (live) setSeat(r); }).catch(() => {});
    fetchFlightLog(user.id).then((r) => { if (live) setFlights(r || []); }).catch(() => {});
    return () => { live = false; };
  }, [wantSeat, user?.id]);

  // Blips are seeded so they hold still between renders.
  const blips = useMemo(() => {
    const R = rng(4114);
    return Array.from({ length: Math.min(contacts.length, 5) }, () => ({
      top: (18 + R() * 62).toFixed(1) + "%",
      left: (18 + R() * 62).toFixed(1) + "%",
    }));
  }, [contacts.length]);

  // --------------------------------------------------------------- profiles
  // Drawn at true pixel size: measure, set the viewBox to match, never scale.
  useLayoutEffect(() => {
    railRef.current?.querySelectorAll(".prof").forEach((svg) => {
      const W = Math.round(svg.clientWidth), H = Math.round(svg.clientHeight);
      if (!W || !H) return;
      const row = moduleRows.find((m) => m.code === svg.dataset.code);
      if (!row) return;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.innerHTML = profileSVG(W, H, row.pr, row.chapters, null, false, C);
    });
    const r = railRef.current;
    if (r) setRailOverflows(r.scrollWidth - r.clientWidth > 2);
    // moduleRows is read out of the closure, so the effect needs a signature of
    // it or a chapter completed in this session leaves every profile stale.
  }, [C, tick, progressKey]);

  useEffect(() => {
    // Coalesced to one bump per frame. tick is a dependency of the effect that
    // redraws every flight profile, so an un-coalesced bump turned a window
    // drag into a re-render and a full SVG remeasure per resize event — and the
    // observer watches elements that resize as a result of that render, which
    // is a feedback loop. Dragging a window from half to full width froze it.
    //
    // cancel-and-reschedule rather than a boolean guard: a guard that is set
    // before a frame that never runs — a backgrounded tab, a dropped frame —
    // latches, and this stops updating for good. That has bitten twice here.
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", bump);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, []);

  // ------------------------------------------------------------------ render
  const heroStarted = nextState !== SEGMENT.EMPTY;

  // The exact spot, when there is one for this module. The card is about that
  // spot rather than about the chapter that happens to contain it — otherwise
  // the title and the line under it describe two different things.
  // The last thing you were on. Not the next unfinished thing, not the first
  // thing still owing — the last thing, whatever it was and whether or not it
  // is finished. A lesson watched to the end and a quiz three chapters ahead
  // of where you "should" be are both valid answers to "where was I", and
  // filtering them out is how Resume stopped meaning what it says.
  const place = placeList(progress.get(PLACE_KEY, null))[0] || null;
  const placeChapter = place?.chapterId
    ? CHAPTERS.find((c) => c.id === place.chapterId) || null
    : null;
  const placeLesson = place?.lessonId
    ? (placeChapter?.lessons || []).find((l) => l.id === place.lessonId) || null
    : null;
  const resumeLine = placeLine(place, placeLesson, Boolean(place?.kind === "quiz" && quizRuns[place.chapterId]));
  const heroChapter = placeChapter || next;
  const onResume = () => {
    if (place) return onResumePlace?.(place);
    if (next) onGoToChapter(active.code, next.id);
  };
  const bag = bookmarks.length;
  const contactCount = contacts.length
    ? `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`
    : null;
  const contactCap = contactCount
    ? (roomOn ? `${contactCount} · Ready Room` : contactCount)
    : "The Ready Room finds you company.";

  // ---------------------------------------------------- back on the ground
  // The student's preset still decides what shows, as it did for the band, and
  // every door in the section leads into the Ready Room. What the data becomes
  // is in lib/ground.js, where check:ground holds its rules.
  const surfaces = surfacesFor(preset.band, roomOn);
  const me = user?.id || null;
  const { person, nameOf } = makePeople({
    moduleCode: active.code, chapters: activeChapters, people, presence: onModule,
    seatCandidates, seat, flights,
  });
  const groundSquadron = squadronFor({ me, moduleCode: active.code, squadrons, messages: squadronMessages, person, nameOf });
  const routePeople = routePeopleFor({ me, surfaces, squadron: groundSquadron, presence: onModule, seat, person });
  const groundThreads = threadsFor({ me, moduleCode: active.code, threads, replies, nameOf });
  const groundModule = moduleFor({
    name: active.name, chapters: activeChapters, progress: { done: lessonDoneMap, pos: lessonPosMap }, next,
  });

  return (
    <>
      <div className="inner">
        <div className="dhead">
          <h1 className="title">Flight Deck</h1>
          <div className="greet">{greet}</div>
          <div className="since">{lastFlownPhrase(lastFlown)}</div>
        </div>

        {/* The hero card is never touched by social. */}
        <div className="card">
          <div className="cardbody">
            <div className="cardtext">
              <div className="chapter">{heroChapter ? heroChapter.title : active.name}</div>
              <div className="hcode">{heroChapter ? heroChapter.code : active.code} · {active.name}</div>
              <div className="position">
                {/* No invented number. This was `next?.lessons?.length || 2`,
                    so a chapter whose lessons had not loaded — or genuinely
                    had none, since 0 is falsy — told the student "2 lessons
                    waiting" on no evidence at all. A count shown as fact has
                    to be one; where there is none, the sentence names the
                    action instead, which is what the empty-state rule asks
                    for anyway. */}
                {resumeLine
                  || (heroStarted
                    ? "Pick up where you left off."
                    : (next?.lessons?.length
                      ? `${next.lessons.length} lesson${next.lessons.length === 1 ? "" : "s"} waiting.`
                      : "Start the first lesson."))}
              </div>
            </div>
            {/* A sibling of the text, not a child of it — that is what puts it
                beside the words rather than under them. */}
            {flags["module.interior"] && (
              <button className="resume" type="button" onClick={onResume}>
                {resumeLine ? placeVerb(place) : heroStarted ? "Resume" : "Start the briefing"} &nbsp;›
              </button>
            )}
          </div>

          <div className="strip">
            {/* Manual draws the same five instruments instead of lighting them. */}
            {finish === "manual" ? (
              <PaperStrip
                ballRef={ballRef}
                ring={average}
                bar={minimums}
                flown={flown}
                palette={C}
                bag={bag > 0 ? bag : 0}
                boxes={activeCount.full}
                boxCount={activeSegments.length}
                hobbs={hobbs ? `${hobbs.h}:${hobbs.m}` : "--:--"}
                blips={contacts.length > 0}
                caps={[
                  <GyroCaption average={average} bar={minimums} />,
                  bag > 0 ? "Flight bag" : "A bookmark fills the bag.",
                  "Checklist",
                  hobbs ? "Hobbs" : "Your first hour",
                  contactCap,
                ]}
              />
            ) : (
            <>
            <div className="cel">
              <div className="aiwrap">
                <Gyro average={average} flown={flown} bar={minimums}
                      C={C} surf={surf} night={night} ballRef={ballRef} />
              </div>
              <div className="cap"><GyroCaption average={average} bar={minimums} /></div>
            </div>

            <div className="cel">
              {bag > 0 ? (
                <div className="ladder">
                  {bag + 2}<br />{bag + 1}<b>{bag}</b>{bag - 1}<br />{bag > 1 ? bag - 2 : ""}
                </div>
              ) : (
                <svg className="bagglyph" viewBox="0 0 32 30" fill="none" aria-hidden="true">
                  <path d="M4 10h24v15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V10Z"
                        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M11 10V6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v4" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 16h24" stroke="currentColor" strokeWidth="1.6" opacity=".5" />
                </svg>
              )}
              <div className="cap">{bag > 0 ? "Flight bag" : "A bookmark fills the bag."}</div>
            </div>

            <div className="cel">
              <div className="lamps" style={{ "--legs": activeSegments.length }}>
                {activeSegments.map((s) => (
                  <i key={s.id} className={`lamp ${s.fill === SEGMENT.FULL ? "on" : ""}`} />
                ))}
              </div>
              <div className="cap">Checklist</div>
            </div>

            <div className="cel">
              <div className="hobbs">
                {hobbs
                  ? <>{hobbs.h}<i>:{hobbs.m}</i></>
                  : <>--<i>:--</i></>}
              </div>
              <div className="cap">{hobbs ? "Hobbs" : "Your first hour"}</div>
            </div>

            {/* Social's only foothold in the academic half. */}
            {(() => {
              const face = (
                <>
                  <div className={`radar ${contacts.length ? "" : "quiet"}`}>
                    <span className="ring r1" /><span className="ring r2" /><span className="sweep" />
                    {blips.map((b, i) => <span key={i} className="blip" style={b} />)}
                  </div>
                  <div className="cap">{contactCap}</div>
                </>
              );
              return roomOn ? (
                <button className="cel radarcel" type="button" onClick={onOpenReady}
                        aria-label={`Ready Room, ${contacts.length} on frequency`}>
                  {face}
                </button>
              ) : (
                <div className="cel" role="img" aria-label={`Radar, ${contacts.length} on frequency`}>
                  {face}
                </div>
              );
            })()}
            </>
            )}
          </div>
        </div>

        {/* The module cards are never touched by social. */}
        <div className="sec">
          <div className="sechead">
            <h2>Modules</h2>
            <div className="more">{started ? `${started} active` : `${moduleRows.length} to choose from`}</div>
          </div>
          <div className={`railwrap ${railOverflows ? "more" : ""}`} ref={wrapRef}>
            <div className="rail" ref={railRef}>
              {/* data-code stays: the deck reads it, and it is the module's
                  identifier rather than anything to do with motion. The card
                  used to be given a shared transition name here so it grew
                  into the module heading; that whole mechanism is gone — see
                  the transition layer in app.css for why a named element could
                  not be made to stop flickering. */}
              {moduleRows.map((m) => (
                <Cell className="mod house" data-press="" data-code={m.code} key={m.code} open={flags["module.interior"]}
                      onOpen={() => onEnterModule(m)}>
                  <div className="modin">
                    <div className="mcodeline">
                      <span className="mcode">{m.code}</span>
                      {/* §2/§9 — the lamp sits BESIDE the CURRENT badge, so the
                          two share the right-hand slot rather than being spread
                          apart by the row's space-between. A static mark, not a
                          button: the card is already a button and nesting one
                          inside it is invalid and unreachable. */}
                      <span className="mcodeend">
                        {m.caution
                          ? <CautionMark compact className="modlamp" />
                          : m.code === active.code
                            ? <span className="mcur">CURRENT</span>
                            : flags["module.interior"]
                              ? <span className="mchev" dangerouslySetInnerHTML={{ __html: CHEV }} />
                              : null}
                      </span>
                    </div>
                    <div className="mname">{m.name}</div>
                    <div className="mmeta">
                      {m.pr > 0
                        ? `${phaseName(m.pr)} · ${Math.min(m.chapters, m.full + 1)} of ${m.chapters}`
                        : "Open it and find out"}
                    </div>
                    <svg className="prof" data-code={m.code} aria-hidden="true" />
                  </div>
                </Cell>
              ))}
            </div>
          </div>
        </div>

        {/* Everything social lives in this one section. It draws its own heading
            and Ready Room link, measures itself, and renders nothing with every
            surface off. Every door opens its own place in the Ready Room, and a face
            opens that person's profile sheet there until the new profile lands. */}
        <BackOnTheGround
          module={groundModule}
          surfaces={surfaces}
          squadron={groundSquadron}
          routePeople={routePeople}
          threads={groundThreads}
          onOpenPerson={(p) => onOpenRoomAt?.({ kind: "person", id: p.id, moduleCode: active.code })}
          onOpenThread={(t) => onOpenRoomAt?.({ kind: "thread", moduleCode: active.code, threadId: t.id })}
          onOpenReadyRoom={onOpenReady}
          onFindSquadron={() => onOpenRoomAt?.({ kind: "discover" })}
          onFindSeat={() => onOpenRoomAt?.({ kind: "seat" })}
          onAsk={() => onOpenRoomAt?.({ kind: "ask", moduleCode: active.code })}
          onSend={(text) => { if (groundSquadron) onSquadronPost?.({ squadronId: groundSquadron.id, body: text }); }}
        />
      </div>

      <style>{DECK_CSS}</style>
    </>
  );
}


export default Home;
