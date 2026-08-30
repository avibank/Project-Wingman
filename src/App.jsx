import "./styles/foundations.css";
import "./styles/fonts.css";
import "./styles/app.css";
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { parseRoute, path as routePath } from "./lib/routes.js";
import { titleForRoute, useDocumentTitle } from "./lib/title.js";
import { FLY_SOLO_KEY, mirrorFlySolo } from "./lib/flySolo.js";
const NotFound = lazy(() => import("./components/NotFound.jsx"));
import { engineLivery, deckVars, DEFAULT_LIVERY, RETIRED_TO_FINISH } from "./lib/liveryEngine.js";
import { finishVars, ruledLayer } from "./lib/finishEngine.js";
import { useFlags } from "./lib/flags.js";
import { fetchAllPresence } from "./lib/presence.js";
import { ChevronRight, Lock, Plane } from "lucide-react";
const ChaptersPanel = lazy(() => import("./components/ChaptersPanel.jsx"));
import Home from "./components/Home.jsx";
const ReadyRoom = lazy(() => import("./components/ReadyRoom.jsx"));
const ModulesPage = lazy(() => import("./components/ModulesPage.jsx"));
import RootNav from "./components/RootNav.jsx";
import RunwayLights from "./components/RunwayLights.jsx";
import Deck from "./components/Deck.jsx";
const ModuleHub = lazy(() => import("./components/ModuleHub.jsx"));
import { MODULE_TABS } from "./components/module/ModuleScreen.jsx";
const ModuleScreen = lazy(() => import("./components/module/ModuleScreen.jsx"));
const LessonPage = lazy(() => import("./components/module/LessonPage.jsx"));
const QuizPage = lazy(() => import("./components/module/QuizPage.jsx"));
import { moduleByCode, chaptersFor, papersFor, allModules, loadTestContent } from "./components/module/moduleContent.js";
const DevPanel = lazy(() => import("./components/DevPanel.jsx"));
import RouteError from "./components/RouteError.jsx";
import ReportProblem from "./components/ReportProblem.jsx";
const PdfPanel = lazy(() => import("./components/PdfPanel.jsx"));
import ProfileMenu from "./components/ProfileMenu.jsx";
import StreakMenu from "./components/StreakMenu.jsx";
const SettingsPage = lazy(() => import("./components/SettingsPage.jsx"));
const Profile = lazy(() => import("./components/Profile.jsx"));
const ProgressPage = lazy(() => import("./components/ProgressPage.jsx"));
const BookmarksPage = lazy(() => import("./components/BookmarksPage.jsx"));
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
import { PLACE_KEY, placeTarget, pushPlace } from "./lib/lastPlace.js";
import {
  RETENTION_KEY, emptyRetention, toHolding, toCaution, recheckSet,
} from "./lib/retention.js";
import Review from "./components/module/Review.jsx";
import { stamp as stampDate } from "./components/module/Instruments.jsx";
import AccuracyPanel from "./components/module/AccuracyPanel.jsx";
import { triggerHaptic } from "./lib/haptics.js";
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
  const go = (to) => { navigate(to); if (deckRef.current) deckRef.current.scrollTop = 0; };
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
  const { seedFrom, requestWatch } = useSession();
  // The ammeter's panel: each chapter's FIRST-attempt score against the pass
  // mark. A retake is labelled as one and does not move the needle, so the
  // panel has to show which figure the needle is actually reading.
  const [accuracyOpen, setAccuracyOpen] = useState(false);
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
  const [testStreakOverrideOn, setTestStreakOverrideOn] = useState(false);
  const [testStreakValue, setTestStreakValue] = useState(0);
  const [streak, setStreak] = useState(0);
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
    setTestStreakOverrideOn(progress.get("pw-test-streak-override-on", false));
    setTestStreakValue(progress.get("pw-test-streak-value", 0));
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
    if (!hydrated) return;
    progress.set("pw-test-streak-override-on", testStreakOverrideOn);
  }, [testStreakOverrideOn, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-test-streak-value", testStreakValue);
  }, [testStreakValue, hydrated]);
  useEffect(() => {
    // Detect whether localStorage actually works here (some private-browsing modes block it)
    try {
      localStorage.setItem("pw-storage-check", "1");
      localStorage.removeItem("pw-storage-check");
    } catch {
      setStorageWarning(true);
    }
  }, []);
  useEffect(() => {
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (!progress.loaded) return;
    const today = new Date().toDateString();
    const lastVisit = progress.get("pw-last-visit", null);
    let current = progress.get("pw-streak", 0);
    if (lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      current = lastVisit === yesterday ? current + 1 : 1;
      progress.set("pw-last-visit", today);
      progress.set("pw-streak", current);
    }
    const longest = Math.max(progress.get("pw-longest-streak", 0), current);
    progress.set("pw-longest-streak", longest);
    setStreak(current);
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
  useEffect(() => {
    const { vars, C } = deckVars(shownLivery, variant);
    // The finish is layered over the stock, never mixed into it. With no
    // finish this is the stock exactly, which is what keeps None unchanged.
    const over = finishVars(shownLivery, variant, finish, C.active);
    const all = { ...vars, ...over };
    const root = document.documentElement;
    Object.entries(all).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--grain", grain ? all["--grain"] : "0");
    // Layers that only exist under a finish, cleared otherwise so nothing of
    // one finish survives into the next.
    for (const k of ["--star-img", "--star-img-b", "--cloud-img", "--cloud-op"]) {
      if (!(k in all)) root.style.removeProperty(k);
    }
  }, [shownLivery, variant, grain, finish]);

  const switchTab = (nextTab) => {
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
      }
    }
    scrollPositions.current[tab] = deckRef.current?.scrollTop || 0;
    navigate(nextTab === "pdf" ? routePath.library(activeModuleCode) : routePath.module(activeModuleCode));
    requestAnimationFrame(() => { if (deckRef.current) deckRef.current.scrollTop = scrollPositions.current[nextTab] || 0; });
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
      <header className="topbar">
        <button className="brandmark" onClick={goHome} aria-label="Go to Flight Deck">
          Wingman
        </button>
        <div className="topbar-right">
          
          <StreakMenu streak={streak} overrideStreak={testStreakOverrideOn ? testStreakValue : null} />
          <ProfileMenu
            onNavigate={(page) => {
              setBookmarksMode("list");
              if (page === "licence" || page === "preferences" || page === "appearance") {
                go(routePath.profile(page));
              } else {
                goSettings(page);
              }
            }}
          />
        </div>
      </header>

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
      {settingsPage === "auth" ? (
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
          <SettingsPage
            page={settingsPage}
            onBack={() => go(-1)}
            testStreakOverrideOn={testStreakOverrideOn}
            onToggleTestStreakOverride={() => setTestStreakOverrideOn((t) => !t)}
            testStreakValue={testStreakValue}
            onChangeTestStreakValue={setTestStreakValue}
          />
        </main>
      ) : route.name === "profile" ? (
        <main className="content content-taxi content--profile">
          <Profile
            page={route.tab}
            onNavigate={(t) => go(routePath.profile(t))}
            onBack={() => go(routePath.home())}
            variant={variant}
            variantPin={variantPin}
            onVariantPin={setVariantPin}
            livery={shownLivery}
            onLivery={(id) => { setLivery(id); progress.set("pw-livery", id); }}
            finish={finish}
            onFinish={setFinish}
            ruled={ruled}
            onRuled={setRuled}
            fontSize={fontSize}
            onFontSize={setFontSize}
            reduceMotion={reduceMotion}
            onReduceMotion={setReduceMotion}
            dyslexiaFont={dyslexiaFont}
            onDyslexiaFont={setDyslexiaFont}
            turbulence={turbulence}
            onTurbulence={setTurbulence}
            grain={grain}
            onGrain={setGrain}
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
                state={moduleState} people={useTestContent?.people || []}
                bookmarks={progress.get("pw-bookmarks", [])}
                onToggleSave={(lessonId, on) => {
                  const cur = progress.get("pw-bookmarks", []);
                  progress.set("pw-bookmarks", on
                    ? [...new Set([...cur, lessonId])]
                    : cur.filter((x) => x !== lessonId));
                }}
                presence={useTestContent?.presence || []}
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
            onLibrarySub={(sub) => go(routePath.library(activeModuleCode, sub))}
            papers={papersFor(activeModuleCode, useTestContent)}
            retention={progress.get(RETENTION_KEY, emptyRetention())}
            lastChecked={stampDate(progress.get("pw-last-recheck", null))}
            onInstrument={(what) => {
              if (what === "recheck") go(routePath.review(activeModuleCode, "recheck"));
              else if (what === "caution") go(routePath.review(activeModuleCode, "caution"));
              else setAccuracyOpen(true);
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
    {accuracyOpen && (
      <AccuracyPanel
        chapters={chaptersFor(activeModuleCode, useTestContent)}
        scores={moduleState.quiz}
        onClose={() => setAccuracyOpen(false)} />
    )}
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
        /* THE SCROLLER. min-height: 0 is not optional — a grid item's automatic
           minimum size is its content, so without it the row grows to fit the
           page and the shell scrolls the document after all, which is exactly
           the bug this looks like when it is missing.
           position: relative so the player layer inside it can be placed in the
           scroller's own coordinates. */
        .app .deck {
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          overscroll-behavior: contain;
        }
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
        .topbar { position: relative; z-index: 20;
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
