/* =============================================================================
   DOWNLOADS — a file handed over whole, and nothing that opens it.
   -----------------------------------------------------------------------------
   Owner request, 2026-09-21: Module 13d's study cards as a PDF the class can
   take away, with NO viewer. The paper reader is paused and the viewer is off
   (the build-time papers switch, `library.reader`, `reader.v2` and
   `paper.viewer` all stay as they are), so this is not a paper and does not pretend to be one: a paper
   opens in Wingman, a download goes to the student's device and the browser
   does the rest.

   SO IT IS A PLAIN <a href download>, and that is deliberate on each count:

   · NO onClick. Nothing here routes, fetches, or builds a blob — the browser's
     own download is the most reliable one there is, and it works with the
     app's JavaScript half-loaded. `downloadBlob` in lib/outside.js is for
     things the app MAKES; this file already exists on the server.
   · NO READER. Nothing here imports the reader, the viewer or papers.js, so
     drawing this row cannot put a byte of the paused code back in the build.
     scripts/check-paused.mjs holds exactly that, and it holds that the
     anchor is this one and no other.
   · DATA, NOT MARKUP. The rows are the module's `downloads` in the content
     document ({id, title, file, pages}), validated by contentSchema.js and
     given a site-rooted `href` by contentLoader.js. A module with none draws
     nothing — not a heading, not an empty row.

   THE ROW IS THE LIBRARY'S ROW, class for class — `lrow` for the title,
   meta and action sizes the quiz and card rows above it use, `paper` for the
   document glyph in the thumbnail slot — so the three sections read as one
   list and the papers area as one shelf whichever switch is on.
   ========================================================================= */

const DOC = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.2 1.8h5.2l4.4 4.3v8.1H3.2z" /><path d="M8.4 1.8v4.3h4.4" />
  </svg>
);

export default function LibraryDownloads({ downloads = [] }) {
  if (!downloads.length) return null;
  return (
    <ul className="papers dl-list">
      {downloads.map((d) => (
        <li key={d.id}>
          <a className="lrow paper" href={d.href} download>
            <span className="pg">{DOC}</span>
            <span>
              <div className="lt">{d.title}</div>
              <div className="ls">
                {["PDF", d.pages ? `${d.pages} page${d.pages === 1 ? "" : "s"}` : null]
                  .filter(Boolean).join(" · ")}
              </div>
            </span>
            <span className="rt"><span className="act-o">Download</span></span>
          </a>
        </li>
      ))}
    </ul>
  );
}
