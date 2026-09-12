import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  MessageSquare, Users, Compass, Radio, CornerUpLeft, Copy, Pin, Pencil, Trash2,
  Flag, Link2, Check, Ban,
} from "lucide-react";
import {
  presenceRail, PRESENCE_SHOWN, titleOf, chatUnread,
} from "../../lib/roomModel.js";
import { hueFor } from "../../lib/familiar.js";
import { mmss } from "../module/lessonState.js";
import Rail from "./Rail.jsx";
import SquadronChat from "./SquadronChat.jsx";
import ModuleFeed from "./ModuleFeed.jsx";
import ThreadView from "./ThreadView.jsx";
import RightSeatPane from "./RightSeatPane.jsx";
import Discover from "./Discover.jsx";
import ProfileSheet from "./ProfileSheet.jsx";
import SquadronSheet from "./SquadronSheet.jsx";
import CreateSquadron from "./CreateSquadron.jsx";
import { Menu, Toast } from "./bits.jsx";
import {
  discoverSquadrons, joinSquadron, searchPeople, createSquadron, revokeInvite,
  inviteUrl, tokenFromLink,
} from "../../lib/discovery.js";
import {
  toggleReaction, pinMessage, editMessage, deleteMessage, markSquadronRead,
  setSquadronMuted, leaveSquadron, fetchThreadVotes, voteThread,
} from "../../lib/roomData.js";
import {
  fetchSeat, fetchSeatRequests, askRightSeat, cancelRightSeat, answerRightSeat,
  endRightSeat, fetchSeatMessages, postSeatMessage, keepSeatMessage, sweepSeats,
} from "../../lib/rightSeat.js";
import { typingChannel } from "../../lib/live.js";
import { canTransition, beginTransition, endTransition, nameLayers, clearNames } from "../../lib/viewTransition.js";
import "./room.css";

/* ============================================================================
   THE READY ROOM — a desktop-messaging layout with one important twist:
   SQUADRONS ARE GROUP CHATS, MODULES ARE QUESTION FEEDS.

   That twist is the whole design. A squadron is people you know, talking; a
   module is a body of questions that outlives whoever asked them. Those want
   opposite shapes — a transcript you skim and forget, versus a feed you search
   and answer — and the old room tried to be one thing for both.

   The third screen is neither. The right seat is exactly one person and state
   that expires, and it is a state rather than a place: it adds a face to
   surfaces that already exist and never adds a nav item.

   THIS FILE IS THE ORCHESTRATOR AND NOTHING ELSE. It owns which screen is
   showing, the search, the menus and the sheets. Every screen is its own file
   because the old single component was eight hundred lines with four screens
   inside it, and a change to the chat could only be made by reading the feed.

   WHAT IT WRITES ITSELF, and why. Reactions, pins, edits, deletes, mute, leave,
   create, read state, thread votes and the whole right seat are room-local:
   nothing outside this screen reads them, and routing them through App would
   be a prop each, in a component that already takes twenty. Threads, replies
   and messages still go up through onPost, because App owns the session store
   they live in and two writers to one list is how a list gets out of order.

   TOKENS. Everything uses the app's real tokens — --ground --panel --raised
   --sunk --edge --t1/2/3 --active --caution --ok. Nothing here invents one.
   ========================================================================= */

const EMPTY_REQ = { in: [], out: [] };

export default function ReadyRoom({
  me = "u_you", modules = [], activeModuleCode,
  threads = [], replies = [], people = [], presence = [],
  squadrons = [], messages = [], chapters = [],
  seatCandidates = [], votes = {}, saved = {},
  brand = null, profile = null,
  onPost, onReport, onBlock, onVote, onBest, onOpenLessonAt, onSave,
  onRefresh, onOpenInvite, onPlace,
}) {
  /* WHAT THE PANE IS SHOWING. One piece of state, not six booleans: the six
     states are mutually exclusive and a boolean each is how two of them end up
     on screen together. */
  const [view, setView] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({});
  const [draft, setDraft] = useState("");
  const [seatDraft, setSeatDraft] = useState("");
  const [asking, setAsking] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [jumpTo, setJumpTo] = useState(null);
  const [sending, setSending] = useState(false);

  const [discoverFilter, setDiscoverFilter] = useState("yours");
  const [rooms, setRooms] = useState([]);
  const [foundPeople, setFoundPeople] = useState([]);
  const [profileOf, setProfileOf] = useState(null);
  const [sheetOf, setSheetOf] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [threadVotes, setThreadVotes] = useState({});

  const [seat, setSeat] = useState(null);
  const [seatReq, setSeatReq] = useState(EMPTY_REQ);
  const [seatMessages, setSeatMessages] = useState([]);
  const [seatInvite, setSeatInvite] = useState(null);
  const [typing, setTyping] = useState([]);

  const paneRef = useRef(null);
  const listRef = useRef(null);
  const typingRef = useRef(null);
  const lastPing = useRef(0);

  /* ---------------------------------------------------------------- names */
  const who = useCallback((id) => (id === me ? "You"
    : people.find((p) => p.id === id)?.callsign || "Someone"), [me, people]);
  const personOf = useCallback((id) => {
    const p = people.find((x) => x.id === id);
    return {
      user_id: id, callsign: id === me ? "You" : (p?.callsign || "Someone"),
      code: p?.code || null, module_code: p?.module_code || null,
      exam_window: p?.exam_window || null, active_window: p?.active_window || null,
      hue: hueFor(id),
    };
  }, [people, me]);

  const rail = useMemo(() => presenceRail(presence, PRESENCE_SHOWN), [presence]);
  const online = useMemo(() => new Set(rail.all.map((p) => p.user_id)), [rail]);

  const squadronsWithPresence = useMemo(() => squadrons.map((s) => ({
    ...s,
    online: (s.members || []).filter((id) => online.has(id)).length,
    roster: (s.roster || []).map((m) => ({ ...m, name: who(m.user_id), online: online.has(m.user_id) })),
  })), [squadrons, online, who]);

  const say = useCallback((message, icon = null) => {
    setToast({ message, icon });
    window.clearTimeout(say._t);
    say._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* ------------------------------------------------------------- the pane */
  const openNow = useCallback((next) => {
    setView(next);
    setDraft(""); setReplyTo(null); setAsking(null); setJumpTo(next?.at || null);
    requestAnimationFrame(() => paneRef.current?.focus());
  }, []);

  /* §4d — THE PANE MOVES, THE RAIL DOES NOT. A pane change is not a route
     change, so go() never sees it and the transition layer would never fire.
     The room starts its own: paneR going in, paneL coming back, and the rail is
     named so it is pinned rather than travelling with the pane beside it. */
  const open = useCallback((next, { goingBack = false } = {}) => {
    if (canTransition() && (next || view)) {
      const token = beginTransition(goingBack ? "paneL" : "paneR");
      nameLayers("pane");
      const vt = document.startViewTransition(() => flushSync(() => openNow(next)));
      vt.ready?.catch(() => {});
      vt.finished?.catch(() => {}).finally?.(() => { if (endTransition(token)) clearNames(); });
      return;
    }
    openNow(next);
  }, [view, openNow]);

  const back = useCallback(() => {
    if (view?.kind === "thread") { open({ kind: "module", id: view.id }, { goingBack: true }); return; }
    open(null, { goingBack: true });
    requestAnimationFrame(() => listRef.current?.focus());
  }, [view, open]);

  const squadron = view?.kind === "squadron"
    ? squadronsWithPresence.find((s) => s.id === view.id) : null;
  const mod = (view?.kind === "module" || view?.kind === "thread")
    ? modules.find((m) => (m.code || m.id) === view.id) : null;
  const modThreads = useMemo(
    () => threads.filter((t) => t.moduleId === (mod?.code || mod?.id)),
    [threads, mod]);
  const thread = view?.kind === "thread" ? modThreads.find((t) => t.id === view.threadId) : null;

  /* ------------------------------------------------------------- searches */
  /* PEOPLE SEARCH IS A ROUND TRIP, and has to be. The scope lives in the SQL
     function; there is no client-side list that could answer this correctly. */
  useEffect(() => {
    const q = query.trim();
    if (!q || !me) { setFoundPeople([]); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      searchPeople(me, q).then((r) => { if (live) setFoundPeople(r || []); });
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [query, me]);

  /* The rooms you could join. Re-read when the filter changes, guarded so a
     slow answer for "yours" cannot land after a fast one for "all". */
  useEffect(() => {
    if (view?.kind !== "discover" || !me) return undefined;
    let live = true;
    discoverSquadrons(me, discoverFilter).then((r) => { if (live) setRooms(r || []); });
    return () => { live = false; };
  }, [view?.kind, discoverFilter, me]);

  /* Scores on the questions in the module you are looking at. Fetched per
     module rather than for every thread in the app: the feed is the only place
     they are read, and one round trip per module beats one for four hundred
     rows nobody is looking at. */
  useEffect(() => {
    const ids = modThreads.map((t) => t.id);
    if (!ids.length || !me) return undefined;
    let live = true;
    fetchThreadVotes(ids, me).then((v) => { if (live) setThreadVotes((s) => ({ ...s, ...v })); });
    return () => { live = false; };
  }, [modThreads, me]);

  /* --------------------------------------------------------- the right seat */
  const loadSeat = useCallback(async () => {
    if (!me) return;
    const [s, r] = await Promise.all([fetchSeat(me), fetchSeatRequests(me)]);
    setSeat(s); setSeatReq(r || EMPTY_REQ);
    setSeatMessages(s ? await fetchSeatMessages(s.sessionId) : []);
  }, [me]);

  useEffect(() => {
    if (!me) return undefined;
    let live = true;
    // Opportunistic housekeeping: the person opening the room is the person
    // who needs the hour to have been enforced, so it is enforced here rather
    // than by a scheduler that would be a second owner of the same rule.
    sweepSeats().then(() => { if (live) loadSeat(); });
    const t = setInterval(() => { if (document.visibilityState === "visible") loadSeat(); }, 20000);
    return () => { live = false; clearInterval(t); };
  }, [me, loadSeat]);

  /* The partner moved. A bubble, never a page change — §right seat is explicit
     that nobody is ever followed. */
  const lastPlace = useRef(null);
  useEffect(() => {
    if (!seat?.partnerPlace) return;
    if (lastPlace.current && lastPlace.current !== seat.partnerPlace) {
      setSeatInvite({ label: seat.partnerPlace });
    }
    lastPlace.current = seat.partnerPlace;
  }, [seat?.partnerPlace]);

  /* ------------------------------------------------------------- typing */
  useEffect(() => {
    if (view?.kind !== "squadron" || !view.id || !me) { setTyping([]); return undefined; }
    const ch = typingChannel(view.id, me, setTyping);
    typingRef.current = ch;
    return () => { ch.stop(); typingRef.current = null; setTyping([]); };
  }, [view?.kind, view?.id, me]);

  const onDraft = (v) => {
    setDraft(v);
    const now = Date.now();
    if (v && now - lastPing.current > 900) { lastPing.current = now; typingRef.current?.ping(); }
  };

  /* --------------------------------------------------------------- lessons */
  const lessonOf = (lid) => {
    for (const c of chapters) for (const l of (c.lessons || [])) if (l.id === lid) return { c, l };
    return null;
  };
  const lessonTag = (t) => {
    if (!t?.lessonId) return null;
    const found = lessonOf(t.lessonId);
    const at = t.t != null ? ` · ${mmss(t.t)}` : "";
    return found ? `${found.l.title}${at}` : `A lesson${at}`;
  };

  /* ---------------------------------------------------------------- writes */
  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    if (view?.kind === "squadron") {
      onPost?.({ kind: "message", squadronId: view.id, body, replyTo });
      setReplyTo(null);
    } else if (view?.kind === "thread") {
      onPost?.({ kind: "reply", threadId: view.threadId, body });
    }
    setDraft("");
    setSending(false);
  };

  const react = async (messageId, emoji) => {
    await toggleReaction(me, messageId, emoji);
    onRefresh?.("chat");
  };

  const seen = useCallback(async (squadronId) => {
    await markSquadronRead(me, squadronId);
    onRefresh?.("squadrons");
  }, [me, onRefresh]);

  const share = (t) => {
    const url = `${window.location.origin}/ready-room/${String(t.moduleId).toLowerCase()}/${t.id}`;
    navigator.clipboard?.writeText(url)
      .then(() => say("Link copied", <Link2 aria-hidden="true" />))
      .catch(() => say(url, <Link2 aria-hidden="true" />));
  };

  const copyInvite = (s) => {
    const url = inviteUrl(s.inviteToken);
    navigator.clipboard?.writeText(`https://${url}`)
      .then(() => say("Invite link copied", <Copy aria-hidden="true" />))
      .catch(() => say(url, <Copy aria-hidden="true" />));
  };

  const ask = async (them) => {
    const outcome = await askRightSeat(me, them);
    setProfileOf(null);
    await loadSeat();
    say({
      asked: `Asked ${who(them)}. They get one nudge, not five.`,
      accepted: `You have the right seat with ${who(them)}.`,
      not_shared: "Share a squadron with them first.",
      already_flying: "You already have somebody in the right seat.",
      unavailable: "That one isn't available.",
      missing: "That didn't go through. Try again.",
    }[outcome] || "That didn't go through.", <Radio aria-hidden="true" />);
  };

  const seatState = (id) => (seat ? "flying"
    : seatReq.out.some((r) => r.userId === id) ? "asked" : "free");

  /* ------------------------------------------------------------ the menus */
  const messageMenu = (m) => {
    const items = [
      { id: "reply", icon: <CornerUpLeft aria-hidden="true" />, label: "Reply",
        run: () => setReplyTo(m.id) },
      { id: "copy", icon: <Copy aria-hidden="true" />, label: "Copy text",
        run: () => { navigator.clipboard?.writeText(m.body || ""); say("Copied"); } },
      { id: "pin", icon: <Pin aria-hidden="true" />, label: "Pin in this squadron",
        run: async () => { await pinMessage(me, m.id, true); onRefresh?.("squadrons"); say("Pinned", <Pin aria-hidden="true" />); } },
      "-",
    ];
    if (m.authorId === me) {
      items.push({
        id: "edit", icon: <Pencil aria-hidden="true" />, label: "Edit",
        run: async () => {
          const next = window.prompt("Edit your message", m.body || "");
          if (next == null) return;
          const ok = await editMessage(me, m.id, next);
          onRefresh?.("chat");
          say(ok ? "Edited" : "Too late to edit that one");
        },
      });
      items.push({
        id: "del", icon: <Trash2 aria-hidden="true" />, label: "Delete for everyone", danger: true,
        run: async () => { await deleteMessage(me, m.id); onRefresh?.("chat"); say("Removed"); },
      });
    } else {
      items.push({
        id: "report", icon: <Flag aria-hidden="true" />, label: "Report", danger: true,
        run: () => { onReport?.({ kind: "message", id: m.id, authorId: m.authorId, squadronId: m.squadronId });
                     say("Reported. Somebody reads every one.", <Flag aria-hidden="true" />); },
      });
      items.push({
        id: "block", icon: <Ban aria-hidden="true" />, label: `Block ${who(m.authorId)}`, danger: true,
        run: () => { onBlock?.(m.authorId); say("Blocked — it cuts both ways", <Ban aria-hidden="true" />); },
      });
    }
    return items;
  };

  const onMenu = (anchor, payload) => {
    if (payload?.jump) { setJumpTo(payload.jump); return; }
    if (!anchor) return;
    if (payload.message) { setMenu({ anchor, items: messageMenu(payload.message) }); return; }
    if (payload.thread) {
      setMenu({ anchor, items: [
        { id: "share", icon: <Link2 aria-hidden="true" />, label: "Copy link", run: () => share(payload.thread) },
        { id: "del", icon: <Trash2 aria-hidden="true" />, label: "Delete", danger: true,
          run: () => { onPost?.({ kind: "deleteThread", threadId: payload.thread.id }); say("Removed"); } },
      ] });
      return;
    }
    if (payload.answer) {
      const mine = payload.answer.authorId === me;
      setMenu({ anchor, items: [
        { id: "copy", icon: <Copy aria-hidden="true" />, label: "Copy text",
          run: () => { navigator.clipboard?.writeText(payload.answer.body || ""); say("Copied"); } },
        mine
          ? { id: "del", icon: <Trash2 aria-hidden="true" />, label: "Delete", danger: true,
              run: () => { onPost?.({ kind: "deleteReply", replyId: payload.answer.id }); say("Removed"); } }
          : { id: "report", icon: <Flag aria-hidden="true" />, label: "Report", danger: true,
              run: () => { onReport?.({ kind: "reply", id: payload.answer.id, authorId: payload.answer.authorId });
                           say("Reported. Somebody reads every one.", <Flag aria-hidden="true" />); } },
      ] });
    }
  };

  const newMenu = (anchor) => setMenu({ anchor, items: [
    { id: "q", icon: <MessageSquare aria-hidden="true" />, label: "Ask a question",
      run: () => { const code = mod?.code || activeModuleCode || modules[0]?.code;
                   if (!code) { say("Open a module first"); return; }
                   open({ kind: "module", id: code }); setAsking(code); } },
    { id: "s", icon: <Users aria-hidden="true" />, label: "Create a squadron",
      run: () => setCreating(true) },
    { id: "f", icon: <Compass aria-hidden="true" />, label: "Find a squadron",
      run: () => open({ kind: "discover" }) },
  ] });

  /* Where I am, told to the right seat as the room moves. The rest of the app
     calls the same thing through onPlace — this screen is simply one more
     place a student can be. */
  useEffect(() => {
    if (!seat) return;
    const label = squadron ? squadron.name
      : mod ? `${mod.code || mod.id} questions`
      : thread ? titleOf(thread) : "The Ready Room";
    onPlace?.(mod?.code || mod?.id || null, label);
  }, [seat, squadron, mod, thread, onPlace]);

  const unreadTotal = squadrons.reduce(
    (n, s) => n + (s.muted ? 0 : chatUnread(messages, s.id, s.lastReadAt, me)), 0);

  return (
    <div className="room" data-mobile={view ? "pane" : "rail"}>
      <h1 className="room-h1">Ready Room</h1>

      <Rail
        me={me} query={query} onQuery={setQuery} brand={brand} profile={profile}
        squadrons={squadronsWithPresence} modules={modules} threads={threads}
        replies={replies} messages={messages} foundPeople={foundPeople}
        seat={seat} seatFaces={rail.shown} view={view} onOpen={open}
        onNew={newMenu} onProfile={(id, row) => setProfileOf(row
          ? { user_id: row.user_id, callsign: row.display_name, module_code: row.module_code, hue: hueFor(row.user_id) }
          : personOf(id))}
        onNotifications={() => say(unreadTotal
          ? `${unreadTotal} waiting for you`
          : "Nothing waiting. The badge lights when there is.")}
        unreadTotal={unreadTotal} who={who} listRef={listRef}
      />

      <main className="pane" ref={paneRef} tabIndex={-1} aria-label="Conversation">
        {!view && (
          <div className="pane-blank">
            <div className="blank-mark"><Radio aria-hidden="true" /></div>
            <h2>Ready Room</h2>
            <p>
              Squadrons on the left are chats. Modules are question feeds.
              The right seat is one person, studying with you.
            </p>
            <div className="blank-acts">
              {squadrons[0] && (
                <button type="button" className="primary is-inline"
                        onClick={() => open({ kind: "squadron", id: squadrons[0].id })}>
                  <MessageSquare aria-hidden="true" /> Open {squadrons[0].name}
                </button>
              )}
              <button type="button" className="ghost is-inline"
                      onClick={() => open({ kind: "discover" })}>
                <Compass aria-hidden="true" /> Find a squadron
              </button>
            </div>
          </div>
        )}

        {squadron && (
          <SquadronChat
            me={me} squadron={squadron} messages={messages}
            draft={draft} onDraft={onDraft} onSend={send} sending={sending}
            replyTo={replyTo} onReplyTo={setReplyTo} onReact={react} onMenu={onMenu}
            onBack={back} onInfo={() => setSheetOf(squadron)}
            onProfile={(id) => setProfileOf(personOf(id))}
            onSearchHere={() => { setQuery(""); listRef.current?.querySelector("input")?.focus(); }}
            typing={typing} who={who} onSeen={seen} jumpTo={jumpTo}
          />
        )}

        {mod && !thread && (
          <ModuleFeed
            me={me} mod={mod} threads={modThreads} replies={replies}
            votes={threadVotes} saved={saved}
            sort={sort[mod.code || mod.id] || "hot"}
            onSort={(code, id) => setSort((s) => ({ ...s, [code]: id }))}
            asking={asking} onAsking={setAsking}
            onPost={(ev) => { onPost?.({ kind: "thread", ...ev }); setAsking(null); say("Posted"); }}
            onOpenThread={(t) => open({ kind: "thread", id: t.moduleId, threadId: t.id })}
            onVote={async (id, dir) => {
              const mine = await voteThread(me, id, dir);
              setThreadVotes((v) => {
                const was = v[id] || { score: 0, mine: 0 };
                return { ...v, [id]: { score: was.score - was.mine + mine, mine } };
              });
            }}
            onSave={(id) => onSave?.(id)}
            onShare={share} onBack={back}
            onProfile={(id) => setProfileOf(personOf(id))}
            onMenu={onMenu}
            onSearchHere={() => { setQuery(""); listRef.current?.querySelector("input")?.focus(); }}
            readers={rail.all.length} who={who} lessonTag={lessonTag}
          />
        )}

        {thread && (
          <ThreadView
            me={me} thread={thread} mod={mod} replies={replies}
            votes={threadVotes} replyVotes={votes} saved={Boolean(saved[thread.id])}
            draft={draft} onDraft={setDraft} onSend={send} sending={sending}
            onVote={async (id, dir) => {
              const mine = await voteThread(me, id, dir);
              setThreadVotes((v) => {
                const was = v[id] || { score: 0, mine: 0 };
                return { ...v, [id]: { score: was.score - was.mine + mine, mine } };
              });
            }}
            onVoteReply={(id, on) => onVote?.(id, on)}
            onBest={(tid, aid) => onBest?.(tid, aid)}
            onSave={(id) => onSave?.(id)}
            onShare={share}
            onSubReply={(ev) => onPost?.({ kind: "reply", ...ev })}
            onBack={back} onProfile={(id) => setProfileOf(personOf(id))}
            onMenu={onMenu} onOpenLessonAt={(t) => onOpenLessonAt?.(t)}
            who={who} lessonTag={lessonTag}
          />
        )}

        {view?.kind === "seat" && (
          <RightSeatPane
            me={me} seat={seat} requests={seatReq} candidates={seatCandidates}
            squadrons={squadronsWithPresence}
            seatMessages={seatMessages} seatDraft={seatDraft} onSeatDraft={setSeatDraft}
            onSendSeat={async () => {
              const body = seatDraft.trim();
              if (!body || !seat) return;
              const row = await postSeatMessage(me, seat.sessionId, body);
              if (row) setSeatMessages((m) => [...m, row]);
              setSeatDraft("");
            }}
            onKeep={async (id, on) => {
              await keepSeatMessage(id, on);
              setSeatMessages((m) => m.map((x) => (x.id === id ? { ...x, kept: on } : x)));
              say(on ? "Kept — it survives the landing" : "No longer kept");
            }}
            myPlace={squadron ? squadron.name : mod ? `${mod.code || mod.id} questions` : "The Ready Room"}
            invite={seatInvite}
            onDismissInvite={() => setSeatInvite(null)}
            onFollowInvite={() => { setSeatInvite(null); say("Opening what they opened"); }}
            onAsk={ask}
            onCancelAsk={async (id) => { await cancelRightSeat(me, id); await loadSeat(); }}
            onAnswer={async (id, accept) => {
              await answerRightSeat(me, id, accept);
              await loadSeat();
              say(accept ? "You have a copilot." : "Declined.", accept ? <Check aria-hidden="true" /> : null);
            }}
            onEnd={async () => { await endRightSeat(me); await loadSeat(); say("Right seat cleared"); }}
            onBack={back} onProfile={(id) => setProfileOf(personOf(id))} who={who}
          />
        )}

        {view?.kind === "discover" && (
          <Discover
            rooms={rooms} filter={discoverFilter} onFilter={setDiscoverFilter}
            who={who} onBack={back}
            onJoin={async (room) => {
              /* ONE DOOR. The function decides capacity, blocks and policy, and
                 the card renders whichever word comes back — it never decides
                 for itself whether a room is full. */
              const outcome = await joinSquadron(me, room.id);
              setRooms((rs) => rs.map((r) => (r.id === room.id
                ? { ...r, already_in: outcome === "joined", requested: outcome === "requested" }
                : r)));
              if (outcome === "joined") { onRefresh?.("squadrons"); say(`Joined ${room.name}`); }
              else if (outcome === "requested") say("Asked to join. They decide.");
              else say("That one isn't open right now.");
            }}
            onCreate={() => setCreating(true)}
            onOpenLink={(link) => {
              const token = tokenFromLink(link);
              if (!token) { say("That doesn't look like a squadron link"); return; }
              onOpenInvite?.(token);
            }}
            mySquadrons={squadronsWithPresence}
            onCopyInvite={copyInvite}
          />
        )}
      </main>

      {/* One sheet, opened from any avatar on any surface here. */}
      <ProfileSheet
        open={Boolean(profileOf)} person={profileOf}
        sharedSquadrons={profileOf
          ? squadrons.filter((s) => (s.members || []).includes(profileOf.user_id)
              && (s.members || []).includes(me)).map((s) => s.name)
          : []}
        presence={profileOf && online.has(profileOf.user_id) ? "on" : "off"}
        seatState={profileOf ? seatState(profileOf.user_id) : "free"}
        onClose={() => setProfileOf(null)}
        onInvite={(p) => { setProfileOf(null); setCreating(true); say(`Make a room and send ${p.callsign} the link`); }}
        onAskRightSeat={(p) => ask(p.user_id)}
        onOpenChat={(p) => {
          const s = squadrons.find((x) => (x.members || []).includes(p.user_id)
            && (x.members || []).includes(me));
          setProfileOf(null);
          if (s) open({ kind: "squadron", id: s.id });
        }}
        onReport={(p) => { setProfileOf(null); onReport?.({ kind: "person", id: p.user_id });
                           say("Reported. Somebody reads every one.", <Flag aria-hidden="true" />); }}
        onBlock={(p) => { setProfileOf(null); onBlock?.(p.user_id);
                          say("Blocked — it cuts both ways", <Ban aria-hidden="true" />); }}
      />

      <SquadronSheet
        open={Boolean(sheetOf)} squadron={sheetOf} me={me} online={online}
        onClose={() => setSheetOf(null)}
        onCopyInvite={copyInvite}
        onRevoke={async (s) => {
          const token = await revokeInvite(me, s.id);
          onRefresh?.("squadrons");
          say(token ? "New link made. The old one is dead." : "Only the owner can do that.");
        }}
        onMute={async (s, muted) => {
          await setSquadronMuted(me, s.id, muted);
          setSheetOf((x) => (x ? { ...x, muted } : x));
          onRefresh?.("squadrons");
          say(muted ? "Muted. The count still counts." : "Notifications back on");
        }}
        onLeave={async (s) => {
          const outcome = await leaveSquadron(me, s.id);
          setSheetOf(null);
          if (view?.kind === "squadron" && view.id === s.id) open(null, { goingBack: true });
          onRefresh?.("squadrons");
          say(outcome === "closed" ? "You were the last one out. The room closed." : `Left ${s.name}`);
        }}
        onProfile={(id) => { setSheetOf(null); setProfileOf(personOf(id)); }}
      />

      <CreateSquadron
        open={creating} modules={modules} defaultModule={activeModuleCode} busy={busy}
        onClose={() => setCreating(false)}
        onCreate={async (form) => {
          setBusy(true);
          const id = await createSquadron(me, form);
          setBusy(false);
          setCreating(false);
          if (!id) { say("That didn't go through. Try a different name."); return; }
          await onRefresh?.("squadrons");
          open({ kind: "squadron", id });
          say("Created. Share the link to fill it.", <Users aria-hidden="true" />);
        }}
      />

      {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      <Toast message={toast?.message} icon={toast?.icon} />
    </div>
  );
}
