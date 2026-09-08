import { useRef, useState } from "react";
import { FilePlus2, X } from "lucide-react";
import { ingest } from "../../lib/paperIngest.js";
import { uploadPaper, paperId, SETUP_COMMAND } from "../../lib/papers.js";
import { chaptersFor } from "./moduleContent.js";

/* =============================================================================
   ADDING A PAPER.

   The whole of §4.7's pipeline that can run without a server runs here, on the
   uploader's own machine, while they watch: the manifest, the text layer and
   the thumbnails are all produced from the file before a byte of it is sent.
   That is what lets the reader lay out a thousand pages before it has any of
   the PDF.

   It is deliberately honest about the two things it cannot do:

     · It cannot linearize. That needs qpdf and there is nowhere to run it —
       `npm run paper:linearize` does it locally, and the paper records which
       state it is in either way.
     · It cannot create the storage bucket. This build does not touch
       production, so the first upload will say exactly which one command to
       run and stop. It is a setup state, not an error.
   ========================================================================= */
export default function AddPaper({ moduleCode, content, me, onAdded, onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [step, setStep] = useState(null);
  const [done, setDone] = useState(0);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState(null);

  const chapters = chaptersFor(moduleCode, content) || [];
  const busy = step !== null;

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim());
    setError(null);
    setSetup(false);
  };

  const go = async () => {
    if (!file || !title.trim()) return;
    setError(null); setSetup(false); setDone(0);
    try {
      setStep("Reading the paper");
      const ingested = await ingest(file, (n, total, what) => {
        setStep(`Building the ${what}`);
        setDone(total ? Math.round((n / total) * 100) : 0);
      });
      setStep("Uploading");
      const id = paperId(moduleCode, title.trim());
      const res = await uploadPaper({
        id, moduleCode, chapterId: chapter || null, title: title.trim(),
        file, ingested, uploadedBy: me, onStep: setStep,
      });
      if (!res.ok) {
        setStep(null);
        if (res.setup) setSetup(true);
        else setError(res.error?.message || "That did not upload. Nothing was changed.");
        return;
      }
      setStep(null);
      onAdded?.(res.paper);
    } catch (e) {
      console.error(e);
      setStep(null);
      setError(`That file would not open as a PDF. ${e?.message || ""}`.trim());
    }
  };

  return (
    <div className="addpaper" role="dialog" aria-label="Add a paper">
      <header className="addpaper-top">
        <h3>Add a paper</h3>
        <button type="button" className="q-btn" onClick={onClose} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden
             onChange={(e) => pick(e.target.files?.[0])} />

      <button type="button" className="addpaper-drop" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
        <FilePlus2 size={20} aria-hidden="true" />
        <span>{file ? file.name : "Choose a PDF, or drop one here"}</span>
        {file && <em>{(file.size / 1e6).toFixed(1)} MB</em>}
      </button>

      <label className="addpaper-f">
        <span>What it is called</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="Rotary Wing Aerodynamics" />
      </label>

      {chapters.length > 0 && (
        <label className="addpaper-f">
          <span>Which chapter it belongs to</span>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">The whole module</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}

      {busy && (
        <div className="addpaper-work" role="status">
          <p>{step}…</p>
          <span className="addpaper-bar"><i style={{ width: `${done}%` }} /></span>
          <p className="addpaper-note">
            The manifest, the text and the thumbnails are built here, from your
            copy, before anything is sent. A long manual takes a minute.
          </p>
        </div>
      )}

      {/* A SETUP STATE, NOT AN ERROR STATE. They read differently and they need
          different words: one says "run this", the other says "something went
          wrong". This build does not touch production, so the table and the
          bucket are one command away. */}
      {setup && (
        <div className="addpaper-setup" role="status">
          <p><b>One command first.</b> The papers table and its storage bucket
            have not been created on this project yet — this build deliberately
            does not change your database.</p>
          <code>{SETUP_COMMAND}</code>
          <p className="addpaper-note">Run it once, then add the paper again. Nothing was uploaded.</p>
        </div>
      )}

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
