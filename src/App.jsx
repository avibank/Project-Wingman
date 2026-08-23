import "./styles/fonts.css";
import "./styles/liveries.css";
import { useState, useRef, useEffect } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { parseRoute, path as routePath } from "./lib/routes.js";
import { Gauge, ChevronRight, Lock, Plane } from "lucide-react";
import ChaptersPanel from "./components/ChaptersPanel.jsx";
import HubPage from "./components/HubPage.jsx";
import { useSocialPrefs } from "./lib/social.js";
import { fetchEnrollments } from "./lib/enrollments.js";
import ModuleHub from "./components/ModuleHub.jsx";
import DiscussPanel from "./components/DiscussPanel.jsx";
import PdfPanel from "./components/PdfPanel.jsx";
import ProfileMenu from "./components/ProfileMenu.jsx";
import StreakMenu from "./components/StreakMenu.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import ProgressPage from "./components/ProgressPage.jsx";
import BookmarksPage from "./components/BookmarksPage.jsx";
import AuthPage from "./components/AuthPage.jsx";
import UsernameGate from "./components/UsernameGate.jsx";
import FirstFlightGate from "./components/FirstFlightGate.jsx";
import { MODULES, NAV, TRIVIA } from "./data.js";
import { loadJSON, saveJSON } from "./lib/storage.js";
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
  // §2.2 — the URL is the navigation state. `view`, `settingsPage`, `tab` and
  // the pending chapter are all derived from it now, so back, deep links and
  // sharing work without any of them being stored twice.
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseRoute(location.pathname);

  const view = route.name === "module" || route.name === "chapter" ? "module" : "hub";
  const settingsPage =
    route.name === "signin" ? "auth"
    : route.name === "logbook" ? "progress"
    : route.name === "saved" ? "bookmarks"
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
  const { prefs: socialPrefs } = useSocialPrefs();
  const [enrolledCodes, setEnrolledCodes] = useState([]);
  const [bookmarksMode, setBookmarksMode] = useState("list");
  // The persisted "active module" is a preference the hero on Home reads.
  // Inside a module the URL wins.
  const [preferredModuleCode, setPreferredModuleCode] = useState(MODULES.find((m) => m.status === "active")?.code || MODULES[0].code);
  const activeModuleCode = route.moduleCode || preferredModuleCode;
  const [theme, setTheme] = useState("dark");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontSize, setFontSize] = useState("medium");
  const [livery, setLivery] = useState("dawn-patrol");
  const [variantPin, setVariantPin] = useState(null); // "day" | "night" | null = auto
  const autoVariant = new Date().getHours() >= 7 && new Date().getHours() < 19 ? "day" : "night";
  const variant = variantPin || autoVariant;
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [turbulence, setTurbulence] = useState(true);
  const [shakeTab, setShakeTab] = useState(null);
  const [calmDiscussLights, setCalmDiscussLights] = useState(false);
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
  const [scrollPct, setScrollPct] = useState(0);
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
    setTheme(progress.get("pw-theme", "dark"));
    setReduceMotion(progress.get("pw-reduce-motion", false));
    setFontSize(progress.get("pw-font-size", "medium"));
    setLivery(progress.get("pw-livery", "dawn-patrol"));
    setVariantPin(progress.get("pw-variant-pin", null));
    setDyslexiaFont(progress.get("pw-dyslexia-font", false));
    setTurbulence(progress.get("pw-turbulence", true));
    setCalmDiscussLights(progress.get("pw-calm-discuss-lights", false));
    setTestStreakOverrideOn(progress.get("pw-test-streak-override-on", false));
    setTestStreakValue(progress.get("pw-test-streak-value", 0));
    setHydrated(true);
  }, [progress.loaded, progress.isSignedIn]);
  useEffect(() => {
    if (!hydrated) return;
    progress.set("pw-theme", theme);
  }, [theme, hydrated]);
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
    progress.set("pw-calm-discuss-lights", calmDiscussLights);
  }, [calmDiscussLights, hydrated]);
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
    if (isSignedIn && user?.id) fetchEnrollments(user.id).then(setEnrolledCodes);
    else setEnrolledCodes([]);
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
  // The generated tokens are scoped to [data-livery][data-variant]. The .app
  // div carries them, but html and body sit outside it, so the page behind the
  // app had to hardcode a colour. Mirroring the pair onto the root fixes that
  // and makes Day actually repaint the whole page.
  useEffect(() => {
    const h = document.documentElement;
    h.setAttribute("data-livery", livery);
    h.setAttribute("data-variant", variant);
  }, [livery, variant]);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const pct = h.scrollHeight > h.clientHeight ? h.scrollTop / (h.scrollHeight - h.clientHeight) : 0;
        setScrollPct(Math.min(1, Math.max(0, pct)));
        setHeaderScrolled(window.scrollY > 4);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
    setPaToast("CABIN CREW, DOORS TO MANUAL");
    setTimeout(() => setPaToast(null), 1600);
  };
  const switchTab = (nextTab) => {
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
        setShakeTab(nextTab);
        setTimeout(() => setShakeTab((t) => (t === nextTab ? null : t)), 220);
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
      data-livery={livery}
      data-variant={variant}
      className={`app ${variant === "day" ? "theme-light" : ""} ${reduceMotion ? "reduce-motion" : ""} ${dyslexiaFont ? "dyslexia-font" : ""}`}
      style={{
        "--font-scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
      }}
    >
    <UsernameGate>
    <FirstFlightGate>
      {boarding && (
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
      {paToast && <div className="pa-toast">{paToast}</div>}
      {storageWarning && (
        <div className="storage-warning">Your browser is blocking local storage here, so progress won't be saved on this device.</div>
      )}
      <header className={`topbar ${headerScrolled ? "is-scrolled" : ""}`}>
        <button
          className="brand"
          onClick={() => {
            goHome();
          }}
          aria-label="Go to Flight Deck"
        >
          <Gauge size={20} color="var(--accent)" />
          <span>Project Wingman</span>
        </button>
        <div className="topbar-right">
          
          <StreakMenu streak={streak} overrideStreak={testStreakOverrideOn ? testStreakValue : null} />
          <ProfileMenu
            onNavigate={(page) => {
              setBookmarksMode("list");
              goSettings(page);
            }}
          />
        </div>
      </header>
      {settingsPage === "auth" ? (
        <main className="content content-taxi">
          <AuthPage onBack={() => go(-1)} />
        </main>
      ) : settingsPage === "profile" ? (
        <main className="content content-taxi">
          <ProfilePage
            onBack={() => go(-1)}
            theme={theme}
            onToggleTheme={toggleTheme}
            reduceMotion={reduceMotion}
            onToggleReduceMotion={() => setReduceMotion((r) => !r)}
            calmDiscussLights={calmDiscussLights}
            onToggleCalmDiscussLights={() => setCalmDiscussLights((c) => !c)}
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
      ) : view === "hub" ? (
        <main className="content content-taxi">
          <HubPage
            activeModuleCode={activeModuleCode}
            onEnterModule={enterModule}
            onGoToChapter={goToChapter}
            onGoToDiscuss={() => goToModule(activeModuleCode, "discuss")}
            onGoToSocial={(moduleCode) => goToModule(moduleCode || activeModuleCode, "social")}
            onReviewBookmarks={() => {
              setBookmarksMode("cards");
              goSettings("bookmarks");
            }}
            onSignIn={() => goSettings("auth")}
            streak={streak}
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
          />
        </main>
      )}
      <div className="flight-progress">
        <div className="runway-lights" aria-hidden="true">
          <div className="runway-trail" style={{ width: `${scrollPct * 100}%` }} />
          {Array.from({ length: 12 }).map((_, i) => {
            const lit = i < Math.floor(scrollPct * 12);
            const zone = i >= 10 ? "late" : i >= 8 ? "mid" : "early";
            return <span key={i} className={`runway-dot ${lit ? `is-lit is-${zone}` : ""}`} />;
          })}
        </div>
      </div>
    </FirstFlightGate>
    </UsernameGate>
      <style>{`
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/otf/OpenDyslexic-Regular.otf') format('opentype');
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/otf/OpenDyslexic-Bold.otf') format('opentype');
          font-weight: 700;
          font-display: swap;
        }
        * { box-sizing: border-box; }
        .app, .app *, .app *::before, .app *::after { transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
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
          /* Aliases onto the generated livery tokens (src/styles/liveries.css).
             Cold is the machine, warm is people — §2.2. Component-level names
             are retained so existing screens repaint without a rewrite; they
             resolve to livery tokens and nothing else. */
          --bg: var(--surface-0);
          --panel: var(--surface-1);
          --panel-alt: var(--surface-1);
          --elev-0: var(--surface-0);
          --elev-1: var(--surface-1);
          --elev-2: var(--surface-2);
          --well: var(--surface-0);
          --border: var(--hairline);
          --border-soft: var(--hairline);
          --border-hover: var(--hairline);
          --text: var(--text-1);
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
          --presence: var(--warm);
          --presence-soft: color-mix(in srgb, var(--warm) 13%, transparent);
          --presence-glow: color-mix(in srgb, var(--warm) 20%, transparent);
          --on-presence: var(--surface-0);
          --good: var(--cold);
          --bad: var(--text-2);
          --calm: var(--text-2);
          --avatar-bg: var(--surface-2);
          --shadow-1: 0 1px 2px rgb(0 0 0 / 0.20), 0 4px 12px rgb(0 0 0 / 0.18);
          --shadow-2: 0 2px 4px rgb(0 0 0 / 0.24), 0 16px 36px rgb(0 0 0 / 0.30);
          --shadow-inset: inset 0 2px 7px rgb(0 0 0 / 0.30);
          --hairline-inset: inset 0 1px 0 rgb(255 255 255 / 0.05);
          --sheen: rgb(255 255 255 / 0.08);
          --bezel-hi: rgb(255 255 255 / 0.30); --bezel-mid: rgb(255 255 255 / 0.16); --bezel-lo: rgb(255 255 255 / 0.02);
          --r-sm: 12px; --r-md: 16px; --r-lg: 16px; --r-pill: 999px;
          --font-ui: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
          --font-mono: "Geist Mono", ui-monospace, "SF Mono", monospace;
          --font-serif: "Newsreader", ui-serif, Georgia, serif;
          --font-display: var(--font-ui);
          --font-body: var(--font-ui);
          font-variant-numeric: tabular-nums;
          font-family: var(--font-ui);
          background: var(--surface-0);
          color: var(--text-1);
          min-height: 100vh;
          padding: 0 0 60px;
          position: relative;
        }
        /* §2.6 — the cheatline: one warm gradient rising from the bottom edge. */
        .app::before {
          content: "";
          position: fixed;
          left: 0; right: 0; bottom: 0;
          height: 40vh;
          pointer-events: none;
          z-index: 0;
          opacity: var(--cheatline-alpha, 0.06);
          background: var(--cheatline);
        }
        .app::before { content: ""; position: fixed; left: 50%; top: -280px; width: 1100px; height: 620px;
          transform: translateX(-50%); pointer-events: none; z-index: 0;
          background: radial-gradient(closest-side, var(--accent-glow), transparent 72%); filter: blur(28px); }
        h1, h2, h3, h4 { font-family: var(--font-display); font-variation-settings: "opsz" 40, "SOFT" 40; letter-spacing: -0.005em; }
        .app { font-variant-numeric: tabular-nums; }
        [class*="mono"], [class*="-code"], [class*="-value"], [class*="-count"], [class*="stat"] {
          font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1; }
        .app::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E"); }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; gap: 10px; transition: box-shadow 0.25s ease, border-color 0.25s ease; }
        .topbar.is-scrolled { box-shadow: 0 4px 14px rgba(0,0,0,0.18); border-bottom-color: var(--border-hover); }
        .brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 700; font-size: 15px; letter-spacing: 0.06em; color: var(--text); background: transparent; border: none; padding: 0; cursor: pointer; }
        .brand:hover { color: var(--accent); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .module-banner { position: relative; padding: 26px 22px 18px; }
        .module-banner::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 100% at 25% 0%, var(--accent-soft), transparent 70%); pointer-events: none; z-index: 0; }
        .module-banner > div { position: relative; z-index: 1; }
        .module-banner h1 { font-family: var(--font-display); font-size: 26px; margin: 0 0 4px; color: var(--text); }
        .module-banner p { color: var(--muted); font-size: 12.5px; margin: 0; font-family: var(--font-mono); }
        .tabbar { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid var(--border-soft); }
        .tab { position: relative; display: flex; align-items: center; gap: 7px; background: transparent; border: none; color: var(--muted); font-size: 13.5px; font-weight: 500; padding: 12px 6px; margin-right: 22px; cursor: pointer; }
        .tab.is-active { color: var(--text); font-weight: 600; }
        .tab.is-active svg { color: var(--accent); }
        .tab::after { content: ''; position: absolute; left: 50%; right: 50%; bottom: 0; height: 2px; background: var(--accent); transition: left 0.25s ease, right 0.25s ease; border-radius: 2px 2px 0 0; }
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
        .content-taxi { animation: taxiIn 0.35s ease; }
        @keyframes taxiIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        .btn-primary { display: flex; align-items: center; gap: 6px; justify-content: center; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-md); padding: 12px 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: var(--accent-hover); }
        .boarding-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; animation: boardingFade 2.4s ease forwards; }
        .boarding-pass { width: min(320px, 84vw); background: var(--panel); border: 1px solid var(--border-hover); border-radius: var(--r-lg); padding: 22px; }
        .boarding-pass-top { display: flex; align-items: center; justify-content: space-between; color: var(--accent); margin-bottom: 14px; }
        .boarding-pass-airline { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--muted2); }
        .boarding-pass-welcome { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; color: var(--accent); margin-bottom: 10px; }
        .boarding-pass-route { font-family: var(--font-display); font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
        .boarding-pass-row { display: flex; gap: 22px; margin-bottom: 16px; }
        .boarding-pass-row label { display: block; font-family: var(--font-mono); font-size: 10px; color: var(--muted2); letter-spacing: 0.06em; margin-bottom: 3px; }
        .boarding-pass-row span { font-family: var(--font-display); font-size: 15px; color: var(--text); font-weight: 600; }
        .boarding-pass-barcode { height: 30px; background: repeating-linear-gradient(90deg, var(--text) 0 2px, transparent 2px 5px); opacity: 0.35; border-radius: 4px; }
        .boarding-trivia { width: min(320px, 84vw); display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.4; }
        .boarding-trivia-label { flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; color: var(--accent); border: 1px solid var(--border-hover); border-radius: var(--r-sm); padding: 2px 6px; }
        @keyframes boardingFade {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .pa-toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 90; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.06em; padding: 8px 16px; border-radius: var(--r-md); animation: paFade 1.6s ease forwards; }
        @keyframes paFade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .flight-progress { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: var(--panel); border-top: 1px solid var(--border-soft); }
        .runway-lights { position: relative; display: flex; gap: 4px; }
        .runway-trail { position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 3px; background: linear-gradient(90deg, transparent, var(--accent)); filter: blur(3px); opacity: 0.55; transition: width 0.15s ease; pointer-events: none; }
        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
        /* §15 — no red outside a destructive confirmation, and no colour that
           is not a livery channel. The zones run cold to warm instead. */
        .runway-dot.is-lit.is-early { background: var(--cold); }
        .runway-dot.is-lit.is-mid { background: color-mix(in oklab, var(--cold) 50%, var(--warm)); }
        .runway-dot.is-lit.is-late { background: var(--warm); }
        .storage-warning { position: relative; z-index: 90; background: rgba(224,102,90,0.15); border-bottom: 1px solid var(--bad); color: var(--text); font-size: 11.5px; text-align: center; padding: 8px 16px; }
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
