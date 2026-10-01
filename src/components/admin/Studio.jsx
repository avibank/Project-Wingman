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
import { publishCourse, fetchCourseVersions } from "../../lib/courseStore.js";
import { useUser } from "../../lib/clerk.js";
import { downloadBlob, downloadSaid } from "../../lib/outside.js";
import { toast } from "../../features/bookmarks/toastBus.js";
/* THE RAW DOCUMENT, not the loaded one. moduleContent/contentLoader hand
   back a NORMALISED course — chapters with `title`, flattened `questions`,
   resolved durations — which is the shape the screens want and the wrong
   shape to edit: what has to come out of here is the document the
   repository takes, key for key. So the Studio imports the JSON itself. */
import {
  clone, nextId, emptyQuestion, copiedInto,
  askedFor, shownList, faultList, countPdfPages,
} from "./studioModel.js";
import "./studio.css";

export { countPdfPages };

const DRAFT_KEY = "wingman.studio.draft";
/* The publishing key lives in the admin's own browser and nowhere else — not
   in the repository, not in a build, not in this file. 0040 compares it as a
   digest and never returns it. */
const PUBKEY_KEY = "wingman.studio.key";
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
const writeDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* full or blocked */ } };

/* HOW MANY QUESTION EDITORS ARE MOUNTED AT ONCE. A chapter of 345 is 345
   stems, 1035 answer fields and 345 reasons if the list is drawn whole —
   about 1700 inputs, and typing in any one of them re-renders the lot.
   Forty at a time, and more on asking. Search is the other way through. */
const PAGE = 40;

export default function Studio() {
  const [doc, setDoc] = useState(null);           // the working copy
  const [live, setLive] = useState(null);         // what the app ships today
  const [mi, setMi] = useState(0);
  const [ci, setCi] = useState(0);
  const [tab, setTab] = useState("quiz");         // quiz | cards | paper
  const [busy, setBusy] = useState("");
  const [papers, setPapers] = useState({});       // path -> File, attached this session
  const [versions, setVersions] = useState([]);   // what has been published
  const [pubKey, setPubKey] = useState(() => { try { return localStorage.getItem(PUBKEY_KEY) || ""; } catch { return ""; } });
  const [asking, setAsking] = useState(false);    // the key field is open
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");         // the search box
  const [shown, setShown] = useState(PAGE);       // how many editors are mounted
  const [picked, setPicked] = useState(() => new Set());  // chosen questions, BY ID
  const { user } = useUser();
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

  const loadVersions = useCallback(() => { fetchCourseVersions(8).then(setVersions).catch(() => setVersions([])); }, []);
  useEffect(() => { loadVersions(); }, [loadVersions]);

  /* PUBLISHING IS THE POINT OF THE TABLE. Export stays beside it: a document
     on disk is how the course is committed, and the two are not rivals —
     publish puts it in front of the class tonight, the commit is what the
     next build ships with. */
  /* A PAPER THAT IS NOT ON THE SERVER YET IS A 404 IN FRONT OF A CLASS.
     Publishing can put a `downloads/…` row in the Library tonight, but the
     FILE only arrives with the next commit — so every path is asked for
     before the document goes, and one that is not there stops the publish
     with its own name. Attaching a PDF in this session is exactly when this
     happens, which is why the message says what to do about it. */
  const missingPapers = async () => {
    const paths = (doc.modules || []).flatMap((m) => (m.downloads || []).map((d) => d.file)).filter(Boolean);
    const gone = [];
    for (const path of paths) {
      try {
        /* NOT `r.ok`, AND NOT A HEAD. This app is a single page: the dev
           server and Vercel both answer a path they do not have with
           index.html and a 200, so "did it 404" cannot tell a missing paper
           from a missing route — it said every file was there (measured on
           the way in). The first five bytes can: a PDF starts `%PDF-`. */
        const r = await fetch(`/${path}`, { headers: { Range: "bytes=0-4" }, cache: "no-store" });
        const head = r.ok ? (await r.text()).slice(0, 5) : "";
        if (head !== "%PDF-") gone.push(path);
      } catch { gone.push(path); }
    }
    return gone;
  };

  const publish = async () => {
    if (!pubKey.trim()) { setAsking(true); return; }
    setBusy("Checking the papers…");
    const gone = await missingPapers();
    if (gone.length) {
      setBusy("");
      toast(`${gone[0].split("/").pop()} is not on the server yet — export it and commit it first, then publish.`);
      return;
    }
    setBusy("Publishing…");
    const r = await publishCourse(doc, pubKey.trim(), {
      note: note.trim() || null,
      by: user?.username || user?.id || null,
    });
    setBusy("");
    if (!r.ok) { toast(r.error || "That did not publish."); return; }
    try { localStorage.setItem(PUBKEY_KEY, pubKey.trim()); } catch { /* blocked */ }
    setAsking(false);
    setNote("");
    setLive(clone(doc));           // the draft and the published course now agree
    loadVersions();
    toast(`Published as version ${r.id}. Everybody sees it on their next load.`);
  };

  const modules = doc?.modules || [];
  const mod = modules[mi] || null;
  const chapters = mod?.chapters || [];
  const chapter = chapters[ci] || null;
  const list = useMemo(() => {
    if (!chapter) return [];
    return tab === "cards" ? (chapter.cards || []) : (chapter.quiz?.questions || []);
  }, [chapter, tab]);
  /* Pairs of [question, its real index]. Not the index on screen: a filtered
     list that renumbered would delete the wrong question (studioModel.js). */
  const hits = useMemo(() => shownList(list, query), [list, query]);
  const view = useMemo(() => hits.slice(0, shown), [hits, shown]);
  /* CHOSEN BY ID RATHER THAN BY POSITION, because what the choosing is FOR is
     moving and deleting, and both change every position after them. */
  const chosen = useMemo(() => list.filter((q) => picked.has(q.id)), [list, picked]);

  /* A new chapter, a new tab or a new search is a new list, so the window
     closes back to its first page and nothing stays chosen across it —
     "delete the 8 I picked" must never mean 8 in a list you cannot see. */
  useEffect(() => { setShown(PAGE); setPicked(new Set()); }, [mi, ci, tab]);
  useEffect(() => { setShown(PAGE); }, [query]);

  const faults = useMemo(() => (doc ? faultList(doc) : []), [doc]);
  /* The ids of broken questions, so a row can be marked where it stands. */
  const broken = useMemo(() => new Set(faults.map((f) => f.id).filter(Boolean)), [faults]);
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

  /* ------------------------------------------------------- the chosen ones */
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickAllShown = () => setPicked(new Set(hits.map(([q]) => q.id)));
  const pickNone = () => setPicked(new Set());
  const delPicked = () => {
    if (!chosen.length) return;
    if (!window.confirm(`Delete ${chosen.length} question${chosen.length === 1 ? "" : "s"} from the draft?`)) return;
    setList(list.filter((q) => !picked.has(q.id)));
    pickNone();
  };
  /* COPY OR MOVE TO THE OTHER EXERCISE. The ids are re-issued in the
     destination's space by `copiedInto`; a move deletes the originals in the
     same edit, so the document is never briefly holding both. */
  const sendPicked = (move) => {
    if (!chosen.length) return;
    const other = tab === "cards" ? "quiz" : "cards";
    const n = chosen.length;
    edit((d) => {
      const c = d.modules[mi].chapters[ci];
      const made = copiedInto(c, other, chosen);
      if (other === "cards") c.cards = [...(c.cards || []), ...made];
      else { c.quiz = c.quiz || { id: `${c.id}.QZ`, name: "", questions: [] }; c.quiz.questions = [...c.quiz.questions, ...made]; }
      if (move) {
        if (tab === "cards") c.cards = (c.cards || []).filter((q) => !picked.has(q.id));
        else c.quiz.questions = c.quiz.questions.filter((q) => !picked.has(q.id));
      }
    });
    pickNone();
    toast(`${n} ${move ? "moved" : "copied"} to ${other === "cards" ? "the study cards" : "the quiz"}`);
  };

  /* The way to a broken question from the footer that named it: its chapter,
     its tab, its position — and the search box set to that position, which is
     what puts it inside the window. */
  const goToFault = (f) => { setMi(f.mi); setCi(f.ci); setTab(f.kind); setQuery(`#${f.i + 1}`); };

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
            Write a chapter here, then publish it. A draft stays in this browser
            until you do; publishing puts it in front of the class on their next
            load. Export hands you the same document to commit.
          </p>
          <p className="st-live">
            {versions.length
              ? `Live: version ${versions[0].id}, published ${new Date(versions[0].published_at).toLocaleString()}${versions[0].published_by ? ` by ${versions[0].published_by}` : ""}${versions[0].note ? ` — ${versions[0].note}` : ""}`
              : "Nothing published yet — students are reading the document this build shipped with."}
          </p>
          {asking && (
            <div className="st-ask">
              <label className="st-field">
                <span>Publishing key</span>
                <input type="password" autoComplete="off" value={pubKey} placeholder="The key you were given"
                       onChange={(e) => setPubKey(e.target.value)} />
              </label>
              <label className="st-field">
                <span>What changed (optional)</span>
                <input value={note} placeholder="e.g. Pitot-Static, two stems reworded"
                       onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="button" className="st-btn st-btn--go" onClick={publish} disabled={!pubKey.trim()}>
                Publish it
              </button>
              <button type="button" className="st-btn" onClick={() => setAsking(false)}>Not now</button>
            </div>
          )}
        </div>
        <div className="st-headacts">
          {changed && <span className="st-dirty">Draft</span>}
          <button type="button" className="st-btn" onClick={discard} disabled={!changed}>Discard</button>
          <button type="button" className="st-btn" onClick={exportAll} disabled={faults.length > 0}>Export</button>
          <button type="button" className="st-btn st-btn--go" onClick={publish} disabled={faults.length > 0 || !!busy}>
            Publish
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
                    <label className="st-search">
                      <span className="st-sr">Find a question</span>
                      <input value={query} placeholder="Find a word, or a number for its place"
                             onChange={(e) => setQuery(e.target.value)} />
                      {query && <button type="button" className="st-mini" onClick={() => setQuery("")}>Clear</button>}
                    </label>
                    <span className="st-count">
                      {query
                        ? `${hits.length} of ${list.length}${askedFor(query).kind === "at" ? "" : " match"}`
                        : `${list.length} in this ${tab === "cards" ? "set" : "quiz"}`}
                    </span>
                    {busy && <span className="st-busy">{busy}</span>}
                  </div>

                  {/* CHOOSING SEVERAL AND DOING ONE THING TO THEM is the half of
                      this screen that makes a 345-question chapter editable: the
                      quiz is drawn from the set, so "these forty are also the
                      quiz" is the commonest edit there is. */}
                  <div className="st-bulk">
                    <button type="button" className="st-mini" onClick={pickAllShown} disabled={!hits.length}>
                      {query ? `Choose these ${hits.length}` : `Choose all ${list.length}`}
                    </button>
                    {chosen.length > 0 && (
                      <>
                        <span className="st-chosen">{chosen.length} chosen</span>
                        <button type="button" className="st-mini" onClick={() => sendPicked(false)}>
                          Copy to {tab === "cards" ? "the quiz" : "the study cards"}
                        </button>
                        <button type="button" className="st-mini" onClick={() => sendPicked(true)}>
                          Move there
                        </button>
                        <button type="button" className="st-mini st-danger" onClick={delPicked}>Delete them</button>
                        <button type="button" className="st-mini" onClick={pickNone}>Let them go</button>
                      </>
                    )}
                  </div>

                  <ol className="st-qs">
                    {view.map(([q, i]) => (
                      <li key={q.id} className={`st-q${broken.has(q.id) ? " is-broken" : ""}${picked.has(q.id) ? " is-chosen" : ""}`}>
                        <div className="st-qhead">
                          <label className="st-pick">
                            <input type="checkbox" checked={picked.has(q.id)} onChange={() => toggle(q.id)}
                                   aria-label={`Choose question ${i + 1}`} />
                          </label>
                          <span className="st-qn">{i + 1}</span>
                          <code>{q.id}</code>
                          {broken.has(q.id) && <span className="st-warn">needs a look</span>}
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
                  {hits.length > view.length && (
                    <button type="button" className="st-btn st-more" onClick={() => setShown((n) => n + PAGE)}>
                      Show {Math.min(PAGE, hits.length - view.length)} more of {hits.length - view.length}
                    </button>
                  )}
                  {!list.length && <p className="st-empty">Import a .docx, or add the first question by hand.</p>}
                  {!!list.length && !hits.length && (
                    <p className="st-empty">Nothing here says that — clear the search to see all {list.length}.</p>
                  )}
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
            {/* EACH ONE IS THE WAY TO ITSELF. The sentences alone told the
                owner a question three hundred rows down was broken and left
                him to find it. */}
            {faults.slice(0, 3).map((f, k) => (
              <button key={`${f.where}-${f.why}-${k}`} type="button" className="st-mini" onClick={() => goToFault(f)}>
                {f.where}: {f.why}
              </button>
            ))}
            {faults.length > 3 && <span>and {faults.length - 3} more</span>}
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
