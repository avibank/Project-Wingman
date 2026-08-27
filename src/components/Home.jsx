import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSocialPrefs } from "../lib/social.js";
import { fetchAllPresence, fetchModulePresence } from "../lib/presence.js";
import { fetchPartnerSuggestions } from "../lib/partners.js";
import { fetchMessages } from "../lib/comms.js";
import { moduleSegments, chapterCount, nextChapter, SEGMENT, segmentState } from "../lib/progressModel.js";
import { deckVars, engineLivery, rng } from "../lib/liveryEngine.js";
import { profileSVG, phaseName, chapterT } from "../lib/flightProfile.js";
import { pickGreeting } from "../lib/greeting.js";
import { moduleAverage, chop } from "../lib/attitude.js";
import { useAttitude } from "../lib/useAttitude.js";
import { DEFAULT_CHARACTER } from "../lib/voices.js";
import { useFlags } from "../lib/flags.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import PaperStrip from "./PaperStrip.jsx";

// The Flight Deck. Ported from the Step 1 reference rig — the colour and
// lighting system, the hero card with the instrument strip inside it, the
// module rail, and the crew band — with the bench chrome stripped out.
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

function Cell({ className, open, onOpen, children }) {
  return open
    ? <button className={className} type="button" onClick={onOpen}>{children}</button>
    : <div className={className}>{children}</div>;
}

const CHEV = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
  <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "··";


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

// Presence carries a chapter id; everything the deck shows is a chapter code.
const chapterCodeOf = (id) => {
  if (!id) return null;
  for (const m of MODULES) {
    const hit = chaptersForModule(m.code).find((c) => c.id === id);
    if (hit) return hit.code;
  }
  return null;
};


function hhmm(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    : "";
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
.deck .cardbody { padding: 18px; display: flex; gap: 17px; align-items: flex-start; flex-wrap: wrap; }
.deck .frame { width: 124px; height: 72px; border-radius: 8px; flex: none; background: var(--raised);
  border: 1px solid var(--line); position: relative; overflow: hidden; }
.deck .frame::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px;
  width: var(--frame-pos, 0%); background: var(--active); }
.deck .frame .play { position: absolute; inset: 0; margin: auto; width: 24px; height: 24px;
  border-radius: 50%; background: var(--active-fill); }
.deck .frame .play::after { content: ""; position: absolute; inset: 0; margin: auto; width: 0; height: 0;
  border-left: 8px solid var(--ground); border-top: 5px solid transparent; border-bottom: 5px solid transparent;
  transform: translateX(1px); }
.deck .cardtext { flex: 1; min-width: 220px; }
.deck .chapter { font-size: 18px; font-weight: 600; letter-spacing: -.2px; }
.deck .hcode { font-family: var(--font-mono); font-size: 11px; color: var(--t3); letter-spacing: .05em; }
.deck .position { font-size: 12.5px; color: var(--t2); margin-top: 5px; }
.deck .resume { margin-top: 12px; background: var(--active-fill); color: var(--ground); border: 0;
  border-radius: 999px; padding: 8px 18px; font-size: 12.5px; font-weight: 600; cursor: pointer; }

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
   background shorthand, which resets background-image.
   .crew is deliberately absent — it is a grid whose 1px gaps show its own
   background through, so a background-image on it paints the gap lines. */
.deck .card, .deck .mod, .deck .cel { background-image: var(--sheen-img, none); }

/* The cast shadow. Nothing read --drop before this: these surfaces were flat
   with a border. Night sets it to none, so this is inert there. */
.deck .card, .deck .mod, .deck .crew { box-shadow: var(--drop, none); }

.deck .cap { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .13em; text-transform: uppercase;
  color: var(--t2); text-align: center; }
.deck .ai { width: calc(112px * var(--scale, 1)); height: calc(112px * var(--scale, 1)); display: block; }
.deck .ai-rim { transition: stroke-dasharray 600ms cubic-bezier(.16,.84,.34,1); }
@media (prefers-reduced-motion: reduce) { .deck .ai-rim { transition: none; } }
.app.smooth-air .deck .ai-rim { transition: none; }
.deck .ladder { font-family: var(--font-mono); font-size: calc(11px * var(--scale, 1)); line-height: 1.55; text-align: center;
  background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 5px 13px; color: var(--t3); }
.deck .ladder b { display: block; font-size: calc(19px * var(--scale, 1)); font-weight: 500; color: var(--on); }
.deck .bagglyph { width: calc(32px * var(--scale, 1)); height: calc(30px * var(--scale, 1)); color: var(--t3); }
.deck .lamps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: calc(88px * var(--scale, 1)); }
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
.deck .sec { margin-top: 30px; }
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
.deck .mod { container-type: inline-size; flex: 1 1 0; min-width: 180px; scroll-snap-align: start;
  text-align: left; color: inherit; cursor: pointer; background: var(--panel);
  border: 1px solid var(--line); border-top-color: var(--edge-hi); border-bottom-color: var(--edge-lo);
  border-radius: 12px; padding: 0; overflow: hidden; opacity: .84;
  transition: transform .22s cubic-bezier(.2,.8,.3,1), border-color .22s, background .22s, box-shadow .22s, opacity .22s; }
.deck .modin { padding: 14px; display: flex; flex-direction: column; height: 100%; }
.deck .mcodeline { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 15px; }
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
.deck .mod:hover, .deck .mod:focus-visible { opacity: 1; transform: translateY(-3px); border-color: var(--t3);
  background: var(--raised); box-shadow: 0 12px 26px var(--shadow-c); }
.deck .mod:hover .mname, .deck .mod:focus-visible .mname { color: var(--t1); }
.deck .mod:hover .mmeta, .deck .mod:focus-visible .mmeta { opacity: 1; }
.deck .prof .reveal, .deck .prof .plane { opacity: 0; transition: opacity .26s ease; }
.deck .mod:hover .prof .reveal, .deck .mod:hover .prof .plane,
.deck .mod:focus-visible .prof .reveal, .deck .mod:focus-visible .prof .plane { opacity: 1; }

/* ------------------------------------------------------------ crew strip */
.deck .crew { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line);
  border-radius: 13px; border-top-color: var(--edge-hi); border-bottom-color: var(--edge-lo); overflow: hidden; }
.deck .crew.n3 { grid-template-columns: minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.25fr); }
.deck .crew.n2 { grid-template-columns: minmax(0,1.45fr) minmax(0,1fr); }
@media (max-width: 940px) { .deck .crew.n3, .deck .crew.n2 { grid-template-columns: minmax(0,1fr); } }
.deck .cell { background: var(--panel); padding: 16px 17px; display: flex; flex-direction: column;
  gap: 11px; min-height: 176px; }
.deck .cellhead { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .13em;
  text-transform: uppercase; color: var(--t3); }
.deck .formsvg { display: block; width: 100%; height: 92px; margin-top: 2px; }
.deck .formlist { display: flex; gap: 14px; flex-wrap: wrap; margin-top: auto; align-items: center; }
.deck .fm { display: flex; align-items: center; gap: 7px; min-width: 0; }
.deck .fm .av { width: 22px; height: 22px; font-size: 8.5px; }
.deck .fmname { font-size: 12px; font-weight: 600; }
.deck .fmpos { font-family: var(--font-mono); font-size: 9px; letter-spacing: .08em;
  text-transform: uppercase; color: var(--t3); }
.deck .fmnote { font-size: 12.5px; color: var(--t2); }
.deck .av { width: 30px; height: 30px; border-radius: 50%; flex: none; display: grid; place-items: center;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--ground); background: var(--active-fill); }
.deck .av.dim { background: var(--raised); color: var(--t2); box-shadow: inset 0 0 0 1px var(--line); }
.deck .cop { display: flex; align-items: center; gap: 12px; }
.deck .cop .av { width: 42px; height: 42px; font-size: 13px; }
.deck .copname { font-size: 16px; font-weight: 600; letter-spacing: -.2px; }
.deck .copwhy { font-size: 12.5px; color: var(--t2); line-height: 1.4; }
.deck .copmeta { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .1em;
  text-transform: uppercase; color: var(--t3); }
.deck .fly { align-self: flex-start; margin-top: auto; background: var(--active-fill); color: var(--ground);
  border: 0; border-radius: 999px; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.deck .freqhead { display: flex; align-items: baseline; gap: 8px; }
.deck .freqcode { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .11em; color: var(--t3); }
.deck .freqname { font-size: 13px; font-weight: 600; letter-spacing: -.1px; }
.deck .msgs { display: flex; flex-direction: column; gap: 7px; flex: 1; }
.deck .msg { font-size: 12.5px; line-height: 1.45; color: var(--t2); }
.deck .msg b { color: var(--t1); font-weight: 600; }
.deck .tick { font-family: var(--font-mono); font-size: 9px; color: var(--t3); letter-spacing: .06em; }
.deck .compose { display: flex; align-items: center; gap: 9px; border: 1px solid var(--line);
  border-radius: 999px; padding: 8px 14px; color: var(--t3); font-size: 12.5px; text-align: left;
  cursor: pointer; background: color-mix(in oklab, var(--raised), transparent 40%); }
.deck .compose span { flex: 1; }
.deck .send { width: 19px; height: 19px; border-radius: 50%; background: var(--raised); flex: none; }

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

function Home({ activeModuleCode, livery, variant, reduceMotion, finish, onGoToChapter, onEnterModule, onOpenReady, onOpenChannel }) {
  const { user } = useUser();
  const progress = useUserProgress();
  const { prefs } = useSocialPrefs();
  const { flags } = useFlags();

  const railRef = useRef(null);
  const wrapRef = useRef(null);
  const formRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [crew, setCrew] = useState([]);
  const [wingman, setWingman] = useState(undefined);   // undefined = still loading
  const [msgs, setMsgs] = useState(undefined);
  const [greet, setGreet] = useState("");
  const [railOverflows, setRailOverflows] = useState(false);
  const [tick, setTick] = useState(0);

  // The room itself lives in Deck.jsx and its tokens come off :root. What is
  // still needed here is the solid semantic map, which is what the instruments
  // and the flight profiles paint with.
  const { C, surf, night } = useMemo(() => deckVars(engineLivery(livery), variant), [livery, variant]);



  // ------------------------------------------------------------------- state
  const completed = new Set(progress.get("pw-completed", []));
  const viewed = new Set(progress.get("pw-viewed-chapters", []));
  const answered = progress.get("pw-chapter-progress", {});
  const scores = progress.get("pw-quiz-scores", {});
  const bookmarks = progress.get("pw-bookmarks", []);
  const lastFlown = progress.get("pw-last-flown", null);
  const state = { completed, viewed, answered };

  const active = MODULES.find((m) => m.code === activeModuleCode) || MODULES[0];
  const activeChapters = chaptersForModule(active.code);
  const activeSegments = moduleSegments(activeChapters, state);
  const activeCount = chapterCount(activeSegments);
  const next = nextChapter(activeChapters, state);
  const nextState = next ? segmentState(next.id, state) : SEGMENT.EMPTY;

  const moduleRows = MODULES.map((m) => {
    const chs = chaptersForModule(m.code);
    const { full, half, total } = chapterCount(moduleSegments(chs, state));
    const pr = total ? Math.min(1, (full + half * 0.5) / total) : 0;
    return { ...m, chapters: total, pr, full, first: chs[0]?.title || null };
  });
  const started = moduleRows.filter((m) => m.pr > 0).length;
  const activeRow = moduleRows.find((m) => m.code === active.code) || moduleRows[0];
  const progressKey = moduleRows.map((m) => m.code + m.pr.toFixed(4)).join("|");

  // The two halves of the instrument, on separate clocks. The rim carries the
  // score; the ball is live and never waits for it.
  const { average, flown } = moduleAverage(activeChapters.map((c) => scores[c.id]));
  const still = reduceMotion;
  const ballRef = useAttitude(still);

  // Hobbs — chapters flown. It used to sum briefing durations; content carries
  // no durations now, so the same instrument counts the thing that does exist.
  const hobbs = MODULES.flatMap((m) => chaptersForModule(m.code))
    .filter((c) => viewed.has(c.id) || completed.has(c.id)).length;


  // §5.3 — "If a feature behind a preset doesn't exist in the backend yet,
  // don't offer that preset and don't render the Ready Room link." Never ship a
  // door to an empty room.
  const chosen = progress.get(PRESET_KEY, "crew");
  const allowed = chosen === "open" && !flags["social.frequency"] ? "crew" : chosen;
  const preset = PRESETS[!flags["social.crew"] ? "quiet" : allowed] || PRESETS.quiet;
  const roomOn = flags["social.readyroom"];

  // ---------------------------------------------------------------- greeting
  // The greeter is off until you give it a name to call you. Silence is the
  // default: a stranger talking to you before you have told it anything is
  // worse than no line at all. Set a name in Preferences and it starts, and it
  // keeps going until the field is cleared again.
  const greetName = progress.get("pw-greet-name", null) || null;
  const greeterOn = !!greetName;
  const character = flags["voice.characters"]
    ? progress.get("pw-voice", DEFAULT_CHARACTER)
    : DEFAULT_CHARACTER;

  useEffect(() => {
    if (!greeterOn) { setGreet(""); return; }
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
  }, [greetName, character, lastFlown, greeterOn]);

  // -------------------------------------------------------------------- data
  useEffect(() => {
    let live = true;
    fetchAllPresence(user?.id).then((r) => live && setContacts(r || [])).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  useEffect(() => {
    let live = true;
    fetchModulePresence(active.code, user?.id)
      .then((rows) => {
        if (!live) return;
        // Position, never pace: a crewmate's mark is the chapter they are on,
        // which is what presence already carries.
        const byUser = new Map();
        (rows || []).forEach((p) => byUser.set(p.user_id, p));
        setCrew([...byUser.values()].map((p) => {
          const i = activeChapters.findIndex((c) => c.id === p.chapter_id);
          return {
            id: p.user_id,
            ini: initials(p.display_name),
            name: p.display_name || "Pilot",
            code: i >= 0 ? activeChapters[i].code : "at the gate",
            pr: i >= 0 ? chapterT(i, activeChapters.length) : 0.08,
          };
        }));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [active.code, user?.id]);

  useEffect(() => {
    let live = true;
    if (!user?.id) { setWingman(null); return undefined; }
    fetchPartnerSuggestions({ userId: user.id, moduleCode: active.code, course: prefs?.course })
      .then((r) => live && setWingman(r?.suggestions?.[0] || null))
      .catch(() => live && setWingman(null));
    return () => { live = false; };
  }, [user?.id, active.code, prefs?.course]);

  useEffect(() => {
    let live = true;
    if (!preset.band.includes("freq")) { setMsgs(undefined); return undefined; }
    fetchMessages({ moduleCode: active.code, userId: user?.id, limit: 12 })
      .then((r) => live && setMsgs((r || []).slice(-3)))
      .catch(() => live && setMsgs([]));
    return () => { live = false; };
  }, [active.code, user?.id, preset.band]);

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
    const fs = formRef.current;
    if (fs) {
      const W = Math.round(fs.clientWidth), H = Math.round(fs.clientHeight);
      if (W && H) {
        fs.setAttribute("viewBox", `0 0 ${W} ${H}`);
        fs.setAttribute("preserveAspectRatio", "none");
        fs.innerHTML = profileSVG(W, H, activeRow.pr, activeChapters.length, crew, true, C);
      }
    }
    const r = railRef.current;
    if (r) setRailOverflows(r.scrollWidth - r.clientWidth > 2);
    // moduleRows is read out of the closure, so the effect needs a signature of
    // it or a chapter completed in this session leaves every profile stale.
  }, [C, crew, tick, progressKey, preset.band]);

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
    if (ro && formRef.current) ro.observe(formRef.current);
    window.addEventListener("resize", bump);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, [preset.band]);

  // ------------------------------------------------------------------ render
  const heroStarted = nextState !== SEGMENT.EMPTY;
  const framePos = next ? (completed.has(next.id) ? 100 : heroStarted ? 56 : 0) : 0;
  const bag = bookmarks.length;
  const contactCount = contacts.length
    ? `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`
    : null;
  const contactCap = contactCount
    ? (roomOn ? `${contactCount} · Ready Room` : contactCount)
    : "Nobody on your route yet";

  return (
    <>
      <div className="inner">
        <div className="dhead">
          <h1 className="title">Flight Deck</h1>
          {greeterOn && greet && <div className="greet">{greet}</div>}
          <div className="since">{lastFlownPhrase(lastFlown)}</div>
        </div>

        {/* The hero card is never touched by social. */}
        <div className="card">
          <div className="cardbody">
            <div className="frame" style={{ "--frame-pos": framePos + "%" }} />
            <div className="cardtext">
              <div className="chapter">{next ? next.title : active.name}</div>
              <div className="hcode">{next ? next.code : active.code} · {active.name}</div>
              {/* TODO(step-2): the exact resume timestamp arrives with the
                  chapter view's player. Until then this is the coarse state. */}
              <div className="position">
                {heroStarted
                  ? "Pick up where you left off."
                  : `${next?.lessons?.length || 2} lessons waiting.`}
              </div>
              {flags["module.interior"] && (
                <button className="resume" type="button" onClick={() => next && onGoToChapter(active.code, next.id)}>
                  {heroStarted ? "Resume" : "Start the briefing"} &nbsp;›
                </button>
              )}
            </div>
          </div>

          <div className="strip">
            {/* Manual draws the same five instruments instead of lighting them. */}
            {finish === "manual" ? (
              <PaperStrip
                ring={average}
                bag={bag > 0 ? bag : 0}
                boxes={activeCount.full}
                hobbs={hobbs > 0
                  ? `${String(Math.floor(hobbs)).padStart(3, "0")}.${Math.floor((hobbs % 1) * 10)}`
                  : "--.-"}
                blips={contacts.length > 0}
                caps={[
                  average == null ? "First quiz fills the ring." : `${chop(average)} · ${average}%`,
                  bag > 0 ? "Flight bag" : "Nothing saved yet",
                  activeCount.full
                    ? `Checklist · ${activeCount.full} of ${activeCount.total}`
                    : `Checklist · ${activeCount.total} to fly`,
                  hobbs > 0 ? "Hobbs" : "Your first hour",
                  contactCap,
                ]}
              />
            ) : (
            <>
            <div className="cel">
              <svg className="ai" viewBox="0 0 120 120" role="img"
                   aria-label={average == null ? "Attitude indicator, no quiz flown yet" : `Attitude indicator, ${average} percent across ${flown} ${flown === 1 ? "quiz" : "quizzes"}`}>
                <defs><clipPath id="pw-dial"><circle cx="60" cy="60" r="42" /></clipPath></defs>
                <g clipPath="url(#pw-dial)">
                  {/* The ball. Its transform is written straight onto the node
                      every frame — see useAttitude — so it never re-renders the
                      deck and wants no CSS transition of its own. */}
                  <g ref={ballRef} transform="rotate(0 60 60) translate(0 0)">
                    <rect x="-70" y="-80" width="260" height="140" fill={surf[night ? 7 : 9]} />
                    <rect x="-70" y="60" width="260" height="140" fill={surf[night ? 1 : 6]} />
                    <rect x="-70" y="59" width="260" height="1.6" fill={C.lit} />
                    <g stroke={surf[night ? 10 : 4]} strokeWidth="1.4">
                      <line x1="52" y1="46" x2="68" y2="46" /><line x1="55" y1="52.5" x2="65" y2="52.5" />
                      <line x1="55" y1="66.5" x2="65" y2="66.5" /><line x1="52" y1="73" x2="68" y2="73" />
                    </g>
                  </g>
                </g>
                <circle cx="60" cy="60" r="42" fill="none" strokeWidth="1" stroke={C.line} />
                <circle cx="60" cy="60" r="49" fill="none" strokeWidth="3" stroke={C.line} />
                {average != null && (
                  <circle className="ai-rim" cx="60" cy="60" r="49" fill="none" strokeWidth="3" stroke={C.active}
                          strokeLinecap="round" transform="rotate(-90 60 60)"
                          strokeDasharray={`${(2 * Math.PI * 49 * (average / 100)).toFixed(1)} ${(2 * Math.PI * 49).toFixed(1)}`} />
                )}
                <g fill={C.line}>
                  <circle cx="21" cy="21" r="1.8" /><circle cx="99" cy="21" r="1.8" />
                  <circle cx="21" cy="99" r="1.8" /><circle cx="99" cy="99" r="1.8" />
                </g>
                <g strokeWidth="5.2" strokeLinecap="round" fill="none" opacity=".85" stroke={surf[night ? 0 : 12]}>
                  <line x1="38" y1="60" x2="52" y2="60" /><line x1="68" y1="60" x2="82" y2="60" />
                </g>
                <g strokeWidth="2.6" strokeLinecap="round" fill="none" stroke={surf[night ? 11 : 1]}>
                  <line x1="38" y1="60" x2="52" y2="60" /><line x1="68" y1="60" x2="82" y2="60" />
                </g>
                <circle cx="60" cy="60" r="3.6" fill={surf[night ? 0 : 12]} opacity=".85" />
                <circle cx="60" cy="60" r="2.2" fill={surf[night ? 11 : 1]} />
                {average != null && (
                  <text x="60" y="88" textAnchor="middle" fill={C.t1}
                        fontFamily="Geist Mono, monospace" fontSize="13" fontWeight="500">{average}%</text>
                )}
              </svg>
              <div className="cap">{average == null ? "First quiz fills the ring." : `${chop(average)} · ${average}%`}</div>
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
              <div className="cap">{bag > 0 ? "Flight bag" : "Nothing saved yet"}</div>
            </div>

            <div className="cel">
              <div className="lamps">
                {activeSegments.map((s) => (
                  <i key={s.id} className={`lamp ${s.fill === SEGMENT.FULL ? "on" : ""}`} />
                ))}
              </div>
              <div className="cap">
                {activeCount.full
                  ? `Checklist · ${activeCount.full} of ${activeCount.total}`
                  : `Checklist · ${activeCount.total} to fly`}
              </div>
            </div>

            <div className="cel">
              <div className="hobbs">
                {hobbs > 0
                  ? <>{String(Math.floor(hobbs)).padStart(3, "0")}<i>.{Math.floor((hobbs % 1) * 10)}</i></>
                  : <>--<i>.-</i></>}
              </div>
              <div className="cap">{hobbs > 0 ? "Hobbs" : "Your first hour"}</div>
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
              {moduleRows.map((m) => (
                <Cell className="mod" key={m.code} open={flags["module.interior"]} onOpen={() => onEnterModule(m)}>
                  <div className="modin">
                    <div className="mcodeline">
                      <span className="mcode">{m.code}</span>
                      {m.code === active.code
                        ? <span className="mcur">CURRENT</span>
                        : flags["module.interior"]
                          ? <span className="mchev" dangerouslySetInnerHTML={{ __html: CHEV }} />
                          : null}
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

        {/* Everything social lives in this one band. */}
        {preset.band.length > 0 && (
          <div className="sec">
            <div className="sechead">
              <h2>Back on the ground</h2>
              {roomOn && <button className="more" type="button" onClick={onOpenReady}>Ready Room ›</button>}
            </div>
            <div className={`crew n${preset.band.length}`}>
              {preset.band.includes("form") && (
                <div className="cell">
                  <div className="cellhead">Formation · {active.name}</div>
                  <svg className="formsvg" ref={formRef} aria-hidden="true" />
                  <div className="formlist">
                    <span className="fm">
                      <span className="av">YOU</span>
                      <span><span className="fmname">You</span> <span className="fmpos">{next?.code || active.code}</span></span>
                    </span>
                    {crew.map((p) => (
                      <span className="fm" key={p.id}>
                        <span className="av dim">{p.ini}</span>
                        <span><span className="fmname">{p.name}</span> <span className="fmpos">{p.code}</span></span>
                      </span>
                    ))}
                    {!crew.length && <span className="fmnote">First on this route. The Ready Room finds you company.</span>}
                  </div>
                </div>
              )}

              {preset.band.includes("wing") && (
                <div className="cell">
                  <div className="cellhead">Your wingman</div>
                  {wingman ? (
                    <>
                      <div className="cop">
                        <span className="av">{initials(wingman.displayName)}</span>
                        <span>
                          <span className="copname">{wingman.displayName || "Pilot"}</span>
                          <div className="copwhy">{wingman.reason}</div>
                        </span>
                      </div>
                      <div className="copmeta">{chapterCodeOf(wingman.chapterId) || "On frequency now"}</div>
                      {roomOn && <button className="fly" type="button" onClick={onOpenReady}>Fly together &nbsp;›</button>}
                    </>
                  ) : (
                    <>
                      <div className="copwhy">
                        {wingman === undefined
                          ? "Looking for someone on your route."
                          : "The Ready Room pairs you the moment there's someone on your route."}
                      </div>
                      {roomOn && <button className="fly" type="button" onClick={onOpenReady}>Open the Ready Room &nbsp;›</button>}
                    </>
                  )}
                </div>
              )}

              {preset.band.includes("freq") && (
                <div className="cell">
                  <div className="cellhead">Frequency</div>
                  <div className="freqhead">
                    <span className="freqcode">{active.code}</span>
                    <span className="freqname">{active.name}</span>
                  </div>
                  <div className="msgs">
                    {msgs && msgs.length ? (
                      <>
                        {msgs.map((m) => (
                          <div className="msg" key={m.id}>
                            <b>{m.author_username || m.author_real_name || "Pilot"}</b> {m.body}
                          </div>
                        ))}
                        <div className="tick">QUIET SINCE {hhmm(msgs[msgs.length - 1].created_at)}</div>
                      </>
                    ) : (
                      <div className="msg">Quiet frequency. Say the first thing and someone answers.</div>
                    )}
                  </div>
                  {roomOn && (
                    <button className="compose" type="button" onClick={() => onOpenChannel(active.code)}>
                      <span>Message {active.code}…</span><i className="send" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{DECK_CSS}</style>
    </>
  );
}


export default Home;
