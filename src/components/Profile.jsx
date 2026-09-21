import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "../lib/clerk.js";
import LicenceCard from "./licence/LicenceCard.jsx";
import CoverPicker from "./licence/CoverPicker.jsx";
import PhrasePicker from "./licence/PhrasePicker.jsx";
import StampCreator from "./licence/StampCreator.jsx";
import PhotoPicker from "./licence/PhotoPicker.jsx";
import CoverCrop from "./licence/CoverCrop.jsx";
import AvatarCrop from "./licence/AvatarCrop.jsx";
import { checkFile, uploadCover, renderAvatar, uploadAvatar } from "../lib/coverImage.js";
import { fetchCard, saveCard, syncStats, statsFrom } from "../lib/licence.js";
import { HOBBS_KEY, DAYS_KEY } from "../lib/hobbs.js";
import { stampOf } from "../lib/stamp.js";
import { ShieldCheck, X } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { LIVERIES, deckVars, engineLivery, keyImg, fillImg, auroraImg, LIGHT, hueAt, LX, LS, wrap, col } from "../lib/liveryEngine.js";
import { profileSVG } from "../lib/flightProfile.js";
import { MODULES, CHAPTERS } from "../data.js";
import { CHARACTERS, DEFAULT_CHARACTER, VOICES } from "../lib/voices.js";
import { withSetting } from "../lib/viewTransition.js";
import { useFlags } from "../lib/flags.js";
import { FLY_SOLO_KEY, mirrorFlySolo } from "../lib/flySolo.js";
import { clearPresence } from "../lib/presence.js";
import BlockedList from "./BlockedList.jsx";
import { saveProfile, fetchProfile } from "../lib/squadron.js";
import { takeLicenceAsk } from "../lib/licenceAsk.js";
import { ERROR_GENERIC } from "../lib/copy.js";
import { demoOn, demoProfile, DEMO_ME, DEMO_PRESET, DEMO_BAR } from "../lib/demoFixture.js";
import { OFFERED_FINISHES as FINISHES, lightOverride } from "../lib/finishEngine.js";
import { MIN_FLOOR, MIN_CEIL, PASS_PCT, MINIMUMS_KEY, clampMinimums, readMinimums } from "../lib/minimums.js";
import { useTiltPermission } from "../lib/useAttitude.js";
import { useTabPill } from "../lib/tabMotion.js";

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
/* THE REFERENCE'S OWN PLACEHOLDERS (`GREET` in docs/launch/code/
   10-preferences.js), which START-HERE §3 names as the source for this panel.
   They were longer here — "Skip it. I'll keep talking until you look up, same
   as always." and "Empty, leave it. Know who you are, I already do." — and
   both are kept in docs/launch/DECISIONS.md in case the owner prefers them:
   they are the same joke, told at length. The label follows the greeter. */
const CALL_COPY = {
  wingman: { label: "What Wingman calls you", hint: "Skip it. I'll talk anyway." },
  hermit:  { label: "What the Hermit calls you", hint: "Skip it, you may. Talk anyway, I will." },
};

const SCALES = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];
// You asked for Night Ops on dark and Day Ops on light. The POC's shape is a
// The card is the control. Light, Dark and Auto need no explaining, so there is
// no name row and no description line — see the override line for the one case
// where something still has to be said.
//
// Auto follows the device's own appearance setting. Not the clock, not sunrise,
// and not the greeting system's hour bands, which are deliberately separate.
const MODES = [
  { id: "day", label: "Light" },
  { id: "night", label: "Dark" },
  { id: null, label: "Auto" },
];

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

// The radio, wide, disabledIds and describedBy props are opt-in and used only
// by the lighting card. The five other Segs on this page keep the group and
// aria-pressed semantics they already had.
function Seg({ label, options, value, onPick, radio, wide, disabledIds = [], describedBy }) {
  const off = (id) => disabledIds.includes(id);

  // A radiogroup is expected to move with the arrow keys; buttons do not do
  // that on their own. Disabled options are stepped over rather than landed on.
  const onKeyDown = (e) => {
    if (!radio) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const pickable = options.filter((o) => !off(o.id));
    if (!pickable.length) return;
    const at = pickable.findIndex((o) => o.id === value);
    const next = pickable[(at + step + pickable.length) % pickable.length];
    onPick(next.id);
  };

  return (
    // The override line explains the whole control, so the GROUP carries the
    // description as well as any individually disabled option. When a finish
    // overrides the light choice this control collapses to the one option that
    // is still true, which leaves no disabled segment to hang the explanation
    // on — without this, a screen reader gets the collapsed control and never
    // hears why.
    <div className={`seg${wide ? " seg-wide" : ""}`} role={radio ? "radiogroup" : "group"}
         aria-label={label} aria-describedby={describedBy} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={String(o.id)} type="button"
                  role={radio ? "radio" : undefined}
                  aria-checked={radio ? on : undefined}
                  aria-pressed={radio ? undefined : on}
                  aria-disabled={off(o.id) || undefined}
                  aria-describedby={off(o.id) && describedBy ? describedBy : undefined}
                  tabIndex={radio && !on ? -1 : 0}
                  onClick={() => { if (!off(o.id)) onPick(o.id); }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// §6.3 — one solid colour per circle: the core of that livery's own ramp.
// Not the ground, not the key light — the colour the livery is.

function LiveryDot({ livery: L, selected, onPick }) {
  // A solid disc of the livery's own colour inside a ring of its own highlight.
  // Flat — no shading, no gradient across the face: an earlier radial version
  // read as a glass bead, which is a different kind of object from the flat
  // controls around it.
  //
  // Both values come from that livery's ramp, so the swatch previews the thing
  // it selects. Nothing here is a hand-picked colour.
  //
  // All seven are identical in treatment. Aurora used to carry its starfield
  // here while the other six were plain, which made it read as a different kind
  // of control; the stars belong on the specimen below, where there is room for
  // them.
  const core = `oklch(.60 ${(L.chroma * L.midC).toFixed(3)} ${hueAt(L, 0.55).toFixed(1)})`;
  const highlight = col(0.80, L.chroma * 0.75, hueAt(L, 0.85), 1);
  const style = { background: core, boxShadow: `inset 0 0 0 5px ${highlight}` };
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
/* ONE COLUMN, 680px, CENTRED — the reference's .col, which every one of its
   three tabs sits in. It was a 1240px page with a 520px tab strip and a 760px
   panel inside it, all flush left, which is bug 5: "the card is wider than its
   column and runs off the right edge. It should be the width of the tab strip
   above it, centred under it." Two of those three numbers had to go for the
   third to be true. Appearance's own contents are untouched; it narrows with
   the page, as it does in the reference. */
.profile { max-width: 680px; margin: 0 auto; padding: 0 0 80px; }
/* .content already lays a 22px gutter on every page, and .deck another 16
   outside the zoom. A third layer here was 38px a side of a 326px phone, so
   23% of the screen was margin before any content — and on a desktop it was
   the 20px that made this column 40px narrower than the reference's at every
   width. There is none now, at any size. The bottom padding stays: that one
   is clearing the tab bar, not a gutter. */
@media (max-width: 640px) { .profile { padding: 0 0 96px; } }

.phead { margin: 10px 0 16px; }
.back { background: none; border: 0; color: var(--t2); font-size: 13px; cursor: pointer; padding: 4px 0;
  display: inline-flex; align-items: center; gap: 6px; min-height: 0; }
.back:hover { color: var(--t1); }
.ptitle { font-size: calc(30px * var(--scale, 1)); font-weight: 700; letter-spacing: -.6px;
  margin: 6px 0 0; color: var(--t1); }

.tabs { display: flex; gap: 4px; background: color-mix(in oklab, var(--panel), transparent 20%);
  border: 1px solid var(--line); border-radius: 11px; padding: 4px; margin-bottom: 20px;
  /* Three tabs at the Large text size come to 288px, which does not fit a
     375px phone: "Appearance" ran 17px past the edge and .deck's
     overflow-x: hidden ate it, so the tab was unreachable rather than merely
     tight. Scrolls instead, the same treatment .mscreen .tabs already has.
     Nothing changes at sizes where the row fits. */
  overflow-x: auto; scrollbar-width: none;
  /* Every pill paints below every label: a pill sliding past a neighbouring
     tab passes under its word, never over it. */
  isolation: isolate; }
.tabs::-webkit-scrollbar { display: none; }
/* flex: 1 0 auto — grow to fill the row exactly as before wherever there is
   room, and never shrink below the label. A 0 0 auto would have stopped them
   filling on a desktop, which is a look, not a fix.
   (No backticks in this block: it is a JS template literal, and one inside a
   CSS comment ends the string.) */
.tabs button { flex: 1 0 auto; background: none; border: 0; border-radius: 8px; padding: 10px 8px;
  color: var(--t2); font-size: calc(13px * var(--scale, 1)); font-weight: 600; cursor: pointer;
  position: relative; transition: color .16s; }
.tabs button[aria-selected="true"] { color: var(--t1); }
/* The selected tab's fill and edge, on an element of their own so they can
   travel between tabs (useTabPill). Exactly the look the button used to paint
   on itself. */
.tabs button .tab-pill { display: none; }
.tabs button[aria-selected="true"] .tab-pill { display: block; position: absolute; inset: 0; z-index: -1;
  border-radius: 8px; background: var(--raised);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--active), transparent 55%);
  transform-origin: left center; }

.panel { display: flex; flex-direction: column; gap: 16px; }
/* THE TWO TABS THE REFERENCE OWNS ARE NOT A FLEX COLUMN. Its boxes carry a
   16px bottom margin of their own, and a flex gap on top of that made every
   space on the tab 32. Turning the gap off is not enough: a flex item is a
   block formatting context, so the LAST box's margin could not collapse out
   of the panel either, which left 16px of the screenshot below the last box
   that the reference does not have. Ordinary flow, and the margins are the
   whole of the spacing — which is how the reference's own #t-pref measures. */
.panel.panel-ref { display: block; }
.block { background: var(--panel); border: 1px solid var(--line); border-radius: 13px;
  border-top-color: var(--edge-hi); padding: 18px 20px 20px; }
.block > .eyebrow { display: block; margin-bottom: 14px; }

/* Preferences packs the most into each card — a name, a line, a control and,
   in the greeter's case, a field as well — and it was the tightest of the
   three tabs as a result. One rhythm from a flex gap instead of each child
   carrying its own margin, so the parts sit apart evenly rather than wherever
   their own margins happened to land. */
#ppanel-preferences .block { display: flex; flex-direction: column; gap: 13px;
  padding: 20px 22px 22px; }
#ppanel-preferences .block > .eyebrow { margin-bottom: 2px; }
#ppanel-preferences .livname { margin-bottom: 0; }
#ppanel-preferences .livdesc { margin-bottom: 0; }
#ppanel-preferences .field { padding: 0; }
.eyebrow { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--t3); }

.row { display: flex; align-items: center; gap: 16px; padding: 13px 0;
  border-top: 1px solid color-mix(in oklab, var(--line), transparent 45%); }
.row:first-of-type { border-top: 0; padding-top: 2px; }
.rowtext { flex: 1; min-width: 0; }
.rowtext b { display: block; font-size: calc(14px * var(--scale, 1)); font-weight: 600; }
.rowtext span { display: block; font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); margin-top: 2px; }

/* §6 — Your bar, in its own box: a heading that carries the number, a
   paragraph that says what it does, the slider, and its two ends labelled.
   The old .barctl — a slider and an output squeezed onto a settings row — is
   gone with the row. */
.barhead { display: flex; align-items: baseline; gap: 10px; font-size: calc(15px * var(--scale, 1)); color: var(--t1); }
.barbig { font-family: var(--font-mono); font-size: calc(20px * var(--scale, 1)); font-weight: 700;
  color: var(--active-text); font-variant-numeric: tabular-nums; margin-left: auto; }
.barrange { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px;
  margin: 16px 0 8px; min-height: 44px; accent-color: var(--active); background: transparent; }
.barends { display: flex; justify-content: space-between; gap: 12px;
  font-family: var(--font-mono); font-size: calc(11px * var(--scale, 1)); color: var(--t3); }

/* Your bar: the slider and the number it is set to, as one control. */
.barctl { display: flex; align-items: center; gap: 12px; flex: 0 1 280px; min-width: 0; }
.barctl input { flex: 1 1 auto; min-width: 0; min-height: 44px; margin: 0; accent-color: var(--active); }
.barctl output { flex: none; min-width: 4ch; text-align: right; color: var(--t1);
  font-family: var(--font-mono); font-size: calc(14px * var(--scale, 1)); font-variant-numeric: tabular-nums; }
.tiltbtn { flex: none; background: var(--raised); color: var(--t1); border: 1px solid var(--line);
  border-radius: 10px; padding: 8px 16px; font: inherit; font-weight: 600;
  font-size: calc(12.5px * var(--scale, 1)); cursor: pointer; }

.field { display: flex; flex-direction: column; gap: 6px; padding: 11px 0; }
.field label { font-size: calc(12.5px * var(--scale, 1)); color: var(--t2); }
.field input, .field textarea { background: var(--raised); border: 1px solid var(--line);
  border-radius: 9px; padding: 10px 12px; color: var(--t1); font-family: inherit;
  font-size: calc(14px * var(--scale, 1)); width: 100%; }
.field input:focus, .field textarea:focus { outline: 2px solid var(--active); outline-offset: 1px; }
.field .hint { font-size: calc(11.5px * var(--scale, 1)); color: var(--t3); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 620px) { .two { grid-template-columns: 1fr; } }

/* A SETTINGS ROW STACKS ON A NARROW SCREEN, and until now it did not.
   .row is a flex pair: a text block that shrinks and a control that cannot.
   The segmented control is sized by its labels, so at 375px its intrinsic
   width was larger than the space left beside the label and it pushed 83px
   past the row -- measured, not guessed: the row ended at x=291 and the
   control at x=374, hard against the screen edge. It read as a control that
   had slipped out of its card.
   Wrapping is the fix rather than shrinking, because shrinking a segmented
   control past its labels only moves the problem into the text. Label on top,
   control full width beneath, which is the pattern every settings screen on a
   phone already uses -- so it is also the more familiar of the two. */
@media (max-width: 620px) {
  .row { flex-wrap: wrap; row-gap: 10px; }
  .profile .barctl { flex-basis: 100%; }
  /* EVERY segmented control, not the ones in a .row. Writing this per-context
     found the same overflow three times in three places -- the finish control
     hung 91px outside its card because it is sized by width: max-content and
     max-width: 100% caps the BOX without letting the buttons shrink; the
     preferences pair hung 3px. One rule where the control is, rather than one
     per container it might sit in. Scoped through .profile to outrank the base
     rules further down this sheet. */
  .profile .seg { width: 100%; }
  .profile .seg > button { flex: 1 1 0; min-width: 0; padding-inline: 8px; }

  /* Same shape, same cause: a 200px floor beside an avatar in a 208px row.
     On a phone the identity block takes the whole line instead.
     Scoped through .profile deliberately. Bare .idtext ties with the base rule
     on specificity, and the base rule is declared further down this sheet, so
     source order handed it back its flex-basis and its 200px floor -- measured
     as still 22px past the row after the first attempt. A media query adds no
     specificity of its own; the extra class is what wins it. */
  .profile .idtext { flex-basis: 100%; min-width: 0; }
}

/* An address has no spaces to break at, so a long one runs past its column on
   any width. This is the only thing here that is not width-conditional. */
.idmail { overflow-wrap: anywhere; }

.seg { display: inline-flex; background: var(--raised); border: 1px solid var(--line);
  border-radius: 10px; padding: 3px; gap: 3px; }
.seg button { background: none; border: 0; border-radius: 7px; padding: 8px 15px; color: var(--t2);
  font-size: calc(12.5px * var(--scale, 1)); font-weight: 600; cursor: pointer;
  transition: background .16s, color .16s; }
.seg button[aria-pressed="true"] { background: var(--panel); color: var(--t1);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--active), transparent 55%); }

/* The lighting card is nothing but this control, so the control has to carry
   the state on its own. The selected segment is FILLED rather than ringed:
   with the value name row gone, nothing else on the card says which one is on.
   --active-fill is the app's existing filled-control pair, so no new colour. */
.seg-wide { display: flex; width: 100%; }
.seg-wide button { flex: 1 1 0; min-width: 0; padding: 7px 8px;
  /* 44px is the touch floor, and it is also what lets the third label wrap to
     two lines inside its own segment instead of truncating. */
  min-height: 44px; white-space: normal; line-height: 1.15; text-align: center; }
.seg-wide button[aria-checked="true"] { background: var(--active-fill); color: var(--ground); font-weight: 600; }
.seg-wide button[aria-disabled="true"] { opacity: .5; cursor: default; }

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

/* The control centres under the name and line it belongs to. .seg is
   inline-flex, so it needs a width of its own before a margin can centre it. */
.block-livery .seg { display: flex; width: max-content; max-width: 100%; margin-inline: auto; }

/* Ruled is a detail of Manual, not a second heading. Styled as .livname it
   carried the same weight as the finish name directly above it and the card
   read as two cards pushed together. A rule and a smaller label instead, so
   the card is one thing with a detail under it. */
.finish-sub { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
.finish-sub .subname { font-size: calc(13.5px * var(--scale, 1)); font-weight: 600;
  color: var(--t1); text-align: center; }
.finish-sub .subdesc { font-size: calc(12px * var(--scale, 1)); color: var(--t2);
  text-align: center; margin: 2px 0 13px; }
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

/* WHICH PROVIDER, IN WORDS. Clerk names them `oauth_google`, `oauth_apple` and
   so on; a student has never seen that string and should not start now. Falls
   back to "your sign-in provider", which is the sentence that used to be shown
   to everybody whether it was true of them or not. */
function signInWith(user) {
  const id = user?.externalAccounts?.[0]?.provider || "";
  const name = String(id).replace(/^oauth_/, "").replace(/_/g, " ").trim();
  if (!name) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function Profile({ page = "licence", onNavigate, onBack, variantPin, onVariantPin, livery, onLivery,
                   finish, onFinish, ruled, onRuled,
                   fontSize, onFontSize, reduceMotion, onReduceMotion, dyslexiaFont, onDyslexiaFont,
                   grain, onGrain, variant }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const progress = useUserProgress();
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
  useTabPill(tabsRef, tab);
  const fileRef = useRef(null);

  const [holderName, setHolderName] = useState("");
  const [username, setUsername] = useState("");
  const [greetName, setGreetName] = useState("");
  const [saveNote, setSaveNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* The three-character code. It has no field of its own any more — §2 of the
     handoff: "The code is chosen inside the creator" — but every account still
     HAS one, claimed on sight, and the creator opens on it. */
  const [code, setCode] = useState("");

  /* §5 — THE CARD. The first box on this tab IS the licence card, and it is
     the same component other people see; `edit` is the whole difference.
     `card` is the profile row it draws, which is also where the bio and the
     phrase live now — the bio used to be pw-bio in this account's private
     progress, which meant the one line written to be read by other people was
     the one line other people could not read. */
  const [card, setCard] = useState(null);
  const [picker, setPicker] = useState(null);       // cover | photo | photocrop | crop | phrase | stamp | others
  const [statsWas, setStatsWas] = useState(null);
  /* §5's cover upload: the file, once it has been read, and whether the crop
     is busy sending. The object URL is revoked when the sheet closes — a
     blob left in memory is a photo the tab keeps holding. */
  const [cropSrc, setCropSrc] = useState(null);
  const [cropBusy, setCropBusy] = useState(false);
  const coverFileRef = useRef(null);
  const closeCrop = () => {
    setPicker(null);
    setCropSrc((u) => { if (u) URL.revokeObjectURL(u); return null; });
  };
  /* The face's file, read once and held as an object URL so the crop can
     show it without a round trip. Revoked when the sheet closes — a blob left
     in memory is a photo the tab keeps holding. */
  const [photoSrc, setPhotoSrc] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const closePhotoCrop = () => {
    setPicker(null);
    setPhotoSrc((u) => { if (u) URL.revokeObjectURL(u); return null; });
  };
  const pickPhotoFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const wrong = checkFile(file);
    if (wrong) { setSaveNote(wrong); return; }
    setPhotoSrc(URL.createObjectURL(file));
    setPicker("photocrop");
  };

  const pickCoverFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const wrong = checkFile(file);
    if (wrong) { setSaveNote(wrong); return; }
    setCropSrc(URL.createObjectURL(file));
    setPicker("crop");
  };

  useEffect(() => {
    setHolderName(user?.fullName || "");
    setUsername(user?.username || "");
    // Empty unless they have set one. No longer seeded from the first name.
    setGreetName(progress.get("pw-greet-name", "") || "");
  }, [user?.fullName, user?.username, user?.firstName, progress.loaded]);

  /* The code comes from the profile, not from Clerk — Clerk has never heard of
     it. IT IS NO LONGER CLAIMED ON SIGHT. It used to be: an account without
     one was handed a random code the first time it opened this screen, and
     the stamp creator then let it type a different one that was never
     claimed. The code IS the stamp now (0035), claimed when the stamp is
     issued, so an account without one simply has none until then, and the
     creator offers a suggestion. */
  useEffect(() => {
    let live = true;
    if (!user?.id) return undefined;
    fetchProfile(user.id).then((row) => { if (live && row?.code) setCode(row.code); });
    return () => { live = false; };
  }, [user?.id]);

  /* Straight from the walkthrough: its last button brings a new student here
     to issue their code and stamp, so the creator opens on arrival. */
  useEffect(() => { if (takeLicenceAsk()) setPicker("stamp"); }, []);
  /* `?creator` opens it too, for ANYBODY: signed out, or with a stamp already
     issued, it opens as a preview whose one missing part is the button that
     issues (StampCreator's `preview`). It is how the creator is looked at on
     the live site by somebody who cannot, or need not, make a stamp. */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("creator")) setPicker("stamp");
  }, []);

  /* The card's own row, read through 0030's function — the same one anybody
     opening your card uses, so what you see in edit mode is what they see.
     And the three stats are pushed on open: they are a projection of this
     account's private progress, and this is the one moment anybody is about
     to look at them. */
  useEffect(() => {
    let live = true;
    if (!user?.id || !progress.loaded) return undefined;
    const numbers = {
      hobbs: progress.get(HOBBS_KEY, {}),
      done: progress.get("pw-lesson-done", {}),
      days: progress.get(DAYS_KEY, null),
    };
    (async () => {
      const next = await syncStats(user.id, numbers, statsWas);
      if (!live) return;
      setStatsWas(next);
      let row = await fetchCard(user.id, user.id);
      /* THE FULL NAME IS MIRRORED ONCE, HERE. Clerk holds it and Postgres
         cannot query Clerk, so pilot_profiles.real_name is the copy every
         other surface reads. It used to be written when the "Full name" field
         was committed — §5 took that field off the card, so nothing wrote it
         any more and an account carried a name on its licence and an initial
         in the app bar. Same person, two faces. */
      const clerkName = (user.fullName || "").trim();
      if (live && clerkName && row && row.real_name !== clerkName) {
        await saveProfile(user.id, { real_name: clerkName });
        row = await fetchCard(user.id, user.id);
      }
      if (live && row) setCard(row);
    })();
    return () => { live = false; };
  }, [user?.id, progress.loaded]);

  /* One writer for the card's fields, and it updates what is on screen from
     what the server accepted rather than from what was asked for — a value
     a CHECK refuses must not keep drawing. */
  const patchCard = async (patch) => {
    if (!user?.id) return;
    setCard((c) => ({ ...(c || { user_id: user.id }), ...patch }));
    const r = await saveCard(user.id, patch);
    if (!r.ok) { setSaveNote("That didn't save. Try again in a moment."); }
    const row = await fetchCard(user.id, user.id);
    if (row) setCard(row);
  };

  const myStats = demoOn() ? DEMO_ME.stats : statsFrom({
    hobbs: progress.get(HOBBS_KEY, {}),
    done: progress.get("pw-lesson-done", {}),
    days: progress.get(DAYS_KEY, null),
  });
  const myStamp = stampOf(card);
  /* Clerk has finished deciding AND there is somebody. `isLoaded` matters:
     without it the card flickers through read-only on every load. */
  const signedIn = Boolean(isLoaded && user?.id);

  const character = progress.get("pw-voice", DEFAULT_CHARACTER);
  const callCopy = CALL_COPY[character] || CALL_COPY.wingman;

  const preset = demoOn() ? DEMO_PRESET : progress.get("pw-social-preset", "crew");
  const currentFinish = FINISHES.find((f) => f.id === (finish ?? null)) || FINISHES[0];
  const override = lightOverride(finish);
  const notices = progress.get("pw-notices", { answers: true, wingman: true, nudge: true });
  // The bar: one key, one clamp, one default, read exactly as Master Caution and
  // the gyro read it, so moving it here moves both.
  const bar = demoOn() ? DEMO_BAR : readMinimums(progress);
  // iOS reports tilt only after a tap asks, so the asking sits here beside the
  // bar, and never happens on load.
  const tilt = useTiltPermission(reduceMotion);

  const liveries = LIVERIES.filter((l) => (l.aurora ? flags["livery.aurora"] : true));
  const current = liveries.find((l) => l.id === engineLivery(livery)) || liveries[0];

  const walkTabs = (e) => {
    const btns = [...(tabsRef.current?.querySelectorAll('[role="tab"]') || [])];
    const i = btns.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); btns[n]?.focus(); onNavigate(TABS[n].id); };
    if (e.key === "ArrowRight") go((i + 1) % btns.length);
    if (e.key === "ArrowLeft") go((i - 1 + btns.length) % btns.length);
    if (e.key === "Home") go(0);
    if (e.key === "End") go(btns.length - 1);
  };

  /* THE PHOTO IS THIS APP'S NOW. `choosePhoto` used to hand the file to
     Clerk's setProfileImage; the read below used to be Clerk's
     `user.imageUrl`, which is never null, so the app's own initials were
     unreachable and the colour picked on this very page painted nothing.
     Both are gone. src/lib/avatar.js and 0033 carry the whole argument. */
  const flySolo = progress.get(FLY_SOLO_KEY, false);
  // Both halves have to move together. The stored value drives this device,
  // the mirror lets the plain lib functions read it synchronously, and
  // pilot_profiles.invisible is the only half other people's queries can see.
  const setFlySolo = (on) => {
    progress.set(FLY_SOLO_KEY, on);
    mirrorFlySolo(on);
    /* AND THE ROW GOES NOW, not on the next beat. The heartbeat clears
       presence when it finds the switch on, and it runs every 45 seconds —
       so turning it on and closing the tab left the student standing where
       they were for the better part of a minute, to everybody else. "Nobody
       sees you" cannot start a minute late. */
    if (on && user?.id) clearPresence(user.id).catch(() => {});
    if (user?.id) saveProfile(user.id, { invisible: on }).catch(() => setSaveNote(ERROR_GENERIC));
  };

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
            {/* The selected look, drawn by its own element so it can slide to
                the next tab — see useTabPill. Identical at rest. */}
            <span className="tab-pill" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {saveNote && <p className="psaved">{saveNote}</p>}

      <div className="panel-swap" ref={swapRef} style={swapH ? { height: swapH } : undefined}>

      {/* ------------------------------------------------------------ LICENCE */}
      {tab === "licence" && (
        <div className="panel panel-in panel-ref" key={tab} role="tabpanel" id="ppanel-licence" aria-labelledby="ptab-licence">
          {/* THE BOXES CARRY THEIR OWN SPACING. `.panel` is a flex column with
              a 16px gap and the reference's `.box` has a 16px bottom margin,
              so together they made 32 — every box on this tab sat twice as far
              from the next as the design draws it. One ordinary block wrapper
              inside the flex column, and the margins are the only spacing. */}
          <div className="ref-lic">
          {/* THE HEADER THE CARD NEVER HAD. The reference's licence tab opens
              with a .boxh — "Your licence" on the left, "See it as others do"
              on the right — and the card sits in the .box under it. Live, the
              header was missing entirely and "See it as others do" was
              stranded at the foot of the card, which is also what made the
              card wider than its column: nothing was holding it in. */}
          <div className="box">
            <div className="boxh">
              <p className="lab">Your licence</p>
              {signedIn && (
                <button type="button" className="pill" onClick={() => setPicker("others")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  See it as others do
                </button>
              )}
            </div>
          {/* §5 — THE CARD IS THE FIRST BOX, and it is not a box: the same
              component anybody else sees when they tap your face, in edit
              mode. The fields that used to be listed here — the photo, the
              callsign, the bio — are ON it now, where they are read, so
              there is no form above a preview of the form.

              WHAT MOVED OUT rather than away:
              · Full name is the ACCOUNT'S and is changed where accounts are;
                it shows on the card under the callsign and is not editable
                here, which is what §5 asks for.
              · "Go by callsign" went with it. The card's big line IS the
                callsign now — §5: "always the big line and the only editable
                name" — so a switch choosing between the two was choosing
                something the design had already decided.
              · Fly solo moved to Preferences (§6), into How social.
              None of the three is gone; each is somewhere it makes sense. */}
          <LicenceCard
            profile={demoProfile(card, { callsign: username, real_name: holderName })}
            stats={myStats}
            stamp={myStamp}
            admin={isAdmin || demoOn()}
            /* SIGNED OUT, THE CARD IS READ-ONLY. It used to render in edit
               mode for anybody who reached this address: a cover picker, a
               phrase picker and a stamp creator, all of which write against
               user.id and therefore wrote nowhere. One of them did worse than
               nothing — the cover upload put an object at `undefined/cover.webp`,
               a single slot shared by every signed-out visitor.

               Read-only is the honest state: this is your licence as it
               stands on this device, and the line under it says what to do
               about it. */
            edit={signedIn}
            onPickCover={() => setPicker("cover")}
            onPickPhoto={() => setPicker("photo")}
            onPickPhrase={() => setPicker("phrase")}
            onCreateStamp={() => setPicker("stamp")}
            onCallsign={(v) => {
              const next = v.trim();
              if (!next || next === username) return;
              setUsername(next);
              /* Clerk owns uniqueness, so the mirror only happens after it
                 accepts. A name that was taken must not be written anywhere. */
              user?.update({ username: next })
                .then(() => { if (user?.id) saveProfile(user.id, { callsign: next }); })
                .catch(() => setSaveNote("That callsign is taken."));
            }}
            onBio={(v) => patchCard({ bio: v })}
            action={signedIn ? null : (
              <p className="lic-signin">Sign in to make this yours and put a stamp on it.</p>
            )}
          />
          </div>

          {/* The reference's Account box: .lab, then three .row s whose text is
              a <div> of <b> over <span>. It was a <span class="rowtext">, and
              the sheet's own `.row span{color:var(--t3)}` would have greyed
              the bold line through it. */}
          <div className="box">
            <p className="lab">Account</p>
            {/* BOTH OF THESE WERE DEAD. They called onNavigate("account"),
                "account" is not one of the three profile tabs, and so
                `path.profile` fell back to /account/licence — the page you
                were already on. They reach Clerk's own account UI now, which
                owns both flows including the verification mail. */}
            <div className="row">
              <div><b>Email</b><span>{user?.primaryEmailAddress?.emailAddress}</span></div>
              <button className="pill" type="button" onClick={() => onNavigate("email")}>Change</button>
            </div>
            <div className="row">
              {/* AND THE PASSWORD ROW TELLS THE TRUTH. It said "Managed by
                  your sign-in provider" to everybody, which is true of a
                  Google account and false of an email-and-password one — and
                  it sat next to a button offering to update the password it
                  had just said was somebody else's. Clerk knows which it is;
                  `passwordEnabled` is the answer. */}
              <div>
                <b>Password</b>
                <span>{user?.passwordEnabled
                  ? "Change it, and see where you are signed in"
                  : signInWith(user)
                    ? `You sign in with ${signInWith(user)}, so there is no password to change`
                    /* The sentence that used to be shown to everybody. It is
                       right here and only here: no password, and no provider
                       we can name. */
                    : "Managed by your sign-in provider"}</span>
              </div>
              <button className="pill" type="button" onClick={() => onNavigate("security")}>
                {user?.passwordEnabled ? "Update" : "Sign-in and devices"}
              </button>
            </div>
            <div className="row">
              <div><b>Sign out</b><span>On this device only</span></div>
              <button className="pill" type="button" onClick={() => signOut()}>Sign out</button>
            </div>
            {/* THE WAY BACK INTO THE DEMO lives here, at the foot of the profile
                (owner, 2026-09-21), not in the menu. It plays once on its own;
                this is for the student who skipped it, or wants it again. */}
            <div className="row">
              <div><b>The walkthrough</b><span>Every screen, step by step, with a class already in it</span></div>
              <button className="pill" type="button" onClick={() => onNavigate("tour")}>Replay</button>
            </div>
          </div>

          {confirmDelete ? (
            <p className="del">
              This removes your logbook, your crew and everything you've flown, and it can't be undone.{" "}
              <button className="linkish" type="button"
                      onClick={() => user?.delete().catch(() => setSaveNote(ERROR_GENERIC))}>
                <u>Delete it all</u>
              </button>
              {" · "}
              <button className="linkish" type="button" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </p>
          ) : (
            <p className="del">
              <button className="linkish" type="button" onClick={() => setConfirmDelete(true)}><u>Delete account</u></button>
              {" "}— removes your logbook, your crew and everything you've flown. It can't be undone.
            </p>
          )}

          </div>

          {/* §5's three pickers and the read-only view. Each is a dialog over
              the card rather than a route: they are a choice about the thing
              behind them, and leaving the page to make one would lose sight
              of what the choice is for. */}
          {picker === "photo" && (
            <PhotoPicker profile={card} name={holderName || username}
                         onUpload={() => fileRef.current?.click()}
                         onInitials={() => {
                           /* ONE WRITE, AND NOTHING THAT CAN THROW. It used
                              to call Clerk's setProfileImage({file: null}),
                              which does throw — and on the versions where it
                              does not, Clerk simply goes back to serving its
                              own generated default. */
                           setPicker(null);
                           patchCard({ photo_url: null });
                           setSaveNote("Using your initials.");
                         }}
                         onClose={() => setPicker(null)} />
          )}
          {/* `image/*`, NOT THE FOUR TYPES A CANVAS CAN DRAW.
              HEIC is the iPhone camera's default, and naming the four greys
              every photo a student has actually taken out of the Files app —
              they see their own camera roll disabled, with no explanation and
              nothing to press. The validation has not moved: `checkFile` still
              refuses anything a canvas cannot draw, and it does it in words
              ("A photo straight off an iPhone is usually HEIC — share it once
              and it becomes a JPEG"), which is a sentence a student can act on
              and a greyed-out file is not. Refuse after the pick, never
              before it, and never silently. */}
          <input ref={fileRef} type="file" hidden
                 accept="image/*"
                 onChange={pickPhotoFile} />
          {picker === "photocrop" && photoSrc && (
            <AvatarCrop src={photoSrc} busy={photoBusy} onCancel={closePhotoCrop}
                        onUse={async (img, frame) => {
                          setPhotoBusy(true);
                          const blob = await renderAvatar(img);
                          const r = await uploadAvatar(user?.id, blob);
                          setPhotoBusy(false);
                          if (!r.ok) { setSaveNote(r.message); return; }
                          await patchCard({
                            photo_url: r.url, photo_zoom: frame.zoom,
                            photo_x: frame.x, photo_y: frame.y,
                          });
                          closePhotoCrop();
                        }} />
          )}
          {/* Same as the avatar above: everything offered, `checkFile` refuses
              what a canvas cannot draw, in words. */}
          <input ref={coverFileRef} type="file" hidden
                 accept="image/*"
                 onChange={pickCoverFile} />
          {picker === "crop" && cropSrc && (
            <CoverCrop src={cropSrc} busy={cropBusy} onCancel={closeCrop}
                       onUse={async (blob) => {
                         setCropBusy(true);
                         const r = await uploadCover(user?.id, blob);
                         setCropBusy(false);
                         if (!r.ok) { setSaveNote(r.message); return; }
                         await patchCard({ cover: "image", cover_image: r.url });
                         closeCrop();
                       }} />
          )}
          {picker === "cover" && (
            <CoverPicker cover={card?.cover || "contour"} ink={card?.cover_ink}
                         image={card?.cover_image}
                         onPick={patchCard}
                         onUpload={() => coverFileRef.current?.click()}
                         onClose={() => setPicker(null)} />
          )}
          {picker === "phrase" && (
            <PhrasePicker phrase={card?.phrase}
                          onPick={(v) => { patchCard({ phrase: v }); setPicker(null); }}
                          onClose={() => setPicker(null)} />
          )}
          {picker === "stamp" && (
            <StampCreator userId={user?.id} code={code}
                          preview={!signedIn || Boolean(card?.stamp_issued_at)}
                          onIssued={(row) => { setCard(row); setPicker(null); }}
                          onClose={() => setPicker(null)} />
          )}
          {/* §5 — "See it as others do: shows the card read-only." The SAME
              component with edit off, which is the whole point of there being
              one component: what this shows cannot drift from what they see. */}
          {picker === "others" && (
            <div className="lic-scrim" role="dialog" aria-label="How others see you"
                 onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
              <div className="lic-sheet">
                <button type="button" className="lic-x" onClick={() => setPicker(null)} aria-label="Close">
                  <X size={15} aria-hidden="true" />
                </button>
                <h3>How others see you</h3>
                <LicenceCard
                  profile={demoProfile(card, { callsign: username, real_name: holderName })}
                  stats={myStats} stamp={myStamp} admin={isAdmin || demoOn()}
                  /* A PICTURE OF THE BUTTON, not a disabled one. This is
                     what somebody else sees; you cannot invite yourself, so
                     there is nothing here to press and nothing to explain
                     why it will not work. A <span> rather than a disabled
                     <button> keeps it out of the tab order as well. */
                  action={<span className="lic-invite" data-preview="">Invite to squadron</span>}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- PREFERENCES */}
      {tab === "preferences" && (
        <div className="panel panel-in panel-ref" key={tab} role="tabpanel" id="ppanel-preferences"
             aria-labelledby="ptab-preferences">
          <div className="ref-lic" data-ref="preferences">

          {/* WHO GREETS YOU, IN THE REFERENCE'S ORDER (09-preferences.html):
              the choice row FIRST, then ONE description line for whichever
              greeter is selected, then the field carrying that greeter's own
              placeholder. Live it ran name, description, name again — the
              greeter's name said twice with the control between the two.

              The copy is this app's rather than the demo's: the blurbs and the
              placeholders come from wingman-voices.md, which §6.2 makes the
              source for anything either of them says. The structure is the
              reference's. */}
          {flags["voice.characters"] && (
            <div className="box">
              <p className="lab">Who greets you</p>
              {/* THE STRIP IS THE DESIGN'S 47.7px, NOT §12's 54. A segmented
                button cannot be given a 44px target without making the strip
                taller than the strip: the buttons tile it, so expanding one
                only overlaps its neighbour. Kept at the reference's height and
                stated rather than smuggled — 37.7px a button, which clears
                WCAG 2.2 AA's 24px minimum and is under this app's own 44px
                floor. Appearance's identical-looking control is a different
                component and stays at 44; docs/launch/DECISIONS.md says how to
                reverse this in one line. */}
            <div className="sega" role="group" aria-label="Who greets you">
                {CHARACTERS.map((c) => (
                  <button key={c.id} type="button" className="is-inline"
                          aria-pressed={character === c.id}
                          onClick={() => withSetting(() => progress.set("pw-voice", c.id))}>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="pd" style={{ marginTop: 12 }}>
                {CHARACTERS.find((c) => c.id === character)?.blurb}
              </p>
              {/* Empty by default, with the line inside the field rather than
                  under it: an empty box that explains itself, and nothing to
                  clear before you type. It does not derive from the first name
                  on the licence — an empty field is a question, a pre-filled
                  one is an answer nobody gave. */}
              <p className="pd" style={{ marginTop: 16, color: "var(--t2)" }} id="f-call-label">
                {callCopy.label}
              </p>
              <input className="inp" id="f-call" aria-labelledby="f-call-label"
                     value={greetName} placeholder={callCopy.hint}
                     onChange={(e) => {
                       const v = e.target.value;
                       setGreetName(v);
                       // Saved as you type, not on blur. Emptying the field is
                       // the whole off switch for the name, and on blur it did
                       // not take effect until focus happened to move — so it
                       // looked as though it had kept using it. The provider
                       // coalesces writes, so this is one patch either way.
                       progress.set("pw-greet-name", v.trim());
                     }} />
            </div>
          )}

          {/* HOW SOCIAL — description, then the choice row, then Fly solo as
              the reference's `.tog`. "Go by callsign" is NOT here and is not
              anywhere: it was cut in the design, and re-adding it once was the
              mistake this deletes. `identity_display` still has its default,
              which is the callsign, and notebook.js and discussion.js still
              read it; there is simply no longer a control that changes it.
              See docs/launch/DECISIONS.md. */}
          <div className="box">
            <p className="lab">How social</p>
            <p className="pd" style={{ margin: 0 }}>{PRESETS.find((x) => x.id === preset)?.desc}</p>
            <div className="sega" role="group" aria-label="How social">
              {PRESETS.filter((x) => (x.id === "quiet") || (x.id === "crew" && flags["social.crew"])
                || (x.id === "open" && flags["social.crew"] && flags["social.frequency"])).map((x) => (
                <button key={x.id} type="button" className="is-inline"
                        aria-pressed={preset === x.id}
                        onClick={() => withSetting(() => progress.set("pw-social-preset", x.id))}>
                  {x.label}
                </button>
              ))}
            </div>
            {/* §6 — FLY SOLO LIVES HERE. It was on the licence, in the identity
                block, which was the right argument when that block was a list
                of who you are: it is part of who people see. §5 turned that
                block into the card itself, and a switch is not something that
                goes on a licence — so it comes to the box about being social.
                An everyday option, not a privacy ceremony: no warning styling,
                no confirmation, no red. */}
            <div className="tog">
              <div>
                <p className="ph">Fly solo</p>
                <p className="pd">
                  Nobody sees you and you see nobody. For the nights you&rsquo;d rather
                  just get on with it.
                </p>
              </div>
              <button type="button" className="sw2 is-inline" role="switch"
                      id="fly-solo" aria-checked={flySolo} aria-label="Fly solo"
                      onClick={() => setFlySolo(!flySolo)} />
            </div>
          </div>

          {/* §6 — YOUR BAR, in its own box, in the reference's words. Never
              called "minimums" on screen: that is the file's name for the
              rule, not the student's name for the number.

              It starts at the 75% pass mark and can only go up, and the
              paragraph says what lighting up actually means — the module
              card, and nowhere else. A number whose consequence is unstated
              is a number people set at random.

              It writes on every step on purpose: the gyro and every lamp
              re-read it as the thumb moves, which is what shows what the
              number does. */}
          <div className="box">
            <p className="lab">Your bar</p>
            <label className="ph" htmlFor="your-bar"
                   style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              The score you&rsquo;re aiming for <b className="barv">{bar}%</b>
            </label>
            <p className="pd">
              If your average on a module falls below this, Master Caution lights up on
              that module&rsquo;s card, and nowhere else. It starts at the {PASS_PCT}% pass
              mark and can only go up from there. Nobody else can see it.
            </p>
            <input id="your-bar" className="barr is-inline" type="range"
                   min={MIN_FLOOR} max={MIN_CEIL} step="1" value={bar}
                   aria-label="Your bar" aria-valuetext={`${bar} per cent`}
                   style={{ "--p": `${((bar - MIN_FLOOR) / (MIN_CEIL - MIN_FLOOR)) * 100}%` }}
                   onChange={(e) => progress.set(MINIMUMS_KEY, clampMinimums(e.target.value))} />
            <div className="barl">
              <span>{PASS_PCT}% &middot; pass mark</span><span>{MIN_CEIL}%</span>
            </div>
          </div>

          {/* BLOCKED AND MUTED is its own box in the reference, rather than the
              foot of How social. It is the ONLY way to unblock anybody, which
              is why it could not go with the Settings page it used to be on. */}
          <div className="box">
            <p className="lab">Blocked and muted</p>
            <BlockedList />
          </div>

          {flags["prefs.notices"] && (
            <div className="box">
              <p className="lab">Notices</p>
              {NOTICES.map((n) => (
                <Switch key={n.id} id={`notice-${n.id}`} label={n.label} note={n.note}
                        on={notices[n.id] ?? n.on}
                        onChange={(v) => withSetting(() => progress.set("pw-notices", { ...notices, [n.id]: v }))} />
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- APPEARANCE */}
      {tab === "appearance" && (
        <div className="panel panel-in" key={tab} role="tabpanel" id="ppanel-appearance" aria-labelledby="ptab-appearance">
          <div className="block">
            <span className="eyebrow" id="lightlabel">Panel lighting</span>
            {/* Only when something is overriding the choice. Without it an
                Aurora user taps Light, nothing happens, and the app looks
                broken. */}
            {/* ONLY the override. Auto needs no explaining, so the line that
                described it is gone; what is left is the one case where
                something genuinely has to be said — a finish forcing the panel
                dark, where tapping Light otherwise appears to do nothing. */}
            {override && (
              <div className="livdesc" id="lightwhy">{override}</div>
            )}
            <Seg radio wide label="Panel lighting" describedBy={override ? "lightwhy" : undefined}
                 value={override ? "night" : variantPin}
                 options={override ? MODES.filter((m) => m.id === "night") : MODES}
                 onPick={onVariantPin} />
          </div>

          <div className="block block-livery">
            {/* Under Manual the livery is the ink, so the label says so. Aurora
                keeps the word Livery: the swatches are still choosing a colour,
                and they stay live under both. */}
            <span className="eyebrow">{finish === "manual" ? "Ink" : "Livery"}</span>
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

          <div className="block block-livery">
            <span className="eyebrow">Finish</span>
            <div className="livname">{currentFinish.name}</div>
            <div className="livdesc">{currentFinish.line}</div>
            <Seg label="Finish" value={finish ?? "none"}
                 options={FINISHES.map((f) => ({ id: f.id ?? "none", label: f.name }))}
                 onPick={(v) => onFinish(v === "none" ? null : v)} />

            {/* Only meaningful under Manual, so it is absent rather than
                disabled for the other two. */}
            {finish === "manual" && (
              <div className="finish-sub">
                <div className="subname">Ruled</div>
                <div className="subdesc">Plain stock, or ruled in your ink.</div>
                <Seg label="Ruled" value={ruled ? "lined" : "plain"}
                     options={[{ id: "plain", label: "Plain" }, { id: "lined", label: "Lined" }]}
                     onPick={(v) => onRuled(v === "lined")} />
              </div>
            )}
          </div>

          <div className="block">
            <span className="eyebrow">Instruments</span>
            <div className="row">
              <span className="rowtext"><b>Text size</b><span>Across chapters, discussion and the library</span></span>
              <Seg label="Instrument scale" value={fontSize} options={SCALES} onPick={onFontSize} />
            </div>
            {/* YOUR BAR MOVED TO PREFERENCES (§6). It was here because Text
                size is here and both are sliders, which is a reason about
                controls rather than about meaning: what it sets is when
                Master Caution lights, which is not an appearance. */}
            {tilt.needed && (
              <div className="row">
                <span className="rowtext"><b>Tilt</b><span>Lets the gyro follow your phone</span></span>
                <button type="button" className="tiltbtn" onClick={tilt.ask}>Allow tilt</button>
              </div>
            )}
          </div>

          <div className="block">
            <span className="eyebrow">Accessibility &amp; motion</span>
            <Switch id="smooth-air" label="Smooth Air" note="Stops the lights drifting and the cards lifting"
                    on={reduceMotion} onChange={onReduceMotion} />
            <Switch id="plain-language" label="Plain Language" note="A clearer typeface for reading fatigue and dyslexia"
                    on={dyslexiaFont} onChange={onDyslexiaFont} />
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
