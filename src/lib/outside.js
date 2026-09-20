/* =============================================================================
   THE THINGS THAT LEAVE THE APP — sharing a link, and saving a file.
   -----------------------------------------------------------------------------
   Half this class is on an iPhone, and both of these were broken there in ways
   that report success. That is the part that matters: a share that fails
   loudly is a bug, and a share that says "Link copied" over an empty clipboard
   is a student pasting nothing into a group chat and wondering why nobody
   answered.

   ---------------------------------------------------------------- share()

   WHAT WAS THERE, in four places:

       navigator.clipboard?.writeText(url).then(() => say("Link copied"))

   `navigator.clipboard` is UNDEFINED on iOS Safari outside a secure context,
   in the in-app browsers this class will actually paste from (Instagram,
   Snapchat), and on older Android WebViews. The optional chain then makes the
   whole expression `undefined`, `.then` throws a TypeError nothing catches,
   and the toast never fires at all — so the control reads as dead. Where it
   did fire, it claimed a copy that had not happened.

   THREE STEPS DOWN, AND NEVER A CLAIM THAT WAS NOT OBSERVED:

     1. `navigator.share` — the right behaviour on a phone, and what a student
        expects: their own share sheet, with the apps they actually use in it.
     2. the clipboard, AWAITED, with the message fired only after it resolves.
     3. a sheet with the link in a selected, read-only field and a Copy button
        — the one that cannot fail, because the link is at least obtainable by
        hand. The caller supplies it; this file decides when it is needed.

   A CANCELLED SHARE IS NOT A FAILURE. `navigator.share` rejects with
   AbortError when somebody dismisses the sheet, and falling through to the
   clipboard there would copy a link they had just decided not to send.

   -------------------------------------------------------- downloadBlob()

   TWO PATTERNS FOR ONE JOB, ONE OF THEM BROKEN. `LogTab` revoked the object
   URL on the line after `a.click()`, and Safari and iOS frequently cancel the
   download because the URL is gone before the fetch has begun. The reader's
   marks export got it right with a timeout. Now there is one.

   · The anchor is appended to the document before it is clicked, because some
     browsers ignore a detached one.
   · The URL is revoked after a delay, never on the next line.
   · ON iOS an `<a download>` on a blob may simply navigate, so where the
     platform can share files, the share sheet is offered first — that is how
     a file reaches the Files app on an iPhone.
   · And if neither works, the URL opens and the caller is told to say so in
     words. Never a silent failure.
   ========================================================================= */

/** Did we actually observe it? Every return says so, and nothing guesses. */
export const SHARED = "shared";      // the platform sheet took it
export const COPIED = "copied";      // the clipboard confirmed it
export const CANCELLED = "cancelled"; // they dismissed the sheet
export const MANUAL = "manual";      // neither worked; show the link yourself

/**
 * Share a URL the way the platform does it.
 * Returns one of the four constants above. It never throws, and it never
 * reports a success it did not see.
 */
export async function share(url, title = "Wingman") {
  const link = String(url || "").trim();
  if (!link) return MANUAL;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url: link });
      return SHARED;
    } catch (e) {
      /* Dismissed. Not a failure, and not a reason to copy a link they have
         just decided not to send. */
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) return CANCELLED;
      /* Anything else — a WebView that advertises share and refuses it — falls
         through to the clipboard below. */
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return COPIED;
    }
  } catch { /* denied, or no secure context */ }

  return MANUAL;
}

/** The sentence for each outcome, so four call sites cannot word it four ways. */
export const shareSaid = (result) =>
  result === SHARED ? null                       // their own sheet already said it
    : result === COPIED ? "Link copied"
    : result === CANCELLED ? null
    : null;                                      // MANUAL — show the link instead

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Save a Blob to the student's device.
 * Returns "saved" | "shared" | "opened" | "failed". "opened" means the file is
 * on screen and the caller must say, in words, to use the browser's own share
 * button — which is the honest answer on an iPhone that refuses both.
 */
export async function downloadBlob(blob, filename = "wingman") {
  if (!blob) return "failed";

  /* iOS FIRST, where an <a download> on a blob may just navigate and leave the
     student looking at a file they cannot keep. `canShare({files})` is the
     only reliable way to ask, and it is false on every desktop browser, so
     this costs nothing anywhere else. */
  try {
    if (typeof navigator !== "undefined" && typeof File === "function"
        && navigator.canShare && typeof navigator.share === "function") {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return "shared";
        } catch (e) {
          if (e && e.name === "AbortError") return "shared";   // they chose not to; not a failure
        }
      }
    }
  } catch { /* not supported; the anchor below is the answer */ }

  let url = null;
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    /* APPENDED BEFORE THE CLICK. Some browsers ignore a detached anchor. */
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* REVOKED AFTER A DELAY, never on the next line: Safari and iOS cancel a
       download whose URL has already gone. */
    wait(4000).then(() => { try { URL.revokeObjectURL(url); } catch { /* gone */ } });
    return "saved";
  } catch {
    if (url) {
      try {
        window.open(url, "_blank", "noopener");
        wait(30000).then(() => { try { URL.revokeObjectURL(url); } catch { /* gone */ } });
        return "opened";
      } catch { /* popup blocked too */ }
      try { URL.revokeObjectURL(url); } catch { /* gone */ }
    }
    return "failed";
  }
}

/** What to say for each download outcome. "shared" needs nothing — the sheet said it. */
export const downloadSaid = (result, filename = "the file") =>
  result === "saved" ? `Saved ${filename}`
    : result === "shared" ? null
    : result === "opened" ? "It is open — use your browser's Share button to save it."
    : "That did not save. Try again.";
