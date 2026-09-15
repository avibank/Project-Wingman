import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { RouteStrip } from "./RouteStrip.jsx";
import { RightSeatCard } from "./RightSeatCard.jsx";
import { SquadronCard } from "./SquadronCard.jsx";
import { ModuleThreadCard } from "./ModuleThreadCard.jsx";

/* The social gateway at the foot of the Flight Deck.
   Route across the top, then up to three cards. Each surface switches off on
   its own and the cards close ranks, taking room in proportion to what they
   have to say. */

const K = [1, 1.18, 1.42];          // how much bigger the content gets per step
const MSG_LIMIT = [3, 4, 5];
const THREAD_LIMIT = [2, 3, 4];

export function BackOnTheGround({
  width,                 // optional override; the section measures itself otherwise
  module,                // { name, chapters, youChapter }
  surfaces,              // { seat: bool, squad: bool, module: bool }
  squadron,              // { name, members, messages, unread, quietSince } | null
  routePeople,           // [{ id, name, chapter, seat }]
  threads,               // [{ id, title, meta, ... }]
  onOpenPerson,
  onOpenThread,
  onFindSquadron,
  onFindSeat,
  onAsk,
  onSend,
  onOpenReadyRoom,
}) {
  const [seatMode, setSeatMode] = useState(null);
  const rootRef = useRef(null);
  const [measured, setMeasured] = useState(width || 1040);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || width) return;
    const read = () => setMeasured(el.clientWidth);
    read();
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const W = width || measured;
  const on = [surfaces.seat, surfaces.squad, surfaces.module].filter(Boolean).length;

  const tier = Math.min(
    on === 1 ? 2 : on === 2 ? 1 : 0,
    W < 620 ? 0 : W < 940 ? 1 : 2
  );

  const seatHolder = (squadron?.members || []).find((m) => m.seat) || null;
  const mode = seatMode || (seatHolder ? "recent" : "suggested");

  const cards = [];
  if (surfaces.seat) {
    cards.push({
      key: "seat",
      weight: !squadron ? 1
        : (squadron.members.length > 3 ? 1.35 : squadron.members.length >= 3 ? 1.3 : 1.1),
      node: (
        <RightSeatCard
          key="seat"
          squadron={squadron}
          seatHolder={seatHolder}
          youChapter={module.youChapter}
          mode={mode}
          onMode={setSeatMode}
          onOpenPerson={onOpenPerson}
          onFindSquadron={onFindSquadron}
          compact={tier === 0}
        />
      ),
    });
  }
  if (surfaces.squad) {
    const has = (squadron?.messages || []).length;
    cards.push({
      key: "squad",
      weight: !squadron ? 1 : has ? 1.5 : 1.15,
      node: (
        <SquadronCard
          key="squad"
          squadron={squadron}
          limit={MSG_LIMIT[tier]}
          onSend={onSend}
          onFindSquadron={onFindSquadron}
        />
      ),
    });
  }
  if (surfaces.module) {
    const count = threads?.length || 0;
    cards.push({
      key: "module",
      weight: !count ? 1 : count === 1 ? 1.2 : 1.45,
      node: (
        <ModuleThreadCard
          key="module"
          moduleName={module.name}
          threads={threads}
          limit={THREAD_LIMIT[tier]}
          showExcerpt={tier > 0}
          onOpenThread={onOpenThread}
          onAsk={onAsk}
        />
      ),
    });
  }

  const sourceLabel = useMemo(() => {
    if (surfaces.squad && squadron && surfaces.module) return "Squadron and module";
    if (surfaces.squad && squadron) return "Your squadron";
    if (surfaces.module) return `Also on ${module.name}`;
    if (surfaces.seat) return "Your right seat";
    return "";
  }, [surfaces, squadron, module.name]);

  const headline = () => {
    const bits = [];
    if (!squadron && !seatHolder && !routePeople.length) {
      return "Ask for someone and this fills up";
    }
    if (routePeople.length) bits.push(`${routePeople.length} on your route`);
    if (squadron?.unread) bits.push(`${squadron.unread} unread`);
    if (threads?.length) bits.push(`${threads.length} open thread${threads.length === 1 ? "" : "s"}`);
    if (!bits.length) bits.push("the Ready Room is open");
    return (W < 620 ? bits.slice(0, 2) : bits).join(" · ");
  };

  if (!on) return <section className="bog" ref={rootRef} hidden />;

  return (
    <section className="bog" ref={rootRef}>
      <div className="bog-head">
        <span className="bog-stack">
          <h2>Back on the ground</h2>
          <span className="bog-meta">{headline()}</span>
        </span>
        <button className="bog-more is-inline" type="button" onClick={onOpenReadyRoom}>Ready Room ›</button>
      </div>

      <RouteStrip
        chapters={module.chapters}
        youChapter={module.youChapter}
        people={routePeople}
        sourceLabel={sourceLabel}
        onOpenPerson={onOpenPerson}
        onFindSeat={onFindSeat}
      />

      <div
        className="bog-cards"
        style={{
          "--cols": cards.length,
          "--k0": K[tier],
          "--tpl": cards.map((c) => `${c.weight.toFixed(2)}fr`).join(" "),
        }}
      >
        {cards.map((c) => c.node)}
      </div>
    </section>
  );
}
