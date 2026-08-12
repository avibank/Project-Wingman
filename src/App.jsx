import { useState, useRef, useEffect } from "react";
import { Play, FileText, MessageSquare, ClipboardCheck, Gauge, ChevronRight, Plus, CheckCircle2, XCircle, Lock, X, Sun, Moon, Search, Star, ThumbsUp, ThumbsDown, Check, Plane, Heart } from "lucide-react";

// ---- Small localStorage helpers (safe if run outside a browser) ----
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ---- Mock content: Jet Turbine Fundamentals ----
const MODULES = [
  { code: "JT", name: "Jet Turbine Fundamentals", status: "active", questions: 10 },
  { code: "PROP", name: "Propulsion Systems (coming soon)", status: "locked", questions: 0 },
];

const CHAPTERS = [
  {
    id: "ch1",
    code: "JT.01",
    title: "Intake & Compressor Stages",
    duration: "11:20",
    clip: "https://www.youtube.com/embed/CXSi4GXUojo",
    isPlaceholder: false,
    questions: [
      {
        id: "q1",
        stem: "In a jet engine's compressor, each successive stage generally has:",
        options: [
          "Larger blades and lower pressure than the previous stage",
          "Smaller blades and higher pressure than the previous stage",
          "The same blade size and pressure throughout",
          "Blades only on odd-numbered stages",
        ],
        answer: 1,
      },
      {
        id: "q2",
        stem: "An axial-flow compressor moves air:",
        options: [
          "Outward, perpendicular to the engine's centerline",
          "Parallel to the engine's centerline, stage by stage",
          "In a single reverse loop before combustion",
          "Only during engine start-up",
        ],
        answer: 1,
      },
      {
        id: "q3",
        stem: "Compressor stall is most likely to occur when:",
        options: [
          "Airflow into the compressor becomes smooth and steady",
          "Airflow is disrupted, causing blades to lose aerodynamic lift",
          "The engine is idling on the ground",
          "Fuel flow is reduced to zero",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch2",
    code: "JT.02",
    title: "Combustion Chamber Basics",
    duration: "14:50",
    clip: "https://www.youtube.com/embed/xycmedGUdB4",
    isPlaceholder: false,
    questions: [
      {
        id: "q4",
        stem: "The primary purpose of the combustion chamber is to:",
        options: [
          "Cool the compressed air before it reaches the turbine",
          "Add fuel and burn it to raise the energy of the airflow",
          "Compress air further before exhaust",
          "Reduce the velocity of exhaust gases",
        ],
        answer: 1,
      },
      {
        id: "q5",
        stem: "Igniters in the combustion chamber are typically used:",
        options: [
          "Continuously throughout the entire flight",
          "Only during engine start, since combustion becomes self-sustaining after",
          "Only during descent",
          "Only when the engine is shut down",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch3",
    code: "JT.03",
    title: "Turbine Section & Energy Extraction",
    duration: "16:35",
    clip: "https://www.youtube.com/embed/6bJ8Q79CHio",
    isPlaceholder: false,
    questions: [
      {
        id: "q6",
        stem: "The turbine section extracts energy from the hot gas stream mainly to:",
        options: [
          "Increase exhaust temperature",
          "Drive the compressor and accessories",
          "Slow the aircraft during descent",
          "Cool the combustion chamber",
        ],
        answer: 1,
      },
      {
        id: "q7",
        stem: "Turbine blades are typically made from materials that prioritize:",
        options: [
          "Low cost over performance",
          "High-temperature strength and creep resistance",
          "Maximum flexibility at room temperature",
          "Low density above all other properties",
        ],
        answer: 1,
      },
      {
        id: "q8",
        stem: "Nozzle guide vanes ahead of the turbine exist mainly to:",
        options: [
          "Add fuel before the gas reaches the turbine",
          "Direct the gas stream onto the turbine blades at the correct angle",
          "Cool the compressor",
          "Generate electrical power",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch4",
    code: "JT.04",
    title: "Exhaust & Thrust Generation",
    duration: "13:05",
    clip: "https://www.youtube.com/embed/BxomJafd3Rs",
    isPlaceholder: false,
    questions: [
      {
        id: "q9",
        stem: "Thrust in a jet engine is produced mainly as a result of:",
        options: [
          "Newton's third law — accelerating air rearward",
          "The engine's weight pressing down on the airframe",
          "Friction between the exhaust and outside air",
          "The compressor spinning at high RPM",
        ],
        answer: 0,
      },
      {
        id: "q10",
        stem: "As altitude increases, air density decreases, which generally causes jet engine thrust to:",
        options: [
          "Increase, due to less aerodynamic drag on the engine",
          "Decrease, due to less air mass available to accelerate",
          "Stay exactly the same at all altitudes",
          "Increase only above the speed of sound",
        ],
        answer: 1,
      },
    ],
  },
];

const SEED_COMMENTS = {
  ch2: [
    { id: "c1", user: "Yousef A.", text: "Why does fuel get added right after the compressor and not later in the flow?", time: "2h ago", reactions: { thumbsUp: 2, heart: 0 } },
    { id: "c2", user: "Sara K.", text: "@Yousef because that's where pressure is highest — the diagram at 6:40 shows the flame stays anchored in the chamber, not further downstream.", time: "1h ago", reactions: { thumbsUp: 3, heart: 1 } },
  ],
};

const PDFS = [
  { id: "p1", title: "JT.02 — Combustion Chamber: Study Notes", pages: 10, size: "980 KB" },
  { id: "p2", title: "JT.03 — Turbine Section: Summary Sheet", pages: 6, size: "520 KB" },
  { id: "p3", title: "Jet Turbine Fundamentals — Key Terms Reference", pages: 4, size: "300 KB" },
];

const NAV = [
  { id: "chapters", label: "Chapters", icon: ClipboardCheck },
  { id: "discuss", label: "Discussion", icon: MessageSquare },
  { id: "pdf", label: "Library", icon: FileText },
];

// Windsock streak indicator — striped and waving while a streak is active, dim and drooping when idle
function WindsockIcon({ size = 20, active }) {
  const activePath = "M2 5 L22 3 L18 7 L24 7 L18 11 L22 15 L2 13 Z";
  const idlePath = "M2 6 L18 6 L13 9 L18 11 L13 14 L18 16 L2 12 Z";
  const clipId = active ? "sockClipActive" : "sockClipIdle";
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 26 18" className={`windsock ${active ? "is-active" : "is-idle"}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={active ? activePath : idlePath} />
        </clipPath>
      </defs>
      {active ? (
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="26" height="18" fill="#fff" />
          <rect x="0" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="8" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="16" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="24" y="0" width="4" height="18" fill="#E5844D" />
        </g>
      ) : (
        <path d={idlePath} fill="var(--muted2)" opacity="0.6" />
      )}
      <line x1="1" y1="0" x2="1" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Placard({ children }) {
  return (
    <span className="placard">
      {children}
      <style>{`
        .placard {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          border-radius: 3px;
          background: var(--accent-soft);
          color: var(--accent);
          border: 1px solid var(--border-hover);
          text-transform: uppercase;
        }
      `}</style>
    </span>
  );
}

function Dial({ value, size = 96 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setDisplay(Math.round(start + (end - start) * p));
      if (p < 1) raf = requestAnimationFrame(step);
      else prevRef.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (display / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="var(--text)" fontSize="20" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
        {display}%
      </text>
    </svg>
  );
}

function ChapterQuiz({ questions, chapterTitle, onComplete, bookmarks, onToggleBookmark }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ correct: 0, seen: 0 });
  const [done, setDone] = useState(false);
  const [flashIdx, setFlashIdx] = useState(null);
  const q = questions[i];

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === q.answer) {
      setFlashIdx(idx);
      setTimeout(() => setFlashIdx(null), 500);
    }
    setScore((s) => ({ correct: s.correct + (idx === q.answer ? 1 : 0), seen: s.seen + 1 }));
  };

  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
    } else {
      setDone(true);
      onComplete?.();
    }
  };

  const restart = () => {
    setI(0);
    setPicked(null);
    setScore({ correct: 0, seen: 0 });
    setDone(false);
  };

  if (done) {
    const pct = Math.round((score.correct / questions.length) * 100);
    const isRough = pct < 50;
    const isPerfect = pct === 100;
    const statusLine =
      pct >= 90 ? `Cruising at ${pct}%` :
      pct >= 70 ? `Steady altitude — ${pct}%` :
      pct >= 50 ? `Light turbulence — ${pct}%` :
      `Holding pattern — ${pct}%`;
    return (
      <div className="exam-done">
        {isPerfect && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, idx) => (
              <Plane
                key={idx}
                size={14}
                className="confetti-plane"
                style={{ left: `${idx * 10 + Math.random() * 5}%`, animationDelay: `${idx * 0.08}s` }}
              />
            ))}
          </div>
        )}
        <Dial value={pct} size={100} />
        <div className="landing-strip">
          <Plane size={20} className={`landing-plane ${isRough ? "is-rough" : "is-smooth"}`} />
          <div className="runway" />
        </div>
        <h3>{statusLine}</h3>
        <p>{score.correct} of {questions.length} correct — {chapterTitle}</p>
        <button className="btn-primary" onClick={restart}>Retake set</button>
        <style>{`
          .exam-done { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px 20px; text-align: center; overflow: hidden; }
          .exam-done h3 { font-family: 'Space Grotesk', sans-serif; color: var(--text); margin: 6px 0 0; font-size: 16px; }
          .exam-done p { color: var(--muted); font-size: 13px; margin: 0 0 8px; }
          .landing-strip { position: relative; height: 34px; width: 100%; max-width: 220px; margin: 4px 0; }
          .runway { position: absolute; left: 0; right: 0; bottom: 6px; height: 2px; background: var(--border); }
          .landing-plane { position: absolute; bottom: 8px; color: var(--accent); }
          .landing-plane.is-smooth { animation: landSmooth 1.4s ease-out forwards; }
          .landing-plane.is-rough { animation: landRough 1.6s ease-out forwards; }
          @keyframes landSmooth {
            0% { left: -10%; bottom: 26px; opacity: 0; transform: rotate(20deg); }
            70% { opacity: 1; }
            100% { left: 85%; bottom: 8px; transform: rotate(0deg); opacity: 1; }
          }
          @keyframes landRough {
            0% { left: -10%; bottom: 26px; opacity: 0; transform: rotate(25deg); }
            40% { bottom: 4px; }
            55% { bottom: 14px; }
            70% { bottom: 2px; }
            85% { bottom: 10px; }
            100% { left: 85%; bottom: 6px; transform: rotate(-5deg); opacity: 1; }
          }
          .confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
          .confetti-plane { position: absolute; top: -20px; color: var(--accent); opacity: 0.9; animation: confettiFall 1.6s ease-in forwards; }
          @keyframes confettiFall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(220px) rotate(340deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  const bookmarked = bookmarks.has(q.id);

  return (
    <div className="exam">
      <div className="exam-head">
        <span className="exam-count">Question {i + 1} of {questions.length}</span>
        <div className="exam-head-right">
          <button
            className={`exam-bookmark ${bookmarked ? "is-on" : ""}`}
            onClick={() => onToggleBookmark(q.id)}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this question"}
          >
            <Star size={15} fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <Dial value={score.seen ? Math.round((score.correct / score.seen) * 100) : 0} size={44} />
        </div>
      </div>
      <p className="exam-stem">{q.stem}</p>
      <div className="exam-options">
        {q.options.map((opt, idx) => {
          const state = picked === null ? "idle" : idx === q.answer ? "correct" : idx === picked ? "wrong" : "idle";
          return (
            <button key={idx} className={`exam-opt exam-opt--${state} ${flashIdx === idx ? "is-flash" : ""}`} onClick={() => choose(idx)}>
              <span className="exam-opt-letter">{String.fromCharCode(65 + idx)}</span>
              <span>{opt}</span>
              {state === "correct" && <CheckCircle2 size={16} color="var(--good)" />}
              {state === "wrong" && <XCircle size={16} color="var(--bad)" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button className="btn-primary" onClick={next}>
          {i + 1 < questions.length ? "Next question" : "See results"} <ChevronRight size={16} />
        </button>
      )}
      <style>{`
        .exam-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .exam-head-right { display: flex; align-items: center; gap: 10px; }
        .exam-count { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); }
        .exam-bookmark { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .exam-bookmark:hover { border-color: var(--accent); color: var(--accent); }
        .exam-bookmark.is-on { color: #F2C230; border-color: #F2C230; }
        .exam-stem { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--text); line-height: 1.4; margin: 0 0 16px; }
        .exam-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .exam-opt { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 13px; border-radius: 14px; border: 1px solid var(--border); background: var(--panel-alt); color: var(--text); font-size: 13.5px; cursor: pointer; }
        .exam-opt:hover { border-color: var(--border-hover); }
        .exam-opt-letter { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted2); border: 1px solid var(--border); border-radius: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .exam-opt--correct { border-color: var(--good); background: rgba(76,175,125,0.08); }
        .exam-opt--wrong { border-color: var(--bad); background: rgba(224,102,90,0.08); }
        .exam-opt--correct span:last-child, .exam-opt--wrong span:last-child { margin-left: auto; }
        .exam-opt.is-flash { animation: flashGlow 0.5s ease-out; }
        @keyframes flashGlow {
          0% { box-shadow: 0 0 0 rgba(76,175,125,0); }
          40% { box-shadow: 0 0 18px rgba(76,175,125,0.55); }
          100% { box-shadow: 0 0 0 rgba(76,175,125,0); }
        }
      `}</style>
    </div>
  );
}

const TRIVIA = [
  "The Boeing 747's wingspan (68.4 m) is longer than the Wright brothers' first powered flight (36.5 m).",
  "A jet engine can process enough air per second to fill a small house.",
  "Concorde could cross the Atlantic in under 3.5 hours — faster than the Earth's own rotation beneath it.",
  "At a typical 35,000 ft cruising altitude, the sky above starts to look noticeably darker.",
  "Some turbine blades spin at speeds exceeding 10,000 RPM.",
];

function ChaptersPanel() {
  const [openId, setOpenId] = useState(CHAPTERS[0].id);
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState(() => new Set(loadJSON("pw-completed", [])));
  const [bookmarks, setBookmarks] = useState(() => new Set(loadJSON("pw-bookmarks", [])));
  const [feedback, setFeedback] = useState(() => loadJSON("pw-feedback", {}));
  const [seen, setSeen] = useState(new Set());
  const [checklistId, setChecklistId] = useState(null);
  const [toast, setToast] = useState(null);

  const markComplete = (id) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveJSON("pw-completed", [...next]);
      return next;
    });
  };

  const toggleBookmark = (qId) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      saveJSON("pw-bookmarks", [...next]);
      return next;
    });
  };

  const giveFeedback = (chapterId, value) => {
    setFeedback((prev) => {
      const next = { ...prev, [chapterId]: value };
      saveJSON("pw-feedback", next);
      return next;
    });
  };

  const openChapter = (ch) => {
    const isOpen = openId === ch.id;
    if (isOpen) {
      setOpenId(null);
      return;
    }
    setOpenId(ch.id);
    if (!seen.has(ch.id)) {
      setChecklistId(ch.id);
      setToast(`NOW BOARDING — ${ch.code}`);
      setTimeout(() => {
        setChecklistId(null);
        setSeen((s) => new Set(s).add(ch.id));
      }, 1500);
      setTimeout(() => setToast(null), 2200);
    }
  };

  const filtered = CHAPTERS.filter((ch) => ch.title.toLowerCase().includes(query.toLowerCase()) || ch.code.toLowerCase().includes(query.toLowerCase()));
  const allDone = completed.size === CHAPTERS.length;
  const streakVal = parseInt(localStorage.getItem("pw-streak") || "0", 10);
  const trivia = TRIVIA[Math.floor(Date.now() / 86400000) % TRIVIA.length];

  return (
    <div className="chapters-wrap">
      <div className="cloud-layer" aria-hidden="true">
        <span className="cloud cloud-a" />
        <span className="cloud cloud-b" />
        <span className="cloud cloud-c" />
      </div>
      {toast && <div className="boarding-toast">{toast}</div>}
      <div className="trivia-card">✈ Did you know: {trivia}</div>
      {allDone && (
        <div className="blackbox">
          <div className="blackbox-title"><Check size={12} /> FLIGHT RECORDER — ALL CHAPTERS COMPLETE</div>
          <div className="blackbox-grid">
            <div><span>{CHAPTERS.length}</span><label>Chapters flown</label></div>
            <div><span>{streakVal}</span><label>Day streak</label></div>
            <div><span>{bookmarks.size}</span><label>Bookmarked Qs</label></div>
          </div>
        </div>
      )}
      <div className="chapters-search">
        <Search size={15} />
        <input placeholder="Search chapters…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chapters">
        {filtered.map((ch) => {
          const isOpen = openId === ch.id;
          const isDone = completed.has(ch.id);
          const fb = feedback[ch.id];
          const showChecklist = checklistId === ch.id;
          return (
            <div key={ch.id} className={`chapter ${isOpen ? "is-open" : ""}`}>
              <button className="chapter-head" onClick={() => openChapter(ch)}>
                <span className="chapter-code">{ch.code}</span>
                <span className="chapter-title">{ch.title}</span>
                {isDone && (
                  <span className="chapter-done" title="Completed"><Check size={12} strokeWidth={3} /></span>
                )}
                <span className="chapter-meta">{ch.questions.length} questions · {ch.duration}</span>
                <ChevronRight size={16} className="chapter-chevron" />
              </button>
              {isOpen && (
                <div className="chapter-body">
                  {showChecklist ? (
                    <div className="preflight">
                      <div className="preflight-item"><Check size={12} /> Video loaded</div>
                      <div className="preflight-item"><Check size={12} /> Questions ready</div>
                      <div className="preflight-item"><Check size={12} /> Cleared for study</div>
                    </div>
                  ) : (
                    <>
                      <div className="chapter-video">
                        {ch.clip.includes("youtube.com/embed") ? (
                          <iframe
                            key={ch.id}
                            className="player-video"
                            src={ch.clip}
                            title={ch.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video key={ch.id} className="player-video" controls preload="metadata">
                            <source src={ch.clip} type="video/mp4" />
                          </video>
                        )}
                        {ch.isPlaceholder && (
                          <div className="player-tag"><Play size={11} /> Placeholder clip — swap for your recording</div>
                        )}
                      </div>
                      <div>
                        <div className="chapter-quiz-head">Practice questions for this chapter</div>
                        <ChapterQuiz
                          key={ch.id}
                          questions={ch.questions}
                          chapterTitle={ch.title}
                          onComplete={() => markComplete(ch.id)}
                          bookmarks={bookmarks}
                          onToggleBookmark={toggleBookmark}
                        />
                        <div className="chapter-feedback">
                          {fb ? (
                            <span className="chapter-feedback-thanks">Thanks for the feedback!</span>
                          ) : (
                            <>
                              <span>Was this chapter helpful?</span>
                              <button onClick={() => giveFeedback(ch.id, "up")} aria-label="Helpful"><ThumbsUp size={14} /></button>
                              <button onClick={() => giveFeedback(ch.id, "down")} aria-label="Not helpful"><ThumbsDown size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="chapters-empty">No chapters match "{query}".</p>}
      </div>
      <style>{`
        .chapters-wrap { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .cloud-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .cloud { position: absolute; width: 220px; height: 60px; background: radial-gradient(ellipse at center, var(--text) 0%, transparent 70%); opacity: 0.035; border-radius: 50%; filter: blur(6px); }
        .cloud-a { top: 4%; left: -15%; animation: driftA 60s linear infinite; }
        .cloud-b { top: 32%; left: -25%; animation: driftB 90s linear infinite; }
        .cloud-c { top: 62%; left: -20%; animation: driftA 75s linear infinite reverse; }
        @keyframes driftA { from { transform: translateX(0); } to { transform: translateX(140vw); } }
        @keyframes driftB { from { transform: translateX(0); } to { transform: translateX(160vw); } }
        .boarding-toast { position: relative; z-index: 2; background: var(--accent); color: var(--on-accent); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; padding: 8px 14px; border-radius: 10px; text-align: center; animation: toastFade 2.2s ease forwards; }
        @keyframes toastFade { 0% { opacity: 0; transform: translateY(-6px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
        .trivia-card { position: relative; z-index: 1; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; font-size: 12.5px; color: var(--muted); }
        .blackbox { position: relative; z-index: 1; background: var(--panel-alt); border: 1px solid var(--border-hover); border-radius: 14px; padding: 14px 16px; }
        .blackbox-title { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; color: var(--good); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
        .blackbox-grid { display: flex; gap: 22px; }
        .blackbox-grid div { display: flex; flex-direction: column; }
        .blackbox-grid span { font-family: 'Space Grotesk', sans-serif; font-size: 20px; color: var(--text); font-weight: 700; }
        .blackbox-grid label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.04em; }
        .chapters-search { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; color: var(--muted2); }
        .chapters-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .chapters-search input:focus { outline: none; }
        .chapters { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .chapters-empty { color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .chapter { border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--panel); }
        .chapter.is-open { border-color: var(--border-hover); }
        .chapter-head { display: grid; grid-template-columns: auto 1fr auto auto auto; align-items: center; gap: 10px; width: 100%; padding: 16px 16px; background: transparent; border: none; cursor: pointer; text-align: left; }
        .chapter-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); }
        .chapter-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); }
        .chapter-done { width: 18px; height: 18px; border-radius: 50%; background: var(--good); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chapter-meta { font-size: 11.5px; color: var(--muted2); font-family: 'JetBrains Mono', monospace; }
        .chapter-chevron { color: var(--muted2); transition: transform 0.2s ease; }
        .chapter.is-open .chapter-chevron { transform: rotate(90deg); }
        .chapter-body { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; padding: 16px 16px 20px; border-top: 1px solid var(--border-soft); min-height: 60px; }
        @media (max-width: 720px) { .chapter-body { grid-template-columns: 1fr; } }
        .preflight { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; padding: 10px 0; }
        .preflight-item { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--good); opacity: 0; animation: checklistIn 0.3s ease forwards; }
        .preflight-item:nth-child(1) { animation-delay: 0.1s; }
        .preflight-item:nth-child(2) { animation-delay: 0.5s; }
        .preflight-item:nth-child(3) { animation-delay: 0.9s; }
        @keyframes checklistIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
        .chapter-video { aspect-ratio: 16/9; border-radius: 14px; background: var(--bg); border: 1px solid var(--border); position: relative; overflow: hidden; }
        .player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: var(--bg); border: none; }
        .player-tag { position: absolute; top: 10px; left: 10px; display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.03em; color: #cfe0ff; background: rgba(11,21,38,0.72); backdrop-filter: blur(4px); padding: 5px 9px; border-radius: 8px; border: 1px solid rgba(111,160,240,0.3); pointer-events: none; }
        .chapter-quiz-head { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin-bottom: 12px; }
        .chapter-feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-soft); font-size: 12.5px; color: var(--muted); }
        .chapter-feedback button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chapter-feedback button:hover { border-color: var(--accent); color: var(--accent); }
        .chapter-feedback-thanks { color: var(--good); }
      `}</style>
    </div>
  );
}

function DiscussPanel() {
  const [comments, setComments] = useState(SEED_COMMENTS.ch2);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [reacted, setReacted] = useState(new Set());
  const fileRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const post = () => {
    if (!text.trim() && !pendingImage) return;
    setComments((c) => [...c, { id: `c${c.length + 1}`, user: "You", text, image: pendingImage, time: "now", reactions: { thumbsUp: 0, heart: 0 } }]);
    setText("");
    setPendingImage(null);
  };

  const toggleReaction = (commentId, type) => {
    const key = `${commentId}-${type}`;
    const already = reacted.has(key);
    setComments((cs) => cs.map((c) => (c.id === commentId ? { ...c, reactions: { ...c.reactions, [type]: c.reactions[type] + (already ? -1 : 1) } } : c)));
    setReacted((r) => {
      const next = new Set(r);
      already ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const myPosts = comments.filter((c) => c.user === "You").length;

  return (
    <div className="discuss">
      <div className="discuss-head">
        <Placard>JT.02 · Combustion Chamber</Placard>
        <span className="discuss-count">{comments.length} threads</span>
      </div>
      {myPosts > 0 && (
        <div className="leaderboard">🏆 You're the most active flyer today — {myPosts} post{myPosts === 1 ? "" : "s"} and counting.</div>
      )}
      <div className="discuss-list">
        {comments.map((c) => (
          <div key={c.id} className="discuss-item">
            <div className="discuss-avatar">{c.user.charAt(0)}</div>
            <div>
              <div className="discuss-meta"><strong>{c.user}</strong><span>{c.time}</span></div>
              {c.text && <p>{c.text}</p>}
              {c.image && <img src={c.image} alt="attachment" className="discuss-img" />}
              <div className="discuss-reactions">
                <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => toggleReaction(c.id, "thumbsUp")}>
                  <ThumbsUp size={12} /> {c.reactions?.thumbsUp || 0}
                </button>
                <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => toggleReaction(c.id, "heart")}>
                  <Heart size={12} /> {c.reactions?.heart || 0}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {pendingImage && (
        <div className="discuss-preview">
          <img src={pendingImage} alt="attachment preview" />
          <button onClick={() => setPendingImage(null)} aria-label="Remove attachment"><X size={13} /></button>
        </div>
      )}
      <div className="discuss-input">
        <input type="file" accept="image/*" ref={fileRef} onChange={onFileChange} style={{ display: "none" }} />
        <button className="discuss-attach" onClick={() => fileRef.current?.click()} aria-label="Attach photo"><Plus size={18} strokeWidth={2.5} /></button>
        <input
          placeholder="Ask a question about this lesson…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
        />
        <button className="discuss-send" onClick={post} aria-label="Post"><Plane size={18} style={{ transform: "rotate(45deg)" }} /></button>
      </div>
      <style>{`
        .discuss { display: flex; flex-direction: column; height: calc(100vh - 250px); min-height: 360px; padding-bottom: 20px; }
        .discuss-head { display: flex; align-items: center; justify-content: space-between; margin: 0 auto 10px; max-width: 640px; width: 100%; flex-shrink: 0; }
        .discuss-count { font-size: 12px; color: var(--muted); }
        .leaderboard { max-width: 640px; margin: 0 auto 12px; width: 100%; font-size: 12px; color: var(--muted); background: var(--panel-alt); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; flex-shrink: 0; }
        .discuss-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin: 0 auto; width: 100%; padding: 4px 4px 12px; }
        .discuss-item { display: flex; gap: 12px; }
        .discuss-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-size: 13px; flex-shrink: 0; }
        .discuss-meta { display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: var(--text); margin-bottom: 3px; }
        .discuss-meta span { font-size: 11px; color: var(--muted2); }
        .discuss-item p { margin: 0; font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }
        .discuss-img { display: block; max-width: 240px; width: 100%; border-radius: 12px; margin-top: 6px; border: 1px solid var(--border); }
        .discuss-reactions { display: flex; gap: 6px; margin-top: 6px; }
        .discuss-reactions button { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 11px; padding: 3px 8px; border-radius: 20px; cursor: pointer; }
        .discuss-reactions button:hover { border-color: var(--accent); color: var(--accent); }
        .discuss-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .discuss-preview { position: relative; max-width: 640px; margin: 8px auto 0; width: fit-content; }
        .discuss-preview img { max-height: 90px; border-radius: 10px; border: 1px solid var(--border); display: block; }
        .discuss-preview button { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .discuss-input { flex-shrink: 0; display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 8px auto 0; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 32px; padding: 8px; min-height: 58px; }
        .discuss-attach { background: #E5484D; border: none; color: #fff; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; animation: pulseRed 2.4s ease-in-out infinite; }
        .discuss-attach:hover { background: #f05c61; }
        .discuss-input input[type="text"], .discuss-input input:not([type]) { flex: 1; background: transparent; border: none; padding: 10px 4px; color: var(--text); font-size: 13.5px; }
        .discuss-input input:focus { outline: none; }
        .discuss-send { background: #34C77B; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; color: #0E1830; cursor: pointer; flex-shrink: 0; animation: pulseGreen 2.4s ease-in-out infinite; animation-delay: 1.2s; }
        .discuss-send:hover { background: #4bd88e; }
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 3px rgba(229,72,77,0.15); opacity: 0.55; }
          50% { box-shadow: 0 0 16px rgba(229,72,77,0.9); opacity: 1; }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 3px rgba(52,199,123,0.15); opacity: 0.55; }
          50% { box-shadow: 0 0 16px rgba(52,199,123,0.9); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .discuss-attach, .discuss-send { animation: none; box-shadow: 0 0 8px rgba(229,72,77,0.35); }
          .discuss-send { box-shadow: 0 0 8px rgba(52,199,123,0.35); }
        }
      `}</style>
    </div>
  );
}

function PdfPanel() {
  const [query, setQuery] = useState("");
  const filtered = PDFS.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="pdf-wrap">
      <div className="pdf-search">
        <Search size={15} />
        <input placeholder="Search the library…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="pdf-list">
        {filtered.map((p) => (
          <div key={p.id} className="pdf-row">
            <div className="pdf-icon"><FileText size={18} color="var(--accent)" /></div>
            <div className="pdf-meta">
              <div className="pdf-title">{p.title}</div>
              <div className="pdf-sub">{p.pages} pages · {p.size}</div>
            </div>
            <button className="pdf-open">Open</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="pdf-empty">No files match "{query}".</p>}
      </div>
      <style>{`
        .pdf-wrap { display: flex; flex-direction: column; gap: 16px; }
        .pdf-search { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; color: var(--muted2); }
        .pdf-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .pdf-search input:focus { outline: none; }
        .pdf-list { display: flex; flex-direction: column; gap: 10px; }
        .pdf-empty { color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .pdf-row { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
        .pdf-icon { width: 36px; height: 36px; border-radius: 12px; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pdf-title { font-size: 14px; color: var(--text); }
        .pdf-sub { font-size: 11.5px; color: var(--muted2); margin-top: 2px; }
        .pdf-meta { flex: 1; }
        .pdf-open { background: transparent; border: 1px solid var(--border-hover); color: var(--text); border-radius: 10px; padding: 7px 14px; font-size: 12.5px; cursor: pointer; }
        .pdf-open:hover { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("chapters");
  const [module, setModule] = useState(MODULES[0]);
  const [theme, setTheme] = useState(() => loadJSON("pw-theme", "dark"));
  const [livery, setLivery] = useState(() => loadJSON("pw-livery", "blue"));
  const [streak, setStreak] = useState(0);
  const [boarding, setBoarding] = useState(true);
  const [paToast, setPaToast] = useState(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [ticket] = useState(() => ({
    seat: `${Math.ceil(Math.random() * 30)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`,
    gate: String.fromCharCode(65 + Math.floor(Math.random() * 6)) + (Math.floor(Math.random() * 20) + 1),
  }));

  useEffect(() => {
    saveJSON("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    saveJSON("pw-livery", livery);
  }, [livery]);

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
    const onScroll = () => {
      const h = document.documentElement;
      const pct = h.scrollHeight > h.clientHeight ? h.scrollTop / (h.scrollHeight - h.clientHeight) : 0;
      setScrollPct(Math.min(1, Math.max(0, pct)));
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

  return (
    <div className={`app ${theme === "light" ? "theme-light" : ""} livery-${livery}`}>
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
        </div>
      )}
      {paToast && <div className="pa-toast">{paToast}</div>}
      <header className="topbar">
        <div className="brand">
          <Gauge size={20} color="var(--accent)" />
          <span>Project Wingman</span>
        </div>
        <div className="topbar-right">
          <span className="streak-badge" title={streak > 0 ? "Consecutive days active" : "No active streak"}>
            <WindsockIcon size={20} active={streak > 0} />
            <span className="streak-num">{streak}</span>
          </span>
          <div className="livery-picker" role="group" aria-label="Choose accent color">
            {[
              { id: "blue", color: "#3D6FD1" },
              { id: "red", color: "#E5484D" },
              { id: "green", color: "#2FA84F" },
            ].map((l) => (
              <button
                key={l.id}
                className={`livery-swatch ${livery === l.id ? "is-active" : ""}`}
                style={{ background: l.color }}
                onClick={() => setLivery(l.id)}
                aria-label={`${l.id} livery`}
              />
            ))}
          </div>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <div className="module-select">
            {MODULES.map((m) => (
              <button
                key={m.code}
                className={`module-chip ${module.code === m.code ? "is-active" : ""}`}
                onClick={() => m.status === "active" && setModule(m)}
                disabled={m.status === "locked"}
              >
                {m.status === "locked" && <Lock size={11} />}
                {m.code}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="module-banner">
        <div>
          <h1>{module.name}</h1>
          <p>Aviation Fundamentals · {module.questions} questions in bank</p>
        </div>
      </div>

      <nav className="tabbar">
        {NAV.map((n) => (
          <button key={n.id} className={`tab ${tab === n.id ? "is-active" : ""}`} onClick={() => setTab(n.id)}>
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

      <div className="flight-progress" aria-hidden="true">
        <div className="runway-lights">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={`runway-dot ${i < Math.floor(scrollPct * 12) ? "is-lit" : ""}`} />
          ))}
        </div>
        <span className="distance-flown">{Math.round(scrollPct * 2400)} nm flown</span>
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
        .app.livery-red { --accent: #E5484D; --accent-hover: #F0777B; --accent-soft: rgba(229,72,77,0.12); }
        .app.livery-green { --accent: #2FA84F; --accent-hover: #4BC96C; --accent-soft: rgba(47,168,79,0.12); }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border-soft); flex-wrap: wrap; gap: 10px; }
        .brand { display: flex; align-items: center; gap: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; color: var(--text); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .streak-badge { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text); background: var(--panel); border: 1px solid var(--border); padding: 5px 9px; border-radius: 10px; }
        .streak-num { min-width: 10px; }
        .windsock.is-active { animation: sockWave 1.8s ease-in-out infinite; transform-origin: left center; }
        .windsock.is-idle { transform: rotate(6deg); }
        @keyframes sockWave { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        .livery-picker { display: flex; gap: 5px; align-items: center; }
        .livery-swatch { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
        .livery-swatch.is-active { border-color: var(--text); }
        .theme-toggle { background: var(--panel); border: 1px solid var(--border); color: var(--muted2); width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .theme-toggle:hover { border-color: var(--accent); color: var(--accent); }
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
        .boarding-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; align-items: center; justify-content: center; animation: boardingFade 1.8s ease forwards; }
        .boarding-pass { width: min(320px, 84vw); background: var(--panel); border: 1px solid var(--border-hover); border-radius: 18px; padding: 22px; }
        .boarding-pass-top { display: flex; align-items: center; justify-content: space-between; color: var(--accent); margin-bottom: 14px; }
        .boarding-pass-airline { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; color: var(--muted2); }
        .boarding-pass-route { font-family: 'Space Grotesk', sans-serif; font-size: 20px; color: var(--text); display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
        .boarding-pass-row { display: flex; gap: 22px; margin-bottom: 16px; }
        .boarding-pass-row label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--muted2); letter-spacing: 0.06em; margin-bottom: 3px; }
        .boarding-pass-row span { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); font-weight: 600; }
        .boarding-pass-barcode { height: 30px; background: repeating-linear-gradient(90deg, var(--text) 0 2px, transparent 2px 5px); opacity: 0.35; border-radius: 4px; }
        @keyframes boardingFade {
          0% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        .pa-toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 90; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 8px 16px; border-radius: 10px; animation: paFade 1.6s ease forwards; }
        @keyframes paFade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .flight-progress { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: var(--panel); border-top: 1px solid var(--border-soft); }
        .runway-lights { display: flex; gap: 4px; }
        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
        .runway-dot.is-lit { background: #F2C230; box-shadow: 0 0 5px rgba(242,194,48,0.8); }
        .distance-flown { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); }
        @media (prefers-reduced-motion: reduce) {
          .boarding-overlay { animation-duration: 0.4s; }
          .content-taxi { animation: none; }
          .windsock.is-active { animation: none; }
        }
      `}</style>
    </div>
  );
}
