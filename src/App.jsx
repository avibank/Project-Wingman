import "./styles/foundations.css";
import "./styles/fonts.css";
import "./styles/app.css";
import { useState, useRef, useEffect, lazy, Suspense, useMemo, useCallback } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { flushSync } from "react-dom";
import { parseRoute, path as routePath } from "./lib/routes.js";
import { titleForRoute, useDocumentTitle } from "./lib/title.js";
import { FLY_SOLO_KEY, mirrorFlySolo } from "./lib/flySolo.js";
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
  readyOld: chunk(() => import("./components/ReadyRoom.jsx")),
  modules: chunk(() => import("./components/ModulesPage.jsx")),
  moduleHub: chunk(() => import("./components/ModuleHub.jsx")),
  module: chunk(() => import("./components/module/ModuleScreen.jsx")),
  lesson: chunk(() => import("./components/module/LessonPage.jsx")),
  quiz: chunk(() => import("./components/module/QuizPage.jsx")),
  dev: chunk(() => import("./components/DevPanel.jsx")),
  pdf: chunk(() => import("./components/PdfPanel.jsx")),
  roomShell: chunk(() => import("./components/room/ReadyRoom.jsx")),
  settings: chunk(() => import("./components/SettingsPage.jsx")),
  profile: chunk(() => import("./components/Profile.jsx")),
  progress: chunk(() => import("./components/ProgressPage.jsx")),
  bookmarks: chunk(() => import("./components/BookmarksPage.jsx")),
};
const NotFound = lazy(CHUNK.notFound);
import { engineLivery, deckVars, DEFAULT_LIVERY, RETIRED_TO_FINISH } from "./lib/liveryEngine.js";
import { finishVars, ruledLayer } from "./lib/finishEngine.js";
import { useFlags } from "./lib/flags.js";
import { fetchAllPresence } from "./lib/presence.js";
import { ChevronRight, Lock, Plane } from "lucide-react";
const ChaptersPanel = lazy(CHUNK.chapters);
import Home from "./components/Home.jsx";
const ReadyRoom = lazy(CHUNK.readyOld);
const ModulesPage = lazy(CHUNK.modules);
import RootNav from "./components/RootNav.jsx";
import RunwayLights from "./components/RunwayLights.jsx";
import Deck from "./components/Deck.jsx";
const ModuleHub = lazy(CHUNK.moduleHub);
import { MODULE_TABS } from "./components/module/ModuleScreen.jsx";
const ModuleScreen = lazy(CHUNK.module);
const LessonPage = lazy(CHUNK.lesson);
const QuizPage = lazy(CHUNK.quiz);
import { moduleByCode, chaptersFor, papersFor, allModules, loadTestContent } from "./components/module/moduleContent.js";
const DevPanel = lazy(CHUNK.dev);
import RouteError from "./components/RouteError.jsx";
import ReportProblem from "./components/ReportProblem.jsx";
const PdfPanel = lazy(CHUNK.pdf);
import ProfileMenu from "./components/ProfileMenu.jsx";
import ReadyRoomPill from "./components/ReadyRoomPill.jsx";
const ReadyRoomShell = lazy(CHUNK.roomShell);
const SettingsPage = lazy(CHUNK.settings);
const Profile = lazy(CHUNK.profile);
const ProgressPage = lazy(CHUNK.progress);
const BookmarksPage = lazy(CHUNK.bookmarks);
const AuthPage = lazy(() => import("./components/AuthPage.jsx"));
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
import { transitionKind, canTransition, clearMorph, markMorphTarget, settleDom, withTheme, withSetting, beginTransition, endTransition } from "./lib/viewTransition.js";
import { PLACE_KEY, placeTarget, pushPlace } from "./lib/lastPlace.js";
import { postModulePost, postReply } from "./lib/lessonSurface.js";
import {
  RETENTION_KEY, emptyRetention, toHolding, toCaution, recheckSet,
} from "./lib/retention.js";
import Review from "./components/module/Review.jsx";
import { triggerHaptic } from "./lib/haptics.js";
import { badgeCount, normalisePresence } from "./lib/roomModel.js";
import { MINIMUMS_KEY, clampMinimums, readMinimums } from "./lib/minimums.js";
import { fetchReplyVotes, toggleReplyVote, setBestReply } from "./lib/threads.js";
import { fetchMySquadrons, fetchSquadronMessages, postSquadronMessage, fetchRightSeat } from "./lib/roomData.js";
import { fetchProfiles } from "./lib/squadron.js";
import { reportContent, blockUser } from "./lib/squadron.js";
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <UserProgressProvider>
      {/* Session sits above the router on purpose. The one <video> is mounted
          by PlayerLayer inside it, as a sibling of the routed content, so
          navigating never unmounts or re-parents it — re-parenting a video
          restarts playback in every browser, and not restarting it is the
          whole point of the mini player. */}
      <SessionProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
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
  const { isSignedIn, user } = useUser();
  const { flags, isAdmin } = useFlags();
  // §2.2 — the URL is the navigation state. `view`, `settingsPage`, `tab` and
  // the pending chapter are all derived from it now, so back, deep links and
  // sharing work without any of them being stored twice.
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseRoute(location.pathname);

  useDocumentTitle(titleForRoute(route));

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
  const MODULE_ROUTES = new Set(["module", "chapter", "lesson", "review"]);
  const view = MODULE_ROUTES.has(route.name) ? "module" : "hub";
  const settingsPage =
    route.name === "signin" ? "auth"
    : route.name === "logbook" && flags["page.logbook"] ? "progress"
    : route.name === "saved" && flags["page.bookmarks"] ? "bookmarks"
    : route.name === "settings" ? (route.page === "index" ? "about" : route.page)
    : null;
  // A silent fall-through to the Flight Deck is worse than "nothing here".
  // These routes stay registered, but they say so until they are built — and
  // /admin says nothing at all to anyone who is not an admin.
  const notFound =
    route.name === "notfound"
    || (route.name === "modules" && !flags["module.interior"])
    || (route.name === "ready" && !flags["social.readyroom"])
    || (route.name === "logbook" && !flags["page.logbook"])
    || (route.name === "saved" && !flags["page.bookmarks"]);

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
  // mounts the component <BrowserRouter>, where the option is accepted and
  // silently ignored: verified by hooking document.startViewTransition and
  // watching it never get called while the route changed underneath it.
  //
  // So the transition is started explicitly, and navigate() runs inside
  // flushSync so React has committed the new screen before the browser takes
  // its "after" snapshot. Without flushSync the update is still queued when
  // the snapshot is taken and both frames are the OLD page — an animation
  // between a thing and itself.
  /* Which chunks a path needs, and a bounded wait for them.
     Keyed on the parsed route name so it cannot drift from the router. The
     bound exists because a click must never feel dead: past it, the caller
     drops the transition and navigates plainly, which is what the app did
     before any of this existed. */
  const warmRoute = async (to) => {
    const name = parseRoute(to).name;
    const needed = ({
      module: [CHUNK.module], chapter: [CHUNK.module, CHUNK.quiz],
      lesson: [CHUNK.lesson], review: [CHUNK.module],
      ready: [CHUNK.roomShell], modules: [CHUNK.modules],
      profile: [CHUNK.profile], settings: [CHUNK.settings],
      logbook: [CHUNK.progress], saved: [CHUNK.bookmarks],
      notfound: [CHUNK.notFound],
    })[name] || [];
    if (!needed.length) return true;          // the deck is not split
    let timer;
    const timeout = new Promise((res) => { timer = setTimeout(() => res(false), 600); });
    // import() resolves from the module cache after the first call, so this is
    // a settled promise on every visit but the first.
    const loaded = Promise.all(needed.map((f) => f())).then(() => true, () => false);
    const ok = await Promise.race([loaded, timeout]);
    clearTimeout(timer);
    return ok;
  };

  const go = async (to, { keepScroll = false } = {}) => {
    let kind = canTransition() ? transitionKind(route, to) : null;
    const move = () => { navigate(to); };

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
      const warmed = await warmRoute(to);
      if (!warmed) kind = null;
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
    const resetScroll = () => {
      if (!keepScroll && deckRef.current) deckRef.current.scrollTop = 0;
    };

    if (!kind) {
      clearMorph();             // nothing will animate, so drop any morph name
      move();
      resetScroll();
    } else {
      // The token, not the attribute. See endTransition: a navigation that is
      // superseded before it settles must not tear down the one that replaced
      // it, which is the glitch when moving back and forth quickly.
      const token = beginTransition(kind);
      // BOTH PROMISES ARE CAUGHT, and they have to be. A transition that is
      // interrupted — a second navigation before the first settles, a tab
      // hidden mid-flight — rejects `ready` and `finished`, and an unhandled
      // rejection is a real console error on a perfectly ordinary double tap.
      // Seen once as "InvalidStateError: Transition was aborted because of
      // invalid state" before this was added. Interruption is normal here, so
      // it is swallowed rather than reported; the navigation itself already
      // happened inside the callback and is unaffected.
      const vt = document.startViewTransition(async () => {
        flushSync(move);
        // flushSync commits immediately when nothing suspends. When the route
        // is code-split it DOES suspend — React.lazy suspends on its first
        // render whatever the module cache holds — so the commit lands a frame
        // or two later and this waits for it. Without the wait the browser
        // photographs the old page as the "after" frame and animates it
        // against itself.
        await settleDom();
        // The new screen exists now, so the scroller has its real content and
        // resetting it means what it says. Before settleDom it would clamp
        // against whatever was still mounted.
        resetScroll();
        // The new screen is in the DOM and the after-snapshot has not been
        // taken yet. This holds it until the returning card exists — the deck
        // commits before its cards do — and gives up quickly if it never does.
        await markMorphTarget(kind, route);
      });
      vt.ready?.catch(() => {});
      vt.finished?.catch(() => {}).finally?.(() => { endTransition(token); });
    }
  };
  // A BACKSTOP, not the cleanup. The morph name is written on one element for
  // the length of one transition, and a card that kept it would collide with
  // the next move, because a view-transition-name has to be unique in the
  // document. `finished` above is what normally clears it, on the exact frame
  // the transition ends. This only covers the case where that promise never
  // settles at all — long enough not to cut a running transition short.
  useEffect(() => {
    const t = setTimeout(() => {
      clearMorph();
      delete document.documentElement.dataset.vt;
    }, 1200);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const goSettings = (page) =>
    go(page === "auth" ? routePath.signin()
      : page === "progress" ? routePath.logbook()
      : page === "bookmarks" ? routePath.saved()
      : routePath.settings(page));
  const goHome = () => go(routePath.home());

  // §4.4 — the door warms when people are in there, and only then.
  const [onFrequency, setOnFrequency] = useState(0);
  useEffect(() => {
    let live = true;
    fetchAllPresence(user?.id)
      .then((rows) => live && setOnFrequency((rows || []).length))
      .catch(() => {});
    return () => { live = false; };
  }, [user?.id]);
  const [bookmarksMode, setBookmarksMode] = useState("list");
  // The persisted "active module" is a preference the hero on Home reads.
  // Inside a module the URL wins.
  const [preferredModuleCode, setPreferredModuleCode] = useState(MODULES.find((m) => m.status === "active")?.code || MODULES[0].code);
  const activeModuleCode = route.moduleCode || preferredModuleCode;

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
    loadTestContent().then((c) => { if (live) setTestContent(c); });
    return () => { live = false; };
  }, [flags]);
  const useTestContent = testContent;

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
  const recordAnswer = (questionId, right, { fromCaution = false } = {}) => {
    const cur = progress.get(RETENTION_KEY, emptyRetention());
    progress.set(RETENTION_KEY, right
      ? toHolding(cur, questionId, { fromCaution })
      : toCaution(cur, questionId));
  };

  const recordPlace = (place) =>
    progress.set(PLACE_KEY,
      pushPlace(progress.get(PLACE_KEY, null), { ...place, moduleCode: activeModuleCode }));

  // Resume goes to the address the place names. A paper has no in-app address
  // — it is the browser's own PDF viewer in another tab — so that one reopens
  // the file rather than routing.
  const resumePlace = (place) => {
    const target = placeTarget(place, routePath);
    if (!target) return;
    if (target.file) window.open(`/${target.file.replace(/^\//, "")}`, "_blank", "noopener");
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
  const [turbulence, setTurbulence] = useState(true);
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
    const storedLivery = progress.get("pw-livery", DEFAULT_LIVERY);
    setLivery(engineLivery(storedLivery));
    // Aurora was a livery before it was a finish. Someone stored as aurora gets
    // sky plus the aurora finish, so the thing they picked still looks like the
    // thing they picked.
    setFinish(progress.get("pw-finish", RETIRED_TO_FINISH[storedLivery] ?? null));
    setRuled(progress.get("pw-ruled", true));
    setVariantPin(progress.get("pw-variant-pin", null));
    setGrain(progress.get("pw-grain", true));
    setDyslexiaFont(progress.get("pw-dyslexia-font", false));
    setTurbulence(progress.get("pw-turbulence", true));
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
    if (!hydrated) return;
    progress.set("pw-turbulence", turbulence);
  }, [turbulence, hydrated]);
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

  // The room renders its own copy of the profile menu, so what the menu does
  // has to live somewhere both can reach rather than being written out twice.
  const goProfile = (page) => {
    setBookmarksMode("list");
    if (page === "licence" || page === "preferences" || page === "appearance") go(routePath.profile(page));
    else goSettings(page);
  };

  /* ------------------------------------------------- the room's shared data */
  // The discussion for whichever module is in front of you, from the shared
  // tables. Re-run on the module, so walking between modules loads each one
  // once and keeps what it already had.
  useEffect(() => { loadDiscussion?.(activeModuleCode); }, [activeModuleCode, loadDiscussion, me]);

  // Squadrons, their chat, and the right seat. These were literal empty arrays
  // — the room drew its own empty states perfectly over nothing at all.
  const [squadrons, setSquadrons] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  const [rightSeat, setRightSeat] = useState([]);
  useEffect(() => {
    if (!isSignedIn || !flags["social.readyroom"]) { setSquadrons([]); setRoomMessages([]); setRightSeat([]); return undefined; }
    let live = true;
    (async () => {
      const sqs = await fetchMySquadrons(me);
      if (!live) return;
      setSquadrons(sqs);
      const [msgs, seat] = await Promise.all([
        fetchSquadronMessages(me, sqs.map((x) => x.id)),
        fetchRightSeat(me, sqs),
      ]);
      if (!live) return;
      setRoomMessages(msgs);
      setRightSeat(seat);
    })();
    return () => { live = false; };
  }, [isSignedIn, me, flags]);

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
  const [profiles, setProfiles] = useState([]);
  const authorIds = useMemo(() => {
    const ids = new Set();
    for (const t of session.threads) if (t.authorId) ids.add(t.authorId);
    for (const r of session.replies) if (r.authorId) ids.add(r.authorId);
    for (const m of roomMessages) if (m.authorId) ids.add(m.authorId);
    return [...ids].sort().join(",");        // a stable key, so the effect
  }, [session.threads, session.replies, roomMessages]);   // runs on CHANGE only
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

  const switchTab = (nextTab) => {
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
      }
    }
    scrollPositions.current[tab] = deckRef.current?.scrollTop || 0;
    // Through go(), so the tab slide applies here as it does on the profile —
    // keepScroll because this restores each tab's own position below, and go()
    // would otherwise send both to the top.
    go(nextTab === "pdf" ? routePath.library(activeModuleCode) : routePath.module(activeModuleCode),
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
    if (turbulence) triggerHaptic();
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
    <UsernameGate>
    <FirstFlightGate>
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
        <header className="topbar">
          <button className="brandmark" onClick={goHome} aria-label="Go to Flight Deck">
            Wingman
          </button>
          <div className="topbar-right">
            {/* §8 — the Ready Room takes the spot the streak pill held. One
                number in the app bar, and it counts things addressed to you. */}
            <ReadyRoomPill count={roomBadge} onGo={() => go(routePath.ready())} />
            <ProfileMenu onNavigate={goProfile} />
          </div>
        </header>
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
            chapters={chaptersFor(activeModuleCode, useTestContent)}
            threads={session.threads}
            replies={session.replies}
            people={directory}
            presence={normalisePresence(useTestContent?.presence || [])}
            squadrons={squadrons}
            messages={roomMessages}
            seatCandidates={rightSeat}
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
            brand={<button type="button" className="brandmark" onClick={goHome}
                           aria-label="Go to Flight Deck">Wingman</button>}
            profile={<ProfileMenu onNavigate={goProfile} />}
            seen={progress.get("pw-room-seen", {})}
            onSeen={(id) => progress.set("pw-room-seen",
              { ...progress.get("pw-room-seen", {}), [id]: Date.now() })}
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
                mutate((sx) => postReply(sx, { threadId: ev.threadId, body: ev.body, authorId: me }));
                return;
              }
              if (ev.kind === "thread") {
                // §5 — asked in the room, so it carries a title and no lesson.
                mutate((sx) => postModulePost(sx, {
                  moduleId: ev.moduleId, body: ev.body, title: ev.title, authorId: me,
                }));
                return;
              }
              if (ev.kind === "message") {
                const sq = squadrons.find((x) => x.id === ev.squadronId);
                postSquadronMessage({
                  me, squadronId: ev.squadronId, moduleCode: sq?.moduleCode, body: ev.body,
                }).then((row) => { if (row) setRoomMessages((ms) => [...ms, row]); });
              }
            }}
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
          <AuthPage onBack={() => go(-1)} />
        </main>
      ) : settingsPage === "progress" ? (
        <main className="content content-taxi">
          <ProgressPage onBack={() => go(-1)} />
        </main>
      ) : settingsPage === "bookmarks" ? (
        <main className="content content-taxi">
          <BookmarksPage onBack={() => go(-1)} initialMode={bookmarksMode} />
        </main>
      ) : settingsPage ? (
        <main className="content content-taxi">
          {/* No page prop: /settings/:page is parsed by the router and mapped
              here, but this screen has no sub-pages — the profile tabs moved to
              /account/*. It was passed and ignored, which is the same shape as
              the bug that hid the quiz's place-keeping. */}
          <SettingsPage onBack={() => go(-1)} />
        </main>
      ) : route.name === "profile" ? (
        <main className="content content-taxi content--profile">
          <Profile
            page={route.tab}
            onNavigate={(t) => go(routePath.profile(t))}
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
            turbulence={turbulence}
            onTurbulence={(v) => withSetting(() => setTurbulence(v))}
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
      ) : route.name === "ready" && flags["social.readyroom"] ? (
        <main className="content content-taxi">
          <ReadyRoom
            moduleCode={route.moduleCode}
            onGoToChapter={(m, c, tab) => go(routePath.chapter(m, c, tab))}
            onOpenChannel={(m) => go(routePath.ready(m))}
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
            onOpenChannel={(code) => go(routePath.ready(code))}
          />
        </main>
      ) : flags["module.screen"] && route.name === "lesson" ? (
        (() => {
          const chs = chaptersFor(activeModuleCode, useTestContent);
          const ch = chs.find((c) => c.id === route.chapterId) || chs[0];
          const ls = ch?.lessons.find((l) => l.id === route.lessonId) || ch?.lessons[0];
          if (!ch || !ls) return <main className="content content-taxi content--full" />;
          return (
            <main className="content content-taxi content--full">
              {/* onComplete is the 90% half of the completion rule; the manual
                  half writes the same flag. One rule, because the lights, the
                  chapter state, the counts and the Flight Deck all read it. */}
              <LessonPage
                module={moduleByCode(activeModuleCode, useTestContent)} chapters={chs} chapter={ch} lesson={ls}
                state={moduleState} people={directory}
                bookmarks={progress.get("pw-bookmarks", [])}
                onToggleSave={(lessonId, on) => {
                  const cur = progress.get("pw-bookmarks", []);
                  progress.set("pw-bookmarks", on
                    ? [...new Set([...cur, lessonId])]
                    : cur.filter((x) => x !== lessonId));
                }}
                presence={normalisePresence(useTestContent?.presence || [])}
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
          const set = route.flow === "recheck"
            ? recheckSet(ret, all)
            : all.filter((q) => q.id in (ret.caution || {}));
          const back = () => go(routePath.module(activeModuleCode));
          return (
            <main className="content content-taxi content--full">
              {set.length === 0 ? (
                <div className="quiz">
                  <div className="quiz-head">
                    <span className="quiz-name">
                      {route.flow === "recheck" ? "Re-check" : "Put right"}
                    </span>
                    <button type="button" className="quiz-leave" onClick={back}>Close</button>
                  </div>
                  <div className="quiz-body">
                    <p className="q-rev-line">
                      {route.flow === "recheck"
                        ? "Nothing is due yet. Questions come back here once they have had time to fade."
                        : "Nothing to put right. Anything you miss lands here until you do."}
                    </p>
                  </div>
                </div>
              ) : (
                <Review
                  // Remount per flow: the set is latched at mount, so moving
                  // between the two flows must be a new sitting, not a reused one.
                  key={route.flow}
                  title={route.flow === "recheck" ? "Re-check" : "Put right"}
                  questions={set}
                  onLeave={back}
                  onOpenLesson={(lessonId) => {
                    const owner = chs.find((c) => (c.lessons || []).some((l) => l.id === lessonId));
                    if (owner) go(routePath.lesson(activeModuleCode, owner.id, lessonId));
                  }}
                  onAnswer={(q, right) => recordAnswer(q.id, right, { fromCaution: route.flow === "caution" })}
                  // The re-check and put-right flows share Review, so they
                  // share its results screen — which weighs the sitting
                  // against the user's bar. Omitted here, `minimums` was
                  // undefined and QuizResults fell back to the pass mark, so
                  // these two screens judged by a different standard than
                  // every other lamp in the app.
                  minimums={minimums}
                  onDone={() => progress.set("pw-last-recheck", new Date().toISOString())} />
              )}
            </main>
          );
        })()
      ) : flags["module.screen"] && route.name === "chapter" && route.tab === "quiz" ? (
        (() => {
          const chs = chaptersFor(activeModuleCode, useTestContent);
          const ch = chs.find((c) => c.id === route.chapterId) || chs[0];
          if (!ch) return <main className="content content-taxi content--full" />;
          return (
            <main className="content content-taxi content--full">
              <QuizPage
                module={moduleByCode(activeModuleCode, useTestContent)} chapters={chs} chapter={ch} state={moduleState}
                autoStart={route.resume}
                // §6 — the results screen weighs the sitting against the same
                // bar every other lamp in the app is weighed against.
                minimums={minimums}
                onRecheck={() => go(routePath.review(activeModuleCode, "caution"))}
                onAnswer={(q, right) => recordAnswer(q.id, right)}
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
                onOpenLesson={(c, l) => go(routePath.lesson(activeModuleCode, c.id, l.id))}
                onOpenQuiz={(c) => go(routePath.chapter(activeModuleCode, c.id, "quiz"))}
                onOpenLessonById={(lessonId) => {
                  // The review links back by lessonId — a join, never a
                  // semantic match on the question text.
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
            state={moduleState}
            tab={route.tab === "pdf" ? "library" : route.tab === "people" ? "people" : "route"}
            librarySub={route.sub === "quizzes" ? "quizzes" : "papers"}
            papers={papersFor(activeModuleCode, useTestContent)}
            retention={progress.get(RETENTION_KEY, emptyRetention())}
            lastRecheck={progress.get("pw-last-recheck", null)}
            minimums={minimums}
            onMinimums={(n) => progress.set(MINIMUMS_KEY, clampMinimums(n))}
            onInstrument={(what) => {
              if (what === "caution") go(routePath.review(activeModuleCode, "caution"));
              else go(routePath.review(activeModuleCode, "recheck"));
            }}
            onOpenPaper={(paper) => {
              // Opened is remembered per account, so the Library can say which
              // ones have been. Written before the tab opens: a popup blocker
              // must not cost the record of having tried.
              progress.set("pw-paper-opened", {
                ...progress.get("pw-paper-opened", {}), [paper.id]: true,
              });
              recordPlace({ kind: "paper", paperId: paper.id, title: paper.title, file: paper.file });
              window.open(`/${paper.file.replace(/^\//, "")}`, "_blank", "noopener");
            }}
            people={{
              // The callsigns behind the author ids. Threads themselves come
              // from the session, not from here — they are the same rows the
              // lesson screen shows.
              people: useTestContent?.people || [],
              wingman: null, groups: [], questions: [],
              // Real or absent. The figures this row is meant to carry —
              // how many have finished, the most replayed minute — have no
              // source yet, so it says what it will fill with rather than
              // inventing a number to look populated.
              moduleRow: { line: "Everyone working through this module.", facts: [] },
            }}
            onTab={(t) => go(t === "library" ? routePath.library(activeModuleCode)
              : t === "people" ? routePath.people(activeModuleCode)
              : routePath.module(activeModuleCode))}
            onBack={() => go(routePath.home())}
            onOpenLesson={(ch, l) => go(routePath.lesson(activeModuleCode, ch.id, l.id))}
            onOpenQuiz={(ch) => navigate(routePath.chapter(activeModuleCode, ch.id, "quiz"))}
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
            chapterTab={route.tab && route.name === "chapter" ? route.tab : "brief"}
            onChapterTab={(chapterId, t) => navigate(routePath.chapter(activeModuleCode, chapterId, t))}
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
    </FirstFlightGate>
    </UsernameGate>
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
           the rare control that genuinely sits inside a line of text. */
        .app button:not(.is-inline),
        .app [role="tab"],
        .app input:not([type="checkbox"]):not([type="radio"]),
        .app select,
        .app textarea { min-height: 44px; }
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
        .tabbar { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid var(--border-soft); }
        .tab { position: relative; display: flex; align-items: center; gap: 7px; background: transparent; border: none; color: var(--muted); font-size: 14px; font-weight: 500; padding: 12px 6px; margin-right: 22px; cursor: pointer; }
        .tab.is-active { color: var(--text); font-weight: 600; }
        .tab.is-active svg { color: var(--accent); }
        .tab::after { content: ''; position: absolute; left: 50%; right: 50%; bottom: 0; height: 2px; background: var(--accent); transition: left 180ms ease, right 180ms ease; border-radius: 2px 2px 0 0; }
        .tab.is-active::after { left: 0; right: 0; }
        .tab.is-shaking { animation: turbulencePulse 0.22s ease; }
        @keyframes turbulencePulse {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        .app.reduce-motion .tab.is-shaking { animation: none; }
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
