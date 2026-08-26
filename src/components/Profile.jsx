import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { ShieldCheck } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSocialPrefs } from "../lib/social.js";
import { LIVERIES, deckVars, engineLivery, keyImg, fillImg, auroraImg, LIGHT, hueAt, LX, LS, wrap, col, dotTile } from "../lib/liveryEngine.js";
import { profileSVG } from "../lib/flightProfile.js";
import { MODULES, CHAPTERS } from "../data.js";
import { CHARACTERS, DEFAULT_CHARACTER, VOICES } from "../lib/voices.js";
import { pickGreeting } from "../lib/greeting.js";
import { useFlags } from "../lib/flags.js";
import { initialsOf, USE_INITIALS_KEY } from "./ProfileMenu.jsx";
import { ERROR_GENERIC } from "../lib/copy.js";

// §6 — the profile. Three tabs: Licence · Preferences · Appearance.
//
// NOTE: profile.html, which §0 names as the primary reference, was not supplied
// with this build. Everything below is built from §6's prose, which is unusually
// specific about fields, hints, defaults, copy and sizes — but it has NOT been
// checked side by side against the file, and §0 says the code wins. Re-verify
// this screen against profile.html before it goes to anyone but admin.

const TABS = [
  { id: "licence", label: "Licence" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
];

const PRESETS = [
  { id: "quiet", label: "Quiet skies", desc: "You can see how busy it is. That's all — no band, no names, no chat." },
  { id: "crew", label: "My flight", desc: "Your formation and your wingman appear below the modules." },
  { id: "open", label: "Open frequency", desc: "Everything, including the module chat." },
];

const NOTICES = [
  { id: "answers", label: "Someone answers your question", note: "On the frequency you asked in", on: true },
  { id: "wingman", label: "Your wingman starts a chapter", note: "Only for the module you're both on", on: true },
  { id: "nudge", label: "Nothing flown for a week", note: "One nudge. Never more.", on: false },
];

// §7 — the label and hint belong to whoever is doing the greeting.
const CALL_COPY = {
  wingman: { label: "What Wingman calls you",
             hint: "Skip it. I'll keep talking until you look up, same as always." },
  hermit:  { label: "What the Hermit calls you",
             hint: "Empty, leave it. Know who you are, I already do." },
};

const SCALES = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];
// You asked for Night Ops on dark and Day Ops on light. The POC's shape is a
// bold label plus a description that changes with the mode, so the label is
// where the mode name goes; the buttons stay Day / Night / Auto.
const MODES = [{ id: "day", label: "Day" }, { id: "night", label: "Night" }, { id: null, label: "Auto" }];
const MODE_COPY = {
  day: { title: "Day Ops", desc: "Cream, whatever the livery. Only the light and the accents carry it." },
  night: { title: "Night Ops", desc: "Dark. The room is lit by the livery." },
  auto: { title: "Auto", desc: "Follows your device." },
};

function Switch({ id, on, onChange, label, note }) {
  return (
    <div className="row">
      <span className="rowtext"><b>{label}</b>{note && <span>{note}</span>}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} id={id}
              className="sw is-inline" onClick={() => onChange(!on)} />
    </div>
  );
}

function Field({ label, hint, value, onChange, onCommit, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} />
      <span className="hint">{hint}</span>
    </div>
  );
}

function Seg({ label, options, value, onPick }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// §6.3 — one solid colour per circle: the core of that livery's own ramp.
// Not the ground, not the key light — the colour the livery is.
//
// Aurora is the only exception. Its ramp is a cold blue and its identity is the
// curtain, so it gets a faint one over the solid base plus a scatter of stars:
// quiet enough to sit in the set, obvious enough to be the special one.
const AURORA_VEIL = 0.2;

function LiveryDot({ livery: L, selected, onPick }) {
  const core = `oklch(.60 ${(L.chroma * L.midC).toFixed(3)} ${hueAt(L, 0.55).toFixed(1)})`;
  // Every swatch previews its own ramp — shadow, core, highlight — which is
  // what its anchors line already promises ("navy to lapiz to sky blue").
  // Aurora used to be the only one showing a gradient while the other six were
  // flat discs, so they read as different kinds of thing. Each stop is taken
  // from that livery's own ramp; nothing here is a hand-picked colour.
  //
  // The highlight sits top-right because that is where the rig's key light is
  // (LIGHT.ambX 76, ambY -18), so a swatch is lit the way a panel is.
  const shadow = col(Math.max(0.18, L.ground + 0.06), L.chroma * 0.85, hueAt(L, 0.10), 1);
  const highlight = col(0.88, L.chroma * 0.60, hueAt(L, 0.94), 1);
  const ramp = `radial-gradient(115% 115% at 74% 8%, ${highlight} 0%, ${core} 46%, ${shadow} 100%)`;
  const style = { background: core, backgroundImage: ramp };
  if (L.aurora) {
    // Aurora keeps its starfield on top of its ramp: the stars are part of that
    // livery, not decoration on the swatch.
    style.backgroundImage = [
      dotTile(10, 20260824, 1.0, 0.8),
      `radial-gradient(120% 66% at 50% -6%, ${col(0.86, 0.170, 158, 0.62 * AURORA_VEIL * 5)} 0%,` +
      ` ${col(0.74, 0.195, 176, 0.34 * AURORA_VEIL * 5)} 36%, ${col(0.70, 0.190, 196, 0)} 78%)`,
      ramp,
    ].join(", ");
  }
  return (
    <button className="liv" type="button" aria-pressed={selected}
            aria-label={L.name} title={L.name} onClick={onPick}>
      <i style={style} />
    </button>
  );
}

// §6.3 — a specimen under the picker: a miniature hero card and one module card
// with both lamps behind them, so you see what the light does to a panel rather
// than to a settings page.
function Specimen({ liveryId, variant }) {
  const { vars, C, livery } = useMemo(() => deckVars(liveryId, variant), [liveryId, variant]);
  const ref = useRef(null);
  const key = livery.aurora
    ? auroraImg()
    : keyImg(livery.keyAbs != null ? livery.keyAbs : hueAt(livery, 1),
             livery.keyC != null ? livery.keyC : LIGHT.ambC, LIGHT.ambX, LIGHT.ambY, LIGHT.ambSize);
  const fill = fillImg(wrap(livery.fillAbs), LIGHT.ambC * 0.85 * (livery.fillC != null ? livery.fillC : 1),
                       LX(LIGHT.fillX), LX(LIGHT.fillY), LS(LIGHT.fillSize));

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const W = Math.round(svg.clientWidth), H = Math.round(svg.clientHeight);
    if (!W || !H) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = profileSVG(W, H, 0.62, 5, null, true, C);
  }, [C]);

  const hero = CHAPTERS[0];
  const mod = MODULES[1];

  return (
    <div className="spec" style={{ ...vars, "--key-img": key, "--fill-img": fill }} aria-label="Preview">
      <span className="specglow" aria-hidden="true" />
      <span className="specglow2" aria-hidden="true" />
      <div className="specin">
        <div className="speccard">
          <div className="specchap">{hero?.title || "Chapter 1"}</div>
          <div className="speccode">{hero?.code} · {(MODULES[0]?.name || "").toUpperCase()}</div>
          <span className="specbtn">Resume ›</span>
        </div>
        <div className="specmod">
          <div className="speccode">{mod?.code}</div>
          <div className="specname">{mod?.name}</div>
          <svg className="specprof" ref={ref} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

const PROFILE_CSS = `
.profile { max-width: 1240px; margin: 0 auto; padding: 0 40px 80px; }
@media (max-width: 640px) { .profile { padding: 0 16px 96px; } }

.phead { margin: 10px 0 16px; }
.back { background: none; border: 0; color: var(--t2); font-size: 13px; cursor: pointer; padding: 4px 0;
  display: inline-flex; align-items: center; gap: 6px; min-height: 0; }
.back:hover { color: var(--t1); }
.ptitle { font-size: calc(30px * var(--scale, 1)); font-weight: 700; letter-spacing: -.6px;
  margin: 6px 0 0; color: var(--t1); }

.tabs { display: flex; gap: 4px; background: color-mix(in oklab, var(--panel), transparent 20%);
  border: 1px solid var(--line); border-radius: 11px; padding: 4px; margin-bottom: 20px; max-width: 520px; }
.tabs button { flex: 1; background: none; border: 0; border-radius: 8px; padding: 10px 8px;
  color: var(--t2); font-size: calc(13px * var(--scale, 1)); font-weight: 600; cursor: pointer;
  transition: background .16s, color .16s; }
.tabs button[aria-selected="true"] { background: var(--raised); color: var(--t1);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--active), transparent 55%); }

.panel { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
.block { background: var(--panel); border: 1px solid var(--line); border-radius: 13px;
  border-top-color: var(--edge-hi); padding: 18px 20px 20px; }
.block > .eyebrow { display: block; margin-bottom: 14px; }
.eyebrow { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--t3); }

.row { display: flex; align-items: center; gap: 16px; padding: 13px 0;
  border-top: 1px solid color-mix(in oklab, var(--line), transparent 45%); }
.row:first-of-type { border-top: 0; padding-top: 2px; }
.rowtext { flex: 1; min-width: 0; }
.rowtext b { display: block; font-size: calc(14px * var(--scale, 1)); font-weight: 600; }
.rowtext span { display: block; font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); margin-top: 2px; }

.field { display: flex; flex-direction: column; gap: 6px; padding: 11px 0; }
.field label { font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); }
.field input, .field textarea { background: var(--raised); border: 1px solid var(--line);
  border-radius: 9px; padding: 10px 12px; color: var(--t1); font-family: inherit;
  font-size: calc(14px * var(--scale, 1)); width: 100%; }
.field input:focus, .field textarea:focus { outline: 2px solid var(--active); outline-offset: 1px; }
.field .hint { font-size: calc(11.5px * var(--scale, 1)); color: var(--t3); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 620px) { .two { grid-template-columns: 1fr; } }

.seg { display: inline-flex; background: var(--raised); border: 1px solid var(--line);
  border-radius: 10px; padding: 3px; gap: 3px; }
.seg button { background: none; border: 0; border-radius: 7px; padding: 8px 15px; color: var(--t2);
  font-size: calc(12.5px * var(--scale, 1)); font-weight: 600; cursor: pointer;
  transition: background .16s, color .16s; }
.seg button[aria-pressed="true"] { background: var(--panel); color: var(--t1);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--active), transparent 55%); }

.ghost { background: none; color: var(--t1); border: 1px solid var(--line); border-radius: 999px;
  padding: 9px 16px; font-size: calc(12.5px * var(--scale, 1)); font-weight: 600; cursor: pointer; }
.ghost:hover { border-color: var(--t3); }
.ghost.sm { padding: 6px 12px; font-size: calc(11.5px * var(--scale, 1)); }

.livname { font-size: calc(15px * var(--scale, 1)); font-weight: 600; margin-bottom: 2px; }
.livdesc { font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); margin-bottom: 14px; }
.livgrid { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.liv { background: none; border: 0; padding: 3px; border-radius: 50%; cursor: pointer; line-height: 0;
  min-height: 0; box-shadow: 0 0 0 0 var(--active); transition: box-shadow .18s, transform .18s; }
.liv:hover { transform: translateY(-2px); }
.liv[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--active); }
.liv i { display: block; width: 56px; height: 56px; border-radius: 50%;
  background-size: cover; background-position: center; }

/* The one centred block on this page, deliberately: name over description over
   swatches, narrowing to the specimen. Scoped rather than set on .livname and
   .livdesc, which the Preferences tab also uses and which stay left. */
.block-livery .livname,
.block-livery .livdesc { text-align: center; }
.block-livery .livgrid { justify-content: center; gap: 10px; }
/* 38px disc inside 3px of padding is a 44x44 target — the floor for a finger,
   so the swatches shrink to exactly that and no further. Below this width the
   gap gives way first; the target never does. */
.block-livery .liv i { width: 38px; height: 38px; }
@media (max-width: 430px) { .block-livery .livgrid { gap: 6px; } }
.anchors { font-family: var(--font-mono); font-size: 10px; letter-spacing: .05em; color: var(--t3);
  margin-top: 12px; }

.spec { margin-top: 16px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
  background: var(--ground); position: relative; }
.specin { position: relative; z-index: 1; padding: 14px; display: grid; gap: 11px;
  grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); }
@media (max-width: 620px) { .specin { grid-template-columns: 1fr; } }
.specglow { position: absolute; inset: -40%; z-index: 0; pointer-events: none; mix-blend-mode: screen;
  background: var(--key-img); opacity: calc(var(--key-int) * .9); filter: blur(38px) saturate(1.28); }
.specglow2 { position: absolute; inset: -40%; z-index: 0; pointer-events: none; mix-blend-mode: screen;
  background: var(--fill-img); opacity: var(--fill-int); filter: blur(46px) saturate(1.2); }
.speccard, .specmod { background: var(--panel); border: 1px solid var(--line);
  border-top-color: var(--edge-hi); border-radius: 10px; padding: 12px; }
.specchap { font-size: 13.5px; font-weight: 600; }
.speccode { font-family: var(--font-mono); font-size: 10px; color: var(--t3); margin-top: 1px; }
.specbtn { margin-top: 10px; display: inline-block; background: var(--active-fill); color: var(--ground);
  border-radius: 999px; padding: 5px 11px; font-size: 11px; font-weight: 600; }
.specmod { display: flex; flex-direction: column; }
.specname { font-size: 12.5px; font-weight: 600; color: var(--t2); margin-top: 4px; }
.specprof { display: block; width: 100%; height: 38px; margin-top: auto; padding-top: 6px; }

.admin { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--active);
  color: var(--active); border-radius: 999px; padding: 3px 9px; font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; }
/* The avatar is the control; the badge is decoration on it. One button, one
   focus ring, and the ring sits on the circle rather than the badge. */
.bigav { position: relative; width: 62px; height: 62px; min-height: 62px; padding: 0; flex: none;
  border: 0; border-radius: 50%; cursor: pointer;
  background: var(--active-fill); background-size: cover; background-position: center;
  color: var(--ground); display: grid; place-items: center;
  font-family: var(--font-mono); font-size: 19px; }
.bigav-initials { pointer-events: none; }
.bigav-badge { position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px;
  border-radius: 50%; display: grid; place-items: center; pointer-events: none;
  background: var(--active-fill); color: var(--ground);
  /* its own ring, so it reads as attached to the circle rather than floating */
  box-shadow: 0 0 0 2px var(--panel); }
.bigav-badge svg { width: 16px; height: 16px; display: block; }
.bigav:hover .bigav-badge { background: var(--active); }
.idrow { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.idname { font-size: calc(20px * var(--scale, 1)); font-weight: 700; letter-spacing: -.3px; }
.idmail { font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); }
.idtext { flex: 1; min-width: 200px; }
.avactions { display: flex; gap: 8px; margin-top: 9px; flex-wrap: wrap; }
.mono { font-family: var(--font-mono); font-size: .94em; font-weight: 500; color: var(--t1); white-space: nowrap; }
.quietline { margin: 2px 2px 0; font-size: calc(11.5px * var(--scale, 1)); color: var(--t3); line-height: 1.6; }
.linkish { background: none; border: 0; padding: 0; min-height: 0; color: var(--t2); font-size: inherit;
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.linkish:hover { color: var(--t1); }
.psaved { font-size: 12.5px; color: var(--t2); margin: -8px 0 0; }
.block-sub { display: flex; flex-direction: column; gap: 8px; padding: 11px 0; }
.block-sub .eyebrow { display: block; }
.pcard-foot { font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); margin: 0; line-height: 1.45; }
`;

function Profile({ page = "licence", onNavigate, onBack, variantPin, onVariantPin, livery, onLivery,
                   fontSize, onFontSize, reduceMotion, onReduceMotion, dyslexiaFont, onDyslexiaFont,
                   turbulence, onTurbulence, grain, onGrain, variant }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const progress = useUserProgress();
  const { prefs, update: updatePrefs } = useSocialPrefs();
  const { flags } = useFlags();
  const isAdmin = user?.publicMetadata?.role === "admin";

  const tab = TABS.some((t) => t.id === page) ? page : "licence";
  // The panel that is leaving keeps its height until the new one has one, so
  // the page does not jump while React swaps them.
  const swapRef = useRef(null);
  const [swapH, setSwapH] = useState(null);
  useLayoutEffect(() => {
    const el = swapRef.current;
    if (!el) return;
    const next = el.firstElementChild?.getBoundingClientRect().height;
    if (next) setSwapH(next);
  }, [tab]);
  const tabsRef = useRef(null);
  const fileRef = useRef(null);

  const [holderName, setHolderName] = useState("");
  const [bio, setBio] = useState("");
  // The call name starts as the first name and follows edits to Full name —
  // but only until the user types here themselves. A deliberate choice is never
  // overwritten, and a stale derived one is never stranded.
  const [callTouched, setCallTouched] = useState(false);
  const [username, setUsername] = useState("");
  const [greetName, setGreetName] = useState("");
  const [saveNote, setSaveNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setHolderName(user?.fullName || "");
    setUsername(user?.username || "");
    const stored = progress.get("pw-greet-name", null);
    setCallTouched(stored !== null);
    setGreetName(stored !== null ? stored : (user?.firstName || ""));
    setBio(progress.get("pw-bio", "") || "");
  }, [user?.fullName, user?.username, user?.firstName, progress.loaded]);

  // §6.1 — on by default. Off is the unusual choice, so the copy says so.
  const byUsername = (prefs?.identity_display || "username") === "username";
  const character = progress.get("pw-voice", DEFAULT_CHARACTER);
  const callCopy = CALL_COPY[character] || CALL_COPY.wingman;

  // Derived, not stored, until it is touched — so changing Full name carries
  // through and nothing has to be kept in sync.
  const derivedCall = holderName.trim().split(/\s+/)[0] || "";
  useEffect(() => {
    if (!callTouched) setGreetName(derivedCall);
  }, [derivedCall, callTouched]);
  const preset = progress.get("pw-social-preset", "crew");
  const notices = progress.get("pw-notices", { answers: true, wingman: true, nudge: true });

  const liveries = LIVERIES.filter((l) => (l.aurora ? flags["livery.aurora"] : true));
  const current = liveries.find((l) => l.id === engineLivery(livery)) || liveries[0];

  const setIdentity = (on) => updatePrefs({ identity_display: on ? "username" : "real" });

  const walkTabs = (e) => {
    const btns = [...(tabsRef.current?.querySelectorAll('[role="tab"]') || [])];
    const i = btns.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); btns[n]?.focus(); onNavigate(TABS[n].id); };
    if (e.key === "ArrowRight") go((i + 1) % btns.length);
    if (e.key === "ArrowLeft") go((i - 1 + btns.length) % btns.length);
    if (e.key === "Home") go(0);
    if (e.key === "End") go(btns.length - 1);
  };

  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try { await user.setProfileImage({ file }); setSaveNote("Photo updated."); }
    catch { setSaveNote("That photo wouldn't upload. Try a smaller one."); }
  };

  const initials = initialsOf(user);
  const useInitials = progress.get(USE_INITIALS_KEY, false);
  const photo = !useInitials && user?.imageUrl ? user.imageUrl : null;

  // §6.2 — a live sample line that changes the greeting on the home page
  // immediately. Dealt off the same engine, so it is a real line, not a mock.
  const sample = useMemo(() => pickGreeting(null, {
    now: Date.now(), hour: new Date().getHours(),
    name: greetName || null, character, awayMs: null,
  }).text, [character, greetName]);

  return (
    <div className="profile">
      <div className="phead">
        <button className="back" type="button" onClick={onBack}>‹ Flight Deck</button>
        <h1 className="ptitle">{TABS.find((t) => t.id === tab)?.label}</h1>
      </div>

      <div className="tabs" role="tablist" aria-label="Profile sections" ref={tabsRef} onKeyDown={walkTabs}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`ptab-${t.id}`} aria-controls={`ppanel-${t.id}`}
                  aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => onNavigate(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {saveNote && <p className="psaved">{saveNote}</p>}

      <div className="panel-swap" ref={swapRef} style={swapH ? { height: swapH } : undefined}>

      {/* ------------------------------------------------------------ LICENCE */}
      {tab === "licence" && (
        <div className="panel panel-in" key={tab} role="tabpanel" id="ppanel-licence" aria-labelledby="ptab-licence">
          <div className="block">
            <span className="eyebrow">Holder</span>
            <div className="idrow">
              {/* The avatar is the control. The badge is decoration on it, not a
                  second button — one target, one focus ring, on the circle. */}
              <button className="bigav" type="button" aria-label="Change your photo"
                      onClick={() => fileRef.current?.click()}
                      style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
                {photo ? "" : <span className="bigav-initials">{initials || "··"}</span>}
                <span className="bigav-badge" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M3.5 6.5h3l1.2-1.8h4.6L13.5 6.5h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="10" cy="11" r="2.9" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={choosePhoto} />
              <span className="idtext">
                <div className="idname">{user?.fullName || user?.username || "Pilot"}</div>
                <div className="idmail">{user?.primaryEmailAddress?.emailAddress}</div>
              </span>
              {isAdmin && (
                <span className="admin">
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
            </div>

            <Field id="f-first" label="Full name" hint="On your licence and nowhere else."
                   value={holderName} onChange={setHolderName}
                   onCommit={() => {
                     const [first, ...rest] = holderName.trim().split(/\s+/);
                     user?.update({ firstName: first || "", lastName: rest.join(" ") });
                   }} />

            {/* Initials are derived from the name, so the switch sits under it. */}
            <Switch id="use-initials" label="Use initials"
                    note="Your photo stays saved. This just hides it."
                    on={useInitials} onChange={(v) => progress.set(USE_INITIALS_KEY, v)} />

            <Field id="f-user" label="Username" hint="How everyone else sees you."
                   value={username} onChange={setUsername}
                   onCommit={() => user?.update({ username: username.trim() }).catch(() => setSaveNote("That username is taken."))} />

            {/* §6 — both real values, live from the fields above. */}
            <div className="block-sub">
              <span className="eyebrow">Everyone sees</span>
              <Seg label="Everyone sees" value={byUsername ? "username" : "real"}
                   options={[
                     { id: "real", label: holderName.trim() || "your full name" },
                     { id: "username", label: username.trim() || "your username" },
                   ]}
                   onPick={(v) => setIdentity(v === "username")} />
              <p className="pcard-foot">One of these gets said out loud when someone finds you. Pick the one you&rsquo;d like hearing.</p>
            </div>

            <div className="field" style={{ maxWidth: 340 }}>
              <label htmlFor="f-call">{callCopy.label}</label>
              <input id="f-call" value={greetName}
                     onChange={(e) => { setCallTouched(true); setGreetName(e.target.value); }}
                     onBlur={() => progress.set("pw-greet-name", greetName.trim())} />
              <span className="hint">{callCopy.hint}</span>
            </div>

            <Field id="f-bio" label="A line about you"
                   hint="Shows on your licence when someone opens it. Keep it short."
                   value={bio} onChange={setBio}
                   onCommit={() => progress.set("pw-bio", bio.trim() || null)} />
          </div>

          <div className="block">
            <span className="eyebrow">Account</span>
            <div className="row">
              <span className="rowtext"><b>Email</b><span>{user?.primaryEmailAddress?.emailAddress}</span></span>
              <button className="ghost" type="button" onClick={() => onNavigate("account")}>Change</button>
            </div>
            <div className="row">
              <span className="rowtext"><b>Password</b><span>Managed by your sign-in provider</span></span>
              <button className="ghost" type="button" onClick={() => onNavigate("account")}>Update</button>
            </div>
            <div className="row">
              <span className="rowtext"><b>Sign out</b><span>On this device only</span></span>
              <button className="ghost" type="button" onClick={() => signOut()}>Sign out</button>
            </div>
          </div>

          {confirmDelete ? (
            <p className="quietline">
              This removes your logbook, your crew and everything you've flown, and it can't be undone.{" "}
              <button className="linkish" type="button"
                      onClick={() => user?.delete().catch(() => setSaveNote(ERROR_GENERIC))}>
                Delete it all
              </button>
              {" · "}
              <button className="linkish" type="button" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </p>
          ) : (
            <p className="quietline">
              <button className="linkish" type="button" onClick={() => setConfirmDelete(true)}>Delete account</button>
              {" "}— removes your logbook, your crew and everything you've flown. It can't be undone.
            </p>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- PREFERENCES */}
      {tab === "preferences" && (
        <div className="panel panel-in" key={tab} role="tabpanel" id="ppanel-preferences" aria-labelledby="ptab-preferences">
          {flags["voice.characters"] && (
            <div className="block">
              <span className="eyebrow">Who greets you</span>
              <div className="livname">{CHARACTERS.find((c) => c.id === character)?.name}</div>
              <div className="livdesc">{CHARACTERS.find((c) => c.id === character)?.blurb}</div>
              <Seg label="Voice" value={character}
                   options={CHARACTERS.map((c) => ({ id: c.id, label: c.name }))}
                   onPick={(v) => progress.set("pw-voice", v)} />
              <div className="anchors">“{sample}”</div>
            </div>
          )}

          <div className="block">
            <span className="eyebrow">How social</span>
            <div className="livdesc">{PRESETS.find((x) => x.id === preset)?.desc}</div>
            <Seg label="Social preset" value={preset}
                 options={PRESETS.filter((x) => (x.id === "quiet") || (x.id === "crew" && flags["social.crew"])
                   || (x.id === "open" && flags["social.crew"] && flags["social.frequency"]))}
                 onPick={(v) => progress.set("pw-social-preset", v)} />
          </div>

          <div className="block">
            <span className="eyebrow">Being seen</span>
            <Switch id="fly-invisible" label="Fly invisible"
                    note="Nobody sees where you are. You still see everyone else."
                    on={progress.get("pw-invisible", false)}
                    onChange={(v) => progress.set("pw-invisible", v)} />
          </div>

          {flags["prefs.notices"] && (
            <div className="block">
              <span className="eyebrow">Notices</span>
              {NOTICES.map((n) => (
                <Switch key={n.id} id={`notice-${n.id}`} label={n.label} note={n.note}
                        on={notices[n.id] ?? n.on}
                        onChange={(v) => progress.set("pw-notices", { ...notices, [n.id]: v })} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- APPEARANCE */}
      {tab === "appearance" && (
        <div className="panel panel-in" key={tab} role="tabpanel" id="ppanel-appearance" aria-labelledby="ptab-appearance">
          <div className="block">
            <span className="eyebrow">Light</span>
            <div className="row">
              <span className="rowtext">
                <b>{MODE_COPY[variantPin || "auto"].title}</b>
                <span>{MODE_COPY[variantPin || "auto"].desc}</span>
              </span>
              <Seg label="Light mode" value={variantPin} options={MODES} onPick={onVariantPin} />
            </div>
          </div>

          <div className="block block-livery">
            <span className="eyebrow">Livery</span>
            <div className="livname">{current.name}</div>
            <div className="livdesc">{current.description}</div>
            {/* Click selects. Nothing happens on hover but the lift. */}
            <div className="livgrid" role="group" aria-label="Livery">
              {liveries.map((L) => (
                <LiveryDot key={L.id} livery={L} selected={L.id === current.id}
                           onPick={() => onLivery(L.id)} />
              ))}
            </div>
            <Specimen liveryId={current.id} variant={variant} />
          </div>

          <div className="block">
            <span className="eyebrow">Instrument scale</span>
            <div className="row">
              <span className="rowtext"><b>Text size</b><span>Across chapters, discussion and the library</span></span>
              <Seg label="Instrument scale" value={fontSize} options={SCALES} onPick={onFontSize} />
            </div>
          </div>

          <div className="block">
            <span className="eyebrow">Accessibility &amp; motion</span>
            <Switch id="smooth-air" label="Smooth Air" note="Stops the lights drifting and the cards lifting"
                    on={reduceMotion} onChange={onReduceMotion} />
            <Switch id="plain-language" label="Plain Language" note="A clearer typeface for reading fatigue and dyslexia"
                    on={dyslexiaFont} onChange={onDyslexiaFont} />
            <Switch id="turbulence" label="Turbulence" note="A small nudge when you move between pages"
                    on={turbulence} onChange={onTurbulence} />
            {flags["appearance.grain"] && (
              <Switch id="grain" label="Grain" note="Fine noise over the light. Off is flatter but smoother."
                      on={grain} onChange={onGrain} />
            )}
          </div>
        </div>
      )}

      </div>

      <style>{PROFILE_CSS}</style>
    </div>
  );
}


export default Profile;
