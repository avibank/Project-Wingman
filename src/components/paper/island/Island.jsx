/* =============================================================================
   THE ISLAND — and it is the whole of the chrome.
   -----------------------------------------------------------------------------
   The owner's instruction, in full: "use the dynamic island kinda — have the
   island show the pages, your profile, the bookmark icon on the left opposite
   of the profile, and tapping it on a page gives out the message. So again,
   all our controls are the island — just adjust for the new use."

   Taken literally. There is no tool bar, no scrubber, no side panel, no
   floating buttons. A page, and one pill above it.

       [ bookmark ]  ←spacer→  [ 0126/1012 ]  ←spacer→  [ you ]

   THREE THINGS CAME ACROSS FROM THE PAUSED READER because they were already
   built and already right, and each is why it is here:

   · `pad()` — the counter is zero-padded to the width of the paper's OWN
     length. `01/14` on a fourteen-page paper, `0126/1012` on a thousand-page
     one. A fixed minimum of four was tried and rejected: it made a short
     handout look like a manual.
   · THE MESSAGE TAKES OVER THE WHOLE PILL as one centred row, rather than
     expanding around the counter. That is a locked decision and `data-msg="1"`
     is how it is done — the face fades up and out, the message fades in.
   · A FIT IS A RELATIONSHIP TO THE ROOM, so it is recomputed on resize rather
     than remembered as a number.

   AND WHAT DID NOT, because there is nothing here to mark: the class-marks
   dot, `waiting()`/`arrived()`, the outbox's `undone()`/`saved()`/`offline()`,
   `window.islandSay` and every mark-colour message, the rail, the chest, the
   props popovers and the marks panel.

   THE ONLY REASON A MESSAGE FIRES is to confirm something the student just
   did. That is what is left of a system that used to announce arrivals and
   failures, and it is deliberate: a pill that speaks when you did nothing is
   a pill you learn to ignore.

   TWO THINGS NEEDED A HOME and neither was named in the instruction:
   · DOWNLOAD goes in the page tray, beside fit and rotate — it is a
     document-level action of the same family, and the tray is one press on
     the counter.
   · BACK TO THE LIBRARY goes in the You panel, as its first row. A student
     must always be one press from out, and the reader's old back arrow only
     appeared while the island was open and pointed back at the paper, which
     is not the same journey.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";

/* Zero-padded to the width of the paper's own length. */
export const pad = (n, total) =>
  String(Math.max(1, n | 0)).padStart(String(Math.max(1, total | 0)).length, "0");

/* One digit, in its own box, so it can roll when it changes. */
function Digit({ ch, roll }) {
  return (
    <span className={`d${roll ? " roll" : ""}`}><i>{ch}</i></span>
  );
}

function Counter({ page, total, onOpen }) {
  const now = pad(page, total);
  const prev = useRef(now);
  const rolled = prev.current !== now;
  useEffect(() => { prev.current = now; }, [now]);
  return (
    <div className="cnt" role="button" tabIndex={0} aria-label={`Page ${page} of ${total}. Open the page controls`}
         onClick={onOpen}
         onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <span className="now">
        {now.split("").map((c, i) => <Digit key={`${i}-${c}`} ch={c} roll={rolled} />)}
      </span>
      <span className="sl">/</span>
      <span className="tot">{Math.max(1, total | 0)}</span>
    </div>
  );
}

const Bookmark = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} aria-hidden="true">
    <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export default function Island({
  page = 1, total = 1, saved = false, initials = "YOU",
  zoom = 100, fit = true, warm = 0, look = "dark",
  onBookmark, onZoom, onFit, onRotate, onDownload, onWarm, onLook, onBack,
}) {
  const [open, setOpen] = useState(null);          // null | "page" | "me"
  const [msg, setMsg] = useState(null);
  const timer = useRef(0);

  /* The message takes the pill over, then gives it back. One timer, cleared on
     every new message, so two presses in a second do not leave the first one's
     timeout to close the second one's message. */
  const flash = useCallback((text, ms = 1500) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  /* Escape closes whatever is open — the tray first, then nothing. */
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const tapBookmark = () => {
    const nowSaved = !saved;
    onBookmark?.(nowSaved);
    /* THE WHOLE ACKNOWLEDGEMENT. Saving is optimistic and instant, so the
       message is the only thing that tells the student it happened. */
    flash(nowSaved ? `Page ${page} saved` : `Page ${page} removed`);
  };

  const download = async () => {
    setOpen(null);
    flash("Getting it…", 4000);
    const said = await onDownload?.();
    flash(said || "Saved");
  };

  return (
    <div className="isl" id="isl" data-msg={msg ? "1" : "0"} data-open={open || undefined}
         style={{ width: open ? "min(300px, calc(100vw - 32px))" : undefined,
                  height: open ? "auto" : undefined,
                  borderRadius: open ? "18px" : undefined }}>
      <div className="head">
        <div className="base" id="base">
          {/* FAR LEFT, opposite the profile. It reads THIS page: scrolling from
              a saved page to an unsaved one has to unfill it, which is why it
              is driven by `saved` rather than by what was last pressed. */}
          <button className="bmkface" type="button" aria-pressed={saved}
                  aria-label={saved ? `Page ${page} is saved` : `Save page ${page}`}
                  onClick={tapBookmark}>
            <Bookmark on={saved} />
          </button>
          <span className="spacer" />
          <Counter page={page} total={total} onOpen={() => setOpen((o) => (o === "page" ? null : "page"))} />
          <span className="spacer" />
          <button className="you" type="button" aria-label="You"
                  onClick={() => setOpen((o) => (o === "me" ? null : "me"))}>
            {initials}
          </button>
        </div>
        <div className="msg" aria-live="polite">{msg}</div>
      </div>

      <div className="tray">
        {open === "page" && (
          <>
            <div className="lab">Page<span className="v">{fit ? "Fit" : `${zoom}%`}</span></div>
            <div className="ctrl">
              <button type="button" aria-label="Zoom out" onClick={() => onZoom?.(-10)}>&minus;</button>
              <span className="rd">{fit ? "Fit" : `${zoom}%`}</span>
              <button type="button" aria-label="Zoom in" onClick={() => onZoom?.(10)}>+</button>
              <span className="gap" />
              <button type="button" className={`wide${fit ? " on" : ""}`} onClick={() => onFit?.()}>Fit</button>
              <button type="button" aria-label="Rotate" onClick={() => onRotate?.(1)}>⟳</button>
            </div>
            <div className="lab">This paper</div>
            <div className="ctrl">
              {/* DOWNLOAD LIVES HERE, beside fit and rotate: a document-level
                  action in the same family, one press from the counter. */}
              <button type="button" className="wide" onClick={download}>Download</button>
              <span className="rd" aria-hidden="true" />
            </div>
          </>
        )}

        {open === "me" && (
          <div className="youpanel">
            {/* FIRST ROW, ALWAYS. A student must be one press from out. */}
            <button type="button" className="yrow" onClick={() => { setOpen(null); onBack?.(); }}>
              <span className="yr-ic">←</span> Back to the Library
            </button>
            <div className="lab">Light</div>
            <div className="ctrl">
              <button type="button" className={`wide${look === "dark" ? " on" : ""}`}
                      onClick={() => onLook?.("dark")}>Dark</button>
              <button type="button" className={`wide${look === "light" ? " on" : ""}`}
                      onClick={() => onLook?.("light")}>Light</button>
            </div>
            <div className="lab">Warmth<span className="v">{Math.round(warm * 100)}%</span></div>
            <div className="ctrl">
              <input type="range" min="0" max="1" step="0.05" value={warm} aria-label="Warmth"
                     className="is-inline"
                     onChange={(e) => onWarm?.(Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
