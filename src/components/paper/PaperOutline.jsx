import { useEffect, useState } from "react";
import { flattenOutline } from "../../lib/paperView.js";

/* =============================================================================
   THE PAPER'S OWN CONTENTS.

   Every PDF may carry a table of contents its author wrote, and every reader
   people use shows it. This one is flat with an indent rather than a tree of
   nested lists: the only thing a reader needs from the hierarchy is how far in
   a heading sits, and a flat list is one component instead of four.

   A destination is resolved to a page number when it is clicked, not when the
   list is built. Resolving fourteen destinations up front is fourteen round
   trips into the worker for a panel that may never be opened.
   ========================================================================= */

export default function PaperOutline({ doc, onPick }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!doc) return undefined;
    let live = true;
    doc.getOutline()
      .then((tree) => { if (live) setRows(flattenOutline(tree || [])); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [doc]);

  const jump = async (row) => {
    try {
      const dest = typeof row.dest === "string" ? await doc.getDestination(row.dest) : row.dest;
      if (!dest?.length) return;
      const index = await doc.getPageIndex(dest[0]);
      onPick(index + 1);
    } catch { /* a destination the file got wrong; the rest still work */ }
  };

  if (rows === null) return <p className="empty">Reading this paper’s contents…</p>;

  /* R11 — an empty state names what to do instead, and never states a zero.
     Plenty of handouts carry no contents at all, and that is not a fault. */
  if (!rows.length) {
    return (
      <p className="empty">
        This paper carries no contents of its own. The page rail beside it shows
        every page, and Find will take you to any word in it.
      </p>
    );
  }

  return (
    <ul className="outline">
      {rows.map((row, i) => (
        <li key={`${row.title}-${i}`} style={{ paddingLeft: 10 + row.depth * 13 }}>
          <button type="button" className="outline-row" data-bold={row.bold ? "" : undefined}
                  onClick={() => jump(row)}>
            {row.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
