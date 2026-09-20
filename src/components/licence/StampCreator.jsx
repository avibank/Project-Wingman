/* =============================================================================
   THE STAMP CREATOR — §5's studio, ported from the reference's `paintStudio`.
   -----------------------------------------------------------------------------
   A big preview with a dice on it, the code directly under it, four tabs —
   Shape · Rim · Pattern · Ink — and one button that issues it for good.

   WHAT THE REFERENCE OFFERS AND THIS DOES NOT, and why each is left out:

   · SYMBOLS. The older build had a Mark tab with a plane, a spanner and a
     propeller. The newer one already maps that tab back to Shape on the first
     line of paintStudio, and §4 says it outright: "a code of 1-3 characters,
     A-Z or 0-9, required. There are no symbols." The renderer can still draw
     one (stamp.js keeps MARKS) because the house seal is a tick.
   · PATTERN SCOPE — Both / Centre / Rim. drawStamp honours `pscope`, so it
     works on screen; §4's data model is
     {shape, code, rim, ring, pattern, ink, seed, issued_at} and 0029 stores
     exactly those. A choice that cannot be stored is lost on the next load,
     and a control whose answer is silently thrown away is worse than no
     control at all. If it should be kept, it is one column and one line here.

   ISSUING IS THE SERVER'S. issueStamp calls 0029's function, which refuses a
   second call and chooses the seed itself. Nothing here can make a stamp
   permanent or pick its ink texture, and that is deliberate.
   ========================================================================= */
import { useRef, useState } from "react";
import { X, Dices } from "lucide-react";
import {
  SHAPE_IDS, PATTERNS, PATTERN_IDS, PALETTE, col, cleanCode, cleanRim, drawStamp,
  ringPattern,
} from "../../lib/stamp.js";
import { issueStamp } from "../../lib/squadron.js";
import { useEscape } from "./Sheet.jsx";
import "./licence.css";
import "./studio.css";
import "./ref-licence.css";

const TABS = [["shape", "Shape"], ["ring", "Rim"], ["pat", "Pattern"], ["ink", "Ink"]];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* A tile is a real stamp drawn small, so what you are choosing is what you
   will get — not an icon standing in for it. */
const Tile = ({ st, size = 46 }) => (
  <span className="st-svg" aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: drawStamp(st, { on: false, size, rot: 0 }) }} />
);

/* A PATTERN TILE IS THE PATTERN ALONE, not a whole stamp with the pattern
   somewhere inside it. Drawn the way the reference draws it
   (docs/launch/code/15-stamp-creator.js): the ring art between two plain
   circles, at a scale where it can be seen.

   It was `drawStamp` at 40px with the rim text and the seal's zigzag edge
   around it, and all six came out as the same small ring — measured by
   looking: None, Rays, Waves, Checks, Swirl and Guilloche were
   indistinguishable, so the tab offered six choices and showed one. */
const PatternTile = ({ id }) => (
  <span className="st-svg" aria-hidden="true">
    <svg width="40" height="40" viewBox="3 3 34 34" fill="none" stroke="currentColor"
         dangerouslySetInnerHTML={{
           __html: `${id === "none" ? "" : ringPattern(id, { type: "circle", ri: 8, ro: 15.5 })}`
             + '<circle cx="20" cy="20" r="7.6" stroke-width=".7"/>'
             + '<circle cx="20" cy="20" r="16" stroke-width=".9"/>',
         }} />
  </span>
);

/* Where a pattern is allowed to go. The drawing has always read
   `st.pscope || 'both'` (stamp.js §pattern) — there was simply nothing that
   could set it, so two of its three answers were unreachable. */
const SCOPES = [["both", "Both"], ["centre", "Centre"], ["rim", "Rim"]];

export default function StampCreator({ userId, code = "", onIssued, onClose }) {
  useEscape(onClose);

  /* THE CREATOR IS WHERE THE CODE IS CHOSEN (§2), so it opens on the one the
     account already has rather than empty. The licence card used to carry a
     separate YOUR CODE box above this; deleting it without seeding the field
     would have meant a pilot with a code typing it again from memory. */
  const [draft, setDraft] = useState({
    shape: "seal", code: cleanCode(code), rim: true, ring: "", pattern: "none",
    ink: PALETTE[1].n, seed: 7,
  });
  const [tab, setTab] = useState("shape");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  /* Every change un-confirms: you cannot wander back into "Issue it" having
     changed the shape underneath it. */
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setConfirming(false); setNote(null); };

  const shuffle = () => set({
    shape: pick(SHAPE_IDS),
    pattern: pick(PATTERN_IDS),
    /* The scope too — the reference's dice rolls it, and a shuffle that
       never moved the pattern off "both" would show two thirds of the
       patterns' range and none of their placement. */
    pscope: pick(["both", "centre", "rim"]),
    ink: pick(PALETTE).n,
    rim: Math.random() > 0.35,
    seed: 1 + Math.floor(Math.random() * 40),
  });

  const codeRef = useRef(null);
  const issue = async () => {
    if (cleanCode(draft.code).length < 1) {
      setNote("Add your code: up to 3 letters or numbers.");
      /* The code is not on a tab — it is under the preview — so the cursor
         goes to it. Changing the tab instead, which the first version did,
         sent you to Shape to look for something that was never there. */
      codeRef.current?.focus();
      return;
    }
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    const { row, error } = await issueStamp(userId, draft);
    setBusy(false);
    if (error || !row) { setNote("That didn't go through. Try again in a moment."); return; }
    onIssued(row);
  };

  return (
    <div className="lic-scrim" role="dialog" aria-label="Your stamp"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-studio">
        <div className="st-head">
          <h3>Your stamp</h3>
          <button type="button" className="lic-x" onClick={onClose} aria-label="Close">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* The preview, on ruled paper, with the dice in the corner. */}
        <div className="st-paper">
          <span className="st-big" aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: drawStamp(draft, { on: true, size: 196, rot: -5 }) }} />
          <button type="button" className="st-dice" onClick={shuffle}
                  title="Surprise me" aria-label="Shuffle">
            <Dices size={18} aria-hidden="true" />
          </button>
        </div>

        {/* §4 — the code sits directly under the preview, not behind a tab.
            It is the one part that is required, so it is the one part that is
            never more than a glance away. */}
        <div className="st-crow">
          <input ref={codeRef} className={`st-code${draft.code ? " is-on" : ""}`} maxLength={3}
                 value={draft.code} placeholder="H7A" autoComplete="off"
                 aria-label="Your code, up to 3 letters or numbers"
                 onChange={(e) => set({ code: cleanCode(e.target.value) })} />
        </div>

        <div className="st-tabs" role="tablist" aria-label="Stamp">
          {TABS.map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
                    onClick={() => setTab(k)}>{n}</button>
          ))}
        </div>

        <div className="st-body">
          {tab === "shape" && (
            <div className="st-row">
              {SHAPE_IDS.map((k) => (
                <button key={k} type="button" aria-label={k} aria-pressed={draft.shape === k}
                        className={`st-tile${draft.shape === k ? " is-on" : ""}`}
                        onClick={() => set({ shape: k })}>
                  <Tile st={{ shape: k, code: "", ring: "", pattern: "none", seed: draft.seed }} />
                </button>
              ))}
            </div>
          )}

          {tab === "ring" && (
            <>
              <div className="st-tgl">
                <span id="rimlab">Rim text</span>
                <button type="button" role="switch" aria-checked={draft.rim !== false}
                        aria-labelledby="rimlab" className="st-sw"
                        onClick={() => set({ rim: draft.rim === false })} />
              </div>
              {draft.rim !== false ? (
                <>
                  <input className="st-in" maxLength={10} value={draft.ring}
                         placeholder="WINGMAN" autoComplete="off" aria-label="Rim text"
                         onChange={(e) => set({ ring: cleanRim(e.target.value) })} />
                  <p className="st-note">Never fly alone runs along the bottom.</p>
                </>
              ) : <p className="st-note">Your pattern fills the ring.</p>}
            </>
          )}

          {tab === "pat" && (
            <>
            <div className="st-row">
              {PATTERN_IDS.map((k) => (
                <button key={k} type="button" aria-pressed={draft.pattern === k}
                        className={`st-tile is-wide${draft.pattern === k ? " is-on" : ""}`}
                        onClick={() => set({ pattern: k })}>
                  <PatternTile id={k} />
                  <small>{PATTERNS[k]}</small>
                </button>
              ))}
            </div>
            {/* WHERE THE PATTERN GOES, and only once there is a pattern to
                place. Both / Centre / Rim, as the reference has it. */}
            {draft.pattern !== "none" && (
              <div className="ref-lic">
                <div className="seg2" role="group" aria-label="Where the pattern goes">
                  {SCOPES.map(([k, n]) => (
                    <button key={k} type="button" aria-pressed={(draft.pscope || "both") === k}
                            className={(draft.pscope || "both") === k ? "on" : undefined}
                            onClick={() => set({ pscope: k })}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            </>
          )}

          {/* EVERY COLOUR IS NAMED, HERE TOO. The reference's ink tab is
              `colourGrid(d.ink, 'data-ink')` — the same `.pal` the cover
              picker draws, a swatch with its name under it. This was thirty-six
              bare circles with the name only in a `title`, which is a colour
              you can point at and never say; and it is the same thirty-six
              names as the cover and the initials, so a pilot who cannot read
              one here cannot match it there. */}
          {tab === "ink" && (
            <div className="ref-lic">
              <div className="pal" role="group" aria-label="Ink">
                {PALETTE.map((p) => (
                  <button key={p.n} type="button" aria-label={p.n}
                          aria-pressed={draft.ink === p.n}
                          className={draft.ink === p.n ? "on" : undefined}
                          onClick={() => set({ ink: p.n })}>
                    <i style={{ background: col(p) }} />
                    <span>{p.n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="st-foot">
          {note && <p className="st-warn">{note}</p>}
          {confirming ? (
            <>
              <p>It can&rsquo;t be changed after this.</p>
              <div className="st-btns">
                <button type="button" className="st-btn" onClick={() => setConfirming(false)}>
                  Keep editing
                </button>
                <button type="button" className="st-btn is-pri" onClick={issue} disabled={busy}>
                  {busy ? "Issuing…" : "Issue it"}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="st-btn is-pri is-wide" onClick={issue}>
              Issue my stamp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
