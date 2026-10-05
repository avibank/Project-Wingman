/* =============================================================================
   THE PATTERN FINISHES, TO LOOK AT — `?pattern` on any address.
   -----------------------------------------------------------------------------
   The owner, 2026-10-04: "build a demo for a new finish based on this … faint
   but noticeable … and has a version for each colour", then "add a tie dye
   finish", then "kill tribal". One pattern left and one desk: `?pattern` on
   any address.

   THIS IS NOT A SWATCH PAGE, and that is the point. A pattern meant to live
   behind the app has to be judged behind the app, with the real panels, the
   real type and the real lamps in front of it — a tile shown on its own
   always looks good and tells you nothing about whether a chapter row is
   still readable on top of it. So `?pattern` paints the finish onto whatever
   screen you are already on, through the SAME door the Manual finish's ruled
   lines use (Deck takes a style object per layer), and puts a small desk in
   the corner to turn the two dials that matter.

   STRENGTH IS `null` UNTIL IT IS TOUCHED. null means "the pattern's own
   default", so the desk opens on exactly what a student would get and the
   slider only overrides once somebody moves it.

   NOTHING HERE IS SAVED. It writes no preference and no progress key: close
   the tab and it is gone, which is what makes it safe to leave reachable.
   ========================================================================= */
import { useEffect, useState } from "react";
import { LIVERIES } from "../lib/liveryEngine.js";


const CSS = `
.tdemo { position: fixed; right: 16px; bottom: 16px; z-index: 60; width: 272px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px 14px 12px; box-shadow: var(--shadow); color: var(--t1);
  font: 500 13px/1.4 var(--font-ui); backdrop-filter: blur(6px); }
.tdemo h2 { margin: 0 0 2px; font: 600 14px/1 var(--font-ui); }
.tdemo p { margin: 0 0 10px; font-size: 12px; color: var(--t2); }
.tdemo label { display: block; margin: 9px 0 0; font: 500 11px/1 var(--font-mono);
  letter-spacing: .08em; text-transform: uppercase; color: var(--t2); }
.tdemo input[type="range"] { width: 100%; margin: 6px 0 0; accent-color: var(--active); }
.tdemo .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.tdemo .row button { min-height: 30px; padding: 4px 9px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--raised); color: var(--t2);
  font: 500 11.5px var(--font-ui); cursor: pointer; }
.tdemo .row button[aria-pressed="true"] { border-color: var(--active); color: var(--t1); }
.tdemo .val { float: right; font: 500 11px var(--font-mono); color: var(--t1);
  letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
.tdemo .shut { position: absolute; right: 10px; top: 8px; background: none; border: 0;
  color: var(--t2); cursor: pointer; font: 500 12px var(--font-ui); padding: 4px; }
`;

/**
 * The desk. `value` is `{ alpha, tint }`. `tint` is WHICH LIVERY'S HUE the field
 * is drawn in, null meaning "the one this account is actually on", which is
 * the honest default. It is not a livery of its own and it is not a colour
 * anybody carries — `check:one-livery` is right to refuse `.livery` on an
 * object, and this is not one.
 */
export default function PatternDemo({ value, onChange, onClose }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!open) return <style>{CSS}</style>;
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      <style>{CSS}</style>
      <aside className="tdemo" aria-label="Pattern finish demo">
        <button type="button" className="shut" onClick={() => { setOpen(false); onClose?.(); }}>Close</button>
        <h2>Tie-dye</h2>
        <p>A fan disc over dyed cloth, wound in the livery&rsquo;s own hues, one
          field behind the whole app. Drop the strength until it is just noticeable.</p>

        <label htmlFor="tdemo-a">Strength
          <span className="val">{value.alpha === null ? "default" : value.alpha.toFixed(3)}</span></label>
        <input id="tdemo-a" type="range" min="0.02" max="0.45" step="0.005"
               value={value.alpha ?? 0.085}
               onChange={(e) => set({ alpha: Number(e.target.value) })} />

        <label>Colour</label>
        <div className="row">
          <button type="button" aria-pressed={value.tint === null} onClick={() => set({ tint: null })}>Mine</button>
          {LIVERIES.map((l) => (
            <button key={l.id} type="button" aria-pressed={value.tint === l.id}
                    onClick={() => set({ tint: l.id })}>{l.name.split(" ")[0]}</button>
          ))}
        </div>

        <div className="row">
          <button type="button" onClick={() => set({ alpha: null, tint: null })}>Reset</button>
        </div>
      </aside>
    </>
  );
}
