import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { ShieldCheck } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSocialPrefs } from "../lib/social.js";
import { LIVERIES, at, deckVars, engineLivery, keyImg, fillImg, auroraImg, LIGHT, hueAt, LX, LS, wrap } from "../lib/liveryEngine.js";
import { CHARACTERS, DEFAULT_CHARACTER, VOICES } from "../lib/voices.js";
import { pickGreeting } from "../lib/greeting.js";
import { useFlags } from "../lib/flags.js";

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
  { id: "quiet", name: "Quiet skies", note: "You can see how busy it is. Nothing else." },
  { id: "crew", name: "My flight", note: "Your formation and your wingman, below the modules." },
  { id: "open", name: "Open frequency", note: "Everything, including the module channel." },
];

const NOTICES = [
  { id: "answers", label: "Answers to your questions", note: "Someone replies to something you asked." },
  { id: "wingman", label: "Your wingman starting a chapter", note: "So you can fly it at the same time." },
  { id: "nudge", label: "One inactivity nudge", note: "One nudge. Never more." },
];

const SCALES = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];
const MODES = [{ id: "day", label: "Day" }, { id: "night", label: "Night" }, { id: null, label: "Auto" }];

function Switch({ id, on, onChange, label, note }) {
  return (
    <div className="prow">
      <div className="prow-text">
        <div className="prow-title">{label}</div>
        {note && <div className="prow-note">{note}</div>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} id={id}
              className={`sw is-inline ${on ? "is-on" : ""}`} onClick={() => onChange(!on)}>
        <span className="sw-knob" />
      </button>
    </div>
  );
}

function Field({ label, hint, value, onChange, onCommit, type = "text", placeholder }) {
  return (
    <label className="pfield">
      <span className="pfield-label">{label}</span>
      <input className="pfield-input" type={type} value={value ?? ""} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} onBlur={onCommit} />
      <span className="pfield-hint">{hint}</span>
    </label>
  );
}

// §6.3 — 34px circles, each carrying its own three shades at 145°, sampled
// through the real at(). Aurora gets its own split: its colour is the curtain,
// which sits nowhere on its ramp.
function liverySwatch(L) {
  if (L.aurora) {
    return "linear-gradient(145deg, oklch(.30 .06 250) 0 34%, oklch(.72 .19 156) 34% 70%, oklch(.60 .16 316) 70% 100%)";
  }
  return `linear-gradient(145deg, ${at(L, 0.12, 1)} 0 33%, ${at(L, L.midAt, 1)} 33% 67%, ${at(L, 0.88, 1)} 67% 100%)`;
}

// §6.3 — a specimen under the picker: a miniature hero card and one module card
// with both lamps behind them, so you see what the light does to a panel rather
// than to a settings page.
function Specimen({ liveryId, variant }) {
  const { vars, livery } = useMemo(() => deckVars(liveryId, variant), [liveryId, variant]);
  const key = livery.aurora
    ? auroraImg()
    : keyImg(livery.keyAbs != null ? livery.keyAbs : hueAt(livery, 1),
             livery.keyC != null ? livery.keyC : LIGHT.ambC, LIGHT.ambX, LIGHT.ambY, LIGHT.ambSize);
  const fill = fillImg(wrap(livery.fillAbs), LIGHT.ambC * 0.85 * (livery.fillC != null ? livery.fillC : 1),
                       LX(LIGHT.fillX), LX(LIGHT.fillY), LS(LIGHT.fillSize));
  return (
    <div className="spec" style={{ ...vars, "--key-img": key, "--fill-img": fill }} aria-hidden="true">
      <div className="spec-card">
        <div className="spec-thumb" />
        <div className="spec-lines">
          <i style={{ width: "62%" }} /><i style={{ width: "40%", opacity: 0.6 }} />
          <span className="spec-pill" />
        </div>
      </div>
      <div className="spec-mod">
        <i style={{ width: "22%", opacity: 0.55 }} /><i style={{ width: "70%" }} />
        <svg viewBox="0 0 100 26" preserveAspectRatio="none">
          <path d="M4,22 L14,22 C22,22 26,6 38,6 L64,6 C76,6 80,22 88,22 L96,22"
                fill="none" stroke="var(--active)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

const PROFILE_CSS = `
.profile { max-width: 720px; margin: 0 auto; padding: 28px 22px 80px; }
.profile-h1 { font-size: 32px; font-weight: 700; letter-spacing: -.7px; margin: 0 0 16px; color: var(--t1); }

.ptabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 22px; }
.ptab { background: none; border: 0; padding: 10px 14px; margin-bottom: -1px; cursor: pointer;
  color: var(--t3); font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; }
.ptab:hover { color: var(--t1); }
.ptab.is-on { color: var(--t1); border-bottom-color: var(--active); }

.ppanel { display: flex; flex-direction: column; gap: 16px; }
.psaved { font-size: 12.5px; color: var(--t2); margin: -8px 0 0; }

.pcard { background: var(--panel); border: 1px solid var(--line); border-top-color: var(--edge-hi);
  border-bottom-color: var(--edge-lo); border-radius: var(--r-panel); padding: 16px 17px;
  display: flex; flex-direction: column; gap: 12px; }
.pcard-head { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .13em;
  text-transform: uppercase; color: var(--t3); }
.pcard-foot { font-size: 12.5px; color: var(--t2); margin: 0; line-height: 1.45; }

.holder { flex-direction: row; align-items: flex-start; gap: 16px; }
.holder-face { width: 64px; height: 64px; border-radius: 50%; flex: none; overflow: hidden;
  background: var(--raised); border: 1px solid var(--line); display: grid; place-items: center;
  font-family: var(--font-mono); font-size: 18px; color: var(--t2); }
.holder-face img { width: 100%; height: 100%; object-fit: cover; }
.holder-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.holder-name { font-size: 18px; font-weight: 600; letter-spacing: -.2px; display: flex; align-items: center; gap: 8px; }
.holder-admin { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono);
  font-size: 8.5px; letter-spacing: .12em; color: var(--ground); background: var(--active-fill);
  border-radius: 3px; padding: 2px 5px; }
.holder-mail { font-size: 12.5px; color: var(--t2); }
.holder-acts { display: flex; align-items: center; gap: 12px; margin-top: 9px; flex-wrap: wrap; }

.pfield { display: flex; flex-direction: column; gap: 4px; }
.pfield-label { font-size: 13px; font-weight: 600; color: var(--t1); }
.pfield-input { min-height: 40px; padding: 0 13px; border-radius: var(--r-control);
  background: var(--raised); border: 1px solid var(--line); color: var(--t1); font-size: 14px; }
.pfield-input:focus { border-color: var(--active); }
.pfield-hint { font-size: 12px; color: var(--t3); }
.ppreview { font-size: 12.5px; color: var(--t2); margin: -4px 0 0; }

.prow { display: flex; align-items: center; gap: 16px; min-height: 44px; }
.prow-text { flex: 1; min-width: 0; }
.prow-title { font-size: 14px; font-weight: 600; color: var(--t1); }
.prow-note { font-size: 12.5px; color: var(--t2); line-height: 1.4; }


.pchoice { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; text-align: left;
  background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-control);
  padding: 12px 13px; cursor: pointer; color: var(--t2); }
.pchoice:hover { border-color: var(--t3); }
.pchoice.is-on { border-color: var(--active); }
.pchoice-name { font-size: 14px; font-weight: 600; color: var(--t1); }
.pchoice-note { font-size: 12.5px; line-height: 1.4; }
.pchoice-sample { margin-top: 7px; font-size: 13px; font-style: italic; color: var(--t1); }

.pseg { display: inline-flex; background: var(--raised); border: 1px solid var(--line);
  border-radius: var(--r-pill); padding: 3px; gap: 3px; align-self: flex-start; }
.pseg button { min-height: 34px; padding: 0 16px; border: 0; border-radius: var(--r-pill);
  background: none; color: var(--t2); font-size: 13px; font-weight: 500; cursor: pointer; }
.pseg button.is-on { background: var(--active-fill); color: var(--ground); }

.plivname { font-size: 16px; font-weight: 600; color: var(--t1); }
.pcircles { display: flex; gap: 12px; flex-wrap: wrap; }
.pcircle { width: 34px; height: 34px; min-height: 34px; padding: 0; border-radius: 50%; cursor: pointer;
  background: var(--sw); border: 1px solid var(--line); }
.pcircle.is-on { box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--active); }
.planchors { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .06em; color: var(--t3); }

/* the specimen — both lamps behind two real panels */
.spec { position: relative; overflow: hidden; border-radius: var(--r-panel); background: var(--ground);
  border: 1px solid var(--line); padding: 16px; display: flex; gap: 12px; isolation: isolate; min-height: 116px; }
.spec::before, .spec::after { content: ""; position: absolute; inset: -55%; pointer-events: none;
  z-index: 0; mix-blend-mode: screen; filter: blur(46px) saturate(1.28); }
.spec::before { background: var(--key-img); opacity: var(--key-int); }
.spec::after { background: var(--fill-img); opacity: var(--fill-int); filter: blur(62px) saturate(1.2); }
.spec > * { position: relative; z-index: 1; }
.spec-card { flex: 1.4; display: flex; gap: 10px; background: var(--panel); border: 1px solid var(--line);
  border-top-color: var(--edge-hi); border-bottom-color: var(--edge-lo); border-radius: 10px; padding: 11px; }
.spec-thumb { width: 52px; height: 32px; border-radius: 5px; background: var(--raised);
  border: 1px solid var(--line); flex: none; }
.spec-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.spec-lines i, .spec-mod i { display: block; height: 5px; border-radius: 3px; background: var(--t2); opacity: .8; }
.spec-pill { display: block; width: 54px; height: 15px; border-radius: 999px; background: var(--active-fill); margin-top: 3px; }
.spec-mod { flex: 1; display: flex; flex-direction: column; gap: 6px; background: var(--panel);
  border: 1px solid var(--line); border-top-color: var(--edge-hi); border-bottom-color: var(--edge-lo);
  border-radius: 10px; padding: 11px; }
.spec-mod svg { width: 100%; height: 26px; margin-top: auto; }

.pdelete { font-size: 12.5px; color: var(--t3); line-height: 1.5; margin: 10px 0 0; }
.plink { background: none; border: 0; padding: 0; min-height: 0; cursor: pointer;
  color: var(--t2); font-size: 12.5px; text-decoration: underline; text-underline-offset: 2px; }
.plink:hover { color: var(--t1); }
.plink.is-quiet { color: var(--t3); }
`;

function Profile({ page = "licence", onNavigate, variantPin, onVariantPin, livery, onLivery,
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
  const [username, setUsername] = useState("");
  const [greetName, setGreetName] = useState("");
  const [saveNote, setSaveNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setHolderName(user?.fullName || "");
    setUsername(user?.username || "");
    setGreetName(progress.get("pw-greet-name", "") || "");
  }, [user?.fullName, user?.username, progress.loaded]);

  // §6.1 — on by default. Off is the unusual choice, so the copy says so.
  const byUsername = (prefs?.identity_display || "username") === "username";
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

  const initials = (user?.fullName || user?.username || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // §6.2 — a live sample line that changes the greeting on the home page
  // immediately. Dealt off the same engine, so it is a real line, not a mock.
  const sample = useMemo(() => pickGreeting(null, {
    now: Date.now(), hour: new Date().getHours(),
    name: greetName || null, character, awayMs: null,
  }).text, [character, greetName]);

  return (
    <div className="profile">
      <h1 className="profile-h1">Your licence</h1>

      <div className="ptabs" role="tablist" aria-label="Profile" ref={tabsRef} onKeyDown={walkTabs}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`ptab-${t.id}`} aria-controls={`ppanel-${t.id}`}
                  aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                  className={`ptab ${tab === t.id ? "is-on" : ""}`} onClick={() => onNavigate(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {saveNote && <p className="psaved">{saveNote}</p>}

      {/* ------------------------------------------------------------ LICENCE */}
      {tab === "licence" && (
        <div className="ppanel" role="tabpanel" id="ppanel-licence" aria-labelledby="ptab-licence">
          <section className="pcard holder">
            <div className="holder-face">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : <span>{initials || "··"}</span>}
            </div>
            <div className="holder-text">
              <div className="holder-name">
                {user?.fullName || user?.username || "Pilot"}
                {isAdmin && <span className="holder-admin"><ShieldCheck size={10} /> ADMIN</span>}
              </div>
              <div className="holder-mail">{user?.primaryEmailAddress?.emailAddress}</div>
              <div className="holder-acts">
                <button className="pill" type="button" onClick={() => fileRef.current?.click()}>Choose a photo</button>
                {user?.imageUrl && (
                  <button className="plink" type="button"
                          onClick={() => user.setProfileImage({ file: null }).then(() => setSaveNote("Back to initials."))}>
                    Use initials
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={choosePhoto} />
              </div>
            </div>
          </section>

          <section className="pcard">
            <Field label="Name on the licence" hint="Private. Nobody sees this but you."
                   value={holderName} onChange={setHolderName}
                   onCommit={() => {
                     const [first, ...rest] = holderName.trim().split(/\s+/);
                     user?.update({ firstName: first || "", lastName: rest.join(" ") });
                   }} />
            <Field label="Username" hint="How you show up to everyone else."
                   value={username} onChange={setUsername}
                   onCommit={() => user?.update({ username: username.trim() }).catch(() => setSaveNote("That username is taken."))} />
            <Field label="What Wingman calls you" hint="Used in greetings, and only by whoever's greeting you."
                   value={greetName} onChange={setGreetName}
                   onCommit={() => progress.set("pw-greet-name", greetName.trim() || null)} />

            <Switch id="by-username" on={byUsername} onChange={setIdentity} label="Go by your username" />
            <p className="ppreview">
              {byUsername
                ? `Everyone else sees @${username || "your-username"}`
                : `Everyone else sees ${holderName || "your name"} — most people don't.`}
            </p>
          </section>

          <section className="pcard">
            <div className="pcard-head">Account</div>
            <div className="prow"><div className="prow-text">
              <div className="prow-title">Email</div>
              <div className="prow-note">{user?.primaryEmailAddress?.emailAddress}</div>
            </div></div>
            <div className="prow"><div className="prow-text">
              <div className="prow-title">Password</div>
              <div className="prow-note">Changed from your account provider.</div>
            </div></div>
            <div className="prow">
              <div className="prow-text"><div className="prow-title">Sign out</div></div>
              <button className="pill" type="button" onClick={() => signOut()}>Sign out</button>
            </div>
          </section>

          {/* Findable if you're looking, invisible if you're not. */}
          {confirmDelete ? (
            <p className="pdelete">
              This removes your logbook, your crew and everything you've flown, and it can't be undone.{" "}
              <button type="button" className="plink"
                      onClick={() => user?.delete().catch(() => setSaveNote("That didn't go through. Try again, or write to us."))}>
                Delete it all
              </button>
              {" · "}
              <button type="button" className="plink" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </p>
          ) : (
            <p className="pdelete">
              <button type="button" className="plink is-quiet" onClick={() => setConfirmDelete(true)}>Delete your account</button>
              {" "}— removes your logbook, your crew and everything you've flown. It can't be undone.
            </p>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- PREFERENCES */}
      {tab === "preferences" && (
        <div className="ppanel" role="tabpanel" id="ppanel-preferences" aria-labelledby="ptab-preferences">
          {flags["voice.characters"] && (
            <section className="pcard">
              <div className="pcard-head">Who greets you</div>
              {CHARACTERS.map((c) => (
                <button key={c.id} type="button"
                        className={`pchoice ${character === c.id ? "is-on" : ""}`}
                        aria-pressed={character === c.id}
                        onClick={() => progress.set("pw-voice", c.id)}>
                  <span className="pchoice-name">{c.name}</span>
                  <span className="pchoice-note">{c.blurb}</span>
                  {character === c.id && <span className="pchoice-sample">{sample}</span>}
                </button>
              ))}
              <p className="pcard-foot">{VOICES[character]?.flat().length} lines, dealt so you see every one before any repeat.</p>
            </section>
          )}

          <section className="pcard">
            <div className="pcard-head">How social</div>
            {PRESETS.filter((p) => (p.id === "quiet") || (p.id === "crew" && flags["social.crew"])
                                || (p.id === "open" && flags["social.crew"] && flags["social.frequency"])).map((p) => (
              <button key={p.id} type="button"
                      className={`pchoice ${preset === p.id ? "is-on" : ""}`}
                      aria-pressed={preset === p.id}
                      onClick={() => progress.set("pw-social-preset", p.id)}>
                <span className="pchoice-name">{p.name}</span>
                <span className="pchoice-note">{p.note}</span>
              </button>
            ))}
          </section>

          <section className="pcard">
            <div className="pcard-head">Notices</div>
            {NOTICES.map((n) => (
              <Switch key={n.id} id={`notice-${n.id}`} label={n.label} note={n.note}
                      on={notices[n.id] !== false}
                      onChange={(v) => progress.set("pw-notices", { ...notices, [n.id]: v })} />
            ))}
          </section>
        </div>
      )}

      {/* --------------------------------------------------------- APPEARANCE */}
      {tab === "appearance" && (
        <div className="ppanel" role="tabpanel" id="ppanel-appearance" aria-labelledby="ptab-appearance">
          <section className="pcard">
            <div className="pcard-head">Night Ops</div>
            <div className="pseg" role="group" aria-label="Night Ops">
              {MODES.map((m) => (
                <button key={String(m.id)} type="button" aria-pressed={variantPin === m.id}
                        className={variantPin === m.id ? "is-on" : ""}
                        onClick={() => onVariantPin(m.id)}>{m.label}</button>
              ))}
            </div>
            <p className="pcard-foot">Auto follows this device.</p>
          </section>

          <section className="pcard">
            <div className="pcard-head">Livery</div>
            <div className="plivname">{current.name}</div>
            <p className="pcard-foot">{current.description}</p>
            {/* Click selects. Nothing happens on hover. */}
            <div className="pcircles" role="radiogroup" aria-label="Livery">
              {liveries.map((L) => (
                <button key={L.id} type="button" role="radio" aria-checked={L.id === current.id}
                        aria-label={L.name} title={L.name}
                        className={`pcircle ${L.id === current.id ? "is-on" : ""}`}
                        style={{ "--sw": liverySwatch(L) }}
                        onClick={() => onLivery(L.id)} />
              ))}
            </div>
            <div className="planchors">{current.anchors}</div>
            <Specimen liveryId={current.id} variant={variant} />
          </section>

          <section className="pcard">
            <div className="pcard-head">Instrument scale</div>
            <div className="pseg" role="group" aria-label="Instrument scale">
              {SCALES.map((s) => (
                <button key={s.id} type="button" aria-pressed={fontSize === s.id}
                        className={fontSize === s.id ? "is-on" : ""}
                        onClick={() => onFontSize(s.id)}>{s.label}</button>
              ))}
            </div>
          </section>

          <section className="pcard">
            <div className="pcard-head">Accessibility &amp; motion</div>
            <Switch id="smooth-air" label="Smooth Air" note="Stops every animation and transition."
                    on={reduceMotion} onChange={onReduceMotion} />
            <Switch id="plain-language" label="Plain Language" note="Swaps to Atkinson Hyperlegible."
                    on={dyslexiaFont} onChange={onDyslexiaFont} />
            <Switch id="turbulence" label="Turbulence" note="The small nudge on view and tab change."
                    on={turbulence} onChange={onTurbulence} />
            <Switch id="grain" label="Grain" note="The film grain over the light."
                    on={grain} onChange={onGrain} />
            <p className="pcard-foot">Your device's own reduced-motion setting is honoured on its own, whatever Smooth Air says.</p>
          </section>
        </div>
      )}

      <style>{PROFILE_CSS}</style>
    </div>
  );
}


export default Profile;
