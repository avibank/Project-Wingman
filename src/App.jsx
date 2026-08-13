import { useState, useRef, useEffect } from "react";
import { Gauge, ChevronRight, Lock, Plane } from "lucide-react";
import ChaptersPanel from "./components/ChaptersPanel.jsx";
import DiscussPanel from "./components/DiscussPanel.jsx";
import PdfPanel from "./components/PdfPanel.jsx";
import ProfileMenu from "./components/ProfileMenu.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import { MODULES, NAV, TRIVIA } from "./data.js";
import { loadJSON, saveJSON } from "./lib/storage.js";

export default function App() {
  const [tab, setTab] = useState("chapters");
  const [settingsPage, setSettingsPage] = useState(null);
  const [module, setModule] = useState(MODULES[0]);
  const [theme, setTheme] = useState(() => loadJSON("pw-theme", "dark"));
  const [reduceMotion, setReduceMotion] = useState(() => loadJSON("pw-reduce-motion", false));
  const [streak, setStreak] = useState(0);
  const [boarding, setBoarding] = useState(true);
  const [paToast, setPaToast] = useState(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [storageWarning, setStorageWarning] = useState(false);
  const scrollPositions = useRef({});
  const [ticket] = useState(() => ({
    seat: `${Math.ceil(Math.random() * 30)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`,
    gate: String.fromCharCode(65 + Math.floor(Math.random() * 6)) + (Math.floor(Math.random() * 20) + 1),
  }));

  useEffect(() => {
    saveJSON("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    saveJSON("pw-reduce-motion", reduceMotion);
  }, [reduceMotion]);

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
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem("pw-last-visit");
    let current = parseInt(localStorage.getItem("pw-streak") || "0", 10);
    if (lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      current = lastVisit === yesterday ? current + 1 : 1;
      localStorage.setItem("pw-last-visit", today);
      localStorage.setItem("pw-streak", String(current));
    }
    setStreak(current);
  }, []);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const pct = h.scrollHeight > h.clientHeight ? h.scrollTop / (h.scrollHeight - h.clientHeight) : 0;
        setScrollPct(Math.min(1, Math.max(0, pct)));
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
    scrollPositions.current[tab] = window.scrollY;
    setTab(nextTab);
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[nextTab] || 0));
  };

  const resetProgress = () => {
    if (!window.confirm("Reset all progress on this device? This can't be undone.")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("pw-"))
      .forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <div className={`app ${theme === "light" ? "theme-light" : ""} ${reduceMotion ? "reduce-motion" : ""}`}>
      {boarding && (
        <div className="boarding-overlay" onAnimationEnd={() => setBoarding(false)}>
          <div className="boarding-pass">
            <div className="boarding-pass-top">
              <span className="boarding-pass-airline">PROJECT WINGMAN AIRWAYS</span>
              <Plane size={22} style={{ transform: "rotate(45deg)" }} />
            </div>
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
      <header className="topbar">
        <div className="brand">
          <Gauge size={20} color="var(--accent)" />
          <span>Project Wingman</span>
        </div>
        <div className="topbar-right">
          <div className="module-select">
            {MODULES.map((m) => (
              <button
                key={m.code}
                className={`module-chip ${module.code === m.code ? "is-active" : ""}`}
                onClick={() => m.status === "active" && setModule(m)}
                disabled={m.status === "locked"}
                title={m.status === "locked" ? "Content coming soon" : undefined}
              >
                {m.status === "locked" && <Lock size={11} />}
                {m.code}
              </button>
            ))}
          </div>
          <ProfileMenu streak={streak} onNavigate={setSettingsPage} />
        </div>
      </header>

      {settingsPage ? (
        <main className="content content-taxi">
          <SettingsPage
            page={settingsPage}
            onBack={() => setSettingsPage(null)}
            theme={theme}
            onToggleTheme={toggleTheme}
            reduceMotion={reduceMotion}
            onToggleReduceMotion={() => setReduceMotion((r) => !r)}
            onResetProgress={resetProgress}
          />
        </main>
      ) : (
        <>
          <div className="module-banner">
            <div>
              <h1>{module.name}</h1>
              <p>Aviation Fundamentals · {module.questions} questions in bank</p>
            </div>
          </div>

          <nav className="tabbar">
            {NAV.map((n) => (
              <button key={n.id} className={`tab ${tab === n.id ? "is-active" : ""}`} onClick={() => switchTab(n.id)}>
                <n.icon size={15} />
                {n.label}
              </button>
            ))}
          </nav>

          <main key={tab} className={`content content-taxi ${tab === "discuss" || tab === "pdf" ? "content--full" : ""}`}>
            {tab === "chapters" && <ChaptersPanel />}
            {tab === "discuss" && <DiscussPanel />}
            {tab === "pdf" && <PdfPanel />}
          </main>
        </>
      )}

      <div className="flight-progress">
        <div className="runway-lights" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => {
            const lit = i < Math.floor(scrollPct * 12);
            const zone = i >= 10 ? "red" : i >= 8 ? "amber" : "white";
            return <span key={i} className={`runway-dot ${lit ? `is-lit is-${zone}` : ""}`} />;
          })}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
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
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; gap: 10px; }
        .brand { display: flex; align-items: center; gap: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; color: var(--text); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .module-select { display: flex; gap: 6px; }
        .module-chip { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11px; background: var(--panel); border: 1px solid var(--border); color: var(--muted); padding: 6px 11px; border-radius: 10px; cursor: pointer; }
        .module-chip.is-active { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
        .module-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .module-banner { padding: 26px 22px 18px; }
        .module-banner h1 { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 4px; color: var(--text); }
        .module-banner p { color: var(--muted); font-size: 13px; margin: 0; font-family: 'JetBrains Mono', monospace; }
        .tabbar { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid var(--border-soft); }
        .tab { display: flex; align-items: center; gap: 7px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--muted2); font-size: 13.5px; padding: 12px 6px; margin-right: 22px; cursor: pointer; }
        .tab.is-active { color: var(--text); border-bottom-color: var(--accent); }
        .content { max-width: 780px; margin: 28px auto 0; padding: 0 22px; }
        .content--full { max-width: none; padding: 0 22px; }
        .content-taxi { animation: taxiIn 0.35s ease; }
        @keyframes taxiIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        .btn-primary { display: flex; align-items: center; gap: 6px; justify-content: center; background: var(--accent); color: var(--on-accent); border: none; border-radius: 12px; padding: 12px 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: var(--accent-hover); }
        .boarding-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; animation: boardingFade 2.4s ease forwards; }
        .boarding-pass { width: min(320px, 84vw); background: var(--panel); border: 1px solid var(--border-hover); border-radius: 18px; padding: 22px; }
        .boarding-pass-top { display: flex; align-items: center; justify-content: space-between; color: var(--accent); margin-bottom: 14px; }
        .boarding-pass-airline { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; color: var(--muted2); }
        .boarding-pass-route { font-family: 'Space Grotesk', sans-serif; font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
        .boarding-pass-row { display: flex; gap: 22px; margin-bottom: 16px; }
        .boarding-pass-row label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--muted2); letter-spacing: 0.06em; margin-bottom: 3px; }
        .boarding-pass-row span { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); font-weight: 600; }
        .boarding-pass-barcode { height: 30px; background: repeating-linear-gradient(90deg, var(--text) 0 2px, transparent 2px 5px); opacity: 0.35; border-radius: 4px; }
        .boarding-trivia { width: min(320px, 84vw); display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.4; }
        .boarding-trivia-label { flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: var(--accent); border: 1px solid var(--border-hover); border-radius: 6px; padding: 2px 6px; }
        @keyframes boardingFade {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .pa-toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 90; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 8px 16px; border-radius: 10px; animation: paFade 1.6s ease forwards; }
        @keyframes paFade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .flight-progress { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: var(--panel); border-top: 1px solid var(--border-soft); }
        .runway-lights { display: flex; gap: 4px; }
        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
        .runway-dot.is-lit.is-white { background: #F4F6FB; box-shadow: 0 0 5px rgba(244,246,251,0.8); }
        .runway-dot.is-lit.is-amber { background: #F2A93B; box-shadow: 0 0 5px rgba(242,169,59,0.8); }
        .runway-dot.is-lit.is-red { background: #E5484D; box-shadow: 0 0 5px rgba(229,72,77,0.8); }
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
