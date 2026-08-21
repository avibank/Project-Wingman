import { useState, useRef, useEffect } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { Gauge, ChevronRight, Lock, Plane } from "lucide-react";
import ChaptersPanel from "./components/ChaptersPanel.jsx";
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
import { MODULES, NAV, TRIVIA, ACCENT_COLORS } from "./data.js";
import { loadJSON, saveJSON } from "./lib/storage.js";
import { useUserProgress } from "./lib/userProgress.js";
import { triggerHaptic } from "./lib/haptics.js";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AppInner />
    </ClerkProvider>
  );
}

function AppInner() {
  const progress = useUserProgress();
  const { isSignedIn, user } = useUser();
  const [tab, setTab] = useState("chapters");
  const [settingsPage, setSettingsPage] = useState(null);
  const [view, setView] = useState("hub"); // "hub" | "module"
  const [activeModuleCode, setActiveModuleCode] = useState(MODULES.find((m) => m.status === "active")?.code || MODULES[0].code);
  const [theme, setTheme] = useState("dark");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontSize, setFontSize] = useState("medium");
  const [accentColor, setAccentColor] = useState("blue");
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [turbulence, setTurbulence] = useState(true);
  const [shakeTab, setShakeTab] = useState(null);
  const [shakeModule, setShakeModule] = useState(null);
  const [calmDiscussLights, setCalmDiscussLights] = useState(false);
  const [testStreakOverrideOn, setTestStreakOverrideOn] = useState(false);
  const [testStreakValue, setTestStreakValue] = useState(0);
  const [streak, setStreak] = useState(0);
  const [boarding, setBoarding] = useState(true);
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
    setTab(progress.get("pw-last-tab", "chapters"));
    setTheme(progress.get("pw-theme", "dark"));
    setReduceMotion(progress.get("pw-reduce-motion", false));
    setFontSize(progress.get("pw-font-size", "medium"));
    setAccentColor(progress.get("pw-accent-color", "blue"));
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
    progress.set("pw-accent-color", accentColor);
  }, [accentColor, hydrated]);

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
    setTab(nextTab);
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

  const enterModule = (m) => {
    if (m.status !== "active") return;
    if (turbulence) {
      triggerHaptic();
      if (!reduceMotion) {
        setShakeModule(m.code);
        setTimeout(() => setShakeModule((c) => (c === m.code ? null : c)), 220);
      }
    }
    setActiveModuleCode(m.code);
    setView("module");
    setTab("chapters");
    window.scrollTo(0, 0);
  };

  const activeAccent = ACCENT_COLORS[accentColor][theme === "light" ? "light" : "dark"];

  return (
    <div
      className={`app ${theme === "light" ? "theme-light" : ""} ${reduceMotion ? "reduce-motion" : ""} ${dyslexiaFont ? "dyslexia-font" : ""}`}
      style={{
        "--font-scale": fontSize === "small" ? 0.9 : fontSize === "large" ? 1.15 : 1,
        "--accent": activeAccent.accent,
        "--accent-hover": activeAccent.hover,
        "--accent-soft": activeAccent.soft,
        "--on-accent": activeAccent.onAccent,
      }}
    >
    <UsernameGate>
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
            setSettingsPage(null);
            setView("hub");
            window.scrollTo(0, 0);
          }}
          aria-label="Go to Hub"
        >
          <Gauge size={20} color="var(--accent)" />
          <span>Project Wingman</span>
        </button>
        <div className="topbar-right">
          {view === "module" && (
            <div className="module-select">
              {MODULES.map((m) => (
                <button
                  key={m.code}
                  className={`module-chip ${activeModuleCode === m.code ? "is-active" : ""} ${shakeModule === m.code ? "is-shaking" : ""}`}
                  onClick={() => enterModule(m)}
                  disabled={m.status === "locked"}
                  title={m.status === "locked" ? "Content coming soon" : undefined}
                >
                  {m.status === "locked" && <Lock size={11} />}
                  {m.code}
                </button>
              ))}
            </div>
          )}
          <StreakMenu streak={streak} overrideStreak={testStreakOverrideOn ? testStreakValue : null} />
          <ProfileMenu onNavigate={setSettingsPage} />
        </div>
      </header>

      {settingsPage === "auth" ? (
        <main className="content content-taxi">
          <AuthPage onBack={() => setSettingsPage(null)} />
        </main>
      ) : settingsPage === "profile" ? (
        <main className="content content-taxi">
          <ProfilePage
            onBack={() => setSettingsPage(null)}
            theme={theme}
            onToggleTheme={toggleTheme}
            reduceMotion={reduceMotion}
            onToggleReduceMotion={() => setReduceMotion((r) => !r)}
            calmDiscussLights={calmDiscussLights}
            onToggleCalmDiscussLights={() => setCalmDiscussLights((c) => !c)}
            onResetProgress={resetProgress}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
            accentColor={accentColor}
            onChangeAccentColor={setAccentColor}
            dyslexiaFont={dyslexiaFont}
            onToggleDyslexiaFont={() => setDyslexiaFont((d) => !d)}
            turbulence={turbulence}
            onToggleTurbulence={() => setTurbulence((t) => !t)}
          />
        </main>
      ) : settingsPage === "progress" ? (
        <main className="content content-taxi">
          <ProgressPage onBack={() => setSettingsPage(null)} />
        </main>
      ) : settingsPage === "bookmarks" ? (
        <main className="content content-taxi">
          <BookmarksPage onBack={() => setSettingsPage(null)} />
        </main>
      ) : settingsPage ? (
        <main className="content content-taxi">
          <SettingsPage
            page={settingsPage}
            onBack={() => setSettingsPage(null)}
            testStreakOverrideOn={testStreakOverrideOn}
            onToggleTestStreakOverride={() => setTestStreakOverrideOn((t) => !t)}
            testStreakValue={testStreakValue}
            onChangeTestStreakValue={setTestStreakValue}
          />
        </main>
      ) : view === "hub" ? (
        <main className="content content-taxi">
          <div className="hub-placeholder">
            <p className="eyebrow">Your modules</p>
            <h1 className="hub-placeholder-title">Hub</h1>
            <p className="hub-placeholder-sub">Choose a module to continue studying.</p>
            <div className="hub-module-list">
              {MODULES.map((m) => (
                <button
                  key={m.code}
                  className={`hub-module-card ${m.status !== "active" ? "is-locked" : ""}`}
                  onClick={() => enterModule(m)}
                  disabled={m.status !== "active"}
                >
                  <div className="hub-module-code">
                    {m.status === "locked" && <Lock size={11} />}
                    {m.code}
                  </div>
                  <div className="hub-module-name">{m.name}</div>
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <>
          <div className="module-banner">
            <div>
              <h1>{MODULES.find((m) => m.code === activeModuleCode)?.name}</h1>
              <p>Aviation Fundamentals · {MODULES.find((m) => m.code === activeModuleCode)?.questions} questions in bank</p>
            </div>
          </div>

          <nav className="tabbar">
            {NAV.map((n) => (
              <button key={n.id} className={`tab ${tab === n.id ? "is-active" : ""} ${shakeTab === n.id ? "is-shaking" : ""}`} onClick={() => switchTab(n.id)}>
                <n.icon size={15} />
                {n.label}
              </button>
            ))}
          </nav>

          <main key={tab} className={`content content-taxi ${tab === "discuss" || tab === "pdf" ? "content--full" : ""}`}>
            {tab === "chapters" && <ChaptersPanel onSignIn={() => setSettingsPage("auth")} />}
            {tab === "discuss" && <DiscussPanel onSignIn={() => setSettingsPage("auth")} calmLights={calmDiscussLights} />}
            {tab === "pdf" && <PdfPanel />}
          </main>
        </>
      )}

      <div className="flight-progress">
        <div className="runway-lights" aria-hidden="true">
          <div className="runway-trail" style={{ width: `${scrollPct * 100}%` }} />
          {Array.from({ length: 12 }).map((_, i) => {
            const lit = i < Math.floor(scrollPct * 12);
            const zone = i >= 10 ? "red" : i >= 8 ? "amber" : "white";
            return <span key={i} className={`runway-dot ${lit ? `is-lit is-${zone}` : ""}`} />;
          })}
        </div>
      </div>
    </UsernameGate>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
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
        ::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 10px; border: 2px solid var(--bg); }
        ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
        * { scrollbar-width: thin; scrollbar-color: var(--border-hover) var(--bg); }
        html, body, #root { height: 100%; margin: 0; background: #0B1526; }
        .app {
          --bg: #0B1526; --panel: #101B2D; --panel-alt: #0E1A2C; --border: #22314A; --border-hover: #33456B;
          --border-soft: rgba(111,160,240,0.12); --text: #E8EDF2; --text-soft: #b9c4cf; --muted: #8291AC; --muted2: #66768F;
          --accent: #6FA0F0; --accent-hover: #8FB8F5; --accent-soft: rgba(111,160,240,0.10); --on-accent: #0E1830;
          --good: #4CAF7D; --bad: #E08585; --avatar-bg: #1E2C46;
          font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 0 0 60px; transition: background 0.2s ease, color 0.2s ease;
        }
        .app.theme-light {
          --bg: #F4F6FB; --panel: #FFFFFF; --panel-alt: #F0F3F9; --border: #D7DEEA; --border-hover: #B9C6DC;
          --border-soft: rgba(61,111,209,0.12); --text: #16202E; --text-soft: #48556B; --muted: #5B6B85; --muted2: #7A8AA3;
          --accent: #3D6FD1; --accent-hover: #5A8AE0; --accent-soft: rgba(61,111,209,0.08); --on-accent: #FFFFFF;
          --good: #2F9D64; --bad: #D14F4F; --avatar-bg: #DCE6F7;
        }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; gap: 10px; transition: box-shadow 0.25s ease, border-color 0.25s ease; }
        .topbar.is-scrolled { box-shadow: 0 4px 14px rgba(0,0,0,0.18); border-bottom-color: var(--border-hover); }
        .brand { display: flex; align-items: center; gap: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; color: var(--text); background: transparent; border: none; padding: 0; cursor: pointer; }
        .brand:hover { color: var(--accent); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .module-select { display: flex; gap: 6px; }
        .module-chip { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: var(--panel); border: 1px solid var(--border); color: var(--muted); padding: 6px 10px; border-radius: 10px; cursor: pointer; }
        .module-chip.is-active { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
        .module-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .module-banner { position: relative; padding: 26px 22px 18px; }
        .module-banner::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 100% at 25% 0%, var(--accent-soft), transparent 70%); pointer-events: none; z-index: 0; }
        .module-banner > div { position: relative; z-index: 1; }
        .module-banner h1 { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 4px; color: var(--text); }
        .module-banner p { color: var(--muted); font-size: 12.5px; margin: 0; font-family: 'JetBrains Mono', monospace; }
        .tabbar { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid var(--border-soft); }
        .tab { position: relative; display: flex; align-items: center; gap: 7px; background: transparent; border: none; color: var(--muted); font-size: 13.5px; font-weight: 500; padding: 12px 6px; margin-right: 22px; cursor: pointer; }
        .tab.is-active { color: var(--text); font-weight: 600; }
        .tab.is-active svg { color: var(--accent); }
        .tab::after { content: ''; position: absolute; left: 50%; right: 50%; bottom: 0; height: 2px; background: var(--accent); transition: left 0.25s ease, right 0.25s ease; border-radius: 2px 2px 0 0; }
        .tab.is-active::after { left: 0; right: 0; }
        .tab.is-shaking, .module-chip.is-shaking { animation: turbulencePulse 0.22s ease; }
        @keyframes turbulencePulse {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        .app.reduce-motion .tab.is-shaking, .app.reduce-motion .module-chip.is-shaking { animation: none; }
        .content { max-width: 780px; margin: 28px auto 0; padding: 0 22px; zoom: var(--font-scale, 1); }
        .content--full { max-width: none; padding: 0 22px; zoom: var(--font-scale, 1); }
        @media (min-width: 1024px) {
          .content { max-width: 1100px; }
        }
        .content-taxi { animation: taxiIn 0.35s ease; }
        @keyframes taxiIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        .btn-primary { display: flex; align-items: center; gap: 6px; justify-content: center; background: var(--accent); color: var(--on-accent); border: none; border-radius: 12px; padding: 12px 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: var(--accent-hover); }
        .boarding-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; animation: boardingFade 2.4s ease forwards; }
        .boarding-pass { width: min(320px, 84vw); background: var(--panel); border: 1px solid var(--border-hover); border-radius: 18px; padding: 22px; }
        .boarding-pass-top { display: flex; align-items: center; justify-content: space-between; color: var(--accent); margin-bottom: 14px; }
        .boarding-pass-airline { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: var(--muted2); }
        .boarding-pass-welcome { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--accent); margin-bottom: 10px; }
        .boarding-pass-route { font-family: 'Space Grotesk', sans-serif; font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
        .boarding-pass-row { display: flex; gap: 22px; margin-bottom: 16px; }
        .boarding-pass-row label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); letter-spacing: 0.06em; margin-bottom: 3px; }
        .boarding-pass-row span { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); font-weight: 600; }
        .boarding-pass-barcode { height: 30px; background: repeating-linear-gradient(90deg, var(--text) 0 2px, transparent 2px 5px); opacity: 0.35; border-radius: 4px; }
        .boarding-trivia { width: min(320px, 84vw); display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.4; }
        .boarding-trivia-label { flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: var(--accent); border: 1px solid var(--border-hover); border-radius: 6px; padding: 2px 6px; }
        @keyframes boardingFade {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .pa-toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 90; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; letter-spacing: 0.06em; padding: 8px 16px; border-radius: 10px; animation: paFade 1.6s ease forwards; }
        @keyframes paFade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .flight-progress { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: var(--panel); border-top: 1px solid var(--border-soft); }
        .runway-lights { position: relative; display: flex; gap: 4px; }
        .runway-trail { position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 3px; background: linear-gradient(90deg, transparent, var(--accent)); filter: blur(3px); opacity: 0.55; transition: width 0.15s ease; pointer-events: none; }
        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
        .runway-dot.is-lit.is-white { background: #F4F6FB; box-shadow: 0 0 5px rgba(244,246,251,0.8); }
        .runway-dot.is-lit.is-amber { background: #F2A93B; box-shadow: 0 0 5px rgba(242,169,59,0.8); }
        .runway-dot.is-lit.is-red { background: #E5484D; box-shadow: 0 0 5px rgba(229,72,77,0.8); }
        .storage-warning { position: relative; z-index: 90; background: rgba(224,102,90,0.15); border-bottom: 1px solid var(--bad); color: var(--text); font-size: 11.5px; text-align: center; padding: 8px 16px; }
        .hub-placeholder .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin: 0 0 6px; }
        .hub-placeholder-title { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 6px; color: var(--text); }
        .hub-placeholder-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 20px; }
        .hub-module-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .hub-module-card { text-align: left; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: border-color 0.2s ease, transform 0.2s ease; }
        .hub-module-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .hub-module-card.is-locked { opacity: 0.6; cursor: not-allowed; }
        .hub-module-card.is-locked:hover { border-color: var(--border); transform: none; }
        .hub-module-code { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); margin-bottom: 6px; }
        .hub-module-name { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); }
        @media (prefers-reduced-motion: reduce) {
          .boarding-overlay { animation-duration: 0.4s; }
          .content-taxi { animation: none; }
        }
        .app.reduce-motion .boarding-overlay { animation-duration: 0.4s; }
        .app.reduce-motion .content-taxi { animation: none; }
        .app.dyslexia-font, .app.dyslexia-font .exam-stem, .app.dyslexia-font .chapter-title, .app.dyslexia-font p, .app.dyslexia-font span, .app.dyslexia-font input, .app.dyslexia-font textarea, .app.dyslexia-font button {
          font-family: 'OpenDyslexic', 'Inter', sans-serif;
        }
      `}</style>
    </div>
    </ClerkProvider>
  );
}
