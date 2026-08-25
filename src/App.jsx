import "./styles/fonts.css";
import "./styles/app.css";
import { useState, useRef, useEffect } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { parseRoute, path as routePath } from "./lib/routes.js";
import { engineLivery, deckVars, DEFAULT_LIVERY } from "./lib/liveryEngine.js";
import { useFlags } from "./lib/flags.js";
import { fetchAllPresence } from "./lib/presence.js";
import { ChevronRight, Lock, Plane } from "lucide-react";
import ChaptersPanel from "./components/ChaptersPanel.jsx";
import Home from "./components/Home.jsx";
import ReadyRoom from "./components/ReadyRoom.jsx";
import ModulesPage from "./components/ModulesPage.jsx";
import RootNav from "./components/RootNav.jsx";
import RunwayLights from "./components/RunwayLights.jsx";
import Deck from "./components/Deck.jsx";
import ModuleHub from "./components/ModuleHub.jsx";
import PdfPanel from "./components/PdfPanel.jsx";
import ProfileMenu from "./components/ProfileMenu.jsx";
import StreakMenu from "./components/StreakMenu.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import Profile from "./components/Profile.jsx";
import Features from "./components/Features.jsx";
import ProgressPage from "./components/ProgressPage.jsx";
import BookmarksPage from "./components/BookmarksPage.jsx";
import AuthPage from "./components/AuthPage.jsx";
import UsernameGate from "./components/UsernameGate.jsx";
import FirstFlightGate from "./components/FirstFlightGate.jsx";
import { MODULES, NAV, TRIVIA } from "./data.js";
import { useUserProgress, UserProgressProvider } from "./lib/userProgress.jsx";
import { triggerHaptic } from "./lib/haptics.js";
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <UserProgressProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
      </UserProgressProvider>
    </ClerkProvider>
  );
}
function AppInner() {
  const progress = useUserProgress();
  const { isSignedIn, user } = useUser();
  const { flags } = useFlags();
  // §2.2 — the URL is the navigation state. `view`, `settingsPage`, `tab` and
  // the pending chapter are all derived from it now, so back, deep links and
  // sharing work without any of them being stored twice.
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseRoute(location.pathname);

  const view = route.name === "module" || route.name === "chapter" ? "module" : "hub";
  const settingsPage =
    route.name === "signin" ? "auth"
    : route.name === "logbook" && flags["page.logbook"] ? "progress"
    : route.name === "saved" && flags["page.bookmarks"] ? "bookmarks"
    : route.name === "settings" ? (route.page === "index" ? "about" : route.page)
    : null;
  const tab = route.tab === "pdf" ? "pdf" : "chapters";
  const pendingChapterId = route.chapterId || null;

  const go = (to) => { navigate(to); window.scrollTo(0, 0); };
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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontSize, setFontSize] = useState("medium");
  const [livery, setLivery] = useState(DEFAULT_LIVERY);
  const [variantPin, setVariantPin] = useState(null); // §6.3 Night Ops: "day" | "night" | null = Auto
  const [grain, setGrain] = useState(true);
  const autoVariant = new Date().getHours() >= 7 && new Date().getHours() < 19 ? "day" : "night";
  const variant = variantPin || autoVariant;
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
  const [paToast, setPaToast] = useState(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollPositions = useRef({});
  const [ticket] = useState(() => ({
    seat: `${Math.ceil(Math.random() * 30)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`,
    gate: String.fromCharCode(65 + Math.floor(Math.random() * 6)) + (Math.floor(Math.random() * 20) + 1),
  }));
  useEffect(() => {
    if (!progress.loaded) return;
    setReduceMotion(progress.get("pw-reduce-motion", false));
    setFontSize(progress.get("pw-font-size", "medium"));
    setLivery(engineLivery(progress.get("pw-livery", DEFAULT_LIVERY)));
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
    progress.set("pw-last-tab", tab);
  }, [tab, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-reduce-motion", reduceMotion);
  }, [reduceMotion, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-font-size", fontSize);
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
    const { vars } = deckVars(shownLivery, variant);
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--grain", grain ? vars["--grain"] : "0");
  }, [shownLivery, variant, grain]);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setHeaderScrolled(window.scrollY > 4);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const toggleTheme = () => {
    // Pin to the opposite of what is showing. Auto (null) is only ever the
    // starting state; once someone chooses, the choice persists.
    setVariantPin(variant === "day" ? "night" : "day");
    setPaToast("CABIN CREW, DOORS TO MANUAL");
    setTimeout(() => setPaToast(null), 1600);
  };
  const switchTab = (nextTab) => {
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
      }
    }
    scrollPositions.current[tab] = window.scrollY;
    navigate(nextTab === "pdf" ? routePath.library(activeModuleCode) : routePath.module(activeModuleCode));
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[nextTab] || 0));
  };
  const resetProgress = async () => {
    if (!window.confirm("Reset all progress on this device? This can't be undone.")) return;
    if (progress.isSignedIn) {
      await progress.resetAll();
    } else {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("pw-"))
        .forEach((k) => localStorage.removeItem(k));
    }
    window.location.reload();
  };
  const goToModule = (moduleCode, targetTab = "chapters") => {
    const m = MODULES.find((x) => x.code === moduleCode);
    if (!m || m.status !== "active") return;
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
      }
    }
    setPreferredModuleCode(m.code);
    go(targetTab === "pdf" ? routePath.library(m.code) : routePath.module(m.code));
  };
  const enterModule = (m) => goToModule(m.code, "chapters");
  // Deep-link into one specific chapter: hand the id to ChaptersPanel directly
  // so it opens that chapter instead of the restored pw-last-chapter.
  const goToChapter = (moduleCode, chapterId) => {
    const m = MODULES.find((x) => x.code === moduleCode);
    if (!m) return;
    setPreferredModuleCode(m.code);
    go(routePath.chapter(m.code, chapterId));
  };
  return (
    <div
      data-livery={shownLivery}
      data-variant={variant}
      /* §6.3 names these Smooth Air and Plain Language. Both class names are
         emitted so the global layer and the per-component rules that still use
         the old ones stay in agreement until the profile rebuild renames the
         state itself. */
      className={`app ${variant === "day" ? "theme-light" : ""} ${reduceMotion ? "reduce-motion smooth-air" : ""} ${dyslexiaFont ? "dyslexia-font plain-language" : ""}`}
      style={{
        "--font-scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
        "--scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
      }}
    >
    <UsernameGate>
    <FirstFlightGate>
    <Deck aurora={shownLivery === "aurora"}>
      {flags["chrome.boarding"] && boarding && (
        <div className="boarding-overlay" onAnimationEnd={() => setBoarding(false)}>
          <div className="boarding-pass">
            <div className="boarding-pass-top">
              <span className="boarding-pass-airline">PROJECT WINGMAN AIRWAYS</span>
              <Plane size={22} style={{ transform: "rotate(45deg)" }} />
            </div>
            {isSignedIn && (user?.username || user?.fullName) && (
              <div className="boarding-pass-welcome">WELCOME ABOARD, {(user.username || user.fullName).toUpperCase()}</div>
            )}
            <div className="boarding-pass-route">AVBANK <ChevronRight size={14} /> JT.01</div>
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
      {flags["chrome.patoast"] && paToast && <div className="pa-toast">{paToast}</div>}
      {storageWarning && (
        <div className="storage-warning">Your browser is blocking local storage here, so progress won't be saved on this device.</div>
      )}
      <header className={`topbar ${headerScrolled ? "is-scrolled" : ""}`}>
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
              } else if (page === "features") {
                go(routePath.features());
              } else {
                goSettings(page);
              }
            }}
          />
        </div>
      </header>

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
      ) : settingsPage === "profile" ? (
        <main className="content content-taxi">
          <ProfilePage
            onBack={() => go(-1)}
            theme={variant === "day" ? "light" : "dark"}
            onToggleTheme={toggleTheme}
            reduceMotion={reduceMotion}
            onToggleReduceMotion={() => setReduceMotion((r) => !r)}
            onResetProgress={resetProgress}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
            dyslexiaFont={dyslexiaFont}
            onToggleDyslexiaFont={() => setDyslexiaFont((d) => !d)}
            turbulence={turbulence}
            onToggleTurbulence={() => setTurbulence((t) => !t)}
          />
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
      ) : route.name === "features" ? (
        <main className="content content-taxi content--profile">
          <Features onBack={() => go(-1)} />
        </main>
      ) : route.name === "profile" ? (
        <main className="content content-taxi content--profile">
          <Profile
            page={route.tab}
            onNavigate={(t) => go(t === "features" ? routePath.features() : routePath.profile(t))}
            onBack={() => go(routePath.home())}
            variant={variant}
            variantPin={variantPin}
            onVariantPin={setVariantPin}
            livery={shownLivery}
            onLivery={(id) => { setLivery(id); progress.set("pw-livery", id); }}
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
      ) : view === "hub" || !flags["module.interior"] ? (
        /* Step 1 — the Flight Deck owns its whole column: it paints its own
           ground and carries its own light layers, so the shell's centred,
           padded .content would crop them. */
        <main className="content content-taxi content--deck">
          <Home
            activeModuleCode={activeModuleCode}
            livery={shownLivery}
            variant={variant}
            onEnterModule={enterModule}
            onGoToChapter={goToChapter}
            onOpenReady={() => go(routePath.ready())}
            onOpenChannel={(code) => go(routePath.ready(code))}
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
      <RunwayLights />
    </Deck>
    </FirstFlightGate>
    </UsernameGate>
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
        .app, .app *, .app *::before, .app *::after { transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease; }
        *:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        ::selection { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); }
        ::-moz-selection { background: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--text); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: var(--r-md); border: 2px solid var(--bg); }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        * { scrollbar-width: thin; scrollbar-color: var(--border-hover) var(--bg); }
        html, body, #root { height: 100%; margin: 0; background: var(--surface-0); }
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
          min-height: 100vh;
          padding: 0 0 60px;
          position: relative;
        }
        h1, h2, h3, h4 { font-family: var(--font-ui); letter-spacing: -0.01em; }
        .app { font-variant-numeric: tabular-nums; }
        [class*="mono"], [class*="-code"], [class*="-value"], [class*="-count"], [class*="stat"] {
          font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1; }
        /* §6.6 — the grain texture is deleted: on OLED it reads as compression
           artefacts, not as paper. */
        .topbar { display: flex; align-items: center; gap: 12px; max-width: 1240px; margin: 0 auto;
          padding: 14px 0 12px; }
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
        .app.dyslexia-font, .app.dyslexia-font .exam-stem, .app.dyslexia-font .chapter-title, .app.dyslexia-font p, .app.dyslexia-font span, .app.dyslexia-font input, .app.dyslexia-font textarea, .app.dyslexia-font button {
          font-family: 'OpenDyslexic', var(--font-body);
        }
      `}</style>
    </div>
  );
}
