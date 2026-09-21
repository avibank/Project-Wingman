import "./styles/foundations.css";
import "./styles/fonts.css";
import "./styles/app.css";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useUser } from "./lib/clerk.js";
import { useLocation, useNavigate } from "react-router-dom";
import TransitionRouter, { popHandler } from "./components/TransitionRouter.jsx";
import { flushSync } from "react-dom";
import { parseRoute, path as routePath } from "./lib/routes.js";
import { titleForRoute, useDocumentTitle } from "./lib/title.js";
import { FLY_SOLO_KEY, mirrorFlySolo } from "./lib/flySolo.js";
import { demoOn, DEMO_LIVERY, DEMO_VARIANT, DEMO_FINISH, DEMO_PAPERS } from "./lib/demoFixture.js";
/* The pause switch, up here because the CHUNK map below is built from it. */
import { papersOn, useFlags } from "./lib/flags.js";
import { examLock, useExamLock } from "./lib/examLock.js";
/* A CHUNK THAT VANISHED UNDER YOU, and why this wrapper exists.
 *
 * Every route below is code-split and the built filenames carry a content
 * hash, so a deploy replaces them all. A tab left open across one then asks
 * for a chunk that no longer exists on the server: the import rejects,
 * React.lazy throws, the route boundary catches it, and the person is told
 * that something went wrong and to reload the page.
 *
 * Reloading IS the right repair — it fetches the new manifest — which is
 * exactly why the app should do it rather than ask. The guard is a session
 * flag so a chunk that is genuinely broken cannot put the tab in a reload
 * loop: the first failure reloads, a second one is allowed through to the
 * boundary, which is the case where something really is wrong. App clears the
 * flag once it has mounted successfully.
 *
 * The promise returned on the reload path never settles, deliberately. The
 * page is going away; resolving would render a component from the old build
 * into a tree that is about to be thrown out.
 */
/* The fallback timer, which is not the mechanism any more.

   A socket tells the app the moment somebody posts — see lib/live.js. This is
   what runs when that socket is not up: on a network that blocks websockets, in
   the seconds before it connects, or if it drops. Five seconds while it is
   down, a slow minute while it is up, because a listener that is working needs
   a safety net rather than a second opinion.

   Twenty seconds used to be the mechanism, and twenty seconds is not live to
   anybody standing next to the person who just typed. They look, nothing is
   there, and they refresh — which is exactly what was reported. */
const POLL_WHEN_LIVE_MS = 60000;
const POLL_WHEN_DOWN_MS = 5000;

const CHUNK_RELOADED = "pw-chunk-reloaded";
const chunk = (factory) => () => factory().catch((err) => {
  let already = true;
  try { already = sessionStorage.getItem(CHUNK_RELOADED) === "1"; } catch { /* private mode */ }
  if (already) throw err;
  try { sessionStorage.setItem(CHUNK_RELOADED, "1"); } catch { /* ignore */ }
  window.location.reload();
  return new Promise(() => {});
});

/* THE IMPORT THUNKS, NAMED. A navigation needs to be able to WARM the chunk it
   is about to show before the transition starts — see warmRoute in the shell.
   Declared once and used twice: lazy() takes them here, go() calls them
   directly. */
const CHUNK = {
  notFound: chunk(() => import("./components/NotFound.jsx")),
  chapters: chunk(() => import("./components/ChaptersPanel.jsx")),
  // §6 — its own chunk. An invite link is very often a cold first load on a
  // phone, so it should not drag the whole Ready Room down the wire to render
  // one room name and one button.
  invite: chunk(() => import("./components/room/InviteLanding.jsx")),
  modules: chunk(() => import("./components/ModulesPage.jsx")),
  moduleHub: chunk(() => import("./components/ModuleHub.jsx")),
  module: chunk(() => import("./components/module/ModuleScreen.jsx")),
  lesson: chunk(() => import("./components/module/LessonPage.jsx")),
  // Its own chunk, and it matters more here than anywhere else: pdf.js is the
  // largest thing this app has ever depended on, and nobody who never opens a
  // paper should pay a byte of it. check:bundle is the gate that says so.
  /* PAUSED. `papersOn` is a build-time constant, so with papers off this
     folds to null and the import() goes with it — the reader's chunk and
     pdf.js are not built, not prefetched and not fetched. Turning the
     variable on puts the line back exactly as it was. */
  paper: papersOn ? chunk(() => import("./components/paper/v6/ReaderV6.jsx")) : null,
  /* Adding a paper runs the whole ingest — pdf.js, the text layer, thumbnail
     rendering — so it is lazy for the same reason the reader is: nobody who is
     not adding a paper should pay a byte of it. check:bundle caught this as a
     428KB regression on first paint when it was a static import. */
  addPaper: papersOn ? chunk(() => import("./components/module/AddPaper.jsx")) : null,
  quiz: chunk(() => import("./components/module/QuizPage.jsx")),
  dev: chunk(() => import("./components/DevPanel.jsx")),
  pdf: chunk(() => import("./components/PdfPanel.jsx")),
  roomShell: chunk(() => import("./components/room/ReadyRoom.jsx")),
  profile: chunk(() => import("./components/Profile.jsx")),
  /* THE VIEWER, and it is not the reader. Its own chunk, because pdf.js is
     the largest thing this app depends on and nobody who never opens a paper
     should pay a byte of it — the same reason the reader had one. */
  viewer: chunk(() => import("./components/paper/viewer/PaperViewer.jsx")),
  /* Clerk's own account UI, behind the two buttons that were dead. Large, and
     nobody who never presses them should pay for it. */
  account: chunk(() => import("./components/AccountPortal.jsx")),
  progress: chunk(() => import("./components/ProgressPage.jsx")),
  /* Bookmarks and the card set come out of one chunk: they share the store,
     the adapter, the study pad and the whole stylesheet, so splitting them
     would download most of it twice. */
  bookmarks: chunk(() => import("./features/bookmarks/screens.jsx")),
};
/* WHICH CHUNKS EACH ROUTE RENDERS, exactly. A route missing from here, or
   missing one of its chunks, is a route whose first visit loads its code
   INSIDE the transition rather than before it. `chapter` is two screens: the
   quiz tab is QuizPage and every other tab is ModuleHub, so it warms both.
   `paper` was not here at all, so opening a paper fetched the reader — the
   largest chunk this app has — behind a frozen snapshot. */
const ROUTE_CHUNKS = {
  module: [CHUNK.module],
  chapter: [CHUNK.quiz, CHUNK.moduleHub],
  lesson: [CHUNK.lesson],
  paper: [CHUNK.viewer, ...(papersOn ? [CHUNK.paper] : [])],
  review: [CHUNK.module],
  ready: [CHUNK.roomShell],
  modules: [CHUNK.modules],
  profile: [CHUNK.profile],
  clerk: [CHUNK.account],
  logbook: [CHUNK.progress],
  bookmarks: [CHUNK.bookmarks],
  cards: [CHUNK.bookmarks],
  notfound: [CHUNK.notFound],
};
const warmChunks = (name) => Promise.all((ROUTE_CHUNKS[name] || []).map((f) => f())).catch(() => {});

/* WARM ON INTENT, NOT ON CLICK. A pointer coming to rest on a module card, a
   focus landing on a lesson row, a thumb touching the Ready Room pill: each is
   the best hint there is of the next navigation, and it arrives a few hundred
   milliseconds before the click does. The chunk that click will need is
   fetched then, so by the time the click lands it is a settled promise and the
   transition starts at once rather than after a download. Each place is warmed
   once; import() caches the rest. */
const INTENT = [
  [".mod[data-code], .tabs button", "module"],
  [".kids .item[data-lesson], .next-title", "lesson"],
  [".kids .item:not([data-lesson]), .libwrap .item", "chapter"],
  ['section[aria-labelledby="lsec-papers"] .item', "paper"],
  [".rrpill", "ready"],
  ['.avbtn, [role="menuitem"]', "profile"],
  ['[role="menuitem"]', "settings"],
];
/* WHICH MODULE A MOVE IS ABOUT. Opening one, it is the module being opened;
   coming back out, the one being left. It is the same card either way, which
   is what lets it be one object across the two screens (nameMorph). */
const morphOf = (kind, fromRoute, to) =>
  kind === "morph" ? (parseRoute(to).moduleCode || null)
    : kind === "morphBack" ? (fromRoute?.moduleCode || null)
      : null;

const warmedOnIntent = new Set();
function warmOnIntent(e) {
  const el = e.target?.closest?.('button, a, [role="menuitem"]');
  if (!el) return;
  for (const [sel, name] of INTENT) {
    if (warmedOnIntent.has(name) || !el.matches(sel)) continue;
    warmedOnIntent.add(name);
    warmChunks(name);
  }
}

const NotFound = lazy(CHUNK.notFound);
import { engineLivery, deckVars, DEFAULT_LIVERY, RETIRED_TO_FINISH } from "./lib/liveryEngine.js";
import { finishVars, ruledLayer, offeredFinish } from "./lib/finishEngine.js";
import { fetchAllPresence, heartbeat } from "./lib/presence.js";
import { listen, LIVE_TABLES } from "./lib/live.js";
import { useDisplayName } from "./lib/identity.js";
import { ChevronRight, Lock, Plane } from "lucide-react";
const ChaptersPanel = lazy(CHUNK.chapters);
import Home from "./components/Home.jsx";
const InviteLanding = lazy(CHUNK.invite);
const ModulesPage = lazy(CHUNK.modules);
import RootNav from "./components/RootNav.jsx";
import RunwayLights from "./components/RunwayLights.jsx";
import Deck from "./components/Deck.jsx";
const ModuleHub = lazy(CHUNK.moduleHub);
import { MODULE_TABS } from "./components/module/ModuleScreen.jsx";
const ModuleScreen = lazy(CHUNK.module);
const LessonPage = lazy(CHUNK.lesson);
const ReaderV6 = papersOn ? lazy(CHUNK.paper) : null;
const AddPaper = papersOn ? lazy(CHUNK.addPaper) : null;
const QuizPage = lazy(CHUNK.quiz);
import { moduleByCode, chaptersFor, papersFor, allModules, loadTestContent } from "./components/module/moduleContent.js";
const DevPanel = lazy(CHUNK.dev);
import RouteError from "./components/RouteError.jsx";
import ReportProblem from "./components/ReportProblem.jsx";
const PdfPanel = lazy(CHUNK.pdf);
import ProfileMenu from "./components/ProfileMenu.jsx";
import ReadyRoomPill from "./components/ReadyRoomPill.jsx";
const ReadyRoomShell = lazy(CHUNK.roomShell);
const Profile = lazy(CHUNK.profile);
const AccountPortal = lazy(CHUNK.account);
const PaperViewer = lazy(CHUNK.viewer);
const ProgressPage = lazy(CHUNK.progress);
const BookmarksScreens = lazy(CHUNK.bookmarks);
/* The bag sits in the Flight Deck's instrument strip, which is on the first
   screen — so it is NOT lazy, and it is deliberately the only part of the
   feature that is not. It is one SVG and a count. */
import { FlightBag } from "./features/bookmarks/deck.js";
import { BookmarksToastHost } from "./features/bookmarks/Toast.jsx";
import { provideNav } from "./features/bookmarks/nav.jsx";
import { provideContent, providePapers } from "./features/bookmarks/content.js";
import { initials } from "./lib/familiar.js";
import "./components/manual-stencil.css";
import { askForLicence, licenceAsked } from "./lib/licenceAsk.js";
import { supabase } from "./lib/supabaseClient.js";
import { demoMode, demoState, enterDemo, leaveDemo, enterGuestDemo, walkthroughSeen, markWalkthroughSeen } from "./demo/mode.js";
import { initSaves, resetSaves, noStudent, addSave, removeSave, findSave,
         subscribe as subscribeSaves, getSnapshot as savesSnapshot } from "./features/bookmarks/savesStore.js";
import { stampOf, stampTilt } from "./lib/stamp.js";
import { SIGNOFF_KEY, sign, unsign, tiltOf } from "./lib/signoff.js";
import PilotSheet from "./components/PilotSheet.jsx";
import { fetchSquadron, fetchRoster } from "./lib/squadron.js";
import { fetchMyCompletions } from "./lib/partners.js";
import { StampFilters } from "./components/Stamp.jsx";
const AuthPage = lazy(() => import("./components/AuthPage.jsx"));
/* The walkthrough is lazy: a student sees it once, and it carries twelve
   drawings nobody else should download. */
/* The demo guide is lazy, and only ever loaded inside the demo. */
const Guide = lazy(() => import("./demo/Guide.jsx"));
import UsernameGate from "./components/UsernameGate.jsx";
import FirstFlightGate from "./components/FirstFlightGate.jsx";
import { MODULES, NAV, TRIVIA } from "./data.js";
import { loadJSON, saveJSON } from "./lib/storage.js";
import { LOGBOOK_KEY, lessonDone, quizTaken } from "./lib/logbookRecord.js";
import { useUserProgress, UserProgressProvider } from "./lib/userProgress.jsx";
import { SessionProvider, useSession } from "./lib/session.jsx";
// Housing is a token block, so it loads once for the whole app rather than
// being pulled in by whichever screen happens to mount first.
import "./components/module/housing.css";
import PlayerLayer from "./components/module/PlayerLayer.jsx";
import { useHobbsMeter } from "./lib/hobbs.js";
import { transitionKind, canTransition, settleDom, withTheme, withSetting,
         beginTransition, endTransition, nameLayers, nameMorph, clearNames, scopeOf,
         screenFlag, markBackdrop } from "./lib/viewTransition.js";
import { PLACE_KEY, placeTarget, pushPlace } from "./lib/lastPlace.js";
import { postModulePost, postReply, removeThread, removeReply } from "./lib/lessonSurface.js";
import {
  RETENTION_KEY, emptyRetention, toHolding, toCaution,
} from "./lib/retention.js";
import Review from "./components/module/Review.jsx";
import { listPapers, fileHref } from "./lib/papers.js";
import { badgeCount, normalisePresence } from "./lib/roomModel.js";
import { readMinimums } from "./lib/minimums.js";
import { fetchReplyVotes, toggleReplyVote, setBestReply } from "./lib/threads.js";
import { fetchMySquadrons, fetchSquadronMessages, postSquadronMessage, deleteMessage, fetchRightSeat, markDelivered } from "./lib/roomData.js";
import { fetchSeat, askRightSeat } from "./lib/rightSeat.js";
import { toAttachment, attachToMessage } from "./lib/attachments.js";
import { fetchProfiles, fetchProfile } from "./lib/squadron.js";
import { reportContent, blockUser } from "./lib/squadron.js";
import { CLERK_WORDS } from "./lib/clerkWords.js";
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} localization={CLERK_WORDS}>
      <UserProgressProvider>
      {/* Session sits above the router on purpose. The one <video> is mounted
          by PlayerLayer inside it, as a sibling of the routed content, so
          navigating never unmounts or re-parents it — re-parenting a video
          restarts playback in every browser, and not restarting it is the
          whole point of the mini player. */}
      <SessionProvider>
      {/* Not BrowserRouter: see TransitionRouter for the two things it does
          differently, and why every screen change in the app depends on both. */}
      <TransitionRouter>
        <AppInner />
      </TransitionRouter>
      </SessionProvider>
      </UserProgressProvider>
    </ClerkProvider>
  );
}
// Loading, as one shape rather than a spinner. It carries the page's own
// gutters and rhythm so the layout does not jump when the real thing arrives.
function PageSkeleton() {
  return (
    <main className="content content-taxi" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      <div className="skel skel-line short" />
      <div className="skel skel-block" />
      <style>{`
        .skel { background: var(--raised); border-radius: 7px; opacity: .55;
          animation: skelpulse 1.4s ease-in-out infinite; }
        .skel-title { height: 38px; width: min(58%, 320px); margin: 26px 0 18px; }
        .skel-line { height: 14px; width: min(76%, 520px); margin-bottom: 11px; }
        .skel-line.short { width: min(48%, 340px); }
        .skel-block { height: 210px; margin-top: 26px; }
        @keyframes skelpulse { 0%,100% { opacity: .55 } 50% { opacity: .3 } }
        @media (prefers-reduced-motion: reduce) { .skel { animation: none } }
      `}</style>
    </main>
  );
}

function AppInner() {
  // The one scroller on the page. Declared first because go() closes over it.
  const deckRef = useRef(null);
  const progress = useUserProgress();
  const { isSignedIn, isLoaded: clerkLoaded, user } = useUser();
  const { flags, isAdmin } = useFlags();
  // §2.2 — the URL is the navigation state. `view`, `settingsPage`, `tab` and
  // the pending chapter are all derived from it now, so back, deep links and
  // sharing work without any of them being stored twice.
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseRoute(location.pathname);

  /* A silent fall-through to the Flight Deck is worse than "nothing here".
     These routes stay registered, but they say so until they are built — and
     /admin says nothing at all to anyone who is not an admin.
     Computed HERE, above the title, rather than further down where it used to
     sit: the tab has to agree with the page. /logbook was reporting "Logbook ·
     Wingman" while rendering "Wrong bay.", which is a worse bookmark than the
     bare site title it replaced. */
  /* R4 — the bar is locked while a paper is open. One subscription, read here
     so the header below and nothing else has to know where it came from. */
  const examLocked = useExamLock().locked;

  const notFound =
    route.name === "notfound"
    || (route.name === "modules" && !flags["module.interior"])
    || (route.name === "ready" && !flags["social.readyroom"])
    || (route.name === "logbook" && !flags["page.logbook"])
    /* Papers are paused: a paper's address is an ordinary bad URL, decided
       here — above the title and before anything is fetched or imported. */
    /* Papers are reachable while EITHER answers yes. The viewer is the one
       that is on; the paused reader is the one that is not. */
    || (route.name === "paper" && !papersOn && !flags["paper.viewer"]);

  useDocumentTitle(titleForRoute(notFound ? { name: "notfound" } : route));

  // Fly solo is stored with the rest of progress, but the plain functions in
  // lib/ cannot reach the provider and must read it synchronously. Mirror it to
  // storage whenever it changes, including on first load after a sign-in, or
  // those gates would run against a stale value on a new device.
  const flySolo = progress.get(FLY_SOLO_KEY, false);
  useEffect(() => { mirrorFlySolo(flySolo); }, [flySolo]);

  // §2.2 — the renamed paths. vercel.json 308s these at the edge, so this only
  // catches in-app navigation and the dev server; it replaces rather than
  // pushes, or Back would bounce onto the old path and redirect again.
  useEffect(() => {
    if (route.name === "redirect") navigate(route.to, { replace: true });
  }, [route.name, route.to, navigate]);

  // A review flow is a module screen, not the hub. It was left out of this list
  // once and the Flight Deck rendered underneath a perfectly correct URL.
  // A paper is inside a module, like a lesson is. Leaving it out sent the whole
  // route to the Flight Deck: `view === "hub"` is tested before the paper
  // branch in the render, so the deck matched first and the reader never
  // mounted while the browser tab said "Paper".
  // A card set is a chapter's quiz, read as cards, inside the module's Library
  // — so it is a module screen and the hour meter runs on it.
  const MODULE_ROUTES = new Set(["module", "chapter", "lesson", "review", "paper", "cards"]);
  const view = MODULE_ROUTES.has(route.name) ? "module" : "hub";
  const settingsPage =
    route.name === "signin" ? "auth"
    : route.name === "logbook" && flags["page.logbook"] ? "progress"
    : null;
  const tab = route.tab === "pdf" ? "pdf" : "chapters";
  const pendingChapterId = route.chapterId || null;

  // window.scrollTo is a no-op now — the window does not scroll.
  //
  // ONE CHOKE POINT, so the transition layer is wired in one place rather than
  // on every control that navigates. The direction is derived from where this
  // move goes, BEFORE it happens — the prototype read it back off the DOM
  // afterwards, which meant guessing at when React had finished.
  //
  // THE TRANSITION IS DRIVEN HERE, NOT BY THE ROUTER, and that is forced.
  // React Router 7 does take { viewTransition: true } on navigate — but only
  // under the DATA router (createBrowserRouter + RouterProvider). This app
  // mounts a component router, where the option is accepted and silently
  // ignored: verified by hooking document.startViewTransition and watching it
  // never get called while the route changed underneath it.
  //
  // So the transition is started explicitly, and navigate() runs inside
  // flushSync so React has committed the new screen before the browser takes
  // its "after" snapshot. Without flushSync the update is still queued when
  // the snapshot is taken and both frames are the OLD page — an animation
  // between a thing and itself. And flushSync only works because the router is
  // <TransitionRouter>, not <BrowserRouter>: the stock one hands every location
  // change to React.startTransition, which flushSync cannot hurry, so the
  // after-snapshot was still the old page. See TransitionRouter.jsx.
  /* Which chunks a path needs, and a bounded wait for them.
     Keyed on the parsed route name so it cannot drift from the router. The
     bound exists because a click must never feel dead: past it, go() stops
     waiting and starts the transition anyway, and settleDom holds the
     after-snapshot for whatever is still suspended. */
  const warmRoute = async (to) => {
    const needed = ROUTE_CHUNKS[parseRoute(to).name] || [];
    if (!needed.length) return true;          // the deck is not split
    let timer;
    const timeout = new Promise((res) => { timer = setTimeout(() => res(false), 1400); });
    // import() resolves from the module cache after the first call, so this is
    // a settled promise on every visit but the first.
    const loaded = Promise.all(needed.map((f) => f())).then(() => true, () => false);
    const ok = await Promise.race([loaded, timeout]);
    clearTimeout(timer);
    return ok;
  };

  /* The intent listeners — see warmOnIntent. Delegated and passive, so they
     cost one closest() per pointer arrival and nothing per control. */
  useEffect(() => {
    const opts = { capture: true, passive: true };
    const types = ["pointerover", "focusin", "touchstart"];
    for (const t of types) document.addEventListener(t, warmOnIntent, opts);
    return () => { for (const t of types) document.removeEventListener(t, warmOnIntent, opts); };
  }, []);

  /* ONE TRANSITION PATH FOR EVERY NAVIGATION: a click comes through go() below,
     and Back, Forward and a swipe come through the router's pop handler. They
     used to be two different things — go() animated and the browser's own
     buttons cut — which is why history.back() from a module to the deck
     changed the page in a single frame.

     The token, not the attribute: a navigation superseded before it settles
     must not tear down the one that replaced it (see endTransition). Only the
     layer this kind actually moves is named on the old side before the
     snapshot. BOTH PROMISES ARE CAUGHT, because an interrupted transition — a
     second navigation before the first settles — rejects `ready` and
     `finished`, and interruption is normal here.

     flushSync commits the new route inside the callback; that depends on the
     router NOT deferring it into a React transition (see TransitionRouter.jsx).
     settleDom then waits for a Suspense fallback to clear, the scroller
     is reset against the new screen rather than the old one, and whatever just
     mounted takes the same names before the after-snapshot. */
  const runNavigation = (kind, commit, { placeScroll = () => {}, morph = null } = {}) => {
    if (!kind) {
      clearNames();   // nothing will animate, so nothing should stay named
      commit();
      placeScroll();
      return;
    }
    const token = beginTransition(kind);
    const scope = scopeOf(kind);
    nameLayers(scope);
    /* The module this move is about, named on both sides so its card and the
       heading it opens into are one object (see nameMorph). The scroller is
       placed BEFORE the card is named on the new side: on the way back, the
       card it has to land on may be below the fold of the deck. */
    nameMorph(morph);
    const ground = screenFlag();
    const vt = document.startViewTransition(async () => {
      flushSync(commit);
      await settleDom();
      placeScroll();
      nameLayers(scope);
      nameMorph(morph);
      markBackdrop(ground);
    });
    vt.ready?.catch(() => {});
    vt.finished?.catch(() => {}).finally?.(() => { if (endTransition(token)) clearNames(); });
  };

  /* BACK AND FORWARD. The router hands every popstate here before it applies
     it, and it goes through the same path as a click: the kind is worked out
     from where it goes, the chunk it needs is already cached (it was on screen
     a moment ago), and the scroller is left where the browser put it rather
     than reset. A swipe the browser has already animated itself arrives with
     hasUAVisualTransition, and animating it a second time would be a double
     move, so that one is applied plainly. */
  const routeNow = useRef(route);
  routeNow.current = route;
  /* WHERE EACH SCREEN WAS LEFT, and why it matters to more than the scrollbar.
     Coming back to the Flight Deck from a module, the deck used to open at the
     top — so the card the module shrinks back into could be below the fold,
     and the movement ended somewhere off screen. The position is remembered
     when a screen is left and put back INSIDE the transition callback, before
     the card is named, so the after-snapshot is of the deck where the student
     actually left it, with the card in the window. */
  const pathNow = useRef("");
  pathNow.current = location.pathname;
  const scrollMemory = useRef({});
  /* The screen, not the address: the harness and every shared link carry a
     query, and a position filed under "/?uid=x" is not found again from "/". */
  const scrollKey = (to) => String(to || "").split("?")[0] || "/";
  const rememberScroll = (to) => {
    if (deckRef.current) scrollMemory.current[scrollKey(to)] = deckRef.current.scrollTop || 0;
  };
  const restoreScroll = (to, morphCode) => {
    const deck = deckRef.current;
    if (!deck) return;
    deck.scrollTop = scrollMemory.current[scrollKey(to)] || 0;
    if (morphCode) document.querySelector(`.deck .mod[data-code="${morphCode}"]`)?.scrollIntoView({ block: "nearest" });
  };
  /* Where a lesson sits in its chapter — see lessonOrder, defined once the
     content is. A ref, so this handler, registered once, reads the current one. */
  const lessonOrderRef = useRef(() => -1);
  useEffect(() => {
    popHandler.current = (location, apply, { uaAnimated = false } = {}) => {
      const to = `${location.pathname}${location.search || ""}`;
      /* R4 — BACK DOES NOT ABANDON A PAPER. Measured before this: one press of
         the browser's own Back left an open, timed exam and there was no way
         to say so afterwards. The pop has already happened by the time this
         runs, so the exam's address is pushed straight back on and the paper's
         own end-exam dialog is opened instead. Nothing navigates, so nothing
         needs a transition. */
      const lock = examLock();
      if (lock.locked) {
        window.history.pushState(null, "", pathNow.current);
        lock.askEnd?.();
        return;
      }
      /* The move is worked out whatever the motion setting, because where a
         screen opens is not motion: Back returns you where you were with the
         animation off as much as on. Only the transition is gated. */
      const moveKind = transitionKind(routeNow.current, to, { lessonOrder: lessonOrderRef.current });
      const kind = !uaAnimated && canTransition() ? moveKind : null;
      const morph = morphOf(moveKind, routeNow.current, to);
      rememberScroll(pathNow.current);
      runNavigation(kind, apply, { placeScroll: () => restoreScroll(to, morph), morph });
    };
    return () => { popHandler.current = null; };
  }, []);

  const navWait = useRef(0);
  /* `replace` is for a query the screen owns rather than a place: Bookmarks
     writes the module it is showing into ?m=, and one history entry per glance
     at a different module would make Back mean nothing. */
  /* `still` moves without the screen transition: the tutorial has its own (the
     light closing and opening), and a second one photographing the page
     under it was the longest frame of every move between screens. */
  const go = async (to, { keepScroll = false, replace = false, still = false } = {}) => {
    const moveKind = transitionKind(route, to, { lessonOrder: lessonOrderRef.current });
    let kind = canTransition() && !still ? moveKind : null;
    const move = () => { navigate(to, { replace }); };

    // WARM THE CHUNK FIRST, and this is the stutter.
    //
    // Every route is code-split. flushSync cannot render a component whose
    // module has not arrived, so on a cold chunk it committed nothing: measured
    // at the snapshot instant, the path already read /ready-room while the DOM
    // still showed the Flight Deck. The browser then photographed the OLD page
    // as the "after" frame, animated it against itself — no visible change —
    // and the real screen appeared afterwards, outside the transition. That
    // reads exactly as a hitch, a freeze, then a jump.
    //
    // Loading BEFORE the transition rather than inside it matters: inside, the
    // page is frozen behind a snapshot while the network runs. Out here it stays
    // live and interactive. If the chunk is slow the transition is dropped and
    // the navigation is plain — no transition beats a broken one.
    if (kind) {
      /* WARM, BUT NEVER CANCEL ON IT. This used to drop the transition when the
         chunk was slow, and dropping it means a hard cut — so the FIRST visit
         to every code-split route had no motion at all. That is most of the
         app, and it is exactly the "it just refreshes" complaint: the routes a
         person sees for the first time are the ones that cut.

         The bail made sense when it was written. flushSync cannot render a
         suspended component, so without the chunk the browser photographed the
         old page as the after-frame. settleDom solves that properly now by
         waiting for the Suspense fallback to clear INSIDE the transition, and
         it is capped, so the worst case is a bounded freeze rather than a
         missing transition.

         The await stays because it is still worth having: the page is live
         while the chunk arrives out here, and frozen behind a snapshot if it
         arrives in there.

         A WAIT LONGER THAN A BLINK IS SHOWN. The press itself already answered
         (see "the press" in app.css); if the chunk is still on its way 120ms
         later, html[data-nav-wait] draws a thin bar until it lands. Counted, so
         a second click that overtakes the first cannot have its bar taken down
         by the first one finishing. */
      const waiting = ++navWait.current;
      const hint = setTimeout(() => {
        if (waiting === navWait.current) document.documentElement.dataset.navWait = "1";
      }, 120);
      try {
        await warmRoute(to);
      } finally {
        clearTimeout(hint);
        if (waiting === navWait.current) delete document.documentElement.dataset.navWait;
      }
    }

    /* THE SCROLL RESET BELONGS TO THE NEW SCREEN, and it used to run against
       the old one. It sat after this whole block, synchronously after
       startViewTransition returns — and the old snapshot is NOT captured
       inside that call, it is captured at the next rendering step. So the
       reset landed on the old DOM before it was photographed: the page jumped
       to the top, and the transition then animated the jumped image. Since
       .deck is the element carrying wg-content, that is exactly the layer seen
       to jump, and it happened on every navigation away from a scrolled page —
       which is most of them, moving back and forth.
       Inside the callback it applies to the new screen, before the after-
       snapshot, which is what "the new page starts at the top" should mean. */
    const back = moveKind === "back" || moveKind === "morphBack";
    const morph = morphOf(moveKind, route, to);
    const placeScroll = () => {
      if (keepScroll || !deckRef.current) return;
      /* Going back is returning, not arriving: the screen comes back where it
         was left rather than at the top. Everything else starts at the top. */
      if (back) restoreScroll(to, morph);
      else deckRef.current.scrollTop = 0;
    };
    rememberScroll(pathNow.current);

    runNavigation(kind, move, { placeScroll, morph });
  };

  const goSettings = (page) =>
    go(page === "auth" ? routePath.signin()
      : page === "progress" ? routePath.logbook()
      : routePath.bookmarks());
  const goHome = () => go(routePath.home());

  /* ------------------------------------------------------------- BOOKMARKS
     The feature reads the app through three handles rather than reaching into
     it: go() for every navigation (nav.jsx says why), the content adapter, and
     the saves store. All three are fed from here so there is one owner. */
  const goRef = useRef(go);
  goRef.current = go;
  useLayoutEffect(() => { provideNav((to, opts) => goRef.current(to, opts)); }, []);
  // The persisted "active module" is a preference the hero on Home reads.
  // Inside a module the URL wins.
  const [preferredModuleCode, setPreferredModuleCode] = useState(MODULES.find((m) => m.status === "active")?.code || MODULES[0].code);
  const activeModuleCode = route.moduleCode || preferredModuleCode;

  /* WHO IS ACTUALLY HERE.

     Both halves of this were broken, in opposite directions, and the table
     proved it: one row, written 2026-08-25, carrying module code JT — a code
     this app stopped having. Nothing had marked anybody present since.

     The WRITE lived in ChaptersPanel, which is inside ModuleHub, which is the
     fallback that `module.screen` (everyone: true) makes unreachable. So the
     heartbeat was dead code. It lives here now, where every route passes.

     The READ reached the Ready Room as `useTestContent.presence` — six
     invented rows from late August, identical on every device, so the room's
     online faces were demo pilots who could never leave and real people could
     never join. The rows are live now, polled on the same clock as the beat.

     §4.4 — the door warms when people are in there, and only then. */
  const displayName = useDisplayName();
  const [presenceRows, setPresenceRows] = useState([]);
  const onFrequency = presenceRows.length;
  const presenceChapterId = route.chapterId || null;
  useEffect(() => {
    let live = true;
    // A backgrounded tab must not keep somebody standing in the room they
    // walked away from, so the beat skips while hidden and the window expires
    // the row on its own.
    const beat = async () => {
      if (isSignedIn && user?.id && document.visibilityState === "visible") {
        await heartbeat({
          userId: user.id, displayName,
          moduleCode: activeModuleCode, chapterId: presenceChapterId,
        }).catch(() => {});
      }
      const rows = await fetchAllPresence(user?.id).catch(() => []);
      if (live) setPresenceRows(rows || []);
    };
    beat();
    const t = setInterval(beat, 45000);
    // Coming back to the tab beats immediately rather than waiting out the
    // rest of the interval — otherwise returning to a page you left open can
    // leave you invisible for the better part of a minute.
    const onShow = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [user?.id, isSignedIn, displayName, activeModuleCode, presenceChapterId]);

  // §8's second number, read once per render beside the module state it is
  // weighed against. Every lamp in the app — the chapter header, the Library
  // quiz row, the results screen and the Flight Deck launcher — is computed
  // against THIS value, so they cannot disagree.
  const minimums = readMinimums(progress);

  // The meter runs while a module is open, whatever is on screen inside it,
  // and only then — the Flight Deck itself is not time in the module.
  useHobbsMeter(view === "module" ? activeModuleCode : null, progress);

  // Everything the module screen counts from, per account rather than per
  // device — the Flight Deck already promises "pick up at 6:12", and a
  // position that lived on the device could not keep that promise on a phone
  // after a laptop. Completion and playback are separate keys because they
  // are written at different moments: one when a lesson is finished, one
  // continuously while it plays.
  // Fetched only when the flag is on, so the seeded content is a chunk nobody
  // else downloads. Until it arrives the screens fall back to data.js rather
  // than flashing empty.
  const [testContent, setTestContent] = useState(null);
  useEffect(() => {
    if (!flags["content.test"]) { setTestContent(null); return; }
    let live = true;
    /* A failure here has already been retried and, if it can be, answered
       with a reload (moduleContent.js); the screens keep data.js meanwhile. */
    loadTestContent().then((c) => { if (live) setTestContent(c); }).catch(() => {});
    return () => { live = false; };
  }, [flags]);
  const useTestContent = testContent;

  /* AN ADDRESS THAT NO LONGER RESOLVES GOES UP ONE LEVEL, IT DOES NOT GO BLANK.

     A lesson link is the most shared thing in the app — it gets pasted into
     the class group chat and bookmarked — and it names a chapter and a lesson
     that content can outlive: a chapter renumbered, a lesson withdrawn, or a
     module emptied out, which is what happens the day placeholder content is
     cleared and every saved link at once stops pointing at anything.

     The lesson branch below handled that by returning an empty <main>: the
     topbar, the background, and nothing else — no heading, no sentence, no
     way out except the browser's own back button. Measured on three
     viewports; it is the emptiest screen in the app.

     The module is the right place to land. It exists, it is one level up from
     what was asked for, and it has something to say whether or not it has
     content in it yet. `replace`, so Back returns to wherever the link was
     opened from rather than bouncing off the dead address again.

     It waits while a content document is in flight, or it would redirect away
     from a perfectly good lesson during the load that was about to supply
     it. */
  useEffect(() => {
    /* A CHAPTER IS ON THIS LIST TOO, and it was the one this effect missed.
       `/m/m1/M1.01/quiz` returned `<main className="content content--full" />`
       — the same literally-empty page a dead lesson link used to give, on the
       second most shareable address in the app: a quiz is what one student
       sends another. Found by the route sweep, which flags any screen under
       120 characters of text; this one had NONE.

       Every chapter tab goes through it, because /brief and /comments render
       from the same missing chapter. */
    if (!["lesson", "cards", "chapter"].includes(route.name)) return;
    if (flags["content.test"] && !testContent) return;
    const code = route.moduleCode || activeModuleCode;
    const chs = chaptersFor(code, testContent);
    const resolves = route.name === "lesson"
      ? chs.some((c) => c.id === route.chapterId && (c.lessons || []).some((l) => l.id === route.lessonId))
      : route.name === "chapter"
        ? chs.some((c) => c.id === route.chapterId)
        : chs.length >= Number(route.chapter || 0);
    if (!resolves) navigate(routePath.module(code), { replace: true });
  }, [route, testContent, flags, activeModuleCode, navigate]);
  /* Where a lesson sits in its chapter, which is the direction a move between two
     of them travels: a later lesson arrives from the right. */
  const lessonOrder = (r) => (chaptersFor((r?.moduleCode) || activeModuleCode, useTestContent)
    .find((c) => c.id === r?.chapterId)?.lessons || []).findIndex((l) => l.id === r?.lessonId);
  lessonOrderRef.current = lessonOrder;

  // The seeded notes and threads are written into the account once and then
  // owned like anything else — otherwise deleting a seeded note would bring it
  // back on the next reload.
  const { seedFrom, requestWatch, session, setSession, mutate, requestSeek, me, loadDiscussion } = useSession();
  // The ammeter's panel: each chapter's FIRST-attempt score against the pass
  // mark. A retake is labelled as one and does not move the needle, so the
  // panel has to show which figure the needle is actually reading.
  useEffect(() => { if (testContent) seedFrom(testContent); }, [testContent, seedFrom]);
  const moduleState = {
    opened: progress.get("pw-paper-opened", {}),
    done: progress.get("pw-lesson-done", {}),
    pos: progress.get("pw-lesson-pos", {}),
    quiz: progress.get("pw-quiz-scores", {}),
    run: progress.get("pw-quiz-run", {}),
  };

  // The one record of where you actually were, overwritten by whichever
  // surface you are on. The deck's Resume reads it instead of guessing at the
  // chapter that contains the work.
  // The one writer for the question lifecycle. Both counts on the strip derive
  // from this single record, so the tag and the lamp cannot disagree.
  /* ONE ANSWER, OR A WHOLE PAPER, THROUGH THE SAME FOLD.

     recordAnswer reads the retention state, moves one question, and writes it
     back — which is correct exactly once per render. The exam hands in eight
     answers in a single tick, and eight calls all read the SAME pre-render
     state: each one built its patch on the base the last one had, so seven
     were overwritten and one question reached the caution pile out of eight.
     Nothing looked broken — the score was right, the review was right, and
     only "Put right" was quietly almost empty.

     So the fold is the primitive and the single answer is the special case.
     `results` is [questionId, right] pairs, applied in order to one value and
     written once. */
  const recordAnswers = (results, { fromCaution = false } = {}) => {
    if (!results.length) return;
    let next = progress.get(RETENTION_KEY, emptyRetention());
    for (const [questionId, right] of results) {
      next = right ? toHolding(next, questionId, { fromCaution }) : toCaution(next, questionId);
    }
    progress.set(RETENTION_KEY, next);
  };

  const recordAnswer = (questionId, right, opts = {}) =>
    recordAnswers([[questionId, right]], opts);

  const recordPlace = (place) =>
    progress.set(PLACE_KEY,
      pushPlace(progress.get(PLACE_KEY, null), { ...place, moduleCode: activeModuleCode }));

  // Resume goes to the address the place names. A paper has no in-app address
  // — it is the browser's own PDF viewer in another tab — so that one reopens
  // the file rather than routing.
  const resumePlace = (place) => {
    const target = placeTarget(place, routePath);
    if (!target) return;
    /* The same hand-built path as openPaper had, with the same fault: a
       Supabase url came out as `/https://…`. */
    if (target.file) window.open(fileHref(target.file), "_blank", "noopener");
    else go(target.href);
  };

  // Completion and quiz results write TWO things: the flag the screens count
  // from, and an append-only entry in the logbook. Nothing reads the logbook
  // yet — that is the point. A record of what someone did and when is nearly
  // free while it is happening and impossible to reconstruct afterwards, so
  // it is captured now rather than when there is a page for it.
  const recordLessonDone = (lessonId, chapterId) => {
    progress.set("pw-lesson-done", { ...moduleState.done, [lessonId]: true });
    progress.set(LOGBOOK_KEY,
      lessonDone(progress.get(LOGBOOK_KEY, []), lessonId, chapterId, activeModuleCode));
  };
  const recordQuiz = (chapterId, correct, total) => {
    progress.set("pw-quiz-scores", { ...moduleState.quiz, [chapterId]: { correct, total } });
    progress.set(LOGBOOK_KEY,
      quizTaken(progress.get(LOGBOOK_KEY, []), chapterId, activeModuleCode, correct, total));
  };
  const [reduceMotion, setReduceMotion] = useState(false);

  /* WHAT BOOKMARKS KNOWS ABOUT CONTENT, and it is told rather than asking.
     The seeded document is a lazy chunk, so there is a real window in which
     the app is mounted and knows no questions — and a Bookmarks screen that
     answered "gone" during that window would DELETE the student's saves
     (see the three-state note in content.js). A layout effect, so a screen
     mounting in the same commit reads the new value rather than the one
     before it. */
  useLayoutEffect(() => {
    provideContent({
      doc: useTestContent,
      modules: allModules(useTestContent).map((m) => ({ id: m.code, name: m.name })),
      currentModuleId: activeModuleCode,
      smoothAir: reduceMotion,
    });
  }, [useTestContent, activeModuleCode, reduceMotion]);

  // The app got here, so whatever chunk failed last time was a stale deploy
  // rather than a broken build. Clearing the flag re-arms the one-shot reload
  // for the NEXT deploy; leaving it set would mean the next stale chunk went
  // straight to the error boundary.
  useEffect(() => {
    try { sessionStorage.removeItem(CHUNK_RELOADED); } catch { /* private mode */ }
  }, []);

  // The transition layer's own on-switch, stamped once rather than per move.
  // The app's route fade is turned off while this layer is running, and that
  // has to be a STABLE flag: toggling it per navigation restarted the fade the
  // instant each transition ended, which is a flicker at the end of every one.
  useEffect(() => {
    const root = document.documentElement;
    const set = () => {
      if (canTransition()) root.dataset.vtOn = "1";
      else delete root.dataset.vtOn;
    };
    set();
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", set);
    return () => mq?.removeEventListener?.("change", set);
  }, [reduceMotion]);
  const [fontSize, setFontSize] = useState("medium");
  const [livery, setLivery] = useState(DEFAULT_LIVERY);
  const [variantPin, setVariantPin] = useState(null); // §6.3 Night Ops: "day" | "night" | null = Auto
  const [grain, setGrain] = useState(true);
  // A livery is a colour; a finish is a material. null | "aurora" | "manual".
  const [finish, setFinish] = useState(null);
  const [ruled, setRuled] = useState(true);
  const [autoVariant, setAutoVariant] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "night" : "day");
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const sync = () => setAutoVariant(mq.matches ? "night" : "day");
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  // Aurora is a night sky. Rather than falling back to the plain livery in Day —
  // which left a Day control that silently did nothing to the finish — Day is
  // not offered while Aurora is selected, and not reachable if it was already
  // pinned when the finish was chosen.
  const variant = finish === "aurora" ? "night" : (variantPin || autoVariant);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [boarding, setBoarding] = useState(true);
  // onAnimationEnd was the only way out of a full-screen blocking overlay, and
  // a backgrounded tab never runs animations — so opening the app in a tab that
  // is not in front left the boarding pass covering everything, permanently.
  useEffect(() => {
    if (!boarding) return;
    const t = setTimeout(() => setBoarding(false), 2600);
    return () => clearTimeout(t);
  }, [boarding]);
  const [storageWarning, setStorageWarning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollPositions = useRef({});
  const [ticket] = useState(() => ({
    seat: `${Math.ceil(Math.random() * 30)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`,
    gate: String.fromCharCode(65 + Math.floor(Math.random() * 6)) + (Math.floor(Math.random() * 20) + 1),
  }));
  useEffect(() => {
    if (!progress.loaded) return;
    setReduceMotion(progress.get("pw-reduce-motion", false));
    // Read from the device. An account value from before this moved is
    // honoured once, so nobody's existing choice is thrown away — after that
    // the device copy is the only one written.
    setFontSize(loadJSON("pw-font-size", progress.get("pw-font-size", "medium")));
    /* ?fixture=demo pins the one skin the reference and this app share.
       The reference's dark values ARE Sky night, to the decimal, so a pixel
       diff can only measure layout once both sides are wearing it. Dev only:
       demoOn() is constantly false in a production build. */
    const storedLivery = demoOn() ? DEMO_LIVERY : progress.get("pw-livery", DEFAULT_LIVERY);
    setLivery(engineLivery(storedLivery));
    // Aurora was a livery before it was a finish. Someone stored as aurora gets
    // sky plus the aurora finish, so the thing they picked still looks like the
    // thing they picked.
    setFinish(demoOn() ? DEMO_FINISH
      : offeredFinish(progress.get("pw-finish", RETIRED_TO_FINISH[storedLivery] ?? null)));
    setRuled(progress.get("pw-ruled", true));
    setVariantPin(demoOn() ? DEMO_VARIANT : progress.get("pw-variant-pin", null));
    setGrain(progress.get("pw-grain", true));
    setDyslexiaFont(progress.get("pw-dyslexia-font", false));
    setHydrated(true);
  }, [progress.loaded, progress.isSignedIn]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-variant-pin", variantPin);
  }, [variantPin, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-grain", grain);
  }, [grain, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-finish", finish);
  }, [finish, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-ruled", ruled);
  }, [ruled, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-last-tab", tab);
  }, [tab, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-reduce-motion", reduceMotion);
  }, [reduceMotion, hydrated]);
  // Text size is the one setting that stays on the device. A phone and a
  // laptop want different sizes, and syncing that number across both is what
  // people report as "it keeps changing on me". Everything else follows the
  // account. It also drives data-scale on the root, which is where
  // foundations.css picks --sc up from.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON("pw-font-size", fontSize);
    document.documentElement.setAttribute("data-scale", fontSize);
  }, [fontSize, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-dyslexia-font", dyslexiaFont);
  }, [dyslexiaFont, hydrated]);

  useEffect(() => {
    // Detect whether localStorage actually works here (some private-browsing modes block it)
    try {
      localStorage.setItem("pw-storage-check", "1");
      localStorage.removeItem("pw-storage-check");
    } catch {
      setStorageWarning(true);
    }
  }, []);
  // §8 — the badge counts THINGS ADDRESSED TO YOU and nothing else: unread
  // squadron messages, and replies in threads you are part of. Not every new
  // thread in a module you are enrolled in — that lights permanently within a
  // week and teaches everyone to ignore the one attention mechanism there is.
  // Threads you are merely near get the quiet row dot in the sidebar instead.
  // The Ready Room is full-bleed: no topbar above it, the room owns the
  // viewport. Derived once so the header, the shell class and the room's own
  // props cannot disagree about which route is in front of you.
  const roomFull = route.name === "ready" && Boolean(flags["social.readyroom"]);

  /* ------------------------------------------------------ the walkthrough
     THE WALKTHROUGH IS THE DEMO: the real screens, tab by tab, with a class
     already in them, as a separate state of the app (src/demo/mode.js).

     IT OPENS BY ITSELF FOR A VISITOR WHO IS NOT SIGNED IN, whenever they
     arrive, and for nobody else (owner, 2026-09-21). On ANY page, not
     only the Flight Deck: it used to wait for `/`, so a visitor who arrived
     on a module link, or signed out on the Licence, never saw it (measured
     on the live site). Three places are left alone, because the visitor came
     for something specific: signing in, an invite link, and Clerk's account
     screens. Finishing or skipping it keeps it away for the rest of the
     visit (walkthroughSeen, in mode.js), not for good. A signed-in student
     only ever gets it by asking: Replay, at the foot of the Licence. It can
     always be left. */
  const NO_TOUR_ON = new Set(["signin", "invite", "clerk", "notfound", "redirect"]);
  const startDemoRef = useRef(null);
  const guestAsked = useRef(false);
  useEffect(() => {
    if (demoMode || guestAsked.current || !clerkLoaded) return;
    /* `?tour` opens it for anybody, any time: signed out as a visitor,
       signed in as themselves. The one way to show it on a device that has
       already seen it, and a link that can be sent to somebody. */
    const params = new URLSearchParams(location.search || "");
    if (params.has("tour")) {
      guestAsked.current = true;
      params.delete("tour");
      const from = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
      if (isSignedIn) startDemoRef.current?.("replay");
      else enterGuestDemo(from);
      return;
    }
    /* Not over `?diag`: that page is asked for to see the app as it is on
       this device (src/lib/canary.js), and the demo's reload would take it
       away before it had looked. */
    if (isSignedIn || NO_TOUR_ON.has(route.name) || walkthroughSeen() || params.has("diag")) return;
    guestAsked.current = true;
    enterGuestDemo(`${location.pathname}${location.search || ""}`);
  }, [clerkLoaded, isSignedIn, route.name]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* A STUDENT WHO HAS JUST SIGNED UP GOES TO THEIR LICENCE, to choose their
     code and design their stamp. The note is left by the demo's last button
     and by FirstFlightGate when it makes a new profile, which happens after
     a round trip, so this listens as well as looking once. */
  useEffect(() => {
    if (demoMode) return undefined;
    const check = () => {
      if (!isSignedIn || !licenceAsked()) return;
      if (window.location.pathname === routePath.profile("licence")) return;
      go(routePath.profile("licence"));
    };
    check();
    window.addEventListener("pw-licence-ask", check);
    return () => window.removeEventListener("pw-licence-ask", check);
  }, [isSignedIn]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The room renders its own copy of the profile menu, so what the menu does
  // has to live somewhere both can reach rather than being written out twice.
  const goProfile = (page) => {
    /* "Show me around" is not an address — it is a thing that happens on top
       of whatever screen you are on, so it opens the tour rather than
       navigating anywhere. */
    if (page === "tour") { startDemoRef.current?.("replay"); return; }
    if (page === "licence" || page === "preferences" || page === "appearance") go(routePath.profile(page));
    else goSettings(page);
  };


  /* ------------------------------------------------- the room's shared data */
  // The discussion for whichever module is in front of you, from the shared
  // tables. Re-run on the module, so walking between modules loads each one
  // once and keeps what it already had.
  //
  // AND EVERY MODULE ONCE THE ROOM IS OPEN. The room lists all four at the same
  // time, with the last question and a count on each row — but session.threads
  // only ever held the ACTIVE module's rows, so the other three said "Ask the
  // first question" no matter what was in the table. Somebody asking in M2
  // while you were reading M1 had posted into a room that, for you, was empty.
  // loadDiscussion merges per module and leaves the others alone, so asking
  // for all of them is four reads on entry and nothing after.
  //
  // AND ON A CLOCK. This client is PostgREST only — supabaseClient.js keeps
  // realtime out of the bundle on purpose, and says so — so a reply arriving
  // has to be noticed by asking. It was asked exactly once per module entry,
  // which is why an answer needed a refresh to appear and why the badge sat on
  // whatever number it had when the page loaded. Same discipline as the
  // presence beat: nothing while the tab is hidden, and a read the moment it
  // comes back, so a phone in a pocket is not polling all afternoon.
  const roomOpen = route.name === "ready";
  const moduleCodes = useMemo(
    () => allModules(useTestContent).map((m) => m.code).join(","),
    [useTestContent],
  );
  const [liveOn, setLiveOn] = useState(false);
  useEffect(() => {
    if (!loadDiscussion) return undefined;
    const codes = roomOpen ? moduleCodes.split(",") : [activeModuleCode];
    const read = () => { for (const code of codes) loadDiscussion(code); };
    read();

    // The socket. A row landing anywhere in the discussion re-reads the modules
    // this screen is showing — the payload is a doorbell, not a delivery, so
    // there is still exactly one path that turns rows into state.
    const stop = listen(LIVE_TABLES.discussion, read, (status) => {
      setLiveOn(status === "SUBSCRIBED");
    });

    const tick = () => { if (document.visibilityState === "visible") read(); };
    const t = setInterval(tick, liveOn ? POLL_WHEN_LIVE_MS : POLL_WHEN_DOWN_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop();
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [activeModuleCode, loadDiscussion, me, roomOpen, moduleCodes, liveOn]);

  // Squadrons, their chat, and the right seat. These were literal empty arrays
  // — the room drew its own empty states perfectly over nothing at all.
  const [squadrons, setSquadrons] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  const [rightSeat, setRightSeat] = useState([]);
  /* WHO IS IN THE SEAT, which is not the same list as who COULD be — that is
     `rightSeat` above, the candidates the room offers. The lesson page needs
     the person, because §3's logbook draws their questions on this lesson teal
     and offers a filter named after them. Fetched here rather than on the
     lesson so the answer does not change under a student between two lessons
     of the same sitting; Home keeps its own copy because it loads before this
     one exists. */
  const [seat, setSeat] = useState(null);
  /* The room writes things App does not — joining, leaving, muting, creating,
     reactions, pins, read state — and then has to see them. A nonce rather
     than a second copy of the loader: one code path turns rows into state, and
     the room asks it to run again. */
  const [roomNonce, setRoomNonce] = useState(0);
  const refreshRoom = useCallback(() => setRoomNonce((n) => n + 1), []);
  /* A text message from the Flight Deck's squadron card, on the room's own
     optimistic round trip: on screen at once, replaced by the row the insert
     returns, and taken back out if it fails. */
  const postToSquadron = useCallback(({ squadronId, body }) => {
    const text = (body || "").trim();
    if (!text || !me || !squadronId) return;
    const sq = squadrons.find((x) => x.id === squadronId);
    const temp = {
      id: `pending-${Date.now()}`, squadronId, body: text, authorId: me,
      createdAt: new Date().toISOString(), replyTo: null, reactions: {}, pending: true, attachments: [],
    };
    setRoomMessages((ms) => [...ms, temp]);
    postSquadronMessage({ me, squadronId, moduleCode: sq?.moduleCode, body: text }).then((row) => {
      setRoomMessages((ms) => (row
        ? ms.map((m) => (m.id === temp.id ? row : m))
        : ms.filter((m) => m.id !== temp.id)));
    });
  }, [me, squadrons]);
  /* A door from the Flight Deck into one place in the Ready Room: a thread, the
     ask composer, the right seat, Discover or a person. Handed to the room as
     it opens and handed back once used. State rather than a URL, because it
     is a gesture and not a link anybody keeps. */
  const [roomIntent, setRoomIntent] = useState(null);
  const openRoomAt = (intent) => {
    setRoomIntent(intent);
    go(routePath.ready(intent?.moduleCode));
  };
  useEffect(() => {
    if (!isSignedIn || !flags["social.readyroom"]) {
      setSquadrons([]); setRoomMessages([]); setRightSeat([]); setSeat(null); return undefined;
    }
    let live = true;
    let ids = [];
    const full = async () => {
      const sqs = await fetchMySquadrons(me);
      if (!live) return;
      setSquadrons(sqs);
      ids = sqs.map((x) => x.id);
      const [msgs, seat] = await Promise.all([
        fetchSquadronMessages(me, ids),
        fetchRightSeat(me, sqs),
      ]);
      if (!live) return;
      setRoomMessages(msgs);
      // 0027: everything this device now holds from other people has reached it.
      if (msgs.some((m) => m.authorId !== me)) markDelivered(me, ids);
      setRightSeat(seat);
    };
    fetchSeat(me).then((r) => { if (live) setSeat(r); }).catch(() => {});
    // Only the messages on the interval. Which squadrons you are in and who
    // could take the right seat do not change between two ticks of a chat.
    const messagesOnly = async () => {
      if (!ids.length) return;
      const msgs = await fetchSquadronMessages(me, ids);
      if (!live) return;
      setRoomMessages(msgs);
      if (msgs.some((m) => m.authorId !== me)) markDelivered(me, ids);
    };
    full();
    const stopLive = listen(LIVE_TABLES.chat, messagesOnly);
    const tick = () => { if (document.visibilityState === "visible") messagesOnly(); };
    const t = setInterval(tick, POLL_WHEN_DOWN_MS * 6);
    document.addEventListener("visibilitychange", tick);
    return () => {
      live = false;
      stopLive();
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isSignedIn, me, flags, roomNonce]);

  /* THE SAVES LIST, loaded once per student and kept in one store.
     Every module at once, because it is a short list and the module picker
     switches between them without a fetch. resetSaves on the way out is not
     tidiness: without it the next person to sign in on a shared college
     machine would see the last one's bookmarks until their own arrived. */
  useEffect(() => {
    if (!isSignedIn || !me) {
      /* Clerk still deciding: hold, so a signed-in student does not see the
         empty state flash. Clerk has decided and it is nobody: settle, or
         every Bookmarks screen waits for a load that will never start. */
      if (clerkLoaded) noStudent(); else resetSaves();
      return;
    }
    initSaves({ getSupabase: async () => supabase, userId: me });
  }, [isSignedIn, clerkLoaded, me]);

  // §4c — endorsements on answers. Fetched for the replies actually loaded,
  // keyed by a stable id string so the effect runs when the cast changes
  // rather than on every render.
  const [votes, setVotes] = useState({});
  const replyIds = useMemo(
    () => session.replies.map((r) => r.id).sort().join(","), [session.replies]);
  const reloadVotes = useCallback(async () => {
    const ids = replyIds ? replyIds.split(",") : [];
    if (!ids.length) { setVotes({}); return; }
    setVotes(await fetchReplyVotes(ids, me));
  }, [replyIds, me]);
  useEffect(() => { reloadVotes(); }, [reloadVotes]);

  // WHO WROTE THIS. Names come from pilot_profiles, and without this they did
  // not come from anywhere: `people` held only the content fixture's callsigns,
  // so every real author fell through to the raw id and the room would have
  // shown "user_2abc..." as somebody's name under their own question. Harmless
  // while threads were per-account and nobody else's ever appeared; the moment
  // the tables are shared it is the first thing anyone sees.
  //
  // is_staff becomes role: "instructor", which is what the badge already reads,
  // so the instructor mark works off real standing rather than fixture data.
  /* Am I the author? The correction queue and the author view hang off this
     one flag, and it is a single read of my own row rather than a claim the
     client makes about itself. */
  const [myProfile, setMyProfile] = useState(null);
  useEffect(() => {
    if (!isSignedIn || !me) { setMyProfile(null); return undefined; }
    let live = true;
    fetchProfile(me).then((row) => { if (live) setMyProfile(row); });
    return () => { live = false; };
  }, [isSignedIn, me]);

  /* INTO THE DEMO, BY ASKING: Replay, at the foot of the Licence. The
     student's look goes with them, so the demo is their app and not the
     default one, and they are themselves in it rather than "You". */
  const LOOK_KEYS = ["pw-livery", "pw-finish", "pw-variant-pin", "pw-reduce-motion", "pw-ruled", "pw-font-size", "pw-dyslexia-font", "pw-grain"];
  startDemoRef.current = (how) => {
    if (!isSignedIn || !me || demoMode) return;
    const look = {};
    for (const k of LOOK_KEYS) { const v = progress.get(k, undefined); if (v !== undefined) look[k] = v; }
    enterDemo({
      me, how, from: `${location.pathname}${location.search || ""}`,
      look: { callsign: user?.username || null, name: user?.fullName || null, hasStamp: Boolean(myProfile?.stamp_issued_at), progress: look },
    });
  };

  /* OUT OF IT. A visitor with no account who finishes it goes to sign up, and
     from there to their licence; one who leaves early is back on the page
     they arrived on, signed out. A signed-in student with no stamp yet
     who finishes it goes to the licence; everybody else goes back to where
     they pressed Replay. */
  const leaveDemoFor = (why) => {
    if (demoState?.guest) {
      markWalkthroughSeen();
      if (why === "finish") { askForLicence(); leaveDemo(`${routePath.signin()}?join=1`); return; }
      leaveDemo(demoState?.from || routePath.home());
      return;
    }
    if (why === "finish" && !demoState?.look?.hasStamp) {
      askForLicence();
      leaveDemo(routePath.profile("licence"));
      return;
    }
    leaveDemo(demoState?.from || routePath.home());
  };

  /* ------------------------------------------------------------ the papers
     TWO ANSWERS, NOT ONE. `paper.viewer` is the thing students get: a paper
     that opens to be scrolled, bookmarked and downloaded. `library.reader` is
     the paused annotation reader — the tools, the marks, the ink — and it is
     off, and turning it on must not be the price of having papers at all.

     `activeModuleCode === "M1"` used to be on this line and it was a dev
     condition that shipped: papers opened in the app on Module 1 and in a
     browser tab everywhere else, so the same control did two different things
     depending which module you were in. */
  const viewerOn = flags["paper.viewer"];
  /* The one route that takes the whole screen besides the Ready Room. */
  const paperFull = route.name === "paper" && viewerOn;
  const readerOn = flags["library.reader"] && activeModuleCode === "M1";
  const [addingPaper, setAddingPaper] = useState(false);

  /* THE READER STARTS LOADING WHEN THE URL SAYS PAPER, NOT WHEN THE ROW LANDS.

     The chain was strictly serial: boot, then Clerk, then the papers query,
     then — only once a row had come back naming the file — the reader chunk,
     then pdf.js, then the first bytes of the document. Measured on a cold
     production load, the reader chunk was not even REQUESTED until 1.5s in,
     and it does not need the row: it is the same 430KB whichever paper you
     open. Asking for it in parallel takes half a second off the front.

     Fire-and-forget on purpose. If it fails, the ordinary lazy import runs
     again at render and the only cost is the time this was meant to save. */
  useEffect(() => {
    if (!papersOn) return;                       // the READER is paused; nothing of it to warm
    if (route.name !== "paper" && route.tab !== "library") return;
    CHUNK.paper()
      .then((m) => m?.warm?.())
      .catch(() => {});
  }, [route.name, route.tab]);
  const paperPlace = progress.get("pw-paper-place", null);

  /* Papers added by hand live in a table; the fixture's live in a file. They
     are merged ONCE, here, into the list every screen reads — the Library, the
     Flight Deck's pin, and the reader's own route.
     
     They were not, and that was the whole of "the paper opens blank": the
     route resolved the id against the fixture alone, found nothing, and
     rendered an empty <main>. A merge that only reaches one of three readers
     is not a merge. */
  /* The list is remembered so a second open of the same paper resolves the
     route from the first frame instead of after a round trip — which is what
     the reader, pdf.js and the document's first bytes are all waiting on. The
     server's answer replaces it the moment it arrives, so a stale entry costs
     one render and never survives. */
  const [addedPapers, setAddedPapers] = useState(
    () => progress.get(`pw-papers:${activeModuleCode}`, []) || []);
  const [papersLoading, setPapersLoading] = useState(true);
  useEffect(() => {
    /* Paused: the query is not made at all, rather than made and ignored. */
    /* THE LIST FOLLOWS WHATEVER CAN OPEN ONE. It followed the paused reader,
       which is why a paper was "not in this module" the moment the viewer
       arrived: the query was never made. */
    if ((!papersOn && !viewerOn) || !activeModuleCode || !me) { setPapersLoading(false); return undefined; }
    let live = true;
    setAddedPapers(progress.get(`pw-papers:${activeModuleCode}`, []) || []);
    setPapersLoading(true);
    listPapers(activeModuleCode, me).then(({ papers: rows }) => {
      if (!live) return;
      setAddedPapers(rows || []);
      setPapersLoading(false);
      progress.set(`pw-papers:${activeModuleCode}`, rows || []);
    });
    return () => { live = false; };
  }, [activeModuleCode, me]);

  /* THE STUDENT'S OWN STAMP, from the profile the app already fetches. Null
     until they issue one, which is what makes the house seal the fallback
     everywhere rather than a special case anybody has to remember. */
  const myStamp = useMemo(() => stampOf(myProfile), [myProfile]);

  /* ---------------------------------------------------------------- CREW
     Three things the Crew tab needs that nothing else here already had.

     The MATES are for a ring, not for a grouping: §2 says a squadron mate
     "gets a thin teal ring around their face. They are not grouped
     separately", so this is a set of ids and nothing more.

     MY OWN COMPLETIONS put my stamp on the walls I have signed off. The other
     people's come from crew.js in one query; mine is the one row that query
     leaves out, because it leaves ME out.

     A FACE OR A STAMP OPENS THE PERSON. §2: "No DMs anywhere. Tapping a face
     or stamp opens the profile viewer." That viewer is the licence card, which
     is item 5; until it exists this opens the pilot sheet, which is this app's
     current answer to "who is this" and carries report and block. */
  const [squadronMates, setSquadronMates] = useState(() => new Set());
  const [myCompleted, setMyCompleted] = useState(() => new Set());
  const [pilotSheet, setPilotSheet] = useState(null);

  useEffect(() => {
    if (!me || !activeModuleCode) { setSquadronMates(new Set()); return undefined; }
    let live = true;
    (async () => {
      const sq = await fetchSquadron(me, activeModuleCode);
      if (!live || !sq?.id) { if (live) setSquadronMates(new Set()); return; }
      const roster = await fetchRoster(me, sq.id);
      if (live) setSquadronMates(new Set((roster || []).map((r) => r.user_id).filter(Boolean)));
    })();
    return () => { live = false; };
  }, [me, activeModuleCode]);

  useEffect(() => {
    if (!me || !activeModuleCode) { setMyCompleted(new Set()); return undefined; }
    let live = true;
    fetchMyCompletions(me, activeModuleCode).then((rows) => {
      if (live) setMyCompleted(new Set((rows || []).map((r) => r.chapter_id)));
    });
    return () => { live = false; };
  }, [me, activeModuleCode]);

  const openPilot = (p) => {
    const id = typeof p === "string" ? p : (p?.userId || p?.user_id);
    if (!id || id === me) return;
    setPilotSheet({ user_id: id, callsign: p?.name || p?.callsign || null });
  };


  const modulePapers = useMemo(
    /* ?fixture=demo hands the Library the reference's own three papers, so a
       pixel diff of that tab measures the rows rather than the shelf. Dev
       only — demoOn() is constantly false in a production build. */
    () => (!papersOn && !viewerOn ? []
      : demoOn() ? DEMO_PAPERS
        : [...(papersFor(activeModuleCode, useTestContent) || []), ...addedPapers]),
    [activeModuleCode, useTestContent, addedPapers, viewerOn],
  );
  /* Papers are listed one module at a time, from the database. The adapter is
     told which module a list belongs to so that a save pointing at a paper in
     a module nobody has opened reads as "not known yet" rather than "deleted"
     — the difference between holding a bookmark and pruning it off the
     server. See content.js. */
  useEffect(() => {
    /* PAUSED MEANS "NOT KNOWN", NEVER "NONE", and the difference is a
       student's bookmarks. `content.paper()` answers `undefined` until a
       module's papers have been listed, and `null` — the answer that PRUNES,
       which DELETES the row from the server — only once a list has come back
       without it. Handing it an empty list here would be that second answer
       about every page anybody ever bookmarked. So nothing is provided, and
       the Pages folder is hidden at read time instead (useSaves.js). */
    /* "NOT KNOWN" AND "NONE" ARE DIFFERENT ANSWERS, and the difference is a
       student's bookmarks: `content.paper()` answers `null` once a module's
       papers have been listed without one, and `null` PRUNES, which DELETES
       the row from the server. Providing an empty list while nothing can open
       a paper would be that second answer about every page anybody ever
       saved. With the viewer on, the list is real and may be provided. */
    if (!papersOn && !viewerOn) return;
    if (!papersLoading) providePapers(activeModuleCode, modulePapers);
  }, [activeModuleCode, modulePapers, papersLoading]);
  const lastPaper = useMemo(
    () => modulePapers.find((p) => p.id === paperPlace?.paperId) || null,
    [modulePapers, paperPlace],
  );

  /* ------------------------------------------------ a page, bookmarked
     THE SAVE IS THE ONE THE REST OF THE APP ALREADY USES. `saves` has held
     `kind='page'` with a page column since migration 0028, `savesStore` is its
     only writer, and the Pages folder in Bookmarks reads the same rows — so
     the viewer writes nothing of its own and a page saved here turns up there
     with no second path to keep in step.

     OPTIMISTIC AND INSTANT, because `addSave` changes the screen first and
     lets the server follow; a bookmark that waits on the network reads as
     broken, and the island's message is the acknowledgement. */
  const savesVersion = useSyncExternalStore(subscribeSaves, savesSnapshot, savesSnapshot);
  const savedPagesFor = useCallback((paperId) => {
    const set = new Set();
    for (const r of savesVersion.rows || []) {
      if (r.kind === "page" && r.ref_id === paperId && r.page) set.add(r.page);
    }
    return set;
  }, [savesVersion]);
  const togglePageSave = useCallback((paper, pg, on) => {
    if (!paper?.id || !pg) return;
    if (on) addSave({ kind: "page", moduleId: activeModuleCode, refId: paper.id, page: pg });
    else {
      const row = findSave("page", paper.id, pg);
      if (row) removeSave(row);
    }
  }, [activeModuleCode]);

  const readerPin = readerOn
    ? { paper: lastPaper, page: paperPlace?.page || 1, pages: lastPaper?.pages || null }
    : null;

  const openPaper = useCallback((paper) => {
    if (!paper) return;
    // Opened is remembered per account, so the Library can say which ones have
    // been. Written before anything navigates: a popup blocker, or a chunk that
    // will not load, must not cost the record of having tried.
    progress.set("pw-paper-opened", {
      ...progress.get("pw-paper-opened", {}), [paper.id]: true,
    });
    recordPlace({ kind: "paper", paperId: paper.id, title: paper.title, file: paper.file });
    /* `activeModuleCode === "M1"` USED TO BE HERE, and it was a dev condition
       that shipped: papers opened in the app on Module 1 and fell through to a
       browser tab on every other module, so the same control did two different
       things depending which module you happened to be in. */
    if (viewerOn || flags["library.reader"]) {
      go(routePath.paper(activeModuleCode, paper.id));
    } else {
      /* `fileHref`, NOT A PATH BUILT BY HAND. This was
         `/${paper.file.replace(/^\//, "")}` — and a paper stored in Supabase
         carries an ABSOLUTE url, so that produced `/https://…` and opened a
         404 on this origin. fileHref already tells the two apart. */
      window.open(fileHref(paper.file), "_blank", "noopener");
    }
  }, [progress, flags, activeModuleCode]);

  const [profiles, setProfiles] = useState([]);
  const authorIds = useMemo(() => {
    const ids = new Set();
    for (const t of session.threads) if (t.authorId) ids.add(t.authorId);
    for (const r of session.replies) if (r.authorId) ids.add(r.authorId);
    for (const m of roomMessages) if (m.authorId) ids.add(m.authorId);
    // Somebody can be in the room without having written a word, and the rail
    // still has to know their name — otherwise the online faces are labelled
    // with a raw Clerk id.
    for (const p of presenceRows) if (p.user_id) ids.add(p.user_id);
    return [...ids].sort().join(",");        // a stable key, so the effect
  }, [session.threads, session.replies, roomMessages, presenceRows]);  // on CHANGE only
  useEffect(() => {
    const ids = authorIds ? authorIds.split(",") : [];
    if (!ids.length) { setProfiles([]); return undefined; }
    let live = true;
    fetchProfiles(ids).then((byId) => {
      if (!live) return;
      setProfiles(Object.values(byId || {}).map((r) => ({
        id: r.user_id, callsign: r.callsign,
        role: r.is_staff ? "instructor" : undefined,
      })));
    });
    return () => { live = false; };
  }, [authorIds]);

  // The fixture's people first, real profiles after: a real profile wins for
  // the same id, because `who` takes the FIRST match and a live callsign is
  // never less true than a fixture one.
  const directory = useMemo(
    () => [...profiles, ...(useTestContent?.people || [])],
    [profiles, useTestContent],
  );

  // Unread per squadron, for the badge. Counted against the same pw-room-seen
  // stamp the threads use, so one "seen" gesture settles both registers.
  const chatUnread = useMemo(() => {
    const seen = progress.get("pw-room-seen", {});
    const out = {};
    for (const m of roomMessages) {
      if (m.authorId === me) continue;
      const at = Date.parse(m.createdAt) || 0;
      if (at > (seen[m.squadronId] || 0)) out[m.squadronId] = (out[m.squadronId] || 0) + 1;
    }
    return out;
  }, [roomMessages, progress, me]);

  //
  // This counted three progress keys — pw-my-threads, pw-thread-replies and
  // pw-squadron-unread — that NOTHING in the codebase has ever written. The
  // badge was therefore permanently zero: the one attention mechanism in the
  // app, wired to nothing. It now counts the rows themselves, through the same
  // badgeCount the room's own model exposes, so the pill and the sidebar can
  // never disagree about what is waiting.
  const roomBadge = useMemo(() => badgeCount({
    threads: session.threads,
    replies: session.replies,
    seen: progress.get("pw-room-seen", {}),
    chatUnread: chatUnread,
    me,
  }), [session.threads, session.replies, progress, chatUnread, me]);

  // pw-last-visit is still stamped — the logbook reads it and it is not a
  // streak. What is gone is the counting: pw-streak, pw-longest-streak and the
  // pill that displayed them.
  useEffect(() => {
    if (!progress.loaded) return;
    const today = new Date().toDateString();
    if (progress.get("pw-last-visit", null) !== today) progress.set("pw-last-visit", today);
  }, [progress.loaded]);
  useEffect(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236FA0F0' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M17.8 19.2 16 11l3.5-3.5c.6-.6.9-1.4.9-2.2 0-.5-.4-.9-.9-.9-.8 0-1.6.3-2.2.9L14 8.8 5.8 7 4.5 8.3l6.7 3.7-3 3-2.5-.3-1 1L7 17l1.3 2.3 1-1-.3-2.5 3-3 3.7 6.7 1.3-1.3Z'/></svg>`;
    const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = href;
  }, []);
  // Aurora is the one livery behind a flag; a stored choice must not outlive it.
  // Declared before the effects that list it as a dependency — a dependency
  // array is evaluated during render, so a `const` below them is in the
  // temporal dead zone and throws. A bundler will not catch that.
  const shownLivery = livery === "aurora" && !flags["livery.aurora"] ? DEFAULT_LIVERY : livery;

  // The livery and variant are mirrored onto the root because html and body sit
  // outside .app, so the page behind the app would otherwise have to hardcode a
  // colour and Day would not repaint it.
  useEffect(() => {
    const h = document.documentElement;
    h.setAttribute("data-livery", shownLivery);
    h.setAttribute("data-variant", variant);
  }, [shownLivery, variant]);

  // §2B — the token layer, globally. The ramp is a computation rather than a
  // table, so the base tokens are written onto :root at runtime and every page
  // on the site inherits them, including the ones whose layouts are untouched.
  // The custom properties written onto :root by the effect below, so the next
  // run can remove the ones it no longer writes.
  const appliedVars = useRef(new Set());

  useEffect(() => {
    const { vars, C } = deckVars(shownLivery, variant);
    // The finish is layered over the stock, never mixed into it. With no
    // finish this is the stock exactly, which is what keeps None unchanged.
    const over = finishVars(shownLivery, variant, finish, C.active);
    const all = { ...vars, ...over };
    const root = document.documentElement;
    Object.entries(all).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--grain", grain ? all["--grain"] : "0");
    // Anything a finish wrote LAST time and is not writing THIS time gets
    // removed. This used to be a hand-kept list of four names, which meant
    // every token a finish added afterwards silently survived a switch back to
    // Standard — Manual's eight paper tokens were all still set in Aurora.
    // Harmless while only paper-gated CSS reads them, and one careless
    // ungated selector away from not being. Diffing the applied set cannot
    // fall out of date the way the list did.
    const written = new Set(Object.keys(all));
    for (const k of appliedVars.current) {
      if (!written.has(k)) root.style.removeProperty(k);
    }
    appliedVars.current = written;
  }, [shownLivery, variant, grain, finish]);

  /* TURBULENCE IS GONE (§6). It was a switch on the Appearance tab called "a
     small nudge when you move between pages", and what it actually did by the
     end was fire a haptic on two navigations and nothing else — the shake it
     was named for had already been removed, leaving an empty `if
     (!reduceMotion) {}` behind it. A setting whose whole effect is a vibration
     on a phone, named after an animation that no longer exists, is a setting
     that cannot be explained; deleted rather than renamed. */
  const switchTab = (nextTab) => {
    scrollPositions.current[tab] = deckRef.current?.scrollTop || 0;
    // Through go(), so the tab slide applies here as it does on the profile —
    // keepScroll because this restores each tab's own position below, and go()
    // would otherwise send both to the top.
    go(nextTab === "pdf" || nextTab === "library" ? routePath.library(activeModuleCode)
       : nextTab === "crew" ? routePath.crew(activeModuleCode)
       : routePath.module(activeModuleCode),
       { keepScroll: true })
      // Chained rather than fired straight away: go() is async now, so a bare
      // requestAnimationFrame could restore the position before the new tab
      // had committed and scroll the OLD panel instead.
      .then(() => requestAnimationFrame(() => {
        if (deckRef.current) deckRef.current.scrollTop = scrollPositions.current[nextTab] || 0;
      }));
  };
  const goToModule = (moduleCode, targetTab = "chapters") => {
    // Validated against the code it was handed, not against data.js.
    //
    // This used to look the module up in data.js and return silently if it
    // was missing or not "active" — while the Flight Deck lists whichever
    // content the app is running on. Two lists, and any disagreement between
    // them turned a tap into nothing at all, with no error and nothing on
    // screen to explain it. A dead tap is the worst failure a nav path has,
    // because it looks like the app is simply broken.
    if (!moduleCode) return;
    const m = MODULES.find((x) => x.code === moduleCode);
    if (m && m.status && m.status !== "active") return;   // deliberately locked
    setPreferredModuleCode(moduleCode);
    go(targetTab === "pdf" ? routePath.library(moduleCode) : routePath.module(moduleCode));
  };
  const enterModule = (m) => goToModule(m.code, "chapters");
  // Deep-link into one specific chapter: hand the id to ChaptersPanel directly
  // so it opens that chapter instead of the restored pw-last-chapter.
  const goToChapter = (moduleCode, chapterId) => {
    if (!moduleCode || !chapterId) return;
    setPreferredModuleCode(moduleCode);
    go(routePath.chapter(moduleCode, chapterId));
  };
  return (
    <div
      data-livery={shownLivery}
      data-variant={variant}
      /* §6.3 names these Smooth Air and Plain Language. Both class names are
         emitted so the global layer and the per-component rules that still use
         the old ones stay in agreement until the profile rebuild renames the
         state itself. */
      className={`app ${variant === "day" ? "theme-light" : ""} ${reduceMotion ? "reduce-motion smooth-air" : ""} ${dyslexiaFont ? "plain-language" : ""}`}
      data-aur={finish === "aurora" && variant !== "day" ? "1" : undefined}
      data-paper={finish === "manual" ? "1" : undefined}
      data-roomfull={roomFull ? "1" : undefined}
      /* THE VIEWER OWNS THE SCREEN TOO. `.deck` is the scroller, so a paper
         that simply grows inside it never scrolls itself and the island —
         positioned against the viewer's own box — scrolls out of sight on the
         first flick. Stamped here rather than inferred, like the room's. */
      data-paperfull={paperFull ? "1" : undefined}
      data-fiche={finish === "manual" && variant !== "day" ? "1" : undefined}
      // Tooth in Day whatever the finish. The Day brief excluded Manual, but
      // paper wants fibre more than anything else here does, and the
      // alternative on a light ground is the isotropic speckle Tooth exists to
      // replace. Night never carries it.
      data-tooth={variant === "day" ? "1" : undefined}
      style={{
        "--font-scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
        "--scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
      }}
    >
    {/* FIRST FLIGHT BEFORE THE USERNAME. A new student meets one screen that
        asks for their callsign (which is their Clerk username) and their code.
        The username gate is behind it now, for an older account that has a
        profile and no username, which First Flight never sees. */}
    <FirstFlightGate>
    <UsernameGate>
    <Deck aurora={finish === "aurora" && variant !== "day"}
            rules={finish === "manual" && ruled
              ? ruledLayer(deckVars(shownLivery, variant).C.active, variant === "day") : null} />
      {flags["chrome.boarding"] && boarding && (
        <div className="boarding-overlay" onAnimationEnd={() => setBoarding(false)}>
          <div className="boarding-pass">
            <div className="boarding-pass-top">
              <span className="boarding-pass-airline">WINGMAN AIRWAYS</span>
              <Plane size={22} style={{ transform: "rotate(45deg)" }} />
            </div>
            {isSignedIn && (user?.username || user?.fullName) && (
              <div className="boarding-pass-welcome">WELCOME ABOARD, {(user.username || user.fullName).toUpperCase()}</div>
            )}
            <div className="boarding-pass-route">WINGMAN <ChevronRight size={14} /> JT.01</div>
            <div className="boarding-pass-row">
              <div><label>SEAT</label><span>{ticket.seat}</span></div>
              <div><label>GATE</label><span>{ticket.gate}</span></div>
              <div><label>STATUS</label><span>BOARDING</span></div>
            </div>
            <div className="boarding-pass-barcode" />
          </div>
          <div className="boarding-trivia">
            <span className="boarding-trivia-label">TIP</span>
            {TRIVIA[Math.floor(Date.now() / 86400000) % TRIVIA.length]}
          </div>
        </div>
      )}
      {storageWarning && (
        <div className="storage-warning">Your browser is blocking local storage here, so progress won't be saved on this device.</div>
      )}
      {/* The Ready Room is the one full-screen surface: it takes the banner's
          height too, and carries the wordmark and the profile inside its own
          sidebar instead. A messaging shell with a page header above it wastes
          the one axis it actually needs, and the Ready Room pill would be
          pointing at the room you are already standing in. */}
      {!roomFull && (
        /* R4 — WITH A PAPER OPEN THE BAR IS A WORDMARK AND A SENTENCE. The pill
           and the profile are not hidden, they are not rendered: a hidden
           control is still tabbable-adjacent, still in a page search, and was
           still one stray click out of a timed exam. The wordmark stops being
           a button for the same reason. `examport` is here so the note takes
           the pack's own `.locked-note` rule rather than a new one (R1). */
        examLocked ? (
          <header className="topbar examport" data-locked="1">
            <span className="brandmark">Wingman</span>
            <span className="locked-note">Exam in progress</span>
          </header>
        ) : (
        <header className="topbar">
          <button className="brandmark" onClick={goHome} aria-label="Go to Flight Deck">
            Wingman
          </button>
          <div className="topbar-right">
            {/* §8 — the Ready Room takes the spot the streak pill held. One
                number in the app bar, and it counts things addressed to you. */}
            <ReadyRoomPill count={roomBadge} onGo={() => go(routePath.ready())} />
            <ProfileMenu onNavigate={goProfile} profile={myProfile}
                         profileLoading={Boolean(isSignedIn && me && !myProfile)} />
          </div>
        </header>
        )
      )}

      {/* THE SCROLLER. tabindex and role because Chrome will not make an
          overflow container focusable on its own, so Page Down and the arrow
          keys would do nothing and it would be an unlabelled tab stop. */}
      <div className="deck" ref={deckRef} tabIndex={0} role="region" aria-label="Page content">
      {/* A skeleton in the shape of the page, never a spinner on a blank
          screen. Routes other than the first one are code-split, so this is
          what stands in while a chunk arrives — and on a fast connection it
          is never seen at all. */}
      <Suspense fallback={<PageSkeleton />}>
      <RouteError>
        <div className="deck-inner route-fade" key={route.name}>

      {flags["nav.root"] && (
        <RootNav
          current={
            route.name === "ready" ? "ready"
            : route.name === "logbook" ? "logbook"
            : route.name === "modules" ? "modules"
            : route.name === "home" ? "home" : null
          }
          readyWarm={onFrequency > 0}
          flags={flags}
          onGo={(id) =>
            go(id === "ready" ? routePath.ready()
              : id === "logbook" ? routePath.logbook()
              : id === "modules" ? routePath.modules()
              : routePath.home())
          }
        />
      )}
      {route.name === "ready" && flags["social.readyroom"] ? (
        <main className="content content-taxi content--full">
          <ReadyRoomShell
            me={me}
            modules={allModules(useTestContent)}
            activeModuleCode={activeModuleCode}
            routeThreadId={route.threadId || null}
            chapters={chaptersFor(activeModuleCode, useTestContent)}
            threads={session.threads}
            replies={session.replies}
            people={directory}
            presence={normalisePresence(presenceRows)}
            squadrons={squadrons}
            messages={roomMessages}
            intent={roomIntent}
            onIntentUsed={() => setRoomIntent(null)}
            votes={votes}
            onVote={async (replyId, on) => {
              await toggleReplyVote(replyId, me, on);
              reloadVotes();
            }}
            onBest={async (threadId, replyId) => {
              // Only the asker may mark an answer, and the server checks it —
              // the update is scoped by author_id, so this is a no-op for
              // anyone else rather than a silent success.
              const ok = await setBestReply(threadId, replyId, me);
              if (!ok) return;
              setSession((s0) => ({
                ...s0,
                threads: s0.threads.map((t) => (t.id === threadId
                  ? { ...t, bestReplyId: replyId } : t)),
              }));
            }}
            onHome={goHome}
            onOpenModule={(code) => code && goToModule(code, "chapters")}
            saved={progress.get("pw-room-saved", {})}
            onSave={(threadId) => {
              // Saving a question is the same act as bookmarking a paper, so it
              // lives in the same place rather than in a table of its own.
              const held = progress.get("pw-room-saved", {});
              const next = { ...held };
              if (next[threadId]) delete next[threadId]; else next[threadId] = Date.now();
              progress.set("pw-room-saved", next);
            }}
            onRefresh={() => refreshRoom()}
            onOpenInvite={(token) => go(`/j/${token}`)}
            onOpenLessonAt={(t) => {
              // §5 — the round trip. The lesson opens at the moment, and it has
              // to leave a way back to the thread that sent you there.
              const owner = chaptersFor(activeModuleCode, useTestContent)
                .find((c) => (c.lessons || []).some((l) => l.id === t.lessonId));
              if (!owner) return;
              progress.set("pw-room-return", { threadId: t.id, at: Date.now() });
              go(routePath.lesson(t.moduleId, owner.id, t.lessonId));
              requestSeek?.(t.t);
            }}
            onPost={(ev) => {
              if (ev.kind === "reply") {
                // parentId is how an answer to an answer stays one level deep
                // (0022). Null for a top-level answer, which is most of them.
                mutate((sx) => postReply(sx, {
                  threadId: ev.threadId, body: ev.body, authorId: me, parentId: ev.parentId,
                }));
                return;
              }
              if (ev.kind === "thread") {
                // §5 — asked in the room, so it carries a title and no lesson.
                mutate((sx) => postModulePost(sx, {
                  moduleId: ev.moduleId, body: ev.body, title: ev.title, authorId: me,
                }));
                return;
              }
              if (ev.kind === "deleteThread") {
                // Through mutate, so the row goes from the screen and the table
                // in one place. diffWrite turns the absence into the delete.
                mutate((sx) => removeThread(sx, ev.threadId));
                return;
              }
              if (ev.kind === "deleteReply") {
                mutate((sx) => removeReply(sx, ev.replyId));
                return;
              }
              if (ev.kind === "message") {
                const sq = squadrons.find((x) => x.id === ev.squadronId);
                const attaching = ev.pending || [];
                /* OPTIMISTIC, and then reconciled. The chat used to be
                   posted-then-shown: the composer cleared and nothing appeared
                   until the round trip landed, which on a phone on campus wifi
                   is a second of blank. The temporary row carries `pending` so
                   the bubble can show a single tick instead of two, and it is
                   replaced by the row the insert returns rather than joined by
                   it. */
                const temp = {
                  id: `pending-${Date.now()}`, squadronId: ev.squadronId, body: ev.body || null,
                  authorId: me, createdAt: new Date().toISOString(),
                  replyTo: ev.replyTo || null, reactions: {}, pending: true,
                  /* The photos are on screen at once, from the files still on this
                     device, and swapped for the landed copies when the upload
                     finishes. */
                  attachments: attaching.map((a, i) => toAttachment({
                    id: `pending-att-${i}`, kind: a.kind, localUrl: a.localUrl || null,
                    file_name: a.file?.name, mime_type: a.file?.type, byte_size: a.file?.size,
                    width: a.width, height: a.height, paper_id: a.paperId,
                    paper_title: a.paperTitle, page: a.page, quote: a.quote, anchor: a.anchor,
                  })),
                };
                setRoomMessages((ms) => [...ms, temp]);
                postSquadronMessage({
                  me, squadronId: ev.squadronId, moduleCode: sq?.moduleCode,
                  body: ev.body, replyTo: ev.replyTo, hasAttachments: attaching.length > 0,
                }).then(async (row) => {
                  if (!row) {
                    setRoomMessages((ms) => ms.filter((m) => m.id !== temp.id));
                    if (attaching.length) ev.onFail?.("That didn't send. Try again.");
                    return;
                  }
                  let landed = [];
                  if (attaching.length) {
                    try {
                      landed = (await attachToMessage({
                        me, squadronId: ev.squadronId, messageId: row.id, pending: attaching,
                      })).map(toAttachment);
                    } catch (err) {
                      console.error(err);
                      ev.onFail?.(err?.message || "An attachment didn't send. Try again.");
                    }
                    /* NOTHING LANDED AND THERE WAS NO TEXT: the row is an empty
                       bubble that the transcript would hide on the next load
                       anyway. Take it back out now rather than leave a message
                       that says nothing in the database. */
                    if (!landed.length && !(ev.body || "").trim()) {
                      await deleteMessage(me, row.id);
                      setRoomMessages((ms) => ms.filter((m) => m.id !== temp.id));
                      return;
                    }
                    if (landed.length < attaching.length) {
                      ev.onFail?.("Some of that didn't send. The rest did.");
                    }
                  }
                  setRoomMessages((ms) => ms.map((m) => (m.id === temp.id ? { ...row, attachments: landed } : m)));
                });
              }
            }}
            /* A passage quoted in chat opens the paper it came from, in the
               reader. Paused: no passage renders, so nothing can call this —
               it is withheld as well, so a passage that slipped through would
               be inert rather than a link to a 404. */
            onOpenPaper={papersOn ? ((moduleCode, paperId) => {
              if (paperId) go(routePath.paper(moduleCode || activeModuleCode, paperId));
            }) : null}
            onBlock={async (userId) => {
              // §9 — blocking is symmetric and total. The Ban button called
              // onBlock?.() and nobody supplied it, so it was a safety control
              // that did nothing: the same shape as the Flag button below,
              // which had a table waiting for it and no writer.
              if (!userId || userId === me) return;
              if (!(await blockUser(me, userId))) return;
              // Every fetcher already drops blocked authors, so this only
              // applies that same rule to what is on screen right now rather
              // than making someone reload to stop seeing them.
              setRoomMessages((ms) => ms.filter((m) => m.authorId !== userId));
              setSession((s0) => ({
                ...s0,
                threads: s0.threads.filter((t) => t.authorId !== userId),
                replies: s0.replies.filter((r) => r.authorId !== userId),
              }));
            }}
            onReport={(what) => {
              // The reports table has existed since 0005 and nothing was
              // writing to it: a Flag button that only reached the console is
              // a safety control that does not exist. Fire-and-forget, because
              // the person reporting is owed an acknowledgement, not a wait.
              reportContent({
                reporterId: me,
                targetType: what?.kind || "message",
                targetId: String(what?.id || ""),
                reason: what?.reason || null,
                channelId: what?.squadronId || null,
              });
            }}
          />
        </main>
      ) : settingsPage === "auth" ? (
        <main className="content content-taxi">
          <AuthPage />
        </main>
      ) : settingsPage === "progress" ? (
        <main className="content content-taxi">
          <ProgressPage onBack={() => go(-1)} />
        </main>
      ) : route.name === "bookmarks" || route.name === "cards" ? (
        /* Bookmarks is content-width like every other hub screen; the folder
           grid widens itself from inside (.bm-wide), because a full folder
           needs the room and an empty one reads better narrow. */
        <main className="content content-taxi">
          <BookmarksScreens route={route} />
        </main>
      ) : route.name === "clerk" ? (
        /* Clerk owns the email and password flows, including verification and
           the case where a Google account has no password to change. */
        <main className="content content-taxi content--profile">
          <AccountPortal section={route.section} onBack={() => go(routePath.profile("licence"))} />
        </main>
      ) : route.name === "profile" ? (
        <main className="content content-taxi content--profile">
          <Profile
            page={route.tab}
            /* "security" and "email" are Clerk's, not one of the three tabs —
               `routePath.profile` would fall back to /account/licence, which
               is what made both buttons dead. */
            onNavigate={(t) => (t === "tour" ? goProfile("tour") : go(t === "security" || t === "email"
              ? routePath.clerk(t) : routePath.profile(t)))}
            onBack={() => go(routePath.home())}
            variant={variant}
            variantPin={variantPin}
            onVariantPin={(v) => withTheme(() => setVariantPin(v))}
            livery={shownLivery}
            onLivery={(id) => withTheme(() => { setLivery(id); progress.set("pw-livery", id); })}
            finish={finish}
            onFinish={(f) => withTheme(() => setFinish(f))}
            ruled={ruled}
            /* Paper, scale and face all repaint the page, so they are scene
               changes for the same reason a livery is — the only difference is
               how much of the palette moves. Scale is the loudest of them:
               every measurement on screen changes at once. */
            onRuled={(v) => withTheme(() => setRuled(v))}
            fontSize={fontSize}
            onFontSize={(v) => withTheme(() => setFontSize(v))}
            reduceMotion={reduceMotion}
            /* NOT WRAPPED, deliberately. This is the switch that turns motion
               off; animating the act of turning it off is the one place where
               a transition argues with what it is being asked to do. */
            onReduceMotion={setReduceMotion}
            dyslexiaFont={dyslexiaFont}
            onDyslexiaFont={(v) => withTheme(() => setDyslexiaFont(v))}
            grain={grain}
            onGrain={(v) => withSetting(() => setGrain(v))}
          />
        </main>
      ) : route.name === "modules" && flags["module.interior"] ? (
        <main className="content content-taxi">
          <ModulesPage
            activeModuleCode={activeModuleCode}
            onOpenModule={(code) => { setPreferredModuleCode(code); go(routePath.module(code)); }}
            onGoToChapter={goToChapter}
            onMakeActive={(code) => setPreferredModuleCode(code)}
          />
        </main>
      ) : route.name === "invite" ? (
        /* §6 — an invite link, and it gets a screen of its own rather than a
           modal over whatever was behind it. This is very often the FIRST page
           a new student ever sees, arriving from a group chat, so it carries no
           deck, no rail and no nav: one room, one decision. */
        <main className="content content-taxi">
          <InviteLanding
            me={me}
            token={route.token}
            onEnter={() => go(routePath.ready())}
            onFindInstead={() => go(routePath.ready())}
          />
        </main>
      ) : route.name === "redirect" ? (
        null
      ) : notFound ? (
        <main className="content content-taxi">
          <NotFound onGoHome={goHome} />
        </main>
      ) : view === "hub" || !flags["module.interior"] ? (
        /* Step 1 — the Flight Deck owns its whole column: it paints its own
           ground and carries its own light layers, so the shell's centred,
           padded .content would crop them. */
        <main className="content content-taxi content--deck">
          <Home
            finish={finish}
            activeModuleCode={activeModuleCode}
            livery={shownLivery}
            variant={variant}
            reduceMotion={reduceMotion}
            content={useTestContent}
            onEnterModule={enterModule}
            onGoToChapter={goToChapter}
            onResumePlace={resumePlace}
            onOpenReady={() => go(routePath.ready())}
            onOpenQuizzes={(code) => go(routePath.library(code, "quizzes"))}
            squadrons={squadrons}
            squadronMessages={roomMessages}
            seatCandidates={rightSeat}
            threads={session.threads}
            replies={session.replies}
            people={directory}
            onSquadronPost={postToSquadron}
            onOpenRoomAt={openRoomAt}
          />
        </main>
      ) : route.name === "paper" ? (
        (() => {
          const paper = modulePapers.find((x) => x.id === route.paperId) || null;

          /* THREE STATES, AND NONE OF THEM IS A BLANK PAGE (rule 10).

             Still fetching, genuinely not there, and still being processed are
             three different things and a reader arriving at any of them
             deserves to be told which. This used to return an empty <main> for
             all three, which is how a real uploaded paper opened as a black
             screen with nothing on it at all. */
          if (!paper && papersLoading) {
            return (
              <main className="content content-taxi content--full">
                <div className="paper-state"><p>Finding that paper…</p></div>
              </main>
            );
          }
          if (!paper) {
            return (
              <main className="content content-taxi content--full">
                <div className="paper-state">
                  <h1>That paper is not in this module</h1>
                  <p>It may have been removed, or the link may be to a paper
                     somebody keeps to themselves.</p>
                  <button type="button" className="nextgo"
                          onClick={() => go(routePath.library(activeModuleCode))}>
                    Back to the Library
                  </button>
                </div>
              </main>
            );
          }
          /* THE VIEWER, NOT THE READER. `paper.viewer` and the paused
             `library.reader` are two independent answers, and this is the one
             students get: scroll, bookmark a page, download. It cannot mark
             anything and imports nothing from the paused reader. */
          if (flags["paper.viewer"] && !readerOn) {
            return (
              <main className="content content-taxi content--full">
                <PaperViewer
                  paper={paper}
                  initials={initials(displayName)}
                  startPage={Number(new URLSearchParams(window.location.search).get("page")) || 1}
                  savedPages={savedPagesFor(paper.id)}
                  onToggleSave={(pg, on) => togglePageSave(paper, pg, on)}
                  onPlace={(pg) => progress.set("pw-paper-place", { paperId: paper.id, page: pg })}
                  onBack={() => go(routePath.library(activeModuleCode))}
                />
              </main>
            );
          }
          if (paper.status === "pending") {
            return (
              <main className="content content-taxi content--full">
                <div className="paper-state">
                  <h1>{paper.title}</h1>
                  <p>Still being prepared — its text layer and thumbnails are
                     being built. It opens as soon as they are done.</p>
                  <button type="button" className="nextgo"
                          onClick={() => go(routePath.library(activeModuleCode))}>
                    Back to the Library
                  </button>
                </div>
              </main>
            );
          }
          return (
            <main className="content content-taxi content--full">
              <ReaderV6
                paper={paper}
                moduleCode={activeModuleCode}
                me={me}
                /* `me` is the author id every mark is written under. This is
                   who that id belongs to, which is a different question and
                   was being asked of the same string. */
                identity={{ name: displayName, callsign: displayName }}
                onBack={() => go(routePath.library(activeModuleCode))}
                onPlace={(page) => progress.set("pw-paper-place", { paperId: paper.id, page })}
                onOpenThread={() => go(routePath.ready(activeModuleCode))}
                onOpenOriginal={(p) => window.open(fileHref(p.file), "_blank", "noopener")}
                /* THERE IS ONE LIVERY SYSTEM AND IT IS THE APP'S. The reader's
                   `--lv` is fed from it, and the picker in the reader's You
                   tray changes the app's livery rather than a private copy. */
                livery={shownLivery}
                variant={variant}
                onLivery={(id) => withTheme(() => { setLivery(id); progress.set("pw-livery", id); })}
              />
            </main>
          );
        })()
      ) : flags["module.screen"] && route.name === "lesson" ? (
        (() => {
          const chs = chaptersFor(activeModuleCode, useTestContent);
          const ch = chs.find((c) => c.id === route.chapterId) || chs[0];
          /* `?.` ON `lessons` TOO. A chapter is a quiz and a card set now, and
             its lessons array can be missing entirely — `undefined.find` throws
             inside a render, which is a white screen rather than the redirect
             below. */
          const ls = ch?.lessons?.find((l) => l.id === route.lessonId) || ch?.lessons?.[0];
          /* A LESSON LINK THAT NO LONGER RESOLVES IS NOT A BLANK PAGE.

             This returned `<main />` — an empty element, so the screen was the
             topbar, the background and nothing else, with no heading, no
             message and no way out but the browser's back button. It is
             reachable by ordinary means: a lesson link pasted into the class
             group chat, a bookmark, a chapter renumbered, or a module emptied
             out — which is exactly what happens the day placeholder content is
             cleared and everybody's saved links stop pointing at anything.

             The module screen is the right landing, not the not-found page:
             the MODULE still exists and still has something to say, and it is
             one level up from what was asked for. So the address is corrected
             to the module rather than left sitting on a lesson that is gone. */
          if (!ch || !ls) return null;   // the effect above is already moving us
          /* THE LESSON PAGE IS IN THE ORDINARY COLUMN NOW. It was
             `content--full`, which took it out of the 1100px reading column so
             the player could be bigger; the reference draws it in the same
             column as every other screen — 1056px of content, a
             minmax(0,1fr) + 300px grid inside it — and the player is what
             gives. See docs/launch/DECISIONS.md. */
          return (
            <main className="content content-taxi">
              {/* onComplete is the 90% half of the completion rule; the manual
                  half writes the same flag. One rule, because the lights, the
                  chapter state, the counts and the Flight Deck all read it. */}
              <LessonPage
                module={moduleByCode(activeModuleCode, useTestContent)} chapters={chs} chapter={ch} lesson={ls}
                state={moduleState} people={directory}
                /* The chapter's number, for the label a saved lesson carries in
                   its folder. The save itself points at the lesson's own id. */
                chapterNo={chaptersFor(activeModuleCode, useTestContent).findIndex((c) => c.id === ch.id) + 1}
                /* The stamp that goes down, and the angle it landed at — the
                   stored one when there is a sign-off, so it is the same angle
                   every time this page is opened. */
                stamp={myStamp}
                tilt={tiltOf(progress.get(SIGNOFF_KEY, {}), ls.id) ?? stampTilt(myStamp?.seed || 1, ls.id)}
                /* Who is in the right seat, so the logbook can name them and
                   the progress bar can draw their questions teal. null when
                   nobody is, which is the ordinary state — and the filter chip
                   named after them does not exist then. */
                seat={seat}
                /* The composer's face: this account's own profile row, so it
                   is the same face the app bar and the licence draw. */
                myFace={myProfile}
                onBack={() => go(routePath.module(activeModuleCode))}
                onOpenLesson={(c, l) => go(routePath.lesson(activeModuleCode, c.id, l.id))}
                onOpenQuiz={(c) => go(routePath.chapter(activeModuleCode, c.id, "quiz"))}
                onSeekSaved={(lessonId, pct) => {
                  progress.set("pw-lesson-pos", { ...moduleState.pos, [lessonId]: { pct } });
                  recordPlace({ kind: "lesson", chapterId: ch.id, lessonId, pct });
                }}
                onComplete={(lessonId) => recordLessonDone(lessonId, ch.id)}
                done={Boolean(moduleState.done[ls.id]) || (moduleState.pos[ls.id]?.pct ?? 0) >= 0.9}
                onMarkDone={(lessonId, on) => {
                  /* THE ANGLE IS CHOSEN HERE, once, and stored — §3 asks for a
                     random ±6° per sign-off. Voiding forgets it, because a
                     stamp pressed again is a new press and does not land in
                     the same place. */
                  const book = progress.get(SIGNOFF_KEY, {});
                  progress.set(SIGNOFF_KEY, on ? sign(book, lessonId) : unsign(book, lessonId));
                  if (on) return recordLessonDone(lessonId, ch.id);
                  // Un-marking clears the flag but leaves the logbook alone:
                  // the entry says it was finished at a moment, and it was.
                  progress.set("pw-lesson-done", { ...moduleState.done, [lessonId]: false });
                }}
              />
            </main>
          );
        })()
      ) : flags["module.screen"] && route.name === "review" ? (
        (() => {
          const chs = chaptersFor(activeModuleCode, useTestContent);
          const all = chs.flatMap((c) =>
            (c.questions || []).map((q) => ({ ...q, chapterId: c.id })));
          const ret = progress.get(RETENTION_KEY, emptyRetention());
          /* PUT RIGHT, and only that. The other flow through this route was
             Calibration's re-check — the answers you already had right, come
             round again — and Calibration is gone, row, route, set and date.
             What is left is the caution pile: the ones you missed, until you
             do not. */
          const set = all.filter((q) => q.id in (ret.caution || {}));
          const back = () => go(routePath.module(activeModuleCode));
          return (
            <main className="content content-taxi content--full">
              {set.length === 0 ? (
                <div className="quiz">
                  <div className="quiz-head">
                    <span className="quiz-name">Put right</span>
                    <button type="button" className="quiz-leave" onClick={back}>Close</button>
                  </div>
                  <div className="quiz-body">
                    <p className="q-rev-line">
                      Anything you miss lands here until you put it right.
                    </p>
                  </div>
                </div>
              ) : (
                <Review
                  // The set is latched at mount, so a fresh arrival is a fresh
                  // sitting rather than a reused one.
                  key={route.flow}
                  title="Put right"
                  questions={set}
                  onLeave={back}
                  onOpenLesson={(lessonId) => {
                    const owner = chs.find((c) => (c.lessons || []).some((l) => l.id === lessonId));
                    if (owner) go(routePath.lesson(activeModuleCode, owner.id, lessonId));
                  }}
                  onAnswer={(q, right) => recordAnswer(q.id, right, { fromCaution: true })}
                  // The re-check and put-right flows share Review, so they
                  // share its results screen — which weighs the sitting
                  // against the user's bar. Omitted here, `minimums` was
                  // undefined and QuizResults fell back to the pass mark, so
                  // these two screens judged by a different standard than
                  // every other lamp in the app.
                  minimums={minimums} />
              )}
            </main>
          );
        })()
      ) : flags["module.screen"] && route.name === "chapter" && route.tab === "quiz" ? (
        (() => {
          const chs = chaptersFor(activeModuleCode, useTestContent);
          const ch = chs.find((c) => c.id === route.chapterId) || chs[0];
          /* The effect above is already moving us to the module. Rendering an
             empty <main> in the meantime is what made this a blank screen. */
          if (!ch) return null;
          return (
            <main className="content content-taxi content--full">
              <QuizPage
                module={moduleByCode(activeModuleCode, useTestContent)} chapter={ch} state={moduleState}
                me={me}
                /* §2 — a face or a stamp opens the person, which on the board
                   means the pilot sheet this app already carries rather than
                   the pack's own popover. */
                onOpenPilot={openPilot}
                /* The chapter's NUMBER, which is its place in the module — the
                   word "Chapter 3" — and what a saved question is labelled
                   with. Nothing is saved against it: the save points at the
                   question's own id. */
                chapterNo={chaptersFor(activeModuleCode, useTestContent).findIndex((c) => c.id === ch.id) + 1}
                // §6 — the result screen weighs the sitting against the same
                // bar every other lamp in the app is weighed against.
                minimums={minimums}
                onAnswers={(results) => recordAnswers(results)}
                onScore={(chapterId, correct, total) => {
                  // Finishing clears the run: a finished quiz is a score, not
                  // a place to go back to.
                  const { [chapterId]: _done, ...rest } = moduleState.run;
                  progress.set("pw-quiz-run", rest);
                  recordQuiz(chapterId, correct, total);
                }}
                onRun={(chapterId, r) => {
                  if (r) {
                    progress.set("pw-quiz-run", { ...moduleState.run, [chapterId]: r });
                    recordPlace({ kind: "quiz", chapterId, at: r.at, total: r.total });
                  } else {
                    const { [chapterId]: _cleared, ...rest } = moduleState.run;
                    progress.set("pw-quiz-run", rest);
                  }
                }}
                onBack={() => go(routePath.module(activeModuleCode))}
                onOpenLesson={(lessonId) => {
                  // Going through the paper links back by lessonId — a join,
                  // never a semantic match on the question text.
                  const owner = chs.find((c) => (c.lessons || []).some((l) => l.id === lessonId));
                  if (owner) go(routePath.lesson(activeModuleCode, owner.id, lessonId));
                }}
              />
            </main>
          );
        })()
      ) : flags["module.screen"] ? (
        /* The rebuilt module screen. Behind its own flag so the hub keeps
           working while the Library, People and lesson pages are still being
           built out. */
        <main className="content content-taxi content--full">
          <ModuleScreen
            module={moduleByCode(activeModuleCode, useTestContent)}
            chapters={chaptersFor(activeModuleCode, useTestContent)}
            /* A module with nothing in it is not a module that is loading.
               The only thing that is ever awaited here is the seeded content
               document, and only while its flag is on. */
            contentPending={!!flags["content.test"] && !testContent}
            state={moduleState}
            tab={route.tab === "pdf" ? "library" : route.tab === "crew" ? "crew" : route.tab === "people" ? "people" : "route"}
            librarySub={route.sub === "quizzes" ? "quizzes" : "papers"}
            minimums={minimums}
            onOpenPaper={(paper) => openPaper(paper)}
            readerPin={readerPin}
            stamp={myStamp}
            /* The angle each lesson was signed off at, so the row and the
               lesson page draw the same stamp the same way round. */
            tilts={Object.fromEntries(Object.entries(progress.get(SIGNOFF_KEY, {})).map(([k, v]) => [k, v?.rot]))}
            /* CREW'S OWN DATA. `me` so crew.js can leave the student out of
               their own list, `mates` so a squadron mate gets the teal ring
               without being sorted to the top, and `myDone` so their own stamp
               goes on the walls of the chapters they have signed off. */
            me={me}
            mates={squadronMates}
            myDone={myCompleted}
            onOpenPerson={openPilot}
            onOpenThreads={() => go(routePath.ready(activeModuleCode))}
            /* A DEAD BUTTON, FOUND BY CLICKING IT. "Add a paper" rendered
               whenever this prop was passed, and the sheet behind it is gated
               on `papersOn` — the PAUSED reader's switch — so pressing it did
               nothing at all, silently, with no error. The click sweep is what
               noticed: clicked, and not one thing about the page changed.

               The upload path runs the reader's own ingest (pdf.js, a text
               layer, thumbnails) and that is paused, so there is nothing to
               wire it to today. It is withheld rather than shown broken: the
               one rule that has no exceptions is that a control reaches
               something. Papers arrive by being put in the module for now, and
               this comes back with the ingest. */
            onAddPaper={papersOn ? () => setAddingPaper(true) : null}
            /* One list, merged once, above. The Library must not know there
               are two sources. */
            papers={modulePapers}
            people={{
              // The callsigns behind the author ids. Threads themselves come
              // from the session, not from here — they are the same rows the
              // lesson screen shows. This was the fixture's five demo
              // callsigns ALONE, so a real author fell through to their raw
              // Clerk id; `directory` is the same list with live profiles in
              // front of it, which is what the room already uses.
              people: directory,
              wingman: null, groups: [], questions: [],
              // Real or absent. The figures this row is meant to carry —
              // how many have finished, the most replayed minute — have no
              // source yet, so it says what it will fill with rather than
              // inventing a number to look populated.
              moduleRow: { line: "Everyone working through this module.", facts: [] },
            }}
            /* EVERY TAB IN MODULE_TABS HAS A LINE HERE. It had two, and a
               default of "go to the module" — so Crew, the third tab, went to
               Lessons: the URL did not change, the strip stayed where it was,
               and pressing it looked like nothing happening. The route was
               built and verified; only this could not reach it. A tab that
               changes nothing is a bug, not a placeholder. */
            /* Crew's empty state offers two ways to fill it, and both open
               the Ready Room at the place that does the thing rather than a
               screen of their own: Discover is where a squadron is found, and
               the module's own feed is where you would say where you are. */
            onFindSquadron={() => openRoomAt({ kind: "discover", moduleCode: activeModuleCode })}
            onInviteClass={() => openRoomAt({ kind: "ask", moduleCode: activeModuleCode })}
            onTab={(t) => go(t === "library" ? routePath.library(activeModuleCode)
              : t === "crew" ? routePath.crew(activeModuleCode)
              : t === "people" ? routePath.people(activeModuleCode)
              : routePath.module(activeModuleCode))}
            onBack={() => go(routePath.home())}
            onOpenLesson={(ch, l) => go(routePath.lesson(activeModuleCode, ch.id, l.id))}
            /* go(), not navigate(). A navigation that calls the router
               directly skips the transition layer entirely, and this one was
               the quiz row on the Lessons list — opening a quiz cut hard while
               every other row on the same list moved. */
            onOpenQuiz={(ch) => go(routePath.chapter(activeModuleCode, ch.id, "quiz"))}
            onOpenQuestion={(target) => {
              // The one bridge from People back to the moment. A module post
              // has no moment, so watchAt() hands back null and there is
              // nothing to open — the row is not a door and must not act like
              // one.
              if (!target) return;
              const chs = chaptersFor(activeModuleCode, useTestContent);
              const ch = chs.find((c) => (c.lessons || []).some((l) => l.id === target.lessonId));
              if (!ch) return;
              requestWatch(target);
              go(routePath.lesson(activeModuleCode, ch.id, target.lessonId));
            }}
          />
          {/* Adding a paper is a sheet over the Library rather than a route:
              it is one action on one screen, and it has to be able to fail
              back to exactly where it was started. */}
          {papersOn && addingPaper && (
            <div className="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) setAddingPaper(false); }}>
              <Suspense fallback={<div className="addpaper"><p>Getting the tools…</p></div>}>
              <AddPaper
                moduleCode={activeModuleCode}
                content={useTestContent}
                me={me}
                isStaff={!!myProfile?.is_staff}
                onClose={() => setAddingPaper(false)}
                onAdded={(row) => {
                  setAddedPapers((held) => [...held.filter((p) => p.id !== row.id), row]);
                  setAddingPaper(false);
                }}
              />
              </Suspense>
            </div>
          )}
        </main>
      ) : (
        <main className="content content-taxi content--full">
          <ModuleHub
            moduleCode={activeModuleCode}
            tab={tab}
            onTab={switchTab}
            onSignIn={() => goSettings("auth")}
            onGoToChapter={goToChapter}
            initialChapterId={pendingChapterId}
            onInitialChapterConsumed={() => {}}
            onOpenPaper={(paper) => paper?.id && go(routePath.paper(activeModuleCode, paper.id))}
            chapterTab={route.tab && route.name === "chapter" ? route.tab : "brief"}
            onChapterTab={(chapterId, t) => go(routePath.chapter(activeModuleCode, chapterId, t))}
          />
        </main>
      )}
        </div>
      </RouteError>
      </Suspense>

      {/* The one <video>, INSIDE THE SCROLLER and outside the routed content.
          Inside, because it is absolutely positioned at the slot's offset and
          an absolutely-positioned child of a scroll container scrolls with that
          container for free — no scroll listener, so it cannot lag a frame
          behind the page the way a tracked element does.
          Outside .deck-inner, because that subtree is keyed by route name and
          remounts on every navigation, and re-parenting a <video> restarts
          playback in every browser. */}
      <PlayerLayer />
      </div>

    {/* THE DEMO'S GUIDE, over the real screens, inside `.app` so it has the
        livery's tokens. Only ever inside the demo. */}
    {/* `?noguide` shows the demo's data without the tutorial over it, for
        mapping its screens. Development only: a production build folds it
        away. */}
    {demoMode && !(import.meta.env.DEV && /[?&]noguide/.test(location.search)) && (
      <Suspense fallback={null}>
        <Guide go={(to) => go(to, { still: true })} warm={(paths) => paths.forEach((p) => { warmRoute(p); })} guest={Boolean(demoState?.guest)} hasStamp={Boolean(demoState?.look?.hasStamp)} onLeave={leaveDemoFor} />
      </Suspense>
    )}

    <DevPanel
      isAdmin={isAdmin}
      enabled={flags["dev.panel"]}
      progress={progress}
      modules={allModules(useTestContent)}
      chapters={chaptersFor(activeModuleCode, useTestContent)}
      moduleCode={activeModuleCode}
      onRecordLesson={recordLessonDone}
      onRecordQuiz={recordQuiz}
      onGo={(what, code, lesson) => {
        if (what === "module") go(routePath.module(code));
        else if (what === "library") go(routePath.library(code));
        else if (what === "people") go(routePath.people(code));
        else if (what === "lesson" && lesson) go(routePath.lesson(code, lesson.chapter.id, lesson.id));
        else if (what === "quiz" && lesson) go(routePath.chapter(code, lesson.chapter.id, "quiz"));
      }}
    />
    <ReportProblem route={typeof window !== "undefined" ? window.location.pathname : route.name} />
    {/* The app's one toast, and Bookmarks is what it was built for: a save has
        to be undoable and a failure has to say so, and neither can wait for a
        screen. Mounted once here rather than per screen, so a toast raised on
        the way OUT of a page survives the navigation that raised it. */}
    {/* One <filter> per ink seed on screen, shared. §8: "Crew walls with 100+
        stamps stay smooth… share the filter defs." */}
    {pilotSheet && (
      /* §5 — the profile viewer. The sheet draws that person's licence card
         and offers what you can actually do with them: ask for the right seat
         and open the chat when you are already squadron mates, invite them
         when you are not. Each action leaves for the Ready Room, which is
         where every one of them lives — this dialog starts them, it does not
         reimplement them. */
      <PilotSheet pilot={pilotSheet} channelId={activeModuleCode}
                  mates={squadrons.some((sq) => (sq.members || []).includes(pilotSheet.user_id))}
                  onInvite={(id) => { setPilotSheet(null); openRoomAt({ kind: "person", id }); }}
                  onSeat={(id) => {
                    setPilotSheet(null);
                    if (me) askRightSeat(me, id).catch(() => {});
                    openRoomAt({ kind: "seat" });
                  }}
                  onChat={() => {
                    setPilotSheet(null);
                    openRoomAt({ kind: "module", moduleCode: activeModuleCode });
                  }}
                  onClose={() => setPilotSheet(null)}
                  /* Blocking or muting somebody changes what the room may
                     show, and this was an empty function — so the person you
                     had just blocked stayed on screen until a reload. */
                  onChanged={refreshRoom} />
    )}
    <StampFilters />
    <BookmarksToastHost />
    </UsernameGate>
    </FirstFlightGate>
    {/* A child of .app, and fixed to the viewport from there — measured, not
        assumed: the chin's bottom edge sits exactly at window.innerHeight.
        What would break that is an ancestor with transform, filter,
        perspective, contain or will-change, which makes a position:fixed
        descendant resolve against THAT element instead of the viewport. The
        aurora rig has filter: blur() and will-change, but it is a SIBLING
        (.deck-light is absolute, inset 0) rather than an ancestor, so it
        cannot capture this. The shell's own overflow: hidden does not capture
        fixed either — only the properties listed above do. */}
    <RunwayLights route={route.name} />
      <style>{`
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/otf/OpenDyslexic-Regular.otf') format('opentype');
          font-weight: 500;
          font-display: swap;
        }
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/otf/OpenDyslexic-Bold.otf') format('opentype');
          font-weight: 600;
          font-display: swap;
        }
        * { box-sizing: border-box; }
        /* §5.1 — form controls do not inherit font-family, so every button that
           did not set one explicitly fell out of the type system into the
           browser's default (Arial here, -apple-system elsewhere) at 13.33px.
           This is the whole of that bug, in one line. */
        button, input, textarea, select { font: inherit; letter-spacing: inherit; }
        /* §12 — "Minimum hit target 44px everywhere." Enforced globally rather
           than per component, because it had leaked in eleven places: the brand,
           the streak pill, the avatar, module tabs, search fields, the bookmark
           star, chips, and most of the profile form. Opt out with .is-inline for
           the rare control that genuinely sits inside a line of text.

           THE OPT-OUT NOW COVERS INPUTS TOO, which is what the sentence above
           always said and the selector did not do. It cost 43px on the licence
           card: the callsign field IS that card's heading and the bio field IS
           its line of prose, and both were pushed from 33 and 26 to 44 against
           a signed-off design. A text field sitting inside a line of text is
           the same exception as a button sitting inside one. Every control
           that is a target rather than a sentence — including that card's own
           Cover button — still gets the floor. */
        .app button:not(.is-inline),
        .app [role="tab"],
        .app input:not([type="checkbox"]):not([type="radio"]):not(.is-inline),
        .app select:not(.is-inline),
        .app textarea:not(.is-inline) { min-height: 44px; }
        *:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        ::selection { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); }
        ::-moz-selection { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: var(--r-md); border: 2px solid var(--bg); }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        * { scrollbar-width: thin; scrollbar-color: var(--border-hover) var(--bg); }
        /* No height:100%. It pinned html to the viewport, so the document
           could not scroll even once the inner container was gone — body knew
           it was 1430px tall and html insisted it was 880. */
        html, body, #root { margin: 0; background: var(--surface-0); }
        .app {
          /* The component layer. Every name below resolves to a §3.6 semantic
             and to nothing else — no component may reference a --mono-* step
             directly. Old names are kept as aliases so screens repaint without
             a rewrite; they are retired screen by screen, not in one sweep.

             v2 is monochrome: warm and cold are gone as colour. What was the
             cold channel is now accent-interactive (value, not hue), and what
             was the warm channel is presence — light temperature, not paint. */
          --surface-0: var(--bg-ground);
          --surface-1: var(--bg-panel);
          --surface-2: var(--bg-raised);
          --text-1: var(--text-primary);
          --text-2: var(--text-secondary);
          --text-3: var(--text-tertiary);
          --cold: var(--accent-interactive);
          /* --warm was mostly used as "the primary fill", not as presence. In
             monochrome that is accent-interactive — the brightest thing on a
             dark page. Real presence is --presence below, and it is light, not
             paint; anything filling a button with it would be dark on dark. */
          --warm: var(--accent-interactive);

          --bg: var(--bg-ground);
          --panel: var(--bg-panel);
          --panel-alt: var(--bg-panel);
          --elev-0: var(--bg-ground);
          --elev-1: var(--bg-panel);
          --elev-2: var(--bg-raised);
          --well: var(--bg-ground);
          --border: var(--hairline);
          --border-soft: var(--hairline);
          --border-hover: var(--hairline-bevel);
          --text: var(--text-primary);
          --text-soft: var(--text-2);
          --muted: var(--text-2);
          --muted2: var(--text-3);
          --accent: var(--cold);
          --accent-hover: var(--cold);
          --accent-tint: var(--cold);
          --accent-dim: color-mix(in srgb, var(--cold) 35%, transparent);
          --accent-muted: color-mix(in srgb, var(--cold) 70%, var(--text-2));
          --accent-soft: color-mix(in srgb, var(--cold) 12%, transparent);
          --accent-glow: color-mix(in srgb, var(--cold) 18%, transparent);
          --on-accent: var(--surface-0);
          --presence: var(--presence-lit);
          --presence-soft: var(--presence-panel);
          --presence-glow: var(--presence-lit);
          --on-presence: var(--text-primary);
          --good: var(--cold);
          /* LOAD-BEARING, AND IT DOES NOT LOOK IT. This line is what enforces
             "no red on a wrong quiz answer".

             quiz.css marks a wrong option with var(--bad) and its comment says
             --bad is a semantic red, deliberately outside the livery. The
             livery engine agrees and writes --bad: oklch(.620 .180 25) -- a
             true red, hue 1 -- onto :root. This declaration overrides it for
             everything inside .app, which is everything the user ever sees, so
             a wrong answer renders at hue 209: the same blue-grey as --calm,
             which is exactly what the design rule asks for.

             Measured, both of them: --bad is hue 1 on :root and hue 209 on
             .app. Delete this line as redundant and every wrong answer in the
             app turns red, and no test will catch it. --danger stays red on
             purpose (hue 358) -- that one is for genuine danger states. */
          --bad: var(--text-2);
          --destructive: var(--danger);
          --calm: var(--text-2);
          --avatar-bg: var(--surface-2);
          /* §6.1 — elevation comes from lightness, not shadow. Dark UIs that
             drop-shadow look muddy; ones that step lightness look machined. A
             card gets a hairline and a step, and nothing else. --shadow-2 is
             kept for true overlays only, which §6.1 allows above the two
             surface levels. */
          /* §6.3 — panel 12 · control 8 · chip 6 · avatar full. The old names
             are kept as aliases; --r-sm was doing control duty at 12px, which is
             why nested corners never looked calculated. */
          font-variant-numeric: tabular-nums;
          font-family: var(--font-ui);
          background: var(--surface-0);
          color: var(--text-1);
          /* THE SHELL. Three rows — header, scroller, runway lights — and the
             light rig behind all of them. Short pages have no dead space by
             construction, because the shell is always exactly one viewport. */
          /* THE SHELL, restored. The app is exactly one viewport tall and does
             not scroll; .deck scrolls inside it. Short pages have no dead space
             by construction, and the chin sits at the foot of the screen rather
             than at the foot of a document that may be shorter than the screen.

             overflow: hidden, NOT clip. Both stop the app itself scrolling, but
             clip is one of the properties that makes a position:fixed
             descendant resolve against THAT element instead of the viewport —
             the trap that broke the chin and the player last time. hidden on
             a non-transformed element does not capture fixed, and the runway
             lights are measured against the viewport after this change to prove
             it. */
          height: 100dvh;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr auto;
          padding: 0;
          position: relative;
        }
        /* The scroller's own rules live in Deck.jsx, next to the rest of it —
           min-height: 0, the overflow, the safe centring. They were duplicated
           here and this copy won on specificity, which made Deck.jsx look
           authoritative while being ignored. The chin reservation lives in
           app.css with the other .deck padding. */
        /* A gate that blocks — first flight, the username prompt — renders as
           the only child, and would otherwise be squashed into the header row. */
        .app > *:only-child { grid-row: 1 / -1; }
        h1, h2, h3, h4 { font-family: var(--font-ui); letter-spacing: -0.01em; }
        .app { font-variant-numeric: tabular-nums; }
        [class*="mono"], [class*="-code"], [class*="-value"], [class*="-count"], [class*="stat"] {
          font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1; }
        /* §6.6 — the grain texture is deleted: on OLED it reads as compression
           artefacts, not as paper. */
        /* wingman-poc.html:59. z-index 20 is the important half: at 1 the
           header made a stacking context that trapped the menu's z-index 40
           inside it, and .deck > main is also 1 and later in the DOM, so page
           content painted straight over the open menu. It read as the menu
           being transparent; it was paint order. */
        /* z-index 20 stays: it is what keeps the account menu above page content.
           sticky is now redundant — the header is a grid row and cannot scroll
           away — but harmless, and removing it would be a second change. */
        /* Full bleed. The bar used to be capped at 1240 and centred, so on a
           wide screen the wordmark and the avatar sat well inside the glass
           with dead space outboard of them. They belong in the corners. */
        /* Row 1 by name, for the same reason .deck is row 2 by name: the
           two must not depend on each other's presence to be placed. */
        .topbar { grid-row: 1; position: relative; z-index: 20;
          display: flex; align-items: center; gap: 12px; padding: 14px 24px 12px;
          width: 100%; }
        @media (max-width: 640px) { .topbar { padding: 14px 16px 12px; } }
        .brandmark { margin-right: auto; min-height: 0; background: none; border: 0; padding: 0;
          cursor: pointer; color: var(--t1); font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
        .brandmark:hover { color: var(--t1); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .module-banner { position: relative; padding: 26px 22px 18px; }
        .module-banner::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 100% at 25% 0%, var(--accent-soft), color-mix(in oklab, var(--accent-soft), transparent 100%) 70%); pointer-events: none; z-index: 0; }
        .module-banner > div { position: relative; z-index: 1; }
        .module-banner h1 { font-family: var(--font-display); font-size: 28px; margin: 0 0 4px; color: var(--text); }
        .module-banner p { color: var(--muted); font-size: 12px; margin: 0; font-family: var(--font-ui); }
        /* THE .tabbar BLOCK IS GONE, and .tab is why it had to be. It was an
           older tab strip — .tabbar, .tab, .tab.is-active, the sliding
           ::after underline and a turbulence shake — declared GLOBALLY here,
           and nothing has rendered .tabbar or is-active/is-shaking in
           months. .tab is a different matter: it is the class the reference
           build gives every tab on the module screen, and this rule reached
           every one of them with a 22px right margin.

           What that cost, measured at 390: the strip's three tabs took 241px
           of a 312px row instead of 197, and the search field beside them —
           the only thing in the row that can give — was left 22px wide with
           4px of input in it, overflowing the strip's right edge by 7. The
           tabs looked right, so it read as a broken search field rather than
           as a margin nothing had asked for.

           check:collisions passed it: the rule is bare here and scoped in
           ref-module.css, which it calls the shared-base shape. A tab strip
           from two designs is not a shared base. */
        .content { max-width: 780px; margin: 28px auto 0; padding: 0 22px; zoom: var(--font-scale, 1); }
        .content--full { max-width: none; padding: 0 22px; zoom: var(--font-scale, 1); }
        @media (min-width: 1024px) {
          .content { max-width: 1100px; }
        }
        /* §4.6 — page transitions do not animate. */ }
        .btn-primary { display: flex; align-items: center; gap: 6px; justify-content: center; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-md); padding: 12px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: var(--accent-hover); }
        .boarding-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; animation: boardingFade 2.4s ease forwards; }
        .boarding-pass { width: min(320px, 84vw); background: var(--panel); border: 1px solid var(--border-hover); border-radius: var(--r-lg); padding: 22px; }
        .boarding-pass-top { display: flex; align-items: center; justify-content: space-between; color: var(--accent); margin-bottom: 14px; }
        .boarding-pass-airline { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; color: var(--muted2); }
        .boarding-pass-welcome { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; color: var(--accent); margin-bottom: 10px; }
        .boarding-pass-route { font-family: var(--font-display); font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
        .boarding-pass-row { display: flex; gap: 22px; margin-bottom: 16px; }
        .boarding-pass-row label { display: block; font-family: var(--font-mono); font-size: 12px; color: var(--muted2); letter-spacing: 0.06em; margin-bottom: 3px; }
        .boarding-pass-row span { font-family: var(--font-display); font-size: 16px; color: var(--text); font-weight: 600; }
        .boarding-pass-barcode { height: 30px; background: repeating-linear-gradient(90deg, var(--text) 0 2px, color-mix(in oklab, var(--text), transparent 100%) 2px 5px); opacity: 0.35; border-radius: 6px; }
        .boarding-trivia { width: min(320px, 84vw); display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: var(--muted); line-height: 1.4; }
        .boarding-trivia-label { flex-shrink: 0; font-family: var(--font-ui); font-size: 12px; color: var(--accent); border: 1px solid var(--border-hover); border-radius: var(--r-sm); padding: 2px 6px; }
        @keyframes boardingFade {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .pa-toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 90; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); font-family: var(--font-ui); font-size: 12px; padding: 8px 16px; border-radius: var(--r-md); animation: paFade 1.6s ease forwards; }
        @keyframes paFade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        /* §15 — no red outside a destructive confirmation, and no colour that
           is not a livery channel. The zones run cold to warm instead. */
        .storage-warning { position: relative; z-index: 90; background: rgba(224,102,90,0.15); border-bottom: 1px solid var(--bad); color: var(--text); font-size: 12px; text-align: center; padding: 8px 16px; }
        @media (prefers-reduced-motion: reduce) {
          .boarding-overlay { animation-duration: 0.4s; }
          .content-taxi { animation: none; }
        }
        .app.reduce-motion .boarding-overlay { animation-duration: 0.4s; }
        .app.reduce-motion .content-taxi { animation: none; }
      `}</style>
    </div>
  );
}
