import { useEffect, useRef, useState } from "react";
import { PhotoIcon, FileIcon, PassageIcon, BackIcon } from "./chatIcons.jsx";

/* =============================================================================
   The attach sheet — slides up over the composer.
   -----------------------------------------------------------------------------
   Two screens: the three kinds, and behind "Paper passage" the student's own
   marks in this squadron's module. The marks are asked for when that screen
   opens, not when the chat mounts, because most messages are not quotes and a
   query per chat open would be spent on the few that are.

   Class names are `att-` prefixed where the design used bare ones. `.sheet` is
   already the room's squadron-details sheet and `.chip` the feed's sort chips,
   and under `.room .pane` the design's rules would have outranked both.
   ========================================================================= */
export default function AttachmentSheet({
  open = false, onClose = () => {}, onPickFiles = () => {}, onPickPassage = () => {},
  onWantMarks = () => {}, marks = [], marksLoading = false,
}) {
  const [screen, setScreen] = useState("options");
  const sheetRef = useRef(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { if (!open) setScreen("options"); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    /* pointerdown, not mousedown, so a tap outside closes it on a tablet too.
       The attach button is excluded: it toggles the sheet itself, and closing
       here first would reopen it on the same press. */
    const onDown = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target) && !e.target.closest(".attach")) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const take = (kind) => (e) => {
    const files = e.target.files;
    if (files?.length) onPickFiles(files, kind);
    e.target.value = "";
    onClose();
  };

  return (
    <div className="att-sheet" ref={sheetRef} role="dialog" aria-label="Add an attachment">
      <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={take("image")} />
      <input ref={fileRef} type="file" multiple hidden onChange={take("file")}
             accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv,image/*" />

      {screen === "options" ? (
        <div className="sheet-opts">
          <button className="opt" type="button" onClick={() => photoRef.current?.click()}>
            <span className="oi"><PhotoIcon /></span>
            <span>Photo</span>
          </button>
          <button className="opt" type="button" onClick={() => fileRef.current?.click()}>
            <span className="oi"><FileIcon /></span>
            <span>File</span>
          </button>
          <button className="opt violet" type="button"
                  onClick={() => { setScreen("passages"); onWantMarks(); }}>
            <span className="oi"><PassageIcon /></span>
            <span>Paper passage</span>
          </button>
        </div>
      ) : (
        <>
          <div className="sheet-head">
            <button className="icon-btn back is-inline" type="button"
                    onClick={() => setScreen("options")} aria-label="Back">
              <BackIcon />
            </button>
            <h3>Your marks in this module</h3>
          </div>
          <div className="papers">
            {marksLoading && <p className="papers-empty">Loading your marks…</p>}
            {/* An empty state names the next action rather than the absence. */}
            {!marksLoading && marks.length === 0 && (
              <p className="papers-empty">Highlight a passage in a paper and it turns up here.</p>
            )}
            {marks.map((m) => (
              <button key={m.id} className="paper" type="button"
                      onClick={() => { onPickPassage(m); onClose(); }}>
                <span className="pt">
                  <span className={`dot ${m.tone || "v"}`} />
                  {m.paperTitle}{m.page ? ` · p.${String(m.page).padStart(2, "0")}` : ""}
                </span>
                <span className="pq">{m.quote}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
