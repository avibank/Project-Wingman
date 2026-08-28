import { useState } from "react";

// Three layers, one list, in this order: the wingman pinned, then groups, then
// the individual questions you are in, then the module row. It replaces a
// module chat room, which does not work at any user count — quiet with eleven
// people and unreadable with five thousand.
//
// Unread discipline is the load-bearing rule here. The wingman and groups
// badge normally. A question badges only if you are in it. "Someone asked
// something on a lesson you finished" is a soft dismissible row at the foot of
// the list and never a badge: if every new question lit a dot, the tab would
// be permanently red and people would stop opening it.
function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "··";
}

function Row({ row, current, onPick }) {
  return (
    <button type="button" className={`hrow${row.pinned ? " pinned" : ""}`}
            aria-current={current === row.id} onClick={() => onPick(row)}>
      <span className={`hav${row.kind === "group" ? " grp" : ""}`} aria-hidden="true">
        {row.kind === "module" ? "M" : initials(row.name)}
      </span>
      <span>
        <span className="hn">{row.name}</span>
        <span className="hl">{row.line}</span>
      </span>
      <span className="hr">
        {row.where && <span className="hpos">{row.where}</span>}
        {row.unread > 0 && <span className="unread">{row.unread}</span>}
      </span>
    </button>
  );
}

export default function PeopleTab({ module: mod, wingman, groups, questions, moduleRow, onOpenQuestion }) {
  const rows = [
    ...(wingman ? [{ ...wingman, kind: "wingman", pinned: true }] : []),
    ...groups.map((g) => ({ ...g, kind: "group" })),
    // A question badges only if you are in it, which is what `mine` means.
    ...questions.map((q) => ({ ...q, kind: "question", unread: q.mine ? q.unread : 0 })),
    { id: "module", kind: "module", name: `Everyone on ${mod.name}`, line: moduleRow.line, unread: 0 },
  ];

  const [current, setCurrent] = useState(rows[0]?.id || null);
  const [dismissed, setDismissed] = useState(false);
  const open = rows.find((r) => r.id === current) || rows[0];

  // Never a badge. A quiet line at the foot, and it can be sent away.
  const nudge = questions.find((q) => !q.mine && q.unread > 0);

  return (
    <div className="hub">
      <div className="hublist">
        <div className="hubrows">
          {rows.map((r) => (
            <Row key={r.id} row={r} current={current} onPick={(row) => {
              setCurrent(row.id);
              if (row.kind === "question") onOpenQuestion?.(row);
            }} />
          ))}
        </div>
        {nudge && !dismissed && (
          <button type="button" className="hsug" onClick={() => setDismissed(true)}>
            Someone asked something on a lesson you have finished. Tap to put this away.
          </button>
        )}
      </div>

      <div className="side" style={{ padding: "18px 22px" }}>
        {open?.kind === "module" ? (
          <>
            <h4>{open.name}</h4>
            {/* Never empty and needs nobody online — but the figures are real
                or absent. Nothing here is invented to fill the space. */}
            {moduleRow.facts.length
              ? moduleRow.facts.map((f) => <p key={f} className="sh">{f}</p>)
              : <p className="sh">This fills in as people work through the module. It does not need anyone to be online.</p>}
          </>
        ) : open ? (
          <>
            <h4>{open.name}</h4>
            <p className="sh">{open.line}</p>
            {open.kind === "wingman" && (
              <p className="sh">
                {open.where
                  ? `They are on ${open.where}.`
                  : "Where you each are shows here, before anybody types."}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
