import { useEffect, useState } from "react";
import { drawStamp, PALETTE } from "../../lib/stamp.js";

/* =============================================================================
   ONE DRAWING PER SLIDE.
   -----------------------------------------------------------------------------
   Each is a small picture of the real thing, drawn with the app's own tokens so
   it changes with the livery. Not screenshots: a screenshot goes out of date
   the day a screen changes and cannot move. These are sized in `em` against a
   font-size that is a thirty-sixth of the scene's width (tour.css), so one
   drawing is sharp at 300px and at 480px.

   They move only while their slide is the one on screen (`on`), and only in
   transform and opacity. Smooth Air and prefers-reduced-motion stop all of it.
   ========================================================================= */

const Bars = ({ n = 3, w = [100, 86, 64] }) => (
  <span className="sc-lines" aria-hidden="true">
    {Array.from({ length: n }, (_, k) => <i key={k} style={{ width: `${w[k % w.length]}%` }} />)}
  </span>
);

function Welcome() {
  return (
    <div className="sc sc-welcome">
      <p className="sc-word">Wingman</p>
      <p className="sc-sub">Part-66 study</p>
      <div className="sc-chips">
        {["M1", "M2", "M3", "M4"].map((m, k) => <span key={m} style={{ "--k": k }}>{m}</span>)}
      </div>
    </div>
  );
}

function Deck() {
  return (
    <div className="sc sc-deck">
      <div className="sc-strip">
        <span className="sc-cell"><b className="sc-gauge" /><small>Average</small></span>
        <span className="sc-cell"><b className="sc-bag">3</b><small>Saved</small></span>
        <span className="sc-cell"><b className="sc-time">1h 20m</b><small>Studied</small></span>
        <span className="sc-cell"><b className="sc-radar"><i /></b><small>Nearby</small></span>
      </div>
      <div className="sc-mods">
        {[["M1", "Module 1", false, 0.62], ["M2", "Module 2", true, 0.34], ["M3", "Module 3", false, 0.12]].map(([c, n, lamp, done], k) => (
          <span key={c} className="sc-mod" style={{ "--k": k }}>
            {lamp && <i className="sc-lamp" />}
            <b>{c}</b><em>{n}</em>
            <i className="sc-prog"><i style={{ "--p": done }} /></i>
          </span>
        ))}
      </div>
    </div>
  );
}

function Module() {
  return (
    <div className="sc sc-module">
      <p className="sc-h"><b>M1</b> Module 1</p>
      <div className="sc-tabs"><span>Lessons</span><span className="is-on">Library</span><span>Crew</span><i className="sc-pill" /></div>
      {[1, 2, 3].map((n) => (
        <div key={n} className="sc-chap" style={{ "--k": n }}>
          <span>Chapter {n}</span><em>Exam</em><em>Cards</em>
        </div>
      ))}
    </div>
  );
}

function Exam({ on }) {
  const [left, setLeft] = useState(20 * 60);
  useEffect(() => {
    if (!on) { setLeft(20 * 60); return undefined; }
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [on]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="sc sc-exam">
      <div className="sc-examtop"><span>Question 3 of 20</span><b>{mm}:{ss}</b></div>
      <Bars n={2} w={[96, 70]} />
      {["A", "B", "C"].map((l, k) => (
        <span key={l} className={`sc-opt${k === 1 ? " is-pick" : ""}`}><i>{l}</i><Bars n={1} w={[[70, 84, 58][k]]} /></span>
      ))}
      <span className="sc-handin">Hand in</span>
    </div>
  );
}

function Cards() {
  return (
    <div className="sc sc-cards">
      <div className="sc-flip">
        <div className="sc-face sc-front"><small>Question</small><Bars n={3} /></div>
        <div className="sc-face sc-back"><small>Answer</small><Bars n={2} w={[90, 60]} /><i className="sc-tick" /></div>
      </div>
      <span className="sc-keep">Saved</span>
    </div>
  );
}

function Papers() {
  return (
    <div className="sc sc-papers">
      <div className="sc-page">
        <i className="sc-ribbon" />
        <Bars n={9} w={[92, 100, 84, 96, 70, 100, 88, 94, 60]} />
      </div>
      <span className="sc-counter">12 / 40</span>
      <span className="sc-dl" aria-hidden="true">↓</span>
    </div>
  );
}

function Bookmarks() {
  return (
    <div className="sc sc-bm">
      <div className="sc-bagbody"><i className="sc-handle" /></div>
      {["Questions", "Study cards", "Videos", "Pages"].map((f, k) => (
        <span key={f} className="sc-folder" style={{ "--k": k }}>{f}</span>
      ))}
    </div>
  );
}

function Room() {
  return (
    <div className="sc sc-room">
      <div className="sc-q"><small>Module 1 · question</small><Bars n={2} w={[94, 62]} /></div>
      <div className="sc-a" style={{ "--k": 0 }}><i>DK</i><Bars n={2} w={[100, 74]} /></div>
      <div className="sc-a" style={{ "--k": 1 }}><i>RS</i><Bars n={1} w={[80]} /></div>
    </div>
  );
}

function Crew() {
  const who = [["RS", 1, 0], ["DK", 2, 0], ["You", 3, 0], ["AM", 3, 1], ["JT", 5, 0]];
  return (
    <div className="sc sc-crew">
      <div className="sc-track">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className="sc-stop" style={{ left: `${(n - 1) * 25}%` }}>{n}</span>)}
        {who.map(([w, at, row], k) => (
          <i key={w} className={`sc-av${w === "You" ? " is-me" : ""}`}
             style={{ "--k": k, "--row": row, left: `${(at - 1) * 25}%` }}>{w}</i>
        ))}
      </div>
      <small className="sc-crewnote">The chapter each student has reached</small>
    </div>
  );
}

function Bar() {
  return (
    <div className="sc sc-bar">
      <div className="sc-scale">
        <i className="sc-fill" />
        <span className="sc-mark sc-pass" style={{ left: "75%" }}><b>75%</b><small>Pass mark</small></span>
        <span className="sc-mark sc-yours"><b>85%</b><small>Your target</small></span>
      </div>
      <div className="sc-swatches">
        {[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ "--k": k }} />)}
      </div>
    </div>
  );
}

function Menu() {
  return (
    <div className="sc sc-menu">
      <div className="sc-bar-top"><b>Wingman</b><span className="sc-rr">Ready Room</span><i className="sc-init">AR</i></div>
      <div className="sc-drop">
        {["Licence", "Preferences", "Appearance", "Bookmarks", "Show me around"].map((r, k) => (
          <span key={r} style={{ "--k": k }}>{r}</span>
        ))}
      </div>
      <span className="sc-report">Something’s wrong here</span>
    </div>
  );
}

const STAMP = { shape: "seal", code: "A7K", rim: true, ring: "", pattern: "rays", ink: PALETTE[1]?.n, seed: 7 };

function Licence() {
  return (
    <div className="sc sc-licence">
      <div className="sc-card">
        <small>Licence</small>
        <b>Your name</b>
        <em>your callsign</em>
        <Bars n={2} w={[70, 48]} />
      </div>
      <span className="sc-stamp" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: drawStamp(STAMP, { on: true, size: 132, rot: -8 }) }} />
    </div>
  );
}

const SCENES = {
  welcome: Welcome, deck: Deck, module: Module, exam: Exam, cards: Cards, papers: Papers,
  bookmarks: Bookmarks, room: Room, crew: Crew, bar: Bar, menu: Menu, licence: Licence,
};

export default function Scene({ id, on }) {
  const S = SCENES[id];
  return S ? <S on={on} /> : null;
}
