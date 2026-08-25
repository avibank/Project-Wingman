import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { ShieldCheck } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSocialPrefs } from "../lib/social.js";
import { LIVERIES, at, deckVars, engineLivery, keyImg, fillImg, auroraImg, LIGHT, hueAt, LX, LS, wrap } from "../lib/liveryEngine.js";
import { profileSVG } from "../lib/flightProfile.js";
import { MODULES, CHAPTERS } from "../data.js";
import { CHARACTERS, DEFAULT_CHARACTER, VOICES } from "../lib/voices.js";
import { pickGreeting } from "../lib/greeting.js";
import { useFlags } from "../lib/flags.js";
import { initialsOf, USE_INITIALS_KEY } from "./ProfileMenu.jsx";

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

// §6.3 — 34px circles, each carrying its own three shades at 145°, sampled
// through the real at(). Aurora gets its own split: its colour is the curtain,
// which sits nowhere on its ramp.
function liverySwatch(L) {
  if (L.aurora) {
    return "linear-gradient(145deg, oklch(.24 .05 250) 0 34%, oklch(.72 .19 156) 34% 70%, oklch(.60 .16 316) 70% 100%)";
  }
  // The core is sampled at chroma scale 1.6 — that lift is what makes the
  // middle band read as its own colour rather than a stop on the way through.
  return `linear-gradient(145deg, ${at(L, 0.08, 1)} 0 34%, ${at(L, L.midAt, 1.6)} 34% 70%, ${at(L, 0.92, 1)} 70% 100%)`;
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
.liv i { display: block; width: 34px; height: 34px; border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .14); }
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
.bigav { width: 62px; height: 62px; border-radius: 50%; background: var(--active); color: var(--ground);
  display: grid; place-items: center; font-family: var(--font-mono); font-size: 19px; flex: none;
  background-size: cover; background-position: center; }
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
  const tabsRef = useRef(null);
  const fileRef = useRef(null);

  const [holderName, setHolderName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [greetName, setGreetName] = useState("");
  const [saveNote, setSaveNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setHolderName(user?.fullName || "");
    setUsername(user?.username || "");
    setGreetName(progress.get("pw-greet-name", "") || "");
    setBio(progress.get("pw-bio", "") || "");
  }, [user?.fullName, user?.username, progress.loaded]);

  // §6.1 — on by default. Off is the unusual choice, so the copy says so.
  const byUsername = (prefs?.identity_display || "real") === "username";
  const character = progress.get("pw-voice", DEFAULT_CHARACTER);
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

      {/* ------------------------------------------------------------ LICENCE */}
      {tab === "licence" && (
        <div className="panel" role="tabpanel" id="ppanel-licence" aria-labelledby="ptab-licence">
          <div className="block">
            <span className="eyebrow">Holder</span>
            <div className="idrow">
              <span className="bigav" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
                {photo ? "" : initials || "··"}
              </span>
              <span className="idtext">
                <div className="idname">{user?.fullName || user?.username || "Pilot"}</div>
                <div className="idmail">{user?.primaryEmailAddress?.emailAddress}</div>
                <div className="avactions">
                  <button className="ghost sm" type="button" onClick={() => fileRef.current?.click()}>Choose a photo</button>
                  {/* A display preference, not a delete — the Clerk image stays,
                      so toggling back returns the photo. */}
                  {user?.imageUrl && (
                    <button className="ghost sm" type="button"
                            onClick={() => progress.set(USE_INITIALS_KEY, !useInitials)}>
                      {useInitials ? "Use my photo" : "Use initials"}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={choosePhoto} />
                </div>
              </span>
              {isAdmin && (
                <span className="admin">
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
            </div>

            <div className="two" style={{ marginTop: 18 }}>
              <Field id="f-first" label="Name on the licence" hint="Private. Nobody sees this but you."
                     value={holderName} onChange={setHolderName}
                     onCommit={() => {
                       const [first, ...rest] = holderName.trim().split(/\s+/);
                       user?.update({ firstName: first || "", lastName: rest.join(" ") });
                     }} />
              <Field id="f-user" label="Username" hint="How you show up to everyone else."
                     value={username} onChange={setUsername}
                     onCommit={() => user?.update({ username: username.trim() }).catch(() => setSaveNote("That username is taken."))} />
            </div>

            <Field id="f-bio" label="Bio" hint="A line about you. Other pilots see this."
                   value={bio} onChange={setBio}
                   onCommit={() => progress.set("pw-bio", bio.trim() || null)} />

            <div className="row" style={{ marginTop: 4 }}>
              <span className="rowtext"><b>Go by your username</b>
                <span>{byUsername
                  ? <>Everyone else sees <b className="mono">@{username || "your-username"}</b></>
                  : <>Everyone else sees <b className="mono">{holderName || "your name"}</b> — most people don't.</>}
                </span>
              </span>
              <button type="button" role="switch" aria-checked={byUsername} id="by-username"
                      aria-label="Use username publicly" className="sw is-inline"
                      onClick={() => setIdentity(!byUsername)} />
            </div>

            <div className="field" style={{ maxWidth: 340 }}>
              <label htmlFor="f-call">What Wingman calls you</label>
              <input id="f-call" value={greetName} onChange={(e) => setGreetName(e.target.value)}
                     onBlur={() => progress.set("pw-greet-name", greetName.trim() || null)} />
              <span className="hint">Used in greetings, and only by whoever's greeting you. Leave it empty and you'll only get the lines that don't need a name.</span>
            </div>
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
                      onClick={() => user?.delete().catch(() => setSaveNote("That didn't go through. Try again, or write to us."))}>
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
        <div className="panel" role="tabpanel" id="ppanel-preferences" aria-labelledby="ptab-preferences">
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

          <div className="block">
            <span className="eyebrow">Notices</span>
            {NOTICES.map((n) => (
              <Switch key={n.id} id={`notice-${n.id}`} label={n.label} note={n.note}
                      on={notices[n.id] ?? n.on}
                      onChange={(v) => progress.set("pw-notices", { ...notices, [n.id]: v })} />
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- APPEARANCE */}
      {tab === "appearance" && (
        <div className="panel" role="tabpanel" id="ppanel-appearance" aria-labelledby="ptab-appearance">
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

          <div className="block">
            <span className="eyebrow">Livery</span>
            <div className="livname">{current.name}</div>
            <div className="livdesc">{current.description}</div>
            {/* Click selects. Nothing happens on hover but the lift. */}
            <div className="livgrid" role="group" aria-label="Livery">
              {liveries.map((L) => (
                <button key={L.id} className="liv" type="button" aria-pressed={L.id === current.id}
                        aria-label={L.name} title={L.name} onClick={() => onLivery(L.id)}>
                  <i style={{ background: liverySwatch(L) }} />
                </button>
              ))}
            </div>
            <div className="anchors">{current.anchors}</div>
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

      <style>{PROFILE_CSS}</style>
    </div>
  );
}


export default Profile;
