import { useRef, useState } from "react";
import { initials } from "./route.js";
import { Motif } from "./motifs.jsx";
import { Popover } from "./Popover.jsx";

/* You can only fly right seat with someone you share a squadron with, so this
   card never shows a stranger. Three tiles at most; past that the third is a
   plus that pops the squadron.

   RECENT IS REAL. Each member carries `flewAt`, the last session you actually
   shared, from the flight log. Anyone you have not flown with falls back to
   where they are on the route, so nothing here is a day that did not happen. */
const CAP = 3;

// The day of a flight in the card's own words: today, yesterday, a weekday
// inside the week, a date after that.
function dayWord(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  const d = new Date(t);
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toLowerCase();
}

export function RightSeatCard({
  squadron,        // { name, members: [{ id, name, category, chapter, seat, flewAt }] } | null
  seatHolder,      // person | null
  youChapter,
  mode,            // "recent" | "suggested"
  onMode,
  onOpenPerson,
  onFindSquadron,
  compact,         // true when the cards are three-across
}) {
  const [popAnchor, setPopAnchor] = useState(null);
  const plusRef = useRef(null);

  if (!squadron) {
    return (
      <div className="bog-card">
        <div className="bog-ch"><span className="bog-lbl">Right seat</span></div>
        <div className="bog-body">
          <div className="bog-invite">
            <Motif kind="seat" />
            <p className="bog-lead">A squadron mate fills this seat.</p>
            <p className="bog-why">Find a squadron and the seat opens.</p>
            <button className="bog-btn is-inline" type="button" data-primary="" onClick={onFindSquadron}>
              Find a squadron
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reason = (p) => {
    if (p.seat) return "beside you";
    if (mode === "recent" && p.flewAt) return compact ? dayWord(p.flewAt) : `flew ${dayWord(p.flewAt)}`;
    if (p.chapter == null) return "not flying";
    if (p.chapter === youChapter) return "with you";
    return p.chapter > youChapter ? "ahead of you" : "behind you";
  };

  const flown = (p) => Date.parse(p.flewAt) || 0;
  const pool =
    mode === "recent"
      ? squadron.members.slice().sort((a, b) => flown(b) - flown(a))
      : squadron.members
          .slice()
          .sort((a, b) => {
            const da = a.chapter == null ? 99 : Math.abs(a.chapter - youChapter);
            const db = b.chapter == null ? 99 : Math.abs(b.chapter - youChapter);
            return da - db;
          });

  if (!pool.length) {
    return (
      <div className="bog-card">
        <div className="bog-ch"><span className="bog-lbl">Right seat</span></div>
        <div className="bog-body">
          <div className="bog-invite">
            <Motif kind="seat" />
            <p className="bog-lead">A squadron mate fills this seat.</p>
            <p className="bog-why">Invite someone to {squadron.name} and it opens.</p>
          </div>
        </div>
      </div>
    );
  }

  const overflow = pool.length > CAP;
  const shown = pool.slice(0, overflow ? CAP - 1 : Math.min(CAP, pool.length));
  const rest = pool.length - shown.length;
  const thin = shown.length <= 2 && !overflow;

  return (
    <div className="bog-card">
      <div className="bog-ch">
        <span className="bog-lbl">Right seat</span>
        <span className="bog-seg">
          <button className="is-inline" type="button" aria-pressed={mode === "recent"} onClick={() => onMode("recent")}>Recent</button>
          <button className="is-inline" type="button" aria-pressed={mode === "suggested"} onClick={() => onMode("suggested")}>Suggested</button>
        </span>
      </div>

      <div className="bog-body">
        <div className="bog-seats">
          {shown.map((p) => (
            <span className="bog-seat" key={p.id} data-seat={p.seat ? "" : undefined}>
              <button className="bog-face" type="button" aria-label={p.name} onClick={() => onOpenPerson?.(p)}>
                {initials(p.name)}
              </button>
              <span className="bog-nm">{p.name.split(" ")[0]}</span>
              <span className="bog-why-sm">{reason(p)}</span>
            </span>
          ))}

          {(overflow || thin) && (
            <span className="bog-seat bog-add">
              <button className="bog-face" type="button" ref={plusRef}
                      aria-label={overflow ? `See all ${pool.length}` : "See the squadron"}
                      onClick={(e) => setPopAnchor(popAnchor ? null : e.currentTarget)}>
                {overflow ? `+${rest}` : "+"}
              </button>
              <span className="bog-nm">{overflow ? "All" : "More"}</span>
              <span className="bog-why-sm">in {squadron.name.toLowerCase()}</span>
            </span>
          )}
        </div>
      </div>

      <div className="bog-foot">
        {seatHolder
          ? `${seatHolder.name.split(" ")[0]} is beside you. The seat clears after an hour of quiet.`
          : mode === "recent"
          ? "Who you last flew with."
          : "Nearest your chapter first."}
      </div>

      {popAnchor && (
        <Popover anchor={popAnchor} label={squadron.name} onClose={() => setPopAnchor(null)}>
          <div className="bog-pophead">
            <span className="bog-pop-t">{squadron.name}</span>
            <span className="bog-pop-c">{pool.length}</span>
          </div>
          {pool.map((p) => (
            <button className="bog-poprow" type="button" key={p.id} data-seat={p.seat ? "" : undefined}
                    onClick={() => { setPopAnchor(null); onOpenPerson?.(p); }}>
              <span className="bog-mini">{initials(p.name)}</span>
              <span className="bog-mt">
                <span className="bog-t">{p.name}</span>
                <span className="bog-m">{[p.category, reason(p)].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}
