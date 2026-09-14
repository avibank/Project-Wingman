import { useEffect, useState } from "react";
import { BackOnTheGround } from "../components/ground/BackOnTheGround.jsx";
import { deckVars, LIVERIES } from "../lib/liveryEngine.js";
import { finishVars } from "../lib/finishEngine.js";
import "../styles/foundations.css";
import "../styles/app.css";
import "../components/ground/ground.css";
import "./ground-harness.css";

/* NOT part of the app. Opens only at ?bog=1 in development (see main.jsx) and
   is never linked. It renders the section in every state we care about so a
   change can be seen and machine-checked before it goes near the deck.

   Two things this app needs that the pack's harness did not have. The tokens
   are written by App at runtime rather than sitting in a stylesheet, so the
   livery, lighting and finish are applied here from the same engines. And each
   stage carries a copy of the app's 44px tap floor, so the audit sees what the
   deck will do to a small button. */

const NAMES = ["Jouri", "Saqer", "Bader", "Faisal", "Abdulmohssen", "Hessa",
               "Abdulrahman", "Rayan", "Bloushi", "Tahoos", "Jasem"];
const CATS = ["B1", "B2"];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const person = (i, chapter, seat) => ({
  id: `p${i}`, name: NAMES[i % NAMES.length], category: CATS[i % 2], chapter, seat: !!seat,
  flewAt: i % 3 === 1 ? daysAgo(i) : null,
});

const THREADS = [
  { id: "t1", title: "Why does the AHRS need a compass calibration after a battery change?",
    meta: "Yours · 2 answers · 20m", mine: true, answers: 2, answeredBy: "Saqer", when: "20m",
    excerpt: "Saqer: the magnetometer holds its own hard-iron correction, and losing power drops it." },
  { id: "t2", title: "Gyro drift limits — where does the 3 degrees come from?",
    meta: "5 answers · 2h", answers: 5, when: "2h" },
  { id: "t3", title: "LTT 13d page 212 contradicts the syllabus", meta: "Answered · 1d", answers: 1, when: "1d" },
  { id: "t4", title: "Anyone sat the chapter 3 quiz twice?", meta: "3 answers · 2d", answers: 3, when: "2d" },
];

const MESSAGES = [
  { id: "m1", who: "Bader", text: "anyone got the LTT pdf for 13d?" },
  { id: "m2", who: "Jouri", text: "sending it now — page 212 is wrong though" },
  { id: "m3", who: "Saqer", text: "it is. i flagged it as a correction" },
  { id: "m4", who: "Hessa", text: "same question came up in the chapter 2 quiz" },
  { id: "m5", who: "Faisal", text: "noted, thanks" },
];

export const LIVES = {
  "day one":   { members: 0,  msgs: 0, threads: 0, seat: false, route: 2,  unread: 0 },
  quiet:       { members: 3,  msgs: 0, threads: 1, seat: false, route: 3,  unread: 0 },
  connected:   { members: 6,  msgs: 3, threads: 2, seat: true,  route: 7,  unread: 0 },
  hub:         { members: 11, msgs: 5, threads: 4, seat: true,  route: 11, unread: 2 },
};

export function buildState(life, chapters, youChapter) {
  const L = LIVES[life];
  const members = Array.from({ length: L.members }, (_, i) =>
    person(i, 1 + (i % chapters), L.seat && i === 0));
  const routePeople = Array.from({ length: L.route }, (_, i) =>
    person(i, 1 + (i % chapters), L.seat && i === 0));
  return {
    module: { name: "Module 1", chapters, youChapter: Math.min(chapters, youChapter) },
    squadron: L.members
      ? { name: "Night Shift", members, messages: MESSAGES.slice(0, L.msgs),
          unread: L.unread, quietSince: "Quiet since 21:06" }
      : null,
    routePeople,
    threads: THREADS.slice(0, L.threads),
  };
}

const WIDTHS = [1040, 820, 390];
const SURFACES = [
  { seat: true, squad: true, module: true },
  { seat: true, squad: true, module: false },
  { seat: true, squad: false, module: true },
  { seat: false, squad: true, module: true },
  { seat: true, squad: false, module: false },
  { seat: false, squad: true, module: false },
  { seat: false, squad: false, module: true },
  { seat: false, squad: false, module: false },
];

const noop = () => {};

export function GroundHarness() {
  const [life, setLife] = useState("connected");
  const [chapters, setChapters] = useState(5);
  const [width, setWidth] = useState(1040);
  const [surfIndex, setSurfIndex] = useState(0);
  const [all, setAll] = useState(false);
  const [livery, setLivery] = useState("sky");
  const [light, setLight] = useState("night");
  const [finish, setFinish] = useState(null);

  useEffect(() => {
    const base = deckVars(livery, light).vars;
    const vars = { ...base, ...finishVars(livery, light, finish, base["--active"]) };
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.variant = light;
  }, [livery, light, finish]);

  const s = buildState(life, chapters, 2);

  const one = (surfaces, w, key) => (
    <div className="bogh-stage" key={key} style={{ width: w }} data-w={w}
         data-surf={Object.entries(surfaces).filter(([, v]) => v).map(([k]) => k).join("+") || "none"}>
      <BackOnTheGround
        {...s}
        surfaces={surfaces}
        onOpenPerson={noop} onOpenThread={noop} onFindSquadron={noop}
        onFindSeat={noop} onAsk={noop} onSend={noop} onOpenReadyRoom={noop}
      />
    </div>
  );

  return (
    <div className="bogh">
      <header className="bogh-bar">
        <strong>Back on the ground · harness</strong>
        <span>
          {Object.keys(LIVES).map((k) => (
            <button key={k} data-life={k} aria-pressed={life === k} onClick={() => setLife(k)}>{k}</button>
          ))}
        </span>
        <span>
          {WIDTHS.map((w) => (
            <button key={w} data-width={w} aria-pressed={width === w} onClick={() => setWidth(w)}>{w}</button>
          ))}
        </span>
        <label>
          chapters <input type="range" min="2" max="12" value={chapters} id="bogh-ch"
                          onChange={(e) => setChapters(+e.target.value)} /> {chapters}
        </label>
        <span>
          {SURFACES.map((x, i) => (
            <button key={i} data-surf-index={i} aria-pressed={surfIndex === i}
                    onClick={() => setSurfIndex(i)}>
              {Object.entries(x).filter(([, v]) => v).map(([k]) => k[0]).join("") || "off"}
            </button>
          ))}
        </span>
        <span>
          <select aria-label="Livery" value={livery} onChange={(e) => setLivery(e.target.value)}>
            {LIVERIES.map((l) => <option key={l.id} value={l.id}>{l.id}</option>)}
          </select>
          {["night", "day"].map((v) => (
            <button key={v} data-light={v} aria-pressed={light === v} onClick={() => setLight(v)}>{v}</button>
          ))}
          <select aria-label="Finish" value={finish || "standard"}
                  onChange={(e) => setFinish(e.target.value === "standard" ? null : e.target.value)}>
            {["standard", "aurora", "manual"].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </span>
        <button data-all aria-pressed={all} onClick={() => setAll(!all)}>
          {all ? "one at a time" : "show every state"}
        </button>
      </header>

      <div className="bogh-body" id="bogh-body">
        {all
          ? WIDTHS.flatMap((w) =>
              SURFACES.map((x, i) => one(x, w, `${w}-${i}`)))
          : one(SURFACES[surfIndex], width, "single")}
      </div>
    </div>
  );
}
