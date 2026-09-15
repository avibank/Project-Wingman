import { useEffect, useRef } from "react";
import { Av, Vote, Status } from "./bits.jsx";
import { Back, Search, Plus, Reply, Save, Share, Lesson, Paper } from "./icons.jsx";
import Detail from "./Detail.jsx";
import { when, titleOf, excerptOf, answerCount } from "../../../lib/roomModel.js";
import {
  RR_FILTERS, STATUS_WORD, statusOf, chipCounts, waitingOnAnswer, moduleLine, dragTo,
} from "../../../lib/rrModel.js";

/* ============================================================================
   A MODULE — its questions, Reddit-shaped: the filter chips, the feed, the
   splitter, and the thread beside it.
   -----------------------------------------------------------------------------
   A FEED ROW IS NOT A <button>. The demo's row is a button with Save and Share
   buttons inside it, which is invalid HTML — a browser splits the nesting, and
   React says so on every render. The row is a block with one invisible button
   stretched across it to open the thread, and the controls sit above that
   button, so clicking anywhere but a control still opens the question.

   THE SPLITTER WRITES THE PAGE DIRECTLY WHILE IT MOVES and tells the room once,
   when you let go. React only touches an attribute whose value it has changed,
   so a render in the middle of a drag cannot pull the width back.
   ========================================================================= */

const firstParagraph = (text) => String(text || "").split(/\n{2,}/)[0].trim();

function FeedRow({ t, me, current, replies, vote, saved, who, source, onOpen, onVote, onSave, onShare }) {
  const n = answerCount(t, replies);
  const s = statusOf(t, { replies, me, row: true });
  const src = source(t);
  const snip = firstParagraph(excerptOf(t));
  return (
    <div className="rr-frow" aria-current={current ? "true" : "false"}>
      <button type="button" className="rr-fopen" onClick={onOpen}
              aria-label={`${titleOf(t)}. ${STATUS_WORD[s]}.`} aria-current={current ? "true" : undefined} />
      <div className="rr-fmeta">
        <Av id={t.authorId} name={who(t.authorId)} size={18} />
        <b>{t.authorId === me ? "You" : who(t.authorId)}</b>
        <span className="rr-sep">·</span>
        <span className="rr-t">{when(t.createdAt)}</span>
        <span style={{ flex: 1 }} />
        <Status s={s} />
      </div>
      <div className="rr-ftitle">{titleOf(t)}</div>
      {snip && <div className="rr-fsnip">{snip}</div>}
      <div className="rr-fact">
        <Vote score={vote.score} mine={vote.mine} what="this question" onVote={(dir) => onVote(t.id, dir)} />
        {n > 0 && <span className="rr-mini" aria-label={`${n} answer${n === 1 ? "" : "s"}`}><Reply />{n}</span>}
        {src && <span className="rr-src">{src.kind === "paper" ? <Paper /> : <Lesson />}{src.short}</span>}
        <span className="rr-grow" />
        <button type="button" className="rr-mini is-inline" data-on={saved ? "1" : "0"} aria-pressed={saved}
                title={saved ? "Saved" : "Save"} aria-label={saved ? "Saved" : "Save"}
                onClick={(e) => { e.stopPropagation(); onSave(t.id); }}><Save /></button>
        <button type="button" className="rr-mini is-inline" title="Share" aria-label="Copy a link to this question"
                onClick={(e) => { e.stopPropagation(); onShare(t); }}><Share /></button>
      </div>
    </div>
  );
}

export default function Threads({
  me, mod, all = [], list = [], replies = [], votes = {}, saved = {},
  filter = "all", onFilter, query = "", onFocusSearch,
  threadId = null, onSelect, onAsk, onBack,
  rootRef, layout = { fw: null, wide: false }, onLayout,
  who, source, onVote, onSave, onShare, detail,
}) {
  const bodyRef = useRef(null);
  const feedRef = useRef(null);
  const counts = chipCounts(all, { replies, me });

  /* Keep the selected row in view when the keys move it. A click lands on a
     row that is already visible, where "nearest" does nothing. */
  useEffect(() => {
    const row = feedRef.current?.querySelector('.rr-frow[aria-current="true"]');
    row?.scrollIntoView?.({ block: "nearest" });
  }, [threadId]);

  const drag = (e) => {
    const body = bodyRef.current;
    const root = rootRef?.current;
    if (!body || !root || e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    handle.dataset.drag = "1";
    root.dataset.drag = "1";
    const left = body.getBoundingClientRect().left;
    const total = body.clientWidth;
    let next = { ...layout };
    const move = (ev) => {
      const d = dragTo(ev.clientX - left, total);
      if (d.wide) {
        root.dataset.wide = "1";
        next = { ...next, wide: true };
        return;
      }
      root.removeAttribute("data-wide");
      root.style.setProperty("--fw", d.fw);
      next = { fw: d.fw, wide: false };
    };
    const up = () => {
      handle.releasePointerCapture?.(e.pointerId);
      delete handle.dataset.drag;
      root.removeAttribute("data-drag");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      onLayout(next);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  return (
    <>
      <div className="rr-phead">
        <button type="button" className="rr-iconbtn rr-backbtn is-inline" onClick={onBack} aria-label="Back"><Back /></button>
        <div className="rr-tt">
          <b>{mod.name}</b>
          <span>{moduleLine(all.length, waitingOnAnswer(all, replies))}</span>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="rr-iconbtn is-inline" title="Search this module"
                aria-label="Search this module" onClick={onFocusSearch}><Search /></button>
      </div>

      <div className="rr-threads">
        <div className="rr-chips" role="toolbar" aria-label="Filter the questions">
          {RR_FILTERS.map((f) => (
            <button type="button" key={f.k} className="rr-chip is-inline"
                    aria-pressed={filter === f.k} onClick={() => onFilter(f.k)}>
              {f.label}<span className="rr-n">{counts[f.k]}</span>
            </button>
          ))}
          <span className="rr-grow" />
          <button type="button" className="rr-ask is-inline" onClick={onAsk}><Plus />Ask</button>
        </div>

        <div className="rr-tbody" ref={bodyRef}>
          <div className="rr-feed" ref={feedRef} aria-label={`Questions in ${mod.name}`}>
            {list.map((t) => (
              <FeedRow key={t.id} t={t} me={me} current={t.id === threadId} replies={replies}
                       vote={votes[t.id] || { score: 0, mine: 0 }} saved={Boolean(saved[t.id])}
                       who={who} source={source}
                       onOpen={() => onSelect(t.id, { open: true })}
                       onVote={onVote} onSave={onSave} onShare={onShare} />
            ))}
            {!list.length && (
              <div className="rr-dempty">
                {all.length
                  ? (query.trim() ? "Clear the search to see the rest." : "Pick All to see every question.")
                  : "Ask the first one and the module hears it."}
              </div>
            )}
          </div>
          <div className="rr-split" role="separator" aria-orientation="vertical"
               aria-label="Resize the question list" title="Drag to resize · double-click to reset"
               onPointerDown={drag} onDoubleClick={() => onLayout({ fw: null, wide: false })} />
          <Detail {...detail} me={me} mod={mod} all={all} list={list} threadId={threadId}
                  replies={replies} votes={votes} saved={saved} who={who} source={source}
                  wide={layout.wide} onToggleWide={() => onLayout({ ...layout, wide: !layout.wide })}
                  onSelect={onSelect} onVote={onVote} onSave={onSave} onShare={onShare} />
        </div>
      </div>
    </>
  );
}
