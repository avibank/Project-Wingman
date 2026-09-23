/* =============================================================================
   THE STAMP CREATOR — docs/launch/code/15-stamp-creator.js, in React.
   -----------------------------------------------------------------------------
   The owner (2026-09-21): "Replace the creator with 15-stamp-creator.js."
   The markup below is paintStudio's own — the same elements, the same class
   names, the same words, in the same order — so the reference's stylesheet
   (03-stamp-creator.css, scoped into ref-licence.css by `npm run ref:css`)
   draws it unchanged, and every picture in it comes from the engine
   (stamp-engine.js): inspStamp for the preview and the shape tiles,
   ringPattern for the pattern tiles, colourGrid for all three colour grids.

   WHAT IS THE APP'S, and each is only what a live page needs that a static
   one did not:

   · THE CODE'S STATUS is asked of the real database (takenCodes), where the
     reference had a hard-coded set. The sentences are codeState's own.
   · ISSUING is issue_licence (0035, 0036): the server claims the code and
     issues the stamp around it in one statement, refuses a second call, and
     chooses the seed. A code somebody took in the meantime comes back as
     "taken", and the status line offers its neighbours.
   · THE 44px FLOOR (§12). The design's small controls keep their drawn size
     and wear an invisible 44px hit area (stamp-creator-fit.css), as the
     Ready Room's port does.
   · SIX SHAPES, not the engine's eight: SHAPE_IDS leaves out the shield
     and the hex (owner, 2026-09-21), and they are laid out three across.
   · `preview`: opened by `?creator` for somebody who cannot issue one (signed
     out, or already issued), so the creator can be looked at on the live
     site. Everything works except the button that issues.
   ========================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SHAPE_IDS, PATTERNS, PALETTE, inspStamp, ringPattern, colourGrid,
  drawStamp, cleanRim, inkByName, inkName,
} from "../../lib/stamp.js";
import { issueLicence, takenCodes } from "../../lib/squadron.js";
import { normaliseCode } from "../../lib/code.js";
import { toast } from "../../features/bookmarks/toastBus.js";
import { useEscape } from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";
import "./stamp-creator-fit.css";

const TABS = { shape: "Shape", ring: "Rim", pat: "Pattern", ink: "Ink" };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const html = (h) => ({ __html: h });

/* codeState's sentences. `taken` is read from the database.
   ONE TO THREE CHARACTERS (owner, 2026-09-23), which is 0039's rule on the
   server too, so the "Three characters." nudge is gone: a code of one is a
   code, and the only thing left to say about a short one is whether anybody
   else has it. */
function codeState(c, taken) {
  c = (c || "").toUpperCase();
  if (!c) return { k: "empty", msg: "One to three characters, letters or numbers. Once it is yours nobody else can take it." };
  if (!/^[A-Z0-9]{1,3}$/.test(c)) return { k: "bad", msg: "Letters and numbers only, three at most." };
  if (taken === undefined) return { k: "checking", msg: `${c}` };
  if (taken) return { k: "taken", msg: `${c} is taken.` };
  return { k: "free", msg: `${c} is free. Issue your stamp and it is yours for good.` };
}
/* codeAlts' candidates, in its order: the last character first, then each one
   before it. A code can be one, two or three characters now (0039), so this
   walks the code it is given rather than indexing 0, 1 and 2 — on "A7" the
   old one built `A7undefined`. A short code also has a neighbour the long one
   does not: itself with one more character on the end. */
function codeCandidates(c) {
  const pool = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", out = [];
  const push = (t) => { if (t !== c && !out.includes(t)) out.push(t); };
  for (let i = c.length - 1; i >= 0; i--) for (const ch of pool) push(c.slice(0, i) + ch + c.slice(i + 1));
  if (c.length < 3) for (const ch of pool) push(c + ch);
  return out;
}

export default function StampCreator({ userId, code = "", from = null, onIssued, onClose, preview = false }) {
  useEscape(onClose);
  /* `from` IS A STAMP TO START FROM — the one this student already has, when
     they have been granted the one change 0039 allows. Inks are stored and
     drawn by NAME; in here they are palette entries, because that is what the
     swatches compare against, so each of the three is looked up on the way
     in. Without a `from` the draft is the first one every student gets. */
  const [draft, setDraft] = useState(() => (from ? {
    shape: from.shape || "seal", code: normaliseCode(from.code || code), sym: from.sym || null,
    ring: from.ring || "", rim: from.rim !== false,
    pattern: from.pattern || "none", pscope: from.pscope || "both",
    ink: inkByName(inkName(from.ink)) || PALETTE[1],
    pink: inkByName(inkName(from.pink)), cink: inkByName(inkName(from.cink)),
    seed: from.seed || 7, cmode: from.sym ? "sym" : "code",
  } : {
    shape: "seal", code: normaliseCode(code), sym: null, ring: "", rim: true,
    pattern: "none", pscope: "both", ink: PALETTE[1], pink: null, cink: null, seed: 7, cmode: "code",
  }));
  const [tab, setTab] = useState("shape");
  const [confirming, setConfirming] = useState(false);
  const [anim, setAnim] = useState(true);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef(null);

  /* Every change un-confirms and presses the preview again, as `set` does. */
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setConfirming(false); setAnim(true); };
  useEffect(() => { if (!anim) return undefined; const t = setTimeout(() => setAnim(false), 460); return () => clearTimeout(t); }, [anim, draft]);

  /* THE CODE'S STATUS, and three free neighbours when it is taken. */
  const [look, setLook] = useState({ code: "", taken: undefined, alts: [] });
  const [asked, setAsked] = useState(0);       // bumped to ask again about the same code
  useEffect(() => {
    const c = draft.code;
    if (!c.length) { setLook({ code: c, taken: undefined, alts: [] }); return undefined; }
    let live = true;
    const cands = codeCandidates(c).slice(0, 24);
    const t = setTimeout(async () => {
      const taken = await takenCodes([c, ...cands], userId);
      if (!live) return;
      if (!taken) { setLook({ code: c, taken: false, alts: [] }); return; }
      const isTaken = taken.has(c);
      setLook({ code: c, taken: isTaken, alts: isTaken ? cands.filter((x) => !taken.has(x)).slice(0, 3) : [] });
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [draft.code, userId, asked]);
  const st = codeState(draft.code, look.code === draft.code ? look.taken : undefined);

  const shuffle = () => set({
    shape: pick(SHAPE_IDS), pattern: pick(Object.keys(PATTERNS)),
    pscope: pick(["both", "centre", "rim"]), ink: pick(PALETTE),
    pink: Math.random() > 0.5 ? pick(PALETTE) : null, cink: Math.random() > 0.6 ? pick(PALETTE) : null,
    rim: Math.random() > 0.35, seed: 1 + Math.floor(Math.random() * 40),
  });

  /* Clicks inside a colour grid, which the engine hands over as markup. */
  const onGrid = (attr, key) => (e) => {
    const b = e.target.closest(`[${attr}]`);
    if (b) set({ [key]: PALETTE[+b.getAttribute(attr)] });
  };

  const issue = async () => {
    if (preview) return;
    if (!confirming) {
      if (st.k !== "free") {
        codeRef.current?.focus();
        toast(st.k === "taken" ? st.msg : "Pick your code first");
        return;
      }
      setConfirming(true);
      return;
    }
    setBusy(true);
    const { row, error, taken } = await issueLicence(userId, { ...draft, code: normaliseCode(draft.code) });
    setBusy(false);
    if (taken) {
      setConfirming(false);
      setLook({ code: "", taken: undefined, alts: [] });
      setAsked((n) => n + 1);
      toast(`${draft.code} is taken.`);
      codeRef.current?.focus();
      return;
    }
    if (error || !row) { toast("That didn't go through. Try again in a moment."); return; }
    toast(`Stamp issued — ${draft.code} is yours`);
    onIssued(row);
  };

  const shapeTiles = useMemo(() => SHAPE_IDS.map((k) => [k,
    inspStamp(false, 46, 0, { shape: k, code: "", sym: null, ring: "", rim: false, band: false, pattern: "none" })]), []);
  const patternTiles = useMemo(() => Object.entries(PATTERNS).map(([k, n]) => [k, n,
    `${k === "none" ? "" : ringPattern(k, { type: "circle", ri: 8, ro: 15.5 })}<circle cx="20" cy="20" r="7.6" stroke-width=".7"/><circle cx="20" cy="20" r="16" stroke-width=".9"/>`]), []);

  const d = draft;
  /* RENDERED AT THE ROOT OF .app, NOT WHERE IT IS OPENED. The licence sits in
     a panel whose ancestors establish a containing block, so a fixed scrim
     opened there covered only the content column and the app bar sat over
     the top of the sheet (measured at 1440). `.app` is where the tokens are,
     so the portal goes there rather than to <body>. */
  const root = typeof document !== "undefined" ? document.querySelector(".app") || document.body : null;
  const sheet = (
    <div className="ref-lic">
      <div className="scrim open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Your stamp">
          <div className="studio">
            <div className="shead">
              <h3>Your stamp</h3>
              <button type="button" className="x2 is-inline" onClick={onClose} aria-label="Close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="spaper">
              <span className={`big${anim ? " go" : ""}`} dangerouslySetInnerHTML={html(drawStamp(d, { on: true, size: 196, rot: -5 }))} />
              <button type="button" className="dice is-inline" onClick={shuffle} title="Surprise me" aria-label="Shuffle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
              </button>
            </div>
            <div className="crow">
              <input ref={codeRef} className={`cin${d.sym ? "" : " on"}`} maxLength={3} value={d.sym ? "" : d.code}
                     placeholder="WNG" autoComplete="off" autoCapitalize="characters" spellCheck="false"
                     aria-label="Your code, one to three characters"
                     onChange={(e) => set({ code: normaliseCode(e.target.value), sym: null, cmode: "code" })} />
            </div>
            <p className={`cstat is-${st.k}`} aria-live="polite">
              {st.msg}
              {st.k === "taken" && look.alts.length > 0 && (
                <> <span className="calts">Free: {look.alts.map((a) => (
                  <button key={a} type="button" className="is-inline" onClick={() => set({ code: a })}>{a}</button>
                ))}</span></>
              )}
            </p>
            <div className="stabs" role="tablist">
              {Object.entries(TABS).map(([k, n]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k}
                        onClick={() => { setTab(k); setAnim(false); }}>{n}</button>
              ))}
            </div>
            <div className="sbody">
              {tab === "shape" && (
                /* SIX, THREE ACROSS. The reference lays eight out four across
                   (.srow.shp); with the shield and the hex gone that is a row
                   of four and a row of two, so the reference's own three-up
                   rule (.srow.pat3, the patterns' row) lays them out instead:
                   two full rows, the same grid as the Pattern tab. */
                <div className="srow shp pat3">
                  {shapeTiles.map(([k, svg]) => (
                    <button key={k} type="button" className={`stile${d.shape === k ? " on" : ""}`} data-shape={k} aria-label={k}
                            aria-pressed={d.shape === k} onClick={() => set({ shape: k })}
                            dangerouslySetInnerHTML={html(svg)} />
                  ))}
                </div>
              )}
              {tab === "ring" && (
                <>
                  <div className="tgl">
                    <span>Rim text</span>
                    <button type="button" className="sw2 is-inline" role="switch" aria-checked={d.rim !== false} aria-label="Rim text"
                            onClick={() => set({ rim: d.rim === false })} />
                  </div>
                  {d.rim !== false ? (
                    <>
                      <input className="sin" maxLength={10} value={d.ring} placeholder="WINGMAN" autoComplete="off" aria-label="Rim text"
                             onChange={(e) => set({ ring: cleanRim(e.target.value.replace(/[^A-Za-z0-9 ]/g, "")) })} />
                      <p className="snote" style={{ margin: 0 }}>Motto runs along the bottom</p>
                    </>
                  ) : <p className="snote" style={{ margin: 0 }}>Your pattern fills the ring</p>}
                </>
              )}
              {tab === "pat" && (
                <>
                  <div className="srow pat3">
                    {patternTiles.map(([k, n, art]) => (
                      <button key={k} type="button" className={`stile wide pt${d.pattern === k ? " on" : ""}`} data-pat={k}
                              aria-pressed={d.pattern === k} onClick={() => set({ pattern: k })}>
                        <svg width="40" height="40" viewBox="3 3 34 34" fill="none" stroke="currentColor" dangerouslySetInnerHTML={html(art)} />
                        <small>{n}</small>
                      </button>
                    ))}
                  </div>
                  {d.pattern !== "none" && (
                    <>
                      <div className="seg2">
                        {[["both", "Both"], ["centre", "Centre"], ["rim", "Rim"]].map(([k, n]) => (
                          <button key={k} type="button" className={`is-inline${(d.pscope || "both") === k ? " on" : ""}`} data-scope={k}
                                  aria-pressed={(d.pscope || "both") === k} onClick={() => set({ pscope: k })}>{n}</button>
                        ))}
                      </div>
                      <p className="lab" style={{ margin: "14px 0 6px", alignSelf: "stretch" }}>Pattern colour</p>
                      <button type="button" className={`schip is-inline${d.pink ? "" : " on"}`} id="pinkSame"
                              style={d.pink ? undefined : { boxShadow: "inset 0 0 0 1.5px var(--accent)", color: "var(--t1)" }}
                              onClick={() => set({ pink: null })}>Same as the ink</button>
                      <div style={{ display: "contents" }} onClick={onGrid("data-pink", "pink")} dangerouslySetInnerHTML={html(colourGrid(d.pink, "data-pink"))} />
                    </>
                  )}
                </>
              )}
              {tab === "ink" && (
                <>
                  <p className="lab" style={{ margin: "0 0 6px", alignSelf: "stretch" }}>Stamp ink</p>
                  <div style={{ display: "contents" }} onClick={onGrid("data-ink", "ink")} dangerouslySetInnerHTML={html(colourGrid(d.ink, "data-ink"))} />
                  <p className="lab" style={{ margin: "16px 0 6px", alignSelf: "stretch" }}>The code</p>
                  <button type="button" className={`schip is-inline${d.cink ? "" : " on"}`} id="cinkSame"
                          style={d.cink ? undefined : { boxShadow: "inset 0 0 0 1.5px var(--accent)", color: "var(--t1)" }}
                          onClick={() => set({ cink: null })}>Same as the ink</button>
                  <div style={{ display: "contents" }} onClick={onGrid("data-cink", "cink")} dangerouslySetInnerHTML={html(colourGrid(d.cink, "data-cink"))} />
                </>
              )}
            </div>
            <div className="sfoot">
              {preview ? (
                <p>A preview. Sign in with an account that has no stamp yet to issue yours.</p>
              ) : confirming ? (
                <>
                  <p>It can&rsquo;t be changed after this.</p>
                  <div className="sbtns">
                    <button type="button" className="pill" onClick={() => setConfirming(false)}>Keep editing</button>
                    <button type="button" className="pill pri" onClick={issue} disabled={busy}>{busy ? "Issuing…" : "Issue it"}</button>
                  </div>
                </>
              ) : (
                <button type="button" className="pill pri issueb" onClick={issue}>Issue my stamp</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return root ? createPortal(sheet, root) : sheet;
}
