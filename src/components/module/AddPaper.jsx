import { useRef, useState } from "react";
import { FilePlus2, X, Check } from "lucide-react";
import { open as openPdf } from "../../lib/paperIngest.js";
import {
  uploadPaper, uploadSidecars, paperId, SETUP_COMMAND, SCOPES,
} from "../../lib/papers.js";
import { chaptersFor } from "./moduleContent.js";

/* =============================================================================
   ADDING A PAPER.

   Open to everybody. What differs is who else can see it — your own copy, your
   formation, or the whole module, and the last of those is instructors only,
   because putting a document in front of a cohort is a publishing act and one
   mislabelled or copyrighted file reaches everyone at once. The gate is in SQL
   (`add_paper`, migration 0019), not here; this only asks the question.

   -----------------------------------------------------------------------------
   WHY THE ORDER IS WHAT IT IS

   The first version built everything — manifest, text layer, thumbnails — and
   then uploaded, which meant several minutes of work before the file had moved
   a byte, and any failure threw all of it away. Worse, it caught every error
   and reported it as "that file would not open as a PDF", so a storage bug
   arrived wearing a parser's clothes. On a real 44MB manual it did exactly
   that, and the actual fault was that this app's Supabase client has no
   `.storage` at all.

   Now: open the file and take the manifest (seconds), reserve the row so the
   Library says "Preparing…" immediately, send the file with a real progress
   bar, and build the slow sidecars afterwards. Every failure says which step
   failed and what it was.
   ========================================================================= */
export default function AddPaper({ moduleCode, content, me, isStaff, onAdded, onClose }) {
  const fileRef = useRef(null);
  const abort = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [scope, setScope] = useState("solo");
  const [step, setStep] = useState(null);
  const [pct, setPct] = useState(0);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const chapters = chaptersFor(moduleCode, content) || [];
  const busy = step !== null;
  const scopes = SCOPES.filter((s) => !s.staffOnly || isStaff);

  const pick = (f) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError("That is not a PDF. The reader can only open PDFs today.");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim());
    setError(null); setSetup(false); setNote(null);
  };

  const go = async () => {
    if (!file || !title.trim()) return;
    setError(null); setSetup(false); setNote(null); setPct(0);
    abort.current = new AbortController();
    let handle = null;

    try {
      /* Step 1 — open it. A failure HERE really is the file. */
      setStep("Opening the paper");
      try {
        handle = await openPdf(file, () => {});
      } catch (e) {
        setStep(null);
        setError(`That file would not open as a PDF. ${e?.message || ""}`.trim());
        return;
      }

      const id = paperId(moduleCode, title.trim());

      /* Step 2 and 3 — reserve the row, then send the file. */
      const up = await uploadPaper({
        id, moduleCode, chapterId: chapter, title: title.trim(), file,
        manifest: handle.manifest, visibility: scope, me,
        onStep: setStep,
        onProgress: (loaded, total) => setPct(Math.round((loaded / total) * 100)),
        signal: abort.current.signal,
      });
      if (!up.ok) {
        setStep(null);
        if (up.aborted) return;
        if (up.setup) setSetup(true);
        else setError(up.error?.message || "That did not upload. Nothing was changed.");
        return;
      }
      /* §0019 — the server decides the scope. If it gave you less than you
         asked for, say so rather than letting you believe otherwise. */
      if (up.downgraded) {
        setNote("Module-wide papers are added by instructors, so this one went to your formation instead.");
      }

      /* Step 4 — the slow half, now that the paper itself is safe. */
      setStep("Reading the text layer");
      setPct(0);
      const rest = await handle.rest((n, total, what) => {
        setStep(what === "thumbnails" ? "Making thumbnails" : "Reading the text layer");
        setPct(total ? Math.round((n / total) * 100) : 0);
      });

      const side = await uploadSidecars({
        id, me, text: rest.text, thumbs: rest.thumbs,
        onStep: setStep,
        onProgress: (n, total) => setPct(Math.round((n / total) * 100)),
        signal: abort.current.signal,
      });
      setStep(null);
      if (!side.ok) {
        /* The paper IS there and readable — only search and the page rail are
           missing. Say exactly that instead of calling the whole thing a
           failure. */
        setError(`The paper is uploaded and will open, but its text layer did not store, so search will not work on it yet. ${side.error?.message || ""}`.trim());
        return;
      }

      onAdded?.({
        id, module_code: moduleCode, chapter_id: chapter || null, title: title.trim(),
        pages: handle.manifest.pages, status: "ready", visibility: up.visibility,
        has_text: rest.hasText, linearized: handle.manifest.linearized, mine: true,
      });
    } finally {
      handle?.close();
      abort.current = null;
    }
  };

  return (
    <div className="addpaper" role="dialog" aria-label="Add a paper">
      <header className="addpaper-top">
        <h3>Add a paper</h3>
        <button type="button" className="q-btn" onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden
             onChange={(e) => pick(e.target.files?.[0])} />

      <button type="button" className="addpaper-drop" onClick={() => fileRef.current?.click()}
              disabled={busy}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
        <FilePlus2 size={20} aria-hidden="true" />
        <span>{file ? file.name : "Choose a PDF, or drop one here"}</span>
        {file && <em>{(file.size / 1e6).toFixed(1)} MB</em>}
      </button>

      <label className="addpaper-f">
        <span>What it is called</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy}
               placeholder="Rotary Wing Aerodynamics" />
      </label>

      {chapters.length > 0 && (
        <label className="addpaper-f">
          <span>Which chapter it belongs to</span>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={busy}>
            <option value="">The whole module</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}

      {/* WHO ELSE SEES IT. Three choices, and the third is absent rather than
          disabled for a student — an option you can see and cannot use is a
          worse answer than one that was never offered. */}
      <fieldset className="addpaper-scope" disabled={busy}>
        <legend>Who else can see it</legend>
        {scopes.map((s) => (
          <label key={s.id} className="scope-row" data-on={scope === s.id ? "" : undefined}>
            <input type="radio" name="scope" value={s.id}
                   checked={scope === s.id} onChange={() => setScope(s.id)} />
            <span className="scope-tick" aria-hidden="true">
              {scope === s.id && <Check size={13} />}
            </span>
            <span className="scope-name">
              <b>{s.label}</b>
              <em>{s.note}</em>
            </span>
          </label>
        ))}
        {!isStaff && (
          <p className="addpaper-note">
            Instructors add papers for the whole module. Yours is yours, or your formation&rsquo;s.
          </p>
        )}
      </fieldset>

      {busy && (
        <div className="addpaper-work" role="status">
          <p>{step}…</p>
          <span className="addpaper-bar"><i style={{ width: `${pct}%` }} /></span>
          <p className="addpaper-note">
            The file goes up first, then its text layer and thumbnails are built
            from your copy. A long manual takes a few minutes and you can leave
            this open.
          </p>
          <button type="button" className="q-btn" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        </div>
      )}

      {setup && (
        <div className="addpaper-setup" role="status">
          <p><b>One command first.</b> The papers table and its storage bucket
            are not on this project yet.</p>
          <code>{SETUP_COMMAND}</code>
          <p className="addpaper-note">Run it once, then add the paper again. Nothing was uploaded.</p>
        </div>
      )}

      {note && <p className="addpaper-note addpaper-said">{note}</p>}
      {error && <p className="addpaper-err">{error}</p>}

      <div className="addpaper-foot">
        <button type="button" className="q-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="q-btn" data-primary="" disabled={busy || !file || !title.trim()}
                onClick={go}>
          {busy ? "Working…" : "Add it"}
        </button>
      </div>
    </div>
  );
}
