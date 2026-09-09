/* =============================================================================
   The reader's own parts — v5.
   -----------------------------------------------------------------------------
   Split out of PaperReader.jsx for one reason and it is not tidiness: `Note`
   is rendered by PaperPage, because only the page knows where its own corners
   are, and a component defined inside the reader could not reach it. The rest
   moved with it rather than living in two places.

   Every class name here is COMPONENTS.md v5's, produced exactly as written.
   ========================================================================= */
import { useState } from "react";
import { TOOLS, COL, GROUPS, tool as T, col, colourKey } from "../../lib/readerIcons.js";
import Icon from "./Icon.jsx";

const rgba = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* Three quiet hints at the three things that are not discoverable by looking:
   the chest, the rail that opens the panel, and the bottom edge that scrubs.
   The app is deep; the first thirty seconds must not be. */
export const COACH = [
  { id: "chest", title: "Your tools", body: "Tap the chest to add any tool. Long-press the bar to rearrange it." },
  { id: "rail", title: "Everything you marked", body: "Hover this edge and your marks slide open, with the page they are on." },
  { id: "scrub", title: "Fly through the manual", body: "Drag along the bottom edge to move through the whole paper." },
];

/* ---------------------------------------------------------------------------
   THE MARK CARD — one popover for properties, ownership and actions.

   v5 keeps this and adds a selection popover beside it, which is not the same
   thing twice: the selection popover acts on TEXT YOU JUST SELECTED and the
   card acts on A MARK THAT ALREADY EXISTS. They never appear together.
   ------------------------------------------------------------------------ */
export function Card({ mark, me, at, ctx, onRecolour, onDelete, onNote, onAgree, onThread, onHold, onLeave }) {
  if (!mark || !at) return null;
  const c = col(colourKey(mark.colour));
  const mine = mark.author_id === me;
  const anon = !!mark.anonymous;
  const thread = mark.kind === "question";
  const who = anon && !mine ? "Asked anonymously" : mine ? "You" : (mark.author_name || "Someone");
  const initials = anon && !mine ? "?"
    : mine ? "YOU"
      : (mark.author_name || "S").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="chrome glass pop card open" style={{ left: at.left, top: at.top, "--k": c.hex }}
         onMouseEnter={onHold} onMouseLeave={onLeave}
         role="dialog" aria-label={`${ctx === "course" ? c.course : c.name} on page ${mark.page ?? ""}`}>
      <div className="ch">
        <i /><b>{ctx === "course" ? c.course : c.name}</b><em>p.{mark.page ?? "—"}</em>
      </div>
      {/* What the colour DOES. Only a course paper routes anywhere, so on your
          own document the sentence would be a promise nothing keeps — which is
          why the sheet hides it with [data-ctx="me"] rather than this doing it
          in two places. */}
      <div className="cd">{c.does}</div>

      <div className="cw">
        <span className={`av${mine ? " you" : ""}`}>{initials}</span>
        <div>
          <b>{who}</b>
          <span>
            {mark.when || "just now"}
            {anon && !mine && " · name hidden on questions"}
            {!mine && !anon && mark.contribution ? ` · ${mark.contribution}` : ""}
          </span>
        </div>
      </div>

      <div className="ca">
        {mine ? COL.map((cc) => (
          <button key={cc.k} type="button" data-k={cc.k}
                  className={`c${colourKey(mark.colour) === cc.k ? " on" : ""}`}
                  style={{ "--k": cc.hex }}
                  aria-label={ctx === "course" ? cc.course : cc.name}
                  onClick={() => onRecolour(mark, cc.k)}><i /></button>
        )) : (
          <button type="button" className="btn pri" onClick={() => onThread(mark)}>
            {thread ? "Answer this" : anon ? "Reply" : `Ask ${String(who).split(" ")[0]}`}
          </button>
        )}
        {mine && (
          <>
            <button type="button" className="btn" onClick={() => onNote(mark)}>Note</button>
            <button type="button" className="btn gr" onClick={() => onDelete(mark)}
                    aria-label="Delete">Remove</button>
          </>
        )}
        {!mine && !thread && (
          <button type="button" className="btn gr" onClick={() => onAgree(mark)} aria-label="Agree">
            Agree {mark.agree_count || 0}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   THE SELECTION POPOVER — v5's headline, and the most intuitive thing in it.

   Select any text and the five colours plus Note / Ask / Copy appear over it.
   No tool to arm first, no menu to find. Note and Ask open their widget WITH
   THE SELECTED TEXT ALREADY IN IT: the passage is the reason you are writing
   the note, so it should already be there.
   ------------------------------------------------------------------------ */
export function SelPop({ at, ctx, onColour, onNote, onAsk, onCopy }) {
  if (!at) return null;
  return (
    <div className="chrome glass pop selpop open" style={{ left: at.left, top: at.top }}
         role="toolbar" aria-label="What to do with this passage">
      <div className="swatches">
        {COL.map((c) => (
          <button key={c.k} type="button" className="c" data-k={c.k} style={{ "--k": c.hex }}
                  aria-label={ctx === "course" ? c.course : c.name}
                  onClick={() => onColour(c.k)}><i /></button>
        ))}
      </div>
      <span className="div" />
      <button type="button" data-a="note" onClick={onNote}>
        <Icon tool="note" colour="currentColor" size={16} /> Note
      </button>
      <button type="button" data-a="ask" className="courseonly" onClick={onAsk}>
        <Icon tool="ask" colour="currentColor" size={16} /> Ask
      </button>
      <button type="button" data-a="copy" onClick={onCopy}>Copy</button>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   PROPERTIES — the armed tool's own panel.

   v5 opens it with the tool's VARIANTS, and that is what lets the bar stay at
   six while the app has thirteen: Line / Arrow / Box / Ellipse are one entry.
   Recent colours are gone — five colours never needed a recents row.
   ------------------------------------------------------------------------ */
export function Props({
  open, tool, variant, colourKey: ck, size, opacity, inkOnly, ctx,
  onVariant, onColour, onSize, onOpacity, onInkOnly, onReset, onClose,
}) {
  const spec = T(tool);
  if (!spec) return null;
  const c = col(ck);
  const vs = spec.v || null;
  const fixed = spec.fixed;

  return (
    <div className={`chrome glass pop props${open ? " open" : ""}`}
         role="dialog" aria-label={`${spec.n} settings`}>
      <div className="hd">
        <Icon tool={tool} colour={spec.c ? c.hex : undefined} size={19} />
        {spec.n}
        <button type="button" className="ic" aria-label="Reset tool" onClick={onReset}>
          <Icon name="sync" size={15} />
        </button>
        <button type="button" className="ic" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={15} />
        </button>
      </div>
      <div className="bd">
        {vs && (
          <div className="segs" role="tablist" aria-label={`${spec.n} versions`}>
            {vs.map((v, i) => (
              <button key={v} type="button" role="tab" data-v={i}
                      aria-selected={(variant || 0) === i}
                      className={(variant || 0) === i ? "on" : ""}
                      onClick={() => onVariant(i)}>{v}</button>
            ))}
          </div>
        )}

        {spec.c && (
          <div className="prev">
            <span className="smp" style={{
              background: tool === "hl" ? rgba(c.hex, opacity / 100) : undefined,
              color: tool === "hl" ? undefined : c.hex,
              textDecoration: tool === "ul" ? "underline" : tool === "st" ? "line-through" : undefined,
              textDecorationThickness: `${Math.max(1, size)}px`,
              textUnderlineOffset: 3,
            }}>Sample text</span>
          </div>
        )}

        <div className="rw">
          <div className="lbl"><span>Size</span><b>{size}</b></div>
          <input type="range" min="1" max="32" value={size} aria-label="Size"
                 style={{ "--trk": `linear-gradient(90deg,${c.hex},${rgba(c.hex, .22)})` }}
                 onChange={(e) => onSize(Number(e.target.value))} />
          <div className="ticks"><b>1</b><b>8</b><b>16</b><b>24</b><b>32</b></div>
        </div>

        {spec.c && (
          <div className="rw">
            <div className="lbl"><span>Opacity</span><b>{opacity}%</b></div>
            <input type="range" min="10" max="100" value={opacity} aria-label="Opacity"
                   style={{ "--trk": `linear-gradient(90deg,${rgba(c.hex, .15)},${c.hex})` }}
                   onChange={(e) => onOpacity(Number(e.target.value))} />
          </div>
        )}

        {spec.c && !fixed && (
          <div className="rw">
            <div className="lbl"><span>Colour</span></div>
            <div className="cols">
              {COL.map((cc) => (
                <button key={cc.k} type="button" data-k={cc.k}
                        className={`c${ck === cc.k ? " on" : ""}`} style={{ "--k": cc.hex }}
                        aria-label={ctx === "course" ? cc.course : cc.name}
                        onClick={() => onColour(cc.k)}><i /></button>
              ))}
            </div>
            {/* What this colour does. Hidden on your own document by the sheet,
                because nothing routes anywhere there. */}
            <div className="mean" style={{ "--k": c.hex }}>
              <i />
              <div><b>{c.course}</b><u>{c.does}</u></div>
            </div>
          </div>
        )}

        {fixed && (
          <div className="mean" style={{ "--k": col(fixed).hex }}>
            <i />
            <div><b>{col(fixed).course}</b><u>{col(fixed).does}</u></div>
          </div>
        )}

        {tool === "era" && (
          <div className="toggle">
            <div className="lb2">
              <b>Ink only</b>
              <span>Rubbing out a stroke never eats a highlight.</span>
            </div>
            <button type="button" className={`sw2${inkOnly ? " on" : ""}`} role="switch"
                    aria-checked={inkOnly} aria-label="Ink only"
                    onClick={() => onInkOnly(!inkOnly)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   THE TOOL CHEST — every tool, always reachable, so trimming the bar is safe.
   ------------------------------------------------------------------------ */
export function Chest({ open, tray, cap, bar, ctx, colourOf, onAdd, onReset, onBar, onClose }) {
  const [tab, setTab] = useState(GROUPS[0]);
  const full = tray.length >= cap;
  return (
    <div className={`chrome glass pop addsheet${open ? " open" : ""}`}
         role="dialog" aria-label="Tool chest">
      <div className="hd">
        Tool chest
        <button type="button" className="ic" aria-label="Close" style={{ marginLeft: "auto" }}
                onClick={onClose}><Icon name="close" size={15} /></button>
      </div>
      <div className="tabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={tab === g}
                  className={tab === g ? "on" : ""} onClick={() => setTab(g)}>{g}</button>
        ))}
      </div>
      <div className="grid">
        {TOOLS.filter((t) => t.g === tab && (ctx === "course" || !t.course)).map((t) => (
          <button key={t.id} type="button" data-add={t.id}
                  className={`cell${tray.includes(t.id) ? " have" : ""}`}
                  onClick={() => onAdd(t.id)}>
            <span className="b"><Icon tool={t.id} colour={t.c ? colourOf(t.id) : undefined} size={22} /></span>
            <span>{t.n}</span>
          </button>
        ))}
      </div>
      <div className="foot">
        <span>{full ? `Bar is full — take one off first (${cap} max)` : `${tray.length} of ${cap} on your bar`}</span>
        <u role="button" tabIndex={0} onClick={onReset}
           onKeyDown={(e) => e.key === "Enter" && onReset()}>Reset to default</u>
      </div>
      <div className="lbl" style={{ padding: "0 14px", marginBottom: 6 }}><span>Bar position</span></div>
      <div className="posrow">
        {["left", "right", "bottom", "top"].map((p) => (
          <button key={p} type="button" data-p={p} className={bar === p ? "on" : ""}
                  onClick={() => onBar(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   NOTES AND PINS — a note is a window on the page, not a row in a sidebar.

   Open, it is a `.note` card you can drag by its header. Shut, it collapses to
   a `.pin` — a coloured pill with its title. Both live at a FRACTION of the
   page (0..1), never pixels, so a note written at 80% on a phone is in the
   same place at 250% on a laptop. Same rule as ink, same reason.
   ------------------------------------------------------------------------ */
export function Note({ note, at, dropping, onTitle, onBody, onColour, onOpen, onClose, onDelete, onGrab, onRemoveExc }) {
  const c = col(note.k);
  const style = { left: at.left, top: at.top, "--nk": c.hex, "--nb": rgba(c.hex, .16) };
  if (!note.open) {
    return (
      <button type="button" className={`pin${dropping ? " drop" : ""}`} style={style}
              data-note={note.id} onPointerDown={onGrab} onClick={onOpen}
              aria-label={`${note.title || "Note"} — open`}>
        <Icon tool={note.kind === "question" ? "ask" : "note"} colour="rgba(20,24,30,.72)" size={14} />
        <span>{note.title || (note.kind === "question" ? "Question" : "Note")}</span>
      </button>
    );
  }
  return (
    <div className={`note${dropping ? " drop" : ""}`} style={style} data-note={note.id}
         role="dialog" aria-label={note.kind === "question" ? "Question" : "Note"}>
      <div className="nh" onPointerDown={onGrab}>
        <Icon tool={note.kind === "question" ? "ask" : "note"} colour="rgba(20,24,30,.72)" size={14} />
        <input value={note.title || ""} placeholder={note.kind === "question" ? "What are you asking?" : "Title"}
               aria-label="Title" onChange={(e) => onTitle(e.target.value)} />
        <button type="button" onClick={onClose} aria-label="Collapse to a pin">
          <Icon name="chev" size={13} />
        </button>
        <button type="button" onClick={onDelete} aria-label="Delete">
          <Icon name="trash" size={13} />
        </button>
      </div>
      {(note.exc || []).map((e, i) => (
        <div className="exc" key={i}>
          {e.text}
          <em>p.{e.page}</em>
          <button type="button" data-xrm={i} aria-label="Remove excerpt"
                  onClick={() => onRemoveExc(i)}>×</button>
        </div>
      ))}
      <div className="nb">
        <textarea value={note.body || ""} aria-label="Note"
                  placeholder={note.kind === "question" ? "Anything you already tried?" : "What do you want to remember?"}
                  onChange={(e) => onBody(e.target.value)} />
      </div>
      <div className="nf">
        {COL.map((cc) => (
          <button key={cc.k} type="button" className={`c${note.k === cc.k ? " on" : ""}`}
                  style={{ "--k": cc.hex }} aria-label={cc.name}
                  onClick={() => onColour(cc.k)}><i /></button>
        ))}
        <span className="who">{note.kind === "question" ? "Anonymous" : "Only you"}</span>
      </div>
    </div>
  );
}


export function Coach({ step, at, onDone }) {
  const c = COACH[step];
  if (!c || !at) return null;
  return (
    <div className="glass pop coach" style={at}>
      <b>{c.title}</b>
      {c.body}
      <button type="button" onClick={onDone}>Got it</button>
    </div>
  );
}
