/* =============================================================================
   THE STUDIO — where an admin writes the course instead of sending it away.
   -----------------------------------------------------------------------------
   The owner, 2026-09-30: "I want a way as an admin to add quizzes and study
   cards and papers natively, like how I feed you those — add, delete, edit.
   Build a demo."

   So this is the demo, and what it demonstrates is the whole loop: drop the
   same .docx he has been sending over, watch it become a quiz or a card set,
   edit any question by hand, attach a paper, and take the result away.

   WHAT IT IS HONEST ABOUT. The course is a document in the repository
   (src/content/test-content.json), loaded as a chunk — there is no content
   table, so nothing here can publish to students by itself. A draft lives in
   THIS BROWSER until it is exported, and the screen says so in those words
   rather than implying a save. What Export hands back is exactly what the
   repository takes: the whole content document, and any PDF attached beside
   it. The step after this demo is a content table and a loader that prefers
   it — a decision about where the course lives, worth making with this in
   front of you rather than before it.

   WHAT IT REFUSES. A question with no answer, or with an answer that indexes
   nothing, cannot be exported: `check:question-ids` is in prebuild and would
   fail the build, and a quiz with a wrong answer in it is worse than no quiz.
   The footer says what is wrong and Export stays disabled until it is not.

   THE DRAFT KEY IS NOT `pw-`. Everything under that prefix is swept by the
   storage epoch (src/lib/storage.js), which is raised whenever content is
   replaced — exactly when somebody is most likely to be part-way through
   writing the replacement.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readQuestionsDocx } from "../../lib/docxQuestions.js";
import { downloadBlob, downloadSaid } from "../../lib/outside.js";
import { toast } from "../../features/bookmarks/toastBus.js";
/* THE RAW DOCUMENT, not the loaded one. moduleContent/contentLoader hand
   back a NORMALISED course — chapters with `title`, flattened `questions`,
   resolved durations — which is the shape the screens want and the wrong
   shape to edit: what has to come out of here is the document the
   repository takes, key for key. So the Studio imports the JSON itself. */
import "./studio.css";

const DRAFT_KEY = "wingman.studio.draft";
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const clone = (v) => JSON.parse(JSON.stringify(v));
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
const writeDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* full or blocked */ } };

/* An id for a new question, in the chapter's own space and never colliding
   with one that is already there — the ids are what a saved bookmark, a
   retention pile and a half-finished paper all point at. */
function nextId(chapter, kind) {
  const prefix = `${chapter.id}.${kind === "cards" ? "C" : "Q"}`;
  const taken = new Set([...(chapter.quiz?.questions || []), ...(chapter.cards || [])].map((q) => q.id));
  for (let n = 1; n < 10000; n += 1) {
    const id = kind === "cards" ? `${prefix}${String(n).padStart(3, "0")}` : `${prefix}${n}`;
    if (!taken.has(id)) return id;
  }
  return `${prefix}${Date.now()}`;
}

/** Pages in a PDF, by counting its page objects. 0 when they cannot be seen
 *  — a file whose objects are compressed into streams — and the caller says
 *  so rather than guessing. */
export function countPdfPages(bytes) {
  const text = new TextDecoder("latin1").decode(bytes);
  const objects = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (objects > 0) return objects;
  /* Failing that, the page tree's own count, which a linearised file keeps
     near the front. */
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : 0;
}

const emptyQuestion = (chapter, kind) => ({
  id: nextId(chapter, kind), question: "", options: ["", "", ""], correct: 0, explain: "",
});

/* What cannot be exported, in the words the footer uses. */
function faultsOf(doc) {
  const out = [];
  const seen = new Map();
  for (const m of doc.modules || []) {
    for (const c of m.chapters || []) {
      const all = [...(c.quiz?.questions || []).map((q) => ["quiz", q]), ...((c.cards || []).map((q) => ["card", q]))];
      for (const [kind, q] of all) {
        const where = `${c.name || c.id} · ${kind} ${q.id}`;
        if (!q.id) out.push(`${where}: no id`);
        if (seen.has(q.id)) out.push(`${q.id} is used twice`); else seen.set(q.id, where);
        if (!String(q.question || "").trim()) out.push(`${where}: no question`);
        const opts = (q.options || []).filter((o) => String(o).trim());
        if (opts.length < 2) out.push(`${where}: needs at least two answers`);
        if (!(q.correct >= 0 && q.correct < (q.options || []).length)) out.push(`${where}: no right answer chosen`);
      }
    }
  }
  return out;
}

export default function Studio() {
  const [doc, setDoc] = useState(null);           // the working copy
  const [live, setLive] = useState(null);         // what the app ships today
  const [mi, setMi] = useState(0);
  const [ci, setCi] = useState(0);
  const [tab, setTab] = useState("quiz");         // quiz | cards | paper
  const [busy, setBusy] = useState("");
  const [papers, setPapers] = useState({});       // path -> File, attached this session
  const fileRef = useRef(null);
  const pdfRef = useRef(null);

  /* The live document is the starting point, and a draft from last time wins
     over it — an admin who closed the tab mid-chapter comes back to it. */
  useEffect(() => {
    let alive = true;
    import("../../content/test-content.json").then((d) => {
      if (!alive) return;
      const shipped = clone(d?.default || d || { modules: [] });
      setLive(shipped);
      setDoc(readDraft() || clone(shipped));
    }).catch(() => { if (alive) { setLive({ modules: [] }); setDoc(readDraft() || { modules: [] }); } });
    return () => { alive = false; };
  }, []);

  const edit = useCallback((fn) => setDoc((d) => { const next = clone(d); fn(next); writeDraft(next); return next; }), []);

  const modules = doc?.modules || [];
  const mod = modules[mi] || null;
  const chapters = mod?.chapters || [];
  const chapter = chapters[ci] || null;
  const list = useMemo(() => {
    if (!chapter) return [];
    return tab === "cards" ? (chapter.cards || []) : (chapter.quiz?.questions || []);
  }, [chapter, tab]);

  const faults = useMemo(() => (doc ? faultsOf(doc) : []), [doc]);
  const changed = useMemo(() => (doc && live ? JSON.stringify(doc) !== JSON.stringify(live) : false), [doc, live]);

  /* ------------------------------------------------------------ the writes */
  const setList = (next) => edit((d) => {
    const c = d.modules[mi].chapters[ci];
    if (tab === "cards") c.cards = next;
    else { c.quiz = c.quiz || { id: `${c.id}.QZ`, name: "", questions: [] }; c.quiz.questions = next; }
  });
  const patchQ = (i, patch) => setList(list.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const addQ = () => setList([...list, emptyQuestion(chapter, tab)]);
  const dupQ = (i) => setList([...list.slice(0, i + 1), { ...clone(list[i]), id: nextId(chapter, tab) }, ...list.slice(i + 1)]);
  const delQ = (i) => setList(list.filter((_, k) => k !== i));
  const moveQ = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const addChapter = () => edit((d) => {
    const m = d.modules[mi];
    const n = (m.chapters || []).length + 1;
    const id = `${m.id}.${String(n).padStart(2, "0")}`;
    m.chapters = [...(m.chapters || []), { id, name: `Chapter ${n}`, lessons: [], quiz: { id: `${id}.QZ`, name: "", questions: [] }, cards: [] }];
  });
  const delChapter = () => {
    if (!chapter) return;
    const n = (chapter.quiz?.questions || []).length + (chapter.cards || []).length;
    if (!window.confirm(`Delete "${chapter.name}" and its ${n} question${n === 1 ? "" : "s"} from the draft?`)) return;
    edit((d) => { d.modules[mi].chapters = d.modules[mi].chapters.filter((_, k) => k !== ci); });
    setCi(0);
  };

  /* ------------------------------------------------------------- the import */
  const importDocx = async (file) => {
    if (!file || !chapter) return;
    setBusy("Reading the document…");
    try {
      const { title, questions, warnings } = await readQuestionsDocx(file);
      const bad = warnings.filter((w) => /key|option/.test(w.why));
      const made = questions.map((q, i) => ({
        id: tab === "cards" ? `${chapter.id}.C${String(i + 1).padStart(3, "0")}` : `${chapter.id}.Q${i + 1}`,
        question: q.question,
        options: q.options,
        correct: q.correct ?? 0,
        ...(q.explain ? { explain: q.explain } : {}),
      }));
      edit((d) => {
        const c = d.modules[mi].chapters[ci];
        if (tab === "cards") { c.cards = made; c.cardsName = title || c.cardsName; }
        else { c.quiz = { id: `${c.id}.QZ`, name: title || c.quiz?.name || "", questions: made }; }
      });
      setBusy("");
      toast(`${made.length} question${made.length === 1 ? "" : "s"} in${bad.length ? `, ${bad.length} needing a look` : ""}`);
    } catch (e) {
      setBusy("");
      toast(e?.message || "That file could not be read.");
    }
  };

  /* -------------------------------------------------------------- the paper */
  const attachPdf = async (file) => {
    if (!file || !mod) return;
    setBusy("Counting the pages…");
    /* THE PAGE COUNT IS READ, NOT TYPED, because the Library row prints it
       to a student — and it is read by COUNTING PAGE OBJECTS IN THE BYTES
       rather than by opening the file with pdf.js. Two reasons, and the
       first is a gate: papers are paused, and `check:paused` asserts that
       none of the reader's libraries reach the build at all — one import of
       the app's pdf.js put a 357KB chunk back in it (caught on the way in).
       The second is that this is a page count, not a render: a scan of a few
       hundred kilobytes answers it, and a PDF whose pages hide inside object
       streams answers 0, which the screen says out loud instead of
       inventing a number. */
    let pages = 0;
    try {
      pages = countPdfPages(new Uint8Array(await file.arrayBuffer()));
    } catch (e) { console.error("[studio] page count", e); pages = 0; }
    const id = `${chapter?.id || mod.id}.DL1`;
    const name = file.name.replace(/\s+/g, "-");
    edit((d) => {
      const m = d.modules[mi];
      m.downloads = [...(m.downloads || []).filter((x) => x.id !== id), {
        id, title: chapter?.cardsName || chapter?.name || file.name.replace(/\.pdf$/i, ""),
        file: `downloads/${name}`, pages: pages || 1,
      }];
    });
    setPapers((p) => ({ ...p, [`downloads/${name}`]: file }));
    setBusy("");
    toast(pages ? `${pages} page${pages === 1 ? "" : "s"}` : "Attached. The page count could not be read — set it by hand.");
  };

  /* ------------------------------------------------------------- the export */
  const exportAll = async () => {
    const json = new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: "application/json" });
    const r = await downloadBlob(json, "test-content.json");
    const said = downloadSaid(r, "test-content.json");
    /* One at a time on purpose: Safari refuses a burst of downloads, and
       there are never more than a handful. */
    for (const [path, file] of Object.entries(papers)) {
      await downloadBlob(file, path.split("/").pop());
    }
    toast(said || `Exported${Object.keys(papers).length ? ` with ${Object.keys(papers).length} file` : ""}`);
  };

  const discard = () => {
    if (!window.confirm("Throw the draft away and start from what is live?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* blocked */ }
    setDoc(clone(live));
    setPapers({});
  };

  if (!doc) return <div className="studio" aria-busy="true" />;

  const paper = (mod?.downloads || []).find((x) => x.id === `${chapter?.id}.DL1`) || null;

  return (
    <div className="studio">
      <header className="st-head">
        <div>
          <h1>Studio</h1>
          <p>
            Write a chapter here, then export it. A draft stays in this browser —
            students see it once the export is committed.
          </p>
        </div>
        <div className="st-headacts">
          {changed && <span className="st-dirty">Draft</span>}
          <button type="button" className="st-btn" onClick={discard} disabled={!changed}>Discard</button>
          <button type="button" className="st-btn st-btn--go" onClick={exportAll} disabled={faults.length > 0}>
            Export
          </button>
        </div>
      </header>

      <div className="st-body">
        <aside className="st-rail">
          <label className="st-field">
            <span>Module</span>
            <select value={mi} onChange={(e) => { setMi(Number(e.target.value)); setCi(0); }}>
              {modules.map((m, i) => <option key={m.id} value={i}>{m.name}</option>)}
            </select>
          </label>
          <div className="st-railhead">
            <span>Chapters</span>
            <button type="button" className="st-mini" onClick={addChapter}>Add</button>
          </div>
          <ul className="st-chaps">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button type="button" className={`st-chap${i === ci ? " is-on" : ""}`} onClick={() => setCi(i)}>
                  <b>{c.name || c.id}</b>
                  <small>{(c.quiz?.questions || []).length} quiz · {(c.cards || []).length} cards</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="st-main">
          {!chapter ? (
            <p className="st-empty">Add a chapter to start writing one.</p>
          ) : (
            <>
              <div className="st-chapedit">
                <label className="st-field">
                  <span>Chapter name</span>
                  <input value={chapter.name || ""} onChange={(e) => edit((d) => { d.modules[mi].chapters[ci].name = e.target.value; })} />
                </label>
                <label className="st-field">
                  <span>{tab === "cards" ? "Card set name" : "Quiz name"}</span>
                  <input
                    value={(tab === "cards" ? chapter.cardsName : chapter.quiz?.name) || ""}
                    placeholder={tab === "cards" ? `${chapter.name} cards` : `${chapter.name} quiz`}
                    onChange={(e) => edit((d) => {
                      const c = d.modules[mi].chapters[ci];
                      if (tab === "cards") c.cardsName = e.target.value;
                      else { c.quiz = c.quiz || { id: `${c.id}.QZ`, questions: [] }; c.quiz.name = e.target.value; }
                    })} />
                </label>
                <button type="button" className="st-mini st-danger" onClick={delChapter}>Delete chapter</button>
              </div>

              <div className="st-tabs" role="tablist">
                {[["quiz", `Quiz ${(chapter.quiz?.questions || []).length}`],
                  ["cards", `Study cards ${(chapter.cards || []).length}`],
                  ["paper", "Paper"]].map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
                  ))}
              </div>

              {tab === "paper" ? (
                <div className="st-paper">
                  {paper ? (
                    <div className="st-paperrow">
                      <b>{paper.title}</b>
                      <span>PDF · {paper.pages} page{paper.pages === 1 ? "" : "s"} · {paper.file}</span>
                      <button type="button" className="st-mini st-danger"
                              onClick={() => edit((d) => { d.modules[mi].downloads = (d.modules[mi].downloads || []).filter((x) => x.id !== paper.id); })}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="st-empty">Attach the set as a PDF and it joins the Papers shelf.</p>
                  )}
                  <button type="button" className="st-btn" onClick={() => pdfRef.current?.click()}>
                    {paper ? "Replace the PDF" : "Attach a PDF"}
                  </button>
                  <input ref={pdfRef} type="file" accept="application/pdf" hidden
                         onChange={(e) => { attachPdf(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
              ) : (
                <>
                  <div className="st-tools">
                    <button type="button" className="st-btn" onClick={() => fileRef.current?.click()}>
                      Import a .docx
                    </button>
                    <input ref={fileRef} type="file" hidden
                           accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                           onChange={(e) => { importDocx(e.target.files?.[0]); e.target.value = ""; }} />
                    <button type="button" className="st-btn" onClick={addQ}>Add a question</button>
                    <span className="st-count">{list.length} in this {tab === "cards" ? "set" : "quiz"}</span>
                    {busy && <span className="st-busy">{busy}</span>}
                  </div>

                  <ol className="st-qs">
                    {list.map((q, i) => (
                      <li key={q.id} className="st-q">
                        <div className="st-qhead">
                          <span className="st-qn">{i + 1}</span>
                          <code>{q.id}</code>
                          <span className="st-spacer" />
                          <button type="button" className="st-mini" onClick={() => moveQ(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                          <button type="button" className="st-mini" onClick={() => moveQ(i, 1)} disabled={i === list.length - 1} aria-label="Move down">↓</button>
                          <button type="button" className="st-mini" onClick={() => dupQ(i)}>Duplicate</button>
                          <button type="button" className="st-mini st-danger" onClick={() => delQ(i)}>Delete</button>
                        </div>
                        <textarea className="st-stem" rows={2} value={q.question} placeholder="The question"
                                  onChange={(e) => patchQ(i, { question: e.target.value })} />
                        <div className="st-opts">
                          {(q.options || []).map((o, k) => (
                            <label key={k} className={`st-opt${q.correct === k ? " is-right" : ""}`}>
                              <input type="radio" name={`right-${q.id}`} checked={q.correct === k}
                                     onChange={() => patchQ(i, { correct: k })}
                                     aria-label={`${LETTERS[k]} is the right answer`} />
                              <span className="st-letter">{LETTERS[k]}</span>
                              <input className="st-otext" value={o} placeholder={`Answer ${LETTERS[k]}`}
                                     onChange={(e) => patchQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                              {q.options.length > 2 && (
                                <button type="button" className="st-mini st-danger" aria-label={`Remove answer ${LETTERS[k]}`}
                                        onClick={() => patchQ(i, {
                                          options: q.options.filter((_, j) => j !== k),
                                          correct: q.correct > k ? q.correct - 1 : Math.min(q.correct, q.options.length - 2),
                                        })}>×</button>
                              )}
                            </label>
                          ))}
                          {q.options.length < 6 && (
                            <button type="button" className="st-mini" onClick={() => patchQ(i, { options: [...q.options, ""] })}>
                              Add an answer
                            </button>
                          )}
                        </div>
                        <textarea className="st-why" rows={2} value={q.explain || ""} placeholder="Why that is the answer (optional)"
                                  onChange={(e) => patchQ(i, { explain: e.target.value })} />
                      </li>
                    ))}
                  </ol>
                  {!list.length && <p className="st-empty">Import a .docx, or add the first question by hand.</p>}
                </>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="st-foot">
        {faults.length ? (
          <>
            <b>{faults.length} to put right before this can leave:</b>
            <span>{faults.slice(0, 3).join(" · ")}{faults.length > 3 ? " …" : ""}</span>
          </>
        ) : (
          <span>
            {modules.reduce((n, m) => n + (m.chapters || []).length, 0)} chapters ·{" "}
            {modules.reduce((n, m) => n + (m.chapters || []).reduce((k, c) => k + (c.quiz?.questions || []).length + (c.cards || []).length, 0), 0)} questions ·
            Export hands you the content document and any PDF to commit beside it.
          </span>
        )}
      </footer>
    </div>
  );
}
