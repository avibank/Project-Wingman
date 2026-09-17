import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Radio, CornerUpLeft, Copy, Pin, Pencil, Trash2, Flag, Link2, Check, Ban, SmilePlus,
} from "lucide-react";
import { presenceRail, PRESENCE_SHOWN, titleOf } from "../../lib/roomModel.js";
import {
  visibleThreads, keepSelection, moveSelection, receiptsFor, seatFaces, readLayout, layoutKey,
} from "../../lib/rrModel.js";
import { hueFor } from "../../lib/familiar.js";
import { mmss } from "../module/lessonState.js";
import { path as routePath } from "../../lib/routes.js";
import { listen, LIVE_TABLES, typingChannel } from "../../lib/live.js";
import { fetchFlightLog } from "../../lib/partners.js";
import Rail from "./rr/Rail.jsx";
import Threads from "./rr/Threads.jsx";
import Chat from "./rr/Chat.jsx";
import Seats from "./rr/Seats.jsx";
import SeenPanel from "./rr/SeenPanel.jsx";
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
  setSquadronMuted, leaveSquadron, fetchThreadVotes, voteThread, fetchReceipts,
} from "../../lib/roomData.js";
import {
  fetchSeat, fetchSeatRequests, askRightSeat, cancelRightSeat, answerRightSeat,
  endRightSeat, fetchSeatMessages, postSeatMessage, keepSeatMessage, sweepSeats,
} from "../../lib/rightSeat.js";
import { fetchMyMarks, validateFile, readImageSize, MAX_PER_MESSAGE } from "../../lib/attachments.js";
import { paneTransition } from "../../lib/viewTransition.js";
import "./room.css";
import "./ready-room.css";
import "./rr-app.css";

/* ============================================================================
   THE READY ROOM — the orchestrator, and nothing else.
   -----------------------------------------------------------------------------
   Two vocabularies behind one rail: SQUADRONS ARE GROUP CHATS, MODULES ARE
   QUESTION FEEDS, and the right seat is exactly one person and state that
   expires. The layout is the signed-off rebuild (ready-room.css, kept as sent,
   and rr-app.css, which fits it to the app); every screen is its own file in
   ./rr, and every rule they share is in lib/rrModel.js, where a node script
   holds it.

   ONE STATE OBJECT for what the pane shows — kind, id, thread, filter, asking,
   sheet — because those are one decision, and a boolean each is how two of
   them end up on screen together. `data-view` is the other half and only
   matters on a narrow screen: the rail, the list, or the thread.

   WHAT IT WRITES ITSELF, and why. Reactions, pins, edits, deletes, mute, leave,
   create, read state, thread votes and the whole right seat are room-local:
   nothing outside this screen reads them. Threads, replies and messages still
   go up through onPost, because App owns the store they live in and two writers
   to one list is how a list gets out of order.
   ========================================================================= */

const EMPTY_REQ = { in: [], out: [] };
const narrow = () => typeof window !== "undefined" && window.innerWidth <= 900;

export default function ReadyRoom({
  me = "u_you", modules = [], activeModuleCode, routeThreadId = null,
  threads = [], replies = [], people = [], presence = [],
  squadrons = [], messages = [], chapters = [],
  votes = {}, saved = {},
  onHome, onPost, onReport, onBlock, onVote, onBest, onOpenLessonAt, onSave,
  onRefresh, onOpenInvite, onPlace, onOpenPaper,
  intent = null, onIntentUsed,
}) {
  const firstModule = activeModuleCode || modules[0]?.code || modules[0]?.id || null;
  const [st, setSt] = useState(() => ({
    kind: "module", id: firstModule, thread: routeThreadId, filter: "all", asking: false, sheet: false,
  }));
  const [view, setView] = useState(() => (routeThreadId ? "thread" : narrow() ? "rail" : "list"));
  const [query, setQuery] = useState("");
  const [layout, setLayoutState] = useState(() => {
    try { return readLayout(window.localStorage.getItem(layoutKey(me))); } catch { return { fw: null, wide: false }; }
  });

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [jumpTo, setJumpTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState([]);
  const [marks, setMarks] = useState(null);
  const [marksLoading, setMarksLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [receipts, setReceipts] = useState({});

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
  const [pendingAsk, setPendingAsk] = useState(null);

  const [flightLog, setFlightLog] = useState([]);
  const [seat, setSeat] = useState(null);
  const [seatReq, setSeatReq] = useState(EMPTY_REQ);
  const [seatMessages, setSeatMessages] = useState([]);
  const [seatDraft, setSeatDraft] = useState("");
  const [seatInvite, setSeatInvite] = useState(null);
  const [typing, setTyping] = useState([]);

  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const typingRef = useRef(null);
  const lastPing = useRef(0);
  const receiptSeq = useRef(0);

  /* ------------------------------------------------------------ the layout */
  const setLayout = useCallback((next) => {
    setLayoutState(next);
    try { window.localStorage.setItem(layoutKey(me), JSON.stringify(next)); } catch { /* storage off */ }
  }, [me]);
  useEffect(() => {
    try { setLayoutState(readLayout(window.localStorage.getItem(layoutKey(me)))); } catch { /* storage off */ }
  }, [me]);

  /* Past 900px there is no rail-only view; one left over from a phone-width
     window would show the list and the thread stacked in one column. */
  useEffect(() => {
    const fit = () => { if (!narrow()) setView((v) => (v === "rail" ? "list" : v)); };
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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
  const mates = useMemo(
    () => [...new Set(squadrons.flatMap((s) => s.members || []))].filter((id) => id !== me),
    [squadrons, me]);

  const say = useCallback((message, icon = null) => {
    setToast({ message, icon });
    window.clearTimeout(say._t);
    say._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* ---------------------------------------------------------- what is open */
  const mod = st.kind === "module" ? modules.find((m) => (m.code || m.id) === st.id) || null : null;
  const modCode = mod ? (mod.code || mod.id) : null;
  const modThreads = useMemo(() => threads.filter((t) => t.moduleId === modCode), [threads, modCode]);
  const list = useMemo(
    () => visibleThreads(modThreads, { filter: st.filter, q: query, replies, me, who }),
    [modThreads, st.filter, query, replies, me, who]);
  const squadron = st.kind === "squad" ? squadronsWithPresence.find((s) => s.id === st.id) || null : null;

  const go = useCallback((next) => {
    setInfo(null);
    setMenu(null);
    setDraft("");
    setReplyTo(null);
    setJumpTo(next.at || null);
    if (next.thread && query) setQuery("");
    setSt((s) => {
      const base = { ...s, kind: next.kind, id: next.id ?? null, asking: false, sheet: false };
      if (next.kind !== "module") return base;
      if (next.thread) return { ...base, filter: "all", thread: next.thread };
      const same = s.kind === "module" && s.id === next.id;
      const vis = visibleThreads(threads.filter((t) => t.moduleId === next.id),
        { filter: s.filter, q: query, replies, me, who });
      return { ...base, thread: same ? keepSelection(vis, s.thread) : (vis[0]?.id ?? null) };
    });
    setView(next.kind === "module" && next.thread ? "thread" : "list");
  }, [threads, query, replies, me, who]);

  const back = useCallback(() => {
    setInfo(null);
    if (view === "thread" && window.innerWidth <= 1180) {
      setSt((s) => ({ ...s, asking: false }));
      setView("list");
      return;
    }
    if (narrow()) setView("rail");
  }, [view]);

  const select = useCallback((id, { open = false } = {}) => {
    setSt((s) => ({ ...s, asking: false, thread: id }));
    if (open) setView("thread");
  }, []);

  const onFilter = (k) => setSt((s) => ({
    ...s, filter: k,
    thread: s.asking ? s.thread : keepSelection(
      visibleThreads(modThreads, { filter: k, q: query, replies, me, who }), s.thread),
  }));

  const onQuery = (q) => {
    setQuery(q);
    if (st.kind === "module" && !st.asking) {
      const vis = visibleThreads(modThreads, { filter: st.filter, q, replies, me, who });
      setSt((s) => ({ ...s, thread: keepSelection(vis, s.thread) }));
    }
  };

  const focusSearch = useCallback(() => {
    if (narrow()) setView("rail");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  /* NO PANE IS EMPTY. A module with questions always has one selected, and a
     question that has been deleted hands the selection to the top of the list.
     A link's question is kept while the module's questions are still loading. */
  useEffect(() => {
    if (st.kind !== "module" || st.asking) return;
    if (st.thread && modThreads.some((t) => t.id === st.thread)) return;
    if (st.thread && !modThreads.length) return;
    const next = list[0]?.id ?? null;
    if (next !== st.thread) setSt((s) => ({ ...s, thread: next }));
  }, [st.kind, st.asking, st.thread, modThreads, list]);

  /* A DOOR FROM THE FLIGHT DECK. Back on the ground sends somebody here for one
     place — a thread, the ask composer, the right seat, Discover or a person's
     profile — and the room opens straight to it, once, then hands it back. */
  useEffect(() => {
    if (!intent) return;
    if (intent.kind === "thread") go({ kind: "module", id: intent.moduleCode, thread: intent.threadId });
    else if (intent.kind === "ask") {
      go({ kind: "module", id: intent.moduleCode });
      setSt((s) => ({ ...s, asking: true, thread: null }));
      setView("thread");
    } else if (intent.kind === "seat") go({ kind: "seats" });
    else if (intent.kind === "discover") go({ kind: "discover" });
    else if (intent.kind === "person" && intent.id) setProfileOf(personOf(intent.id));
    onIntentUsed?.();
  }, [intent]);

  /* A shared link: /ready-room/<module>/<question> opens that question. */
  useEffect(() => {
    if (routeThreadId && activeModuleCode) go({ kind: "module", id: activeModuleCode, thread: routeThreadId });
  }, [routeThreadId, activeModuleCode]);

  /* --------------------------------------------------------------- asking */
  const ask = () => { setSt((s) => ({ ...s, asking: true, thread: null })); setView("thread"); };
  const cancelAsk = () => setSt((s) => ({ ...s, asking: false, thread: keepSelection(list, null) }));

  /* ------------------------------------------------------------ the motion
     THE PANE MOVES THE WAY YOU MOVED. These wrap the four changes a person
     makes with their own hand — the rail, a question, Ask and Cancel — in a
     pane transition, and only those: the effects above call go and select
     directly, so a room loading its data or honouring a link never animates.
     Down the rail, or on to a later question, arrives from the right; up, or
     back to an earlier one, from the left. A change between two questions in
     one module moves only the question column, so the feed you chose from
     holds still. */
  const railRank = (c) => {
    if (c.kind === "module") return modules.findIndex((m) => (m.code || m.id) === c.id);
    if (c.kind === "squad") return 100 + squadronsWithPresence.findIndex((s) => s.id === c.id);
    return c.kind === "seats" ? 1000 : 2000;
  };
  const openPane = (next) => {
    const same = next.kind === st.kind && (next.id ?? null) === (st.id ?? null) && !next.thread;
    if (same) { go(next); return; }
    paneTransition(railRank(next) >= railRank(st) ? "paneR" : "paneL", () => go(next));
  };
  const selectThread = (id, opts) => {
    if (id === st.thread && !st.asking) { select(id, opts); return; }
    const from = list.findIndex((t) => t.id === st.thread);
    const to = list.findIndex((t) => t.id === id);
    paneTransition(to >= from ? "paneR" : "paneL", () => select(id, opts), { scope: "detail" });
  };
  const askPane = () => paneTransition("paneR", ask, { scope: "detail" });
  const cancelAskPane = () => paneTransition("paneL", cancelAsk, { scope: "detail" });
  /* BACK, on a room narrow enough to take turns: from a question to its list,
     or from the list to the rail. It used to cut, which on a phone is every
     second press in the room. */
  const backPane = () => {
    const toList = view === "thread" && window.innerWidth <= 1180;
    const toRail = !toList && narrow() && view !== "rail";
    if (!toList && !toRail) { back(); return; }
    paneTransition("paneL", back, { scope: toList ? "detail" : "pane" });
  };
  const postQuestion = ({ title, body }) => {
    onPost?.({ kind: "thread", moduleId: modCode, title, body });
    setPendingAsk({ moduleId: modCode, title });
    setSt((s) => ({ ...s, asking: false, filter: "all" }));
    say("Posted");
  };
  /* Posting unshifts the question into the module and selects it. App makes
     the row, so it is picked out by who asked it and what it says. */
  useEffect(() => {
    if (!pendingAsk) return;
    const made = threads
      .filter((t) => t.moduleId === pendingAsk.moduleId && t.authorId === me && (t.title || "").trim() === pendingAsk.title)
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0];
    if (!made) return;
    setSt((s) => (s.kind === "module" && s.id === pendingAsk.moduleId ? { ...s, thread: made.id } : s));
    setPendingAsk(null);
  }, [threads, pendingAsk, me]);

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

  useEffect(() => {
    if (st.kind !== "discover" || !me) return undefined;
    let live = true;
    discoverSquadrons(me, discoverFilter).then((r) => { if (live) setRooms(r || []); });
    return () => { live = false; };
  }, [st.kind, discoverFilter, me]);

  /* Scores on the questions in the module you are looking at, one round trip
     per module rather than one for every thread in the app. */
  useEffect(() => {
    const ids = modThreads.map((t) => t.id);
    if (!ids.length || !me) return undefined;
    let live = true;
    fetchThreadVotes(ids, me).then((v) => { if (live) setThreadVotes((s) => ({ ...s, ...v })); });
    return () => { live = false; };
  }, [modThreads, me]);

  useEffect(() => {
    if (!me) return undefined;
    let live = true;
    fetchFlightLog(me).then((r) => { if (live) setFlightLog(r || []); });
    return () => { live = false; };
  }, [me]);

  /* -------------------------------------------------------------- receipts */
  /* The ticks on MY messages in the chat that is open: read when it opens, when
     a message of mine lands, when anyone's receipt changes, and on a slow clock
     in case the socket is down. A sequence number stops a slow answer landing
     on top of a newer one. */
  const myIds = useMemo(() => (squadron
    ? messages.filter((m) => m.squadronId === squadron.id && m.authorId === me && !m.deletedAt && !m.pending)
      .map((m) => m.id).slice(-200).join(",")
    : ""), [messages, squadron?.id, me]);
  const loadReceipts = useCallback(async () => {
    const ids = myIds ? myIds.split(",") : [];
    const seq = ++receiptSeq.current;
    const r = ids.length ? await fetchReceipts(me, ids) : {};
    if (seq === receiptSeq.current) setReceipts(r);
  }, [myIds, me]);
  useEffect(() => {
    if (!squadron) return undefined;
    loadReceipts();
    const stop = listen(LIVE_TABLES.receipts, () => loadReceipts());
    const t = setInterval(() => { if (document.visibilityState === "visible") loadReceipts(); }, 20000);
    return () => { stop(); clearInterval(t); };
  }, [squadron?.id, loadReceipts]);

  const openInfo = useCallback((message, anchor) => {
    setInfo((cur) => (cur?.message.id === message.id ? null : { message, anchor }));
  }, []);
  const closeInfo = useCallback(() => setInfo(null), []);

  /* --------------------------------------------------------- the right seat */
  const loadSeat = useCallback(async () => {
    if (!me) return;
    const [s, r] = await Promise.all([fetchSeat(me), fetchSeatRequests(me)]);
    setSeat(s);
    setSeatReq(r || EMPTY_REQ);
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

  /* The partner moved. A bubble, never a page change — nobody is followed. */
  const lastPlace = useRef(null);
  useEffect(() => {
    if (!seat?.partnerPlace) return;
    if (lastPlace.current && lastPlace.current !== seat.partnerPlace) setSeatInvite({ label: seat.partnerPlace });
    lastPlace.current = seat.partnerPlace;
  }, [seat?.partnerPlace]);

  const faces = useMemo(
    () => seatFaces({ seatPartner: seat?.partnerId || null, flightLog, mates, online }),
    [seat?.partnerId, flightLog, mates, online]);

  /* ------------------------------------------------------------- typing */
  useEffect(() => {
    if (st.kind !== "squad" || !st.id || !me) { setTyping([]); return undefined; }
    const ch = typingChannel(st.id, me, setTyping);
    typingRef.current = ch;
    return () => { ch.stop(); typingRef.current = null; setTyping([]); };
  }, [st.kind, st.id, me]);

  const onDraft = (v) => {
    setDraft(v);
    const now = Date.now();
    if (v && now - lastPing.current > 900) { lastPing.current = now; typingRef.current?.ping(); }
  };

  /* --------------------------------------------------------------- sources */
  const sourceOf = useCallback((t) => {
    if (!t?.lessonId) return null;
    let n = null;
    let title = null;
    for (const c of chapters) {
      const i = (c.lessons || []).findIndex((l) => l.id === t.lessonId);
      if (i >= 0) { n = i + 1; title = c.lessons[i].title || null; break; }
    }
    const short = n ? `Lesson ${n}` : "Lesson";
    return { kind: "lesson", short, label: t.t != null ? `${short} · ${mmss(t.t)}` : short, title };
  }, [chapters]);

  /* ---------------------------------------------------------------- writes */
  const send = async () => {
    const body = draft.trim();
    const attached = st.kind === "squad" ? pending : [];
    /* Text OR attachments: a photo on its own is a message. */
    if ((!body && !attached.length) || sending || st.kind !== "squad") return;
    setSending(true);
    onPost?.({ kind: "message", squadronId: st.id, body, replyTo, pending: attached, onFail: say });
    setReplyTo(null);
    setPending([]);
    setDraft("");
    setSending(false);
  };

  /* Files are checked here, before anything is spent: the type, the size, and
     no more than ten on one message. A photo gets its pixel size read now so its
     bubble can reserve the right space, and a local URL so it shows the moment
     it is sent rather than after it uploads. */
  const attachFiles = async (files, kind) => {
    const next = [];
    for (const file of Array.from(files)) {
      if (pending.length + next.length >= MAX_PER_MESSAGE) {
        say(`Up to ${MAX_PER_MESSAGE} attachments on one message.`);
        break;
      }
      const problem = validateFile(file, kind);
      if (problem) { say(problem); continue; }
      const isImage = file.type.startsWith("image/");
      const size = isImage ? await readImageSize(file) : {};
      next.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        kind: isImage ? "image" : "file", file, ...size,
        localUrl: isImage ? URL.createObjectURL(file) : null,
      });
    }
    if (next.length) setPending((p) => [...p, ...next]);
  };
  const attachPassage = (mark) => {
    if (pending.length >= MAX_PER_MESSAGE) { say(`Up to ${MAX_PER_MESSAGE} attachments on one message.`); return; }
    if (pending.some((p) => p.kind === "passage" && p.markId === mark.id)) return;
    setPending((p) => [...p, {
      id: `passage-${mark.id}`, markId: mark.id, kind: "passage",
      paperId: mark.paperId, paperTitle: mark.paperTitle, page: mark.page,
      quote: mark.quote, anchor: mark.anchor ?? null,
    }]);
  };
  const removePending = (i) => setPending((p) => {
    const gone = p[i];
    if (gone?.localUrl) URL.revokeObjectURL(gone.localUrl);
    return p.filter((_, n) => n !== i);
  });
  const wantMarks = async () => {
    const sq = squadrons.find((x) => x.id === st.id);
    if (marks !== null || marksLoading || !sq?.moduleCode) return;
    setMarksLoading(true);
    setMarks(await fetchMyMarks(me, sq.moduleCode));
    setMarksLoading(false);
  };
  /* A different conversation starts with nothing pending and asks for its own
     module's marks. */
  const chatId = st.kind === "squad" ? st.id : null;
  useEffect(() => {
    setPending((p) => { p.forEach((x) => x.localUrl && URL.revokeObjectURL(x.localUrl)); return []; });
    setMarks(null);
  }, [chatId]);

  const setSheet = useCallback((on) => setSt((s) => ({ ...s, sheet: on })), []);

  const react = async (messageId, emoji) => {
    await toggleReaction(me, messageId, emoji);
    onRefresh?.("chat");
  };

  /* onRefresh is a new function on every App render, so it is read through a
     ref. A callback that changed identity with it re-fired the chat's
     mark-as-read effect after every refresh: eight calls for one open,
     measured in the harness. */
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const seen = useCallback(async (squadronId) => {
    await markSquadronRead(me, squadronId);
    refreshRef.current?.("squadrons");
  }, [me]);

  const share = (t) => {
    const url = `${window.location.origin}${routePath.ready(t.moduleId, t.id)}`;
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

  const voteQuestion = async (id, dir) => {
    const mine = await voteThread(me, id, dir);
    setThreadVotes((v) => {
      const was = v[id] || { score: 0, mine: 0 };
      return { ...v, [id]: { score: was.score - was.mine + mine, mine } };
    });
  };

  const askSeat = async (them) => {
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
      { id: "reply", icon: <CornerUpLeft aria-hidden="true" />, label: "Reply", run: () => setReplyTo(m.id) },
      { id: "react", icon: <SmilePlus aria-hidden="true" />, label: "React with 👍", run: () => react(m.id, "👍") },
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
    if (!anchor) return;
    if (payload.message) { setMenu({ anchor, items: messageMenu(payload.message) }); return; }
    if (payload.thread && !payload.answer) {
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

  /* Where I am, told to the right seat as the room moves. */
  useEffect(() => {
    if (!seat) return;
    const t = st.kind === "module" ? modThreads.find((x) => x.id === st.thread) : null;
    const label = squadron ? squadron.name : t ? titleOf(t) : mod ? `${modCode} questions` : "The Ready Room";
    onPlace?.(modCode, label);
  }, [seat, squadron, mod, st.thread, onPlace]);

  /* ------------------------------------------------------------- the keys */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (menu || profileOf || sheetOf || creating) return;
      if (e.key === "Escape") {
        if (info) { setInfo(null); return; }
        if (st.sheet) { setSheet(false); return; }
        if (st.asking) { cancelAsk(); return; }
        backPane();
        return;
      }
      if (st.kind !== "module" || !list.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const id = moveSelection(list, st.asking ? null : st.thread, e.key === "ArrowDown" ? 1 : -1);
        setSt((s) => ({ ...s, asking: false, thread: id }));
        return;
      }
      if (e.key === "Enter") {
        if (!e.target.closest?.("button, a, [role='button']")) setView("thread");
        return;
      }
      if (e.key === "f" || e.key === "F") setLayout({ ...layout, wide: !layout.wide });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [info, st, list, layout, view, menu, profileOf, sheetOf, creating, setLayout, setSheet, focusSearch]);

  const myPlace = squadron ? squadron.name : mod ? `${modCode} questions` : "The Ready Room";

  return (
    <div className="rr" ref={rootRef} data-view={view} data-wide={layout.wide ? "1" : undefined}
         style={layout.fw ? { "--fw": layout.fw } : undefined}>
      <h1 className="room-h1">Ready Room</h1>

      <div className="rr-app">
        <Rail me={me} onHome={onHome} query={query} onQuery={onQuery} searchRef={searchRef}
              squadrons={squadronsWithPresence} modules={modules} threads={threads} replies={replies}
              messages={messages} foundPeople={foundPeople} faces={faces}
              cur={{ kind: st.kind, id: st.id }} who={who} onOpen={openPane}
              onSeeSeats={() => openPane({ kind: "seats" })} onFindSquadron={() => openPane({ kind: "discover" })}
              onProfile={(id, row) => setProfileOf(row
                ? { user_id: row.user_id, callsign: row.display_name, module_code: row.module_code, hue: hueFor(row.user_id) }
                : personOf(id))} />

        <main className="rr-pane" aria-label="Conversation">
          {st.kind === "module" && mod && (
            <Threads me={me} mod={mod} all={modThreads} list={list} replies={replies}
                     votes={threadVotes} saved={saved}
                     filter={st.filter} onFilter={onFilter} query={query} onFocusSearch={focusSearch}
                     threadId={st.asking ? null : st.thread} onSelect={selectThread} onAsk={askPane} onBack={backPane}
                     rootRef={rootRef} layout={layout} onLayout={setLayout}
                     who={who} source={sourceOf} onVote={voteQuestion} onSave={(id) => onSave?.(id)} onShare={share}
                     detail={{
                       asking: st.asking, onPostQuestion: postQuestion, onCancelAsk: cancelAskPane, replyVotes: votes,
                       onVoteReply: (id, on) => onVote?.(id, on),
                       onSign: (tid, aid) => onBest?.(tid, aid),
                       onAnswer: (ev) => onPost?.({ kind: "reply", ...ev }),
                       onOpenSource: (t) => onOpenLessonAt?.(t),
                       onProfile: (id) => setProfileOf(personOf(id)),
                       onMenu,
                     }} />
          )}
          {st.kind === "module" && !mod && <div className="rr-dempty">Pick a module from the list.</div>}

          {st.kind === "squad" && squadron && (
            <Chat me={me} squadron={squadron} messages={messages} receipts={receipts} typing={typing} who={who}
                  draft={draft} onDraft={onDraft} onSend={send} sending={sending}
                  replyTo={replyTo} onReplyTo={setReplyTo}
                  pending={pending} onRemovePending={removePending}
                  onAttachFiles={attachFiles} onAttachPassage={attachPassage}
                  marks={marks || []} marksLoading={marksLoading} onWantMarks={wantMarks}
                  sheet={st.sheet} onSheet={setSheet} onBack={backPane}
                  onInfoSheet={() => setSheetOf(squadron)} onFocusSearch={focusSearch}
                  onProfile={(id) => setProfileOf(personOf(id))} onMenu={onMenu} onReact={react}
                  onSeen={seen} jumpTo={jumpTo} onMessageInfo={openInfo}
                  onOpenPassage={(a) => onOpenPaper?.(squadron.moduleCode, a.paperId, a.anchor)}
                  onOpenImage={(url) => window.open(url, "_blank", "noopener")} />
          )}
          {st.kind === "squad" && !squadron && <div className="rr-dempty">Pick a squadron from the list.</div>}

          {st.kind === "seats" && (
            <Seats me={me} seat={seat} requests={seatReq} mates={mates} flightLog={flightLog} online={online}
                   squadrons={squadronsWithPresence} who={who} onBack={backPane} onAsk={askSeat}
                   onCancelAsk={async (id) => { await cancelRightSeat(me, id); await loadSeat(); }}
                   onAnswer={async (id, accept) => {
                     await answerRightSeat(me, id, accept);
                     await loadSeat();
                     say(accept ? "You have a copilot." : "Declined.", accept ? <Check aria-hidden="true" /> : null);
                   }}
                   onEnd={async () => { await endRightSeat(me); await loadSeat(); say("Right seat cleared"); }}
                   onProfile={(id) => setProfileOf(personOf(id))}
                   session={{
                     myPlace, invite: seatInvite,
                     onDismissInvite: () => setSeatInvite(null),
                     onFollowInvite: () => { setSeatInvite(null); say("Opening what they opened"); },
                     messages: seatMessages, draft: seatDraft, onDraft: setSeatDraft,
                     onSend: async () => {
                       const body = seatDraft.trim();
                       if (!body || !seat) return;
                       const row = await postSeatMessage(me, seat.sessionId, body);
                       if (row) setSeatMessages((m) => [...m, row]);
                       setSeatDraft("");
                     },
                     onKeep: async (id, on) => {
                       await keepSeatMessage(id, on);
                       setSeatMessages((m) => m.map((x) => (x.id === id ? { ...x, kept: on } : x)));
                       say(on ? "Kept — it survives the landing" : "No longer kept");
                     },
                   }} />
          )}

          {st.kind === "discover" && (
            /* The old room's Discover, styled by room.css. `.room` here is a
               box-less bridge (rr-app.css) so its rules still match. */
            <div className="room">
              <Discover
                rooms={rooms} filter={discoverFilter} onFilter={setDiscoverFilter}
                who={who} onBack={backPane}
                onJoin={async (room) => {
                  /* ONE DOOR. The function decides capacity, blocks and policy, and
                     the card renders whichever word comes back. */
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
            </div>
          )}
        </main>
      </div>

      {info && (
        <SeenPanel message={info.message} anchor={info.anchor} who={who} onClose={closeInfo}
                   receipts={receiptsFor(receipts[info.message.id] || [])} />
      )}

      {/* The sheets, the menu and the toast are the old room's, through the same bridge. */}
      <div className="room">
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
          onAskRightSeat={(p) => askSeat(p.user_id)}
          onOpenChat={(p) => {
            const s = squadrons.find((x) => (x.members || []).includes(p.user_id)
              && (x.members || []).includes(me));
            setProfileOf(null);
            if (s) go({ kind: "squad", id: s.id });
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
            if (st.kind === "squad" && st.id === s.id) go({ kind: "module", id: firstModule });
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
            go({ kind: "squad", id });
            say("Created. Share the link to fill it.", <Users aria-hidden="true" />);
          }}
        />

        {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
        <Toast message={toast?.message} icon={toast?.icon} />
      </div>
    </div>
  );
}
