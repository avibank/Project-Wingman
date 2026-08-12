import { useState, useRef } from "react";
import { Play, FileText, MessageSquare, ClipboardCheck, Gauge, ChevronRight, Plus, Plane, CheckCircle2, XCircle, Lock, X } from "lucide-react";

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
    { id: "c1", user: "Yousef A.", text: "Why does fuel get added right after the compressor and not later in the flow?", time: "2h ago" },
    { id: "c2", user: "Sara K.", text: "@Yousef because that's where pressure is highest — the diagram at 6:40 shows the flame stays anchored in the chamber, not further downstream.", time: "1h ago" },
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
          background: rgba(111,160,240,0.14);
          color: #6FA0F0;
          border: 1px solid rgba(111,160,240,0.4);
          text-transform: uppercase;
        }
      `}</style>
    </span>
  );
}

function Dial({ value, size = 96 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E2C46" strokeWidth="7" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#6FA0F0"
        strokeWidth="7"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="#E8EDF2" fontSize="20" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
        {value}%
      </text>
    </svg>
  );
}

function ChapterQuiz({ questions, chapterTitle }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ correct: 0, seen: 0 });
  const [done, setDone] = useState(false);
  const q = questions[i];

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    setScore((s) => ({ correct: s.correct + (idx === q.answer ? 1 : 0), seen: s.seen + 1 }));
  };

  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
    } else {
      setDone(true);
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
    return (
      <div className="exam-done">
        <Dial value={pct} size={100} />
        <h3>Set complete</h3>
        <p>{score.correct} of {questions.length} correct — {chapterTitle}</p>
        <button className="btn-primary" onClick={restart}>Retake set</button>
        <style>{`
          .exam-done { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px 20px; text-align: center; }
          .exam-done h3 { font-family: 'Space Grotesk', sans-serif; color: #E8EDF2; margin: 6px 0 0; font-size: 16px; }
          .exam-done p { color: #8291AC; font-size: 13px; margin: 0 0 8px; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="exam">
      <div className="exam-head">
        <span className="exam-count">Question {i + 1} of {questions.length}</span>
        <Dial value={score.seen ? Math.round((score.correct / score.seen) * 100) : 0} size={44} />
      </div>
      <p className="exam-stem">{q.stem}</p>
      <div className="exam-options">
        {q.options.map((opt, idx) => {
          const state = picked === null ? "idle" : idx === q.answer ? "correct" : idx === picked ? "wrong" : "idle";
          return (
            <button key={idx} className={`exam-opt exam-opt--${state}`} onClick={() => choose(idx)}>
              <span className="exam-opt-letter">{String.fromCharCode(65 + idx)}</span>
              <span>{opt}</span>
              {state === "correct" && <CheckCircle2 size={16} color="#4CAF7D" />}
              {state === "wrong" && <XCircle size={16} color="#E08585" />}
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
        .exam-count { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #8291AC; }
        .exam-stem { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: #E8EDF2; line-height: 1.4; margin: 0 0 16px; }
        .exam-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .exam-opt { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 13px; border-radius: 14px; border: 1px solid #22314A; background: #0E1A2C; color: #E8EDF2; font-size: 13.5px; cursor: pointer; }
        .exam-opt:hover { border-color: #33456B; }
        .exam-opt-letter { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #66768F; border: 1px solid #2A3A56; border-radius: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .exam-opt--correct { border-color: #4CAF7D; background: rgba(76,175,125,0.08); }
        .exam-opt--wrong { border-color: #E08585; background: rgba(224,102,90,0.08); }
        .exam-opt--correct span:last-child, .exam-opt--wrong span:last-child { margin-left: auto; }
      `}</style>
    </div>
  );
}

function ChaptersPanel() {
  const [openId, setOpenId] = useState(CHAPTERS[0].id);

  return (
    <div className="chapters">
      {CHAPTERS.map((ch) => {
        const isOpen = openId === ch.id;
        return (
          <div key={ch.id} className={`chapter ${isOpen ? "is-open" : ""}`}>
            <button className="chapter-head" onClick={() => setOpenId(isOpen ? null : ch.id)}>
              <span className="chapter-code">{ch.code}</span>
              <span className="chapter-title">{ch.title}</span>
              <span className="chapter-meta">{ch.questions.length} questions · {ch.duration}</span>
              <ChevronRight size={16} className="chapter-chevron" />
            </button>
            {isOpen && (
              <div className="chapter-body">
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
                <div className="chapter-quiz-head">Practice questions for this chapter</div>
                <ChapterQuiz key={ch.id} questions={ch.questions} chapterTitle={ch.title} />
              </div>
            )}
          </div>
        );
      })}
      <style>{`
        .chapters { display: flex; flex-direction: column; gap: 12px; }
        .chapter { border: 1px solid #22314A; border-radius: 16px; overflow: hidden; background: #101B2D; }
        .chapter.is-open { border-color: #33456B; }
        .chapter-head { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; width: 100%; padding: 16px 16px; background: transparent; border: none; cursor: pointer; text-align: left; }
        .chapter-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6FA0F0; }
        .chapter-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: #E8EDF2; }
        .chapter-meta { font-size: 11.5px; color: #66768F; font-family: 'JetBrains Mono', monospace; }
        .chapter-chevron { color: #66768F; transition: transform 0.2s ease; }
        .chapter.is-open .chapter-chevron { transform: rotate(90deg); }
        .chapter-body { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; padding: 16px 16px 20px; border-top: 1px solid rgba(111,160,240,0.12); }
        @media (max-width: 720px) { .chapter-body { grid-template-columns: 1fr; } }
        .chapter-video { aspect-ratio: 16/9; border-radius: 14px; background: #0B1526; border: 1px solid #22314A; position: relative; overflow: hidden; }
        .player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: #0B1526; border: none; }
        .player-tag { position: absolute; top: 10px; left: 10px; display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.03em; color: #cfe0ff; background: rgba(11,21,38,0.72); backdrop-filter: blur(4px); padding: 5px 9px; border-radius: 8px; border: 1px solid rgba(111,160,240,0.3); pointer-events: none; }
        .chapter-quiz-head { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #66768F; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}

function DiscussPanel() {
  const [comments, setComments] = useState(SEED_COMMENTS.ch2);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
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
    setComments((c) => [...c, { id: `c${c.length + 1}`, user: "You", text, image: pendingImage, time: "now" }]);
    setText("");
    setPendingImage(null);
  };

  return (
    <div className="discuss">
      <div className="discuss-head">
        <Placard>JT.02 · Combustion Chamber</Placard>
        <span className="discuss-count">{comments.length} threads</span>
      </div>
      <div className="discuss-list">
        {comments.map((c) => (
          <div key={c.id} className="discuss-item">
            <div className="discuss-avatar">{c.user.charAt(0)}</div>
            <div>
              <div className="discuss-meta"><strong>{c.user}</strong><span>{c.time}</span></div>
              {c.text && <p>{c.text}</p>}
              {c.image && <img src={c.image} alt="attachment" className="discuss-img" />}
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
        <button className="discuss-send" onClick={post} aria-label="Post"><Plane size={17} style={{ transform: "rotate(45deg)" }} /></button>
      </div>
      <style>{`
        .discuss { display: flex; flex-direction: column; height: calc(100vh - 250px); min-height: 360px; padding-bottom: 20px; }
        .discuss-head { display: flex; align-items: center; justify-content: space-between; margin: 0 auto 16px; max-width: 640px; width: 100%; flex-shrink: 0; }
        .discuss-count { font-size: 12px; color: #8291AC; }
        .discuss-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin: 0 auto; width: 100%; padding: 4px 4px 12px; }
        .discuss-item { display: flex; gap: 12px; }
        .discuss-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1E2C46; color: #6FA0F0; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-size: 13px; flex-shrink: 0; }
        .discuss-meta { display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: #E8EDF2; margin-bottom: 3px; }
        .discuss-meta span { font-size: 11px; color: #66768F; }
        .discuss-item p { margin: 0; font-size: 13.5px; color: #b9c4cf; line-height: 1.5; }
        .discuss-img { display: block; max-width: 240px; width: 100%; border-radius: 12px; margin-top: 6px; border: 1px solid #22314A; }
        .discuss-preview { position: relative; max-width: 640px; margin: 8px auto 0; width: fit-content; }
        .discuss-preview img { max-height: 90px; border-radius: 10px; border: 1px solid #22314A; display: block; }
        .discuss-preview button { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: #0E1830; border: 1px solid #22314A; color: #E8EDF2; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .discuss-input { flex-shrink: 0; display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 8px auto 0; width: 100%; background: #101B2D; border: 1px solid #22314A; border-radius: 32px; padding: 8px; min-height: 58px; }
        .discuss-attach { background: #E5484D; border: none; color: #fff; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; animation: pulseRed 2.4s ease-in-out infinite; }
        .discuss-attach:hover { background: #f05c61; }
        .discuss-input input[type="text"], .discuss-input input:not([type]) { flex: 1; background: transparent; border: none; padding: 10px 4px; color: #E8EDF2; font-size: 13.5px; }
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
  return (
    <div className="pdf-list">
      {PDFS.map((p) => (
        <div key={p.id} className="pdf-row">
          <div className="pdf-icon"><FileText size={18} color="#6FA0F0" /></div>
          <div className="pdf-meta">
            <div className="pdf-title">{p.title}</div>
            <div className="pdf-sub">{p.pages} pages · {p.size}</div>
          </div>
          <button className="pdf-open">Open</button>
        </div>
      ))}
      <style>{`
        .pdf-list { display: flex; flex-direction: column; gap: 10px; }
        .pdf-row { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid #22314A; border-radius: 14px; background: #101B2D; }
        .pdf-icon { width: 36px; height: 36px; border-radius: 12px; background: rgba(111,160,240,0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pdf-title { font-size: 14px; color: #E8EDF2; }
        .pdf-sub { font-size: 11.5px; color: #66768F; margin-top: 2px; }
        .pdf-meta { flex: 1; }
        .pdf-open { background: transparent; border: 1px solid #33456B; color: #E8EDF2; border-radius: 10px; padding: 7px 14px; font-size: 12.5px; cursor: pointer; }
        .pdf-open:hover { border-color: #6FA0F0; color: #6FA0F0; }
      `}</style>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("chapters");
  const [module, setModule] = useState(MODULES[0]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Gauge size={20} color="#6FA0F0" />
          <span>Project Wingman</span>
        </div>
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

      <main className={`content ${tab === "discuss" || tab === "pdf" ? "content--full" : ""}`}>
        {tab === "chapters" && <ChaptersPanel />}
        {tab === "discuss" && <DiscussPanel />}
        {tab === "pdf" && <PdfPanel />}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; margin: 0; background: #0B1526; }
        .app { font-family: 'Inter', sans-serif; background: #0B1526; color: #E8EDF2; min-height: 100vh; padding: 0 0 40px; }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid rgba(111,160,240,0.12); }
        .brand { display: flex; align-items: center; gap: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; color: #E8EDF2; }
        .module-select { display: flex; gap: 6px; }
        .module-chip { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #101B2D; border: 1px solid #22314A; color: #8291AC; padding: 6px 11px; border-radius: 10px; cursor: pointer; }
        .module-chip.is-active { color: #6FA0F0; border-color: #6FA0F0; background: rgba(111,160,240,0.10); }
        .module-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .module-banner { padding: 26px 22px 18px; }
        .module-banner h1 { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 4px; }
        .module-banner p { color: #8291AC; font-size: 13px; margin: 0; font-family: 'JetBrains Mono', monospace; }
        .tabbar { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid rgba(111,160,240,0.12); }
        .tab { display: flex; align-items: center; gap: 7px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #66768F; font-size: 13.5px; padding: 12px 6px; margin-right: 22px; cursor: pointer; }
        .tab.is-active { color: #E8EDF2; border-bottom-color: #6FA0F0; }
        .content { max-width: 780px; margin: 28px auto 0; padding: 0 22px; }
        .content--full { max-width: none; padding: 0 22px; }
        .btn-primary { display: flex; align-items: center; gap: 6px; justify-content: center; background: #6FA0F0; color: #0E1830; border: none; border-radius: 12px; padding: 12px 18px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: #8FB8F5; }
      `}</style>
    </div>
  );
}
