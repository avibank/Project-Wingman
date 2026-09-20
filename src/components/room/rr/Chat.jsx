import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Av } from "./bits.jsx";
import {
  Back, Search, Info, Plus, Plane, ArrowDown, Reply, Photo, File, Passage, Tick1, Tick2,
} from "./icons.jsx";
import { initials, hueFor } from "../../../lib/familiar.js";
import { clock, chatUnread } from "../../../lib/roomModel.js";
import { chatRows, receiptsFor, tickFor } from "../../../lib/rrModel.js";
import { formatBytes } from "../../../lib/attachments.js";
import { downloadBlob, downloadSaid } from "../../../lib/outside.js";
import { toast } from "../../../features/bookmarks/toastBus.js";

/* ============================================================================
   A SQUADRON — its chat, WhatsApp-shaped.
   -----------------------------------------------------------------------------
   THE TRANSCRIPT STICKS TO THE BOTTOM ONLY WHEN YOU ARE AT THE BOTTOM, so
   somebody reading back through Tuesday is not thrown to Friday when anyone
   types. The unread line is drawn against the moment the chat was opened, not
   against the read mark that opening it moves, or it would vanish the instant
   it appeared.

   TICKS TELL THE TRUTH (0027): one grey tick until everybody it went to has
   it, two grey until everybody has opened it, blue after that.

   THE HOVER ACTIONS ARE REPLY AND MESSAGE INFO, as designed. Everything else a
   message can have done to it — copy, pin, edit, delete, react, and above all
   report and block — is on a right click, or a long press on a phone, where
   there is no hover and nothing else would reach it.
   ========================================================================= */

const NEAR_BOTTOM = 120;
const LONG_PRESS = 480;

function useLongPress(onFire) {
  const timer = useRef(null);
  const start = useRef(null);
  const clear = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e) => {
      if (e.pointerType !== "touch") return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => onFire(el), LONG_PRESS);
    },
    onPointerMove: (e) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
  };
}

function Attachment({ a, onOpenPassage, onOpenImage }) {
  if (a.kind === "image") {
    const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "4 / 3";
    return (
      <button type="button" className="rr-shot is-inline" style={{ aspectRatio: ratio }}
              onClick={() => a.url && onOpenImage(a.url)}
              aria-label={a.fileName ? `Open ${a.fileName}` : "Open the photo"}>
        {a.url ? <img src={a.url} alt={a.fileName || ""} loading="lazy" /> : null}
      </button>
    );
  }
  if (a.kind === "passage") {
    return (
      <button type="button" className="rr-attach is-inline" onClick={() => onOpenPassage(a)}>
        <span className="rr-ic"><Passage /></span>
        <span className="rr-mid">
          <b>{a.paperTitle || "Paper"}{a.page ? ` · p.${a.page}` : ""}</b>
          <span>“{a.quote}”</span>
        </span>
      </button>
    );
  }
  const kind = (a.mimeType || "").split("/").pop()?.toUpperCase().slice(0, 4) || "FILE";
  /* THE `download` ATTRIBUTE IS IGNORED CROSS-ORIGIN, and every attachment
     here is served from Supabase storage — a different origin. So it never
     downloaded anything: it opened the file in a tab, and on iOS in the SAME
     tab, which takes the student out of the conversation they were in. The
     control promised one thing and did another.

     It fetches the file and hands the blob to `downloadBlob`, which appends
     the anchor before clicking it, revokes after a delay rather than on the
     next line, and on a phone offers the share sheet first — the only way a
     file reaches the Files app on an iPhone. If the fetch is refused, the tab
     is still the answer and the student is told that is what happened rather
     than being left with a control that looked like it failed. */
  const keep = async (e) => {
    e.preventDefault();
    if (!a.url) return;
    try {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(String(res.status));
      const said = downloadSaid(await downloadBlob(await res.blob(), a.fileName || "attachment"),
                                a.fileName || "the file");
      if (said) toast(said);
    } catch {
      window.open(a.url, "_blank", "noopener");
      toast("It is open in a new tab — use your browser's Share button to save it.");
    }
  };
  return (
    /* Still a real anchor: the middle click, the cmd-click and the status bar
       all keep working, and only the plain left click is taken over. */
    <a className="rr-attach" href={a.url || undefined} target="_blank" rel="noreferrer"
       onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) keep(e); }}>
      <span className="rr-ic"><File /></span>
      <span className="rr-mid"><b>{a.fileName}</b><span>{formatBytes(a.byteSize)} · {kind}</span></span>
    </a>
  );
}

function Bubble({
  m, first, me, who, tick, parent, lit,
  onReply, onInfo, onMenu, onProfile, onReact, onJump, onOpenPassage, onOpenImage,
}) {
  const rowRef = useRef(null);
  const mine = m.authorId === me;
  const gone = Boolean(m.deletedAt);
  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
  const menu = (el) => { if (!gone) onMenu(el, { message: m }); };
  const press = useLongPress(menu);
  const info = (e) => {
    e.stopPropagation();
    onInfo(m, rowRef.current?.querySelector(".rr-bub"));
  };
  const tickWord = tick === "read" ? "Read by everyone" : tick === "deliv" ? "Delivered to everyone" : "Sent";

  return (
    <div className="rr-msg" ref={rowRef} data-me={mine ? "1" : undefined} data-first={first ? "1" : "0"}
         data-msg={m.id} data-lit={lit ? "1" : undefined}
         onContextMenu={(e) => { if (gone) return; e.preventDefault(); menu(e.currentTarget); }}
         {...press}>
      {!mine && (first ? (
        <button type="button" className="rr-face is-inline" onClick={() => onProfile(m.authorId)}
                aria-label={`${who(m.authorId)}'s profile`}>
          <Av id={m.authorId} name={who(m.authorId)} size={28} />
        </button>
      ) : <span className="rr-slot" />)}
      <div className="rr-bub" data-me={mine ? "1" : undefined} data-gone={gone ? "1" : undefined}>
        {!mine && first && (
          <span className="rr-nm" style={{ color: `oklch(var(--nm-l) 0.13 ${hueFor(m.authorId)})` }}>{who(m.authorId)}</span>
        )}
        {parent && (
          <button type="button" className="rr-rq is-inline" onClick={() => onJump(parent.id)}>
            <b>{parent.authorId === me ? "You" : who(parent.authorId)}</b>
            <span>{parent.deletedAt ? "Message removed" : (parent.body || "An attachment")}</span>
          </button>
        )}
        {!gone && (m.attachments || []).map((a, i) => (
          <Attachment key={a.id || `${a.kind}-${i}`} a={a} onOpenPassage={onOpenPassage} onOpenImage={onOpenImage} />
        ))}
        {gone ? <span className="rr-body">Message removed</span> : (m.body ? <span className="rr-body">{m.body}</span> : null)}
        {reacts.length > 0 && (
          <span className="rr-reacts">
            {reacts.map(([emoji, ids]) => (
              <button type="button" key={emoji} className="rr-react is-inline" aria-pressed={ids.includes(me)}
                      aria-label={`${emoji}, ${ids.length}`} onClick={() => onReact(m.id, emoji)}>
                {emoji} {ids.length}
              </button>
            ))}
          </span>
        )}
        <span className="rr-pad" />
        <span className="rr-mt"
              role={mine && !gone ? "button" : undefined} tabIndex={mine && !gone ? 0 : undefined}
              aria-label={mine && !gone ? `${clock(m.createdAt)}. ${tickWord}. Message info.` : undefined}
              onClick={mine && !gone ? info : undefined}
              onKeyDown={mine && !gone ? (e) => { if (e.key === "Enter" || e.key === " ") info(e); } : undefined}>
          {m.editedAt && !gone && <em>edited</em>}
          {clock(m.createdAt)}
          {mine && !gone && (
            <span className="rr-tick" data-s={tick}>{tick === "sent" ? <Tick1 /> : <Tick2 />}</span>
          )}
        </span>
        {/* THE HOVER ACTIONS SIT IN THE BUBBLE, not in the row. The row is as
            wide as the transcript, so the design's 66px offset put them at the
            window's far edge, half a screen from a short bubble, and 22px past
            it, which scrolled the transcript sideways: measured at 1512px, a
            scrollWidth of 1194 in a 1164px transcript. Against the bubble the
            same offset lands beside it. */}
        {!gone && (
          <div className="rr-qa">
            <button type="button" className="is-inline" title="Reply" aria-label="Reply" onClick={() => onReply(m.id)}><Reply /></button>
            {mine && <button type="button" className="is-inline" title="Message info" aria-label="Message info" onClick={info}><Info /></button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat({
  me, squadron, messages = [], receipts = {}, typing = [], who,
  draft = "", onDraft, onSend, sending = false, replyTo = null, onReplyTo,
  pending = [], onRemovePending, onAttachFiles, onAttachPassage,
  marks = [], marksLoading = false, onWantMarks,
  sheet = false, onSheet, onBack, onInfoSheet, onFocusSearch, onProfile, onMenu, onReact, onSeen,
  jumpTo = null, onMessageInfo, onOpenPassage, onOpenImage,
}) {
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const sheetRef = useRef(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);
  const [stuck, setStuck] = useState(true);
  const [screen, setScreen] = useState("options");
  const [lit, setLit] = useState(null);

  const list = messages.filter((m) => m.squadronId === squadron.id);
  const unread = chatUnread(messages, squadron.id, squadron.lastReadAt, me);
  const opened = useRef({ id: null, at: null });
  if (opened.current.id !== squadron.id) opened.current = { id: squadron.id, at: squadron.lastReadAt };
  const rows = chatRows(list, { lastReadAt: opened.current.at, me });
  const byId = new Map(list.map((m) => [m.id, m]));

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [list.length, squadron.id, stuck, typing.length]);
  useEffect(() => { setStuck(true); }, [squadron.id]);

  /* Read state is the server's, and it is marked once the transcript is at
     the bottom — opening a chat and leaving at once clears nothing. */
  /* Once per newest message, never once per render: the same unread state is
     not marked twice, whatever else changes around it. */
  const marked = useRef("");
  const newest = list.length ? list[list.length - 1].id : "";
  useEffect(() => {
    const key = `${squadron.id}:${newest}`;
    if (!stuck || unread <= 0 || marked.current === key) return;
    marked.current = key;
    onSeen(squadron.id);
  }, [stuck, unread, squadron.id, newest, onSeen]);

  useEffect(() => { if (!sheet) setScreen("options"); }, [sheet]);
  useEffect(() => {
    if (!sheet) return undefined;
    const away = (e) => {
      if (sheetRef.current?.contains(e.target) || e.target.closest?.(".rr-plus")) return;
      onSheet(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [sheet, onSheet]);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = parseFloat(getComputedStyle(el).maxHeight) || 132;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [draft]);
  useEffect(() => { if (replyTo) taRef.current?.focus(); }, [replyTo]);

  const jump = (id) => {
    const el = scrollRef.current?.querySelector(`[data-msg="${id}"]`);
    if (!el) return;
    setStuck(false);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setLit(id);
  };
  useEffect(() => { if (jumpTo) jump(jumpTo); }, [jumpTo, list.length]);
  useEffect(() => {
    if (!lit) return undefined;
    const t = setTimeout(() => setLit(null), 1400);
    return () => clearTimeout(t);
  }, [lit]);

  const take = (kind) => (e) => {
    const files = e.target.files;
    if (files?.length) onAttachFiles(files, kind);
    e.target.value = "";
    onSheet(false);
  };

  const names = (squadron.members || []).map((id) => (id === me ? "You" : who(id)));
  const roster = names.length > 5 ? `${names.slice(0, 4).join(", ")} +${names.length - 4}` : names.join(", ");
  const started = squadron.createdAt
    ? new Date(squadron.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : null;
  const parent = replyTo ? byId.get(replyTo) : null;
  const canSend = Boolean((draft.trim() || pending.length) && !sending);
  const pendIcon = (p) => (p.kind === "image" ? <Photo /> : p.kind === "passage" ? <Passage /> : <File />);
  const pendLabel = (p) => (p.kind === "passage"
    ? `${p.paperTitle || "Paper"}${p.page ? ` · p.${p.page}` : ""}` : p.file?.name || "Attachment");
  const pendSub = (p) => (p.kind === "passage"
    ? `“${p.quote}”` : `${p.kind === "image" ? "Photo" : "File"} · ${formatBytes(p.file?.size)}`);

  return (
    <>
      <div className="rr-phead">
        <button type="button" className="rr-iconbtn rr-backbtn is-inline" onClick={onBack} aria-label="Back"><Back /></button>
        <span><Av id={squadron.id} name={squadron.name} label={initials(squadron.name)} size={40} square /></span>
        <div className="rr-tt">
          <b>{squadron.name}</b>
          <span>{roster}</span>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="rr-iconbtn is-inline" onClick={onFocusSearch}
                title="Search" aria-label="Search this squadron"><Search /></button>
        <button type="button" className="rr-iconbtn is-inline" onClick={onInfoSheet}
                title="Squadron details" aria-label="Squadron details"><Info /></button>
      </div>

      <div className="rr-chat">
        {squadron.pinned && (
          <button type="button" className="rr-draft rr-pin is-inline" onClick={() => jump(squadron.pinned.id)}>
            <span className="rr-mid">
              <b>Pinned · {squadron.pinned.by === me ? "You" : who(squadron.pinned.by)}</b>
              <span>{squadron.pinned.body}</span>
            </span>
          </button>
        )}

        <div className="rr-transcript" ref={scrollRef} aria-label={`${squadron.name} chat`}
             onScroll={(e) => {
               const el = e.currentTarget;
               setStuck(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM);
             }}>
          <div className="rr-tin">
            <div className="rr-intro">
              <Av id={squadron.id} name={squadron.name} label={initials(squadron.name)} size={54} square />
              <b>{squadron.name}</b>
              <p>
                {names.length} in the squadron{started ? ` · started ${started}` : ""}
                <br />Messages here stay in the squadron.
              </p>
            </div>

            {rows.map((r) => {
              if (r.type === "day") return <div className="rr-daypill" key={r.key}>{r.label}</div>;
              if (r.type === "new") {
                return <div className="rr-newline" key={r.key}><span>{r.count} new message{r.count === 1 ? "" : "s"}</span></div>;
              }
              const m = r.m;
              return (
                <Bubble key={r.key} m={m} first={r.first} me={me} who={who}
                        tick={m.authorId === me ? tickFor(receiptsFor(receipts[m.id] || []), { pending: m.pending }) : null}
                        parent={m.replyTo ? byId.get(m.replyTo) : null} lit={lit === m.id}
                        onReply={onReplyTo} onInfo={onMessageInfo} onMenu={onMenu} onProfile={onProfile}
                        onReact={onReact} onJump={jump} onOpenPassage={onOpenPassage} onOpenImage={onOpenImage} />
              );
            })}

            {typing.length > 0 && (
              <div className="rr-msg" data-first="1" role="status"
                   aria-label={typing.length === 1 ? `${who(typing[0])} is typing` : `${typing.length} people are typing`}>
                <Av id={typing[0]} name={who(typing[0])} size={28} />
                <div className="rr-bub rr-typing-bub"><span className="rr-typing"><i /><i /><i /></span></div>
              </div>
            )}
          </div>
        </div>

        {!stuck && (
          <button type="button" className="rr-jump is-inline"
                  onClick={() => { setStuck(true); const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }}>
            <ArrowDown />{unread > 0 ? `${unread} new` : "Latest"}
          </button>
        )}

        <div className="rr-composer">
          {/* Kept mounted and hidden rather than mounted on demand, so closing
              it has something to animate — see the motion section of
              rr-app.css. */}
          <div ref={sheetRef} className="rr-sheetwrap" hidden={!sheet}>
            <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={take("image")} />
            <input ref={fileRef} type="file" multiple hidden onChange={take("file")}
                   accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv,image/*" />
            {screen === "options" ? (
              <div className="rr-sheet" role="group" aria-label="Add an attachment">
                <button type="button" onClick={() => photoRef.current?.click()}><span className="rr-ic"><Photo /></span>Photo</button>
                <button type="button" onClick={() => fileRef.current?.click()}><span className="rr-ic"><File /></span>File</button>
                {/* Only when the room is handed a way to attach one. */}
                {onAttachPassage && (
                  <button type="button" onClick={() => { setScreen("passages"); onWantMarks(); }}>
                    <span className="rr-ic"><Passage /></span>Paper passage
                  </button>
                )}
              </div>
            ) : (
              <div className="rr-passages" role="group" aria-label="Your marks in this module">
                <div className="rr-sect">
                  <button type="button" className="rr-lnk is-inline" onClick={() => setScreen("options")}>Back</button>
                  <span className="rr-grow" />
                  <span className="rr-micro">Your marks in this module</span>
                </div>
                {marksLoading && <div className="rr-ctxnames">Loading your marks…</div>}
                {!marksLoading && !marks.length && (
                  <div className="rr-ctxnames">Highlight a passage in a paper and it turns up here.</div>
                )}
                {marks.map((mk) => (
                  <button type="button" className="rr-oq" key={mk.id}
                          onClick={() => { onAttachPassage(mk); onSheet(false); }}>
                    {mk.quote}
                    <span className="rr-micro">{mk.paperTitle}{mk.page ? ` · p.${mk.page}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="rr-pending">
              {pending.map((p, i) => (
                <span className="rr-attach" key={p.id || i}>
                  <span className="rr-ic">{pendIcon(p)}</span>
                  <span className="rr-mid"><b>{pendLabel(p)}</b><span>{pendSub(p)}</span></span>
                  <button type="button" className="rr-iconbtn is-inline" style={{ width: 28, height: 28 }}
                          onClick={() => onRemovePending(i)} aria-label={`Remove ${pendLabel(p)}`}>✕</button>
                </span>
              ))}
            </div>
          )}

          {parent && (
            <div className="rr-draft">
              <div className="rr-mid">
                <b>{parent.authorId === me ? "You" : who(parent.authorId)}</b>
                <span>{parent.deletedAt ? "Message removed" : (parent.body || "An attachment")}</span>
              </div>
              <button type="button" className="rr-iconbtn is-inline" style={{ width: 28, height: 28 }}
                      onClick={() => onReplyTo(null)} aria-label="Stop replying">✕</button>
            </div>
          )}

          <div className="rr-cin">
            <button type="button" className="rr-iconbtn rr-plus" aria-expanded={sheet}
                    aria-label="Add an attachment" onClick={() => onSheet(!sheet)}><Plus /></button>
            <div className="rr-cfield">
              <textarea ref={taRef} rows={1} value={draft} placeholder={`Message ${squadron.name}`}
                        aria-label={`Message ${squadron.name}`}
                        onChange={(e) => onDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) onSend(); }
                        }}
                        onPaste={(e) => {
                          const files = Array.from(e.clipboardData?.files || []);
                          if (files.length) { e.preventDefault(); onAttachFiles(files, "image"); }
                        }} />
            </div>
            <button type="button" className="rr-send" data-idle={canSend ? "0" : "1"} disabled={!canSend}
                    onClick={onSend} aria-label="Send"><Plane /></button>
          </div>
        </div>
      </div>
    </>
  );
}
