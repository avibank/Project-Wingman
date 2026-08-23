import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSocialPrefs } from "../lib/social.js";
import { fetchAllPresence } from "../lib/presence.js";
import { moduleSegments, progressCaption, nextChapter, chapterCount } from "../lib/progressModel.js";
import SegmentedBar from "./SegmentedBar.jsx";
import ScoreDial from "./ScoreDial.jsx";

// §9.1 — Home is a launchpad, not a dashboard. It answers one question: what do
// I do right now.
//
// Four bands, and the priority order inside the hero is deliberate: the next
// action is the largest text on the page, because §1.3 says a screen has one
// attitude indicator and this is it. The old Deck had the greeting largest and
// the action as a small pill, which is that ladder upside down.
//
// Three numbers, maximum. Everything else belongs in the Logbook (§9.5).

function Home({ activeModuleCode, onGoToChapter, onEnterModule, onMakeActive, onOpenLogbook, onOpenReady }) {
  const { user } = useUser();
  const progress = useUserProgress();
  const { prefs } = useSocialPrefs();
  const [onFrequency, setOnFrequency] = useState(0);

  useEffect(() => {
    let live = true;
    fetchAllPresence(user?.id)
      .then((rows) => live && setOnFrequency((rows || []).length))
      .catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  const completed = new Set(progress.get("pw-completed", []));
  const viewed = new Set(progress.get("pw-viewed-chapters", []));
  const answered = progress.get("pw-chapter-progress", {});
  const scores = progress.get("pw-quiz-scores", {});
  const state = { completed, viewed, answered };

  const active = MODULES.find((m) => m.code === activeModuleCode) || MODULES[0];
  const activeChapters = chaptersForModule(active.code);
  const segments = moduleSegments(activeChapters, state);
  const next = nextChapter(activeChapters, state);

  const scoreValues = Object.values(scores).filter((v) => typeof v === "number");
  const average = scoreValues.length
    ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
    : null;

  const realFirst = user?.firstName || (user?.fullName ? user.fullName.split(" ")[0] : null);
  const name = prefs?.identity_display === "username"
    ? user?.username || realFirst
    : realFirst || user?.username;
  const greeting = new Date().getHours() < 12 ? "Cleared for departure" : "Evening ops";

  const parked = MODULES.filter((m) => m.code !== active.code);

  return (
    <div className="home">
      {/* 1 · Greeting — the one voice moment, and small. */}
      <p className="home-greeting">{name ? `${greeting}, ${name}` : greeting}</p>

      {/* 2 · Hero — the active module. Only one is active at a time. */}
      <section className="home-hero">
        {/* §12 — the page needs a heading. Level is structure, not size: §5's
            scale and §3.7's value ramp are what express visual rank. */}
        <h1 className="home-module">
          <span className="home-module-code">{active.code}</span> {active.name}
        </h1>

        <button className="home-next" onClick={() => next && onGoToChapter(active.code, next.id)}>
          Continue → {next ? `${next.code} · ${next.title}` : active.name}
        </button>

        <SegmentedBar
          segments={segments}
          currentId={next?.id}
          onPick={(s) => onGoToChapter(active.code, s.id)}
          labels
        />

        <div className="home-caption-row">
          <p className="home-caption">{progressCaption(segments)}</p>
          <ScoreDial pct={average} onOpen={onOpenLogbook} />
        </div>
      </section>

      {/* 3 · Parked modules — rows, not cards. Four fit a phone without scrolling. */}
      <ul className="home-parked">
        {parked.map((m) => {
          const chs = chaptersForModule(m.code);
          const { full, total } = chapterCount(moduleSegments(chs, state));
          return (
            <li key={m.code}>
              <div className="home-park">
                <button className="home-park-open" onClick={() => onEnterModule(m)}>
                  <span className="home-park-code">{m.code}</span>
                  <span className="home-park-name">{m.name}</span>
                  <span className="home-park-count">{full} of {total}</span>
                </button>
                {/* §9.1.4 — one tap, instant, reversible, and never a confirm. */}
                <button className="home-park-make" onClick={() => onMakeActive(m.code)}>Make active</button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 4 · The door. The only warm element on the screen, and neutral when
          nobody is there — it must never advertise an empty room. */}
      <button className={`home-door ${onFrequency ? "is-live" : ""}`} onClick={onOpenReady}>
        <span className="home-door-name">Ready Room</span>
        {onFrequency > 0 && <span className="home-door-count">{onFrequency} on frequency</span>}
      </button>

      <style>{`
        .home { display: flex; flex-direction: column; gap: 28px; padding: 8px 0 40px; }

        .home-greeting { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .home-hero { display: flex; flex-direction: column; gap: 14px; }
        .home-module { font-size: 14px; font-weight: 500; color: var(--text-secondary); margin: 0;
          display: flex; align-items: baseline; gap: 8px; }
        .home-module-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); }

        /* the attitude indicator: the largest text on the page */
        .home-next { font-size: 28px; font-weight: 500; line-height: 1.2; letter-spacing: -0.01em;
          color: var(--text-primary); background: none; border: none; padding: 0; margin: 0;
          text-align: left; cursor: pointer; }
        .home-next:hover { color: var(--accent-interactive); }

        .home-caption-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .home-caption { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .home-parked { list-style: none; margin: 0; padding: 0;
          display: grid; gap: 1px; background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .home-park { display: flex; align-items: center; background: var(--bg-panel); min-height: 56px; }
        .home-park-open { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 12px;
          padding: 0 14px; min-height: 56px; background: none; border: none; cursor: pointer; text-align: left; }
        .home-park-open:hover { background: var(--bg-raised); }
        .home-park-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); width: 44px; flex-shrink: 0; }
        .home-park-name { flex: 1; min-width: 0; font-size: 16px; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .home-park-count { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
          font-variant-numeric: tabular-nums; }
        .home-park-make { min-height: 56px; padding: 0 14px; background: none; border: none;
          cursor: pointer; color: var(--text-secondary); font-size: 14px; white-space: nowrap; }
        .home-park-make:hover { color: var(--text-primary); background: var(--bg-raised); }

        .home-door { display: flex; align-items: center; justify-content: space-between; gap: 12px;
          width: 100%; min-height: 60px; padding: 0 18px; border: none; border-radius: 12px;
          cursor: pointer; background: var(--bg-panel); color: var(--text-primary);
          box-shadow: inset 0 1px 0 var(--hairline-bevel);
          transition: background 600ms ease-out; }
        /* §4.2 — warmth arrives when someone is in there, and only then. */
        .home-door.is-live { background: var(--presence-panel); }
        .home-door-name { font-size: 16px; }
        .home-door-count { font-size: 14px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

        @media (min-width: 700px) {
          .home { max-width: 640px; }
        }
        @media (prefers-reduced-motion: reduce) { .home-door { transition: none; } }
      `}</style>
    </div>
  );
}

export default Home;
