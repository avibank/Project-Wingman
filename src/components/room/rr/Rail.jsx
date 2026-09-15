import { Av } from "./bits.jsx";
import { RailSearch } from "./icons.jsx";
import { initials } from "../../../lib/familiar.js";
import { when, titleOf, matches, chatUnread, answerCount } from "../../../lib/roomModel.js";
import { waitingOnAnswer, newestFirst } from "../../../lib/rrModel.js";

/* ============================================================================
   THE RAIL — the right seat, squadrons and modules, one row shape for both
   lists. Every list is by recency. The search covers what its placeholder
   says: people, chats and questions each get a section while there is a query.
   ========================================================================= */

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

function Row({ current = false, unread = false, avatar, l1, l2, time = "", badge = 0, mute = false, onClick }) {
  return (
    <button type="button" className="rr-row" aria-current={current ? "true" : "false"}
            data-unread={unread ? "1" : undefined} onClick={onClick}>
      {avatar}
      <span className="rr-mid">
        <span className="rr-l1">{l1}</span>
        <span className="rr-l2">{l2}</span>
      </span>
      <span className="rr-rt">
        {time ? <span className="rr-tm">{time}</span> : null}
        {badge > 0 ? <span className="rr-badge" data-mute={mute ? "1" : undefined}>{badge}</span> : null}
      </span>
    </button>
  );
}

export default function Rail({
  me, onHome, query = "", onQuery, searchRef,
  squadrons = [], modules = [], threads = [], replies = [], messages = [], foundPeople = [],
  faces = [], cur = {}, who, onOpen, onSeeSeats, onFindSquadron, onProfile,
}) {
  const q = query.trim();
  const lastAt = (s) => Date.parse(s.last?.createdAt) || 0;

  const squads = squadrons
    .filter((s) => matches(query, s.name, s.code, s.blurb))
    .sort((a, b) => lastAt(b) - lastAt(a));

  /* Sort is stable, so modules nobody has asked in keep their own order. */
  const mods = modules
    .map((m) => {
      const code = m.code || m.id;
      const mine = threads.filter((t) => t.moduleId === code).sort(newestFirst);
      return { m, code, newest: mine[0] || null, waiting: waitingOnAnswer(mine, replies) };
    })
    .filter(({ m, code }) => matches(query, m.name, code))
    .sort((a, b) => (Date.parse(b.newest?.createdAt) || 0) - (Date.parse(a.newest?.createdAt) || 0));

  const hitThreads = q ? threads.filter((t) => matches(query, titleOf(t), t.body)).sort(newestFirst).slice(0, 5) : [];
  const hitMessages = q ? messages.filter((m) => !m.deletedAt && matches(query, m.body)).slice(-4).reverse() : [];
  const squadName = (id) => squadrons.find((s) => s.id === id)?.name || "";

  return (
    <aside className="rr-rail" aria-label="Right seat, squadrons and modules">
      <div className="rr-rail-head">
        <div className="rr-brand">
          <b>
            <button type="button" className="rr-home is-inline" onClick={onHome}
                    aria-label="Wingman. Back to the Flight Deck">Wingman</button>
          </b>
          <span className="rr-micro">Ready Room</span>
        </div>
        <label className="rr-search">
          <RailSearch />
          <input ref={searchRef} type="search" value={query}
                 onChange={(e) => onQuery(e.target.value)}
                 placeholder="Search people, chats and questions"
                 aria-label="Search people, chats and questions" />
          <kbd>{MAC ? "⌘K" : "Ctrl K"}</kbd>
        </label>
      </div>

      <div className="rr-rail-scroll">
        {q && foundPeople.length > 0 && (
          <>
            <div className="rr-sect"><span className="rr-micro">People</span></div>
            {foundPeople.map((p) => (
              <Row key={p.user_id}
                   avatar={<Av id={p.user_id} name={p.display_name} size={44} />}
                   l1={p.display_name}
                   l2={[p.module_code, p.shares_squadron ? "In a squadron with you" : null].filter(Boolean).join(" · ") || "In your modules"}
                   onClick={() => onProfile(p.user_id, p)} />
            ))}
          </>
        )}

        {hitThreads.length > 0 && (
          <>
            <div className="rr-sect"><span className="rr-micro">Questions</span></div>
            {hitThreads.map((t) => {
              const n = answerCount(t, replies);
              return (
                <Row key={t.id}
                     avatar={<Av id={t.moduleId} name={t.moduleId} size={44} mod />}
                     l1={titleOf(t)}
                     l2={`${who(t.authorId)} · ${n ? `${n} answer${n === 1 ? "" : "s"}` : "Waiting on an answer"}`}
                     time={when(t.createdAt)}
                     onClick={() => onOpen({ kind: "module", id: t.moduleId, thread: t.id })} />
              );
            })}
          </>
        )}

        {hitMessages.length > 0 && (
          <>
            <div className="rr-sect"><span className="rr-micro">Messages</span></div>
            {hitMessages.map((m) => (
              <Row key={m.id}
                   avatar={<Av id={m.authorId} name={who(m.authorId)} size={44} />}
                   l1={`${m.authorId === me ? "You" : who(m.authorId)} · ${squadName(m.squadronId)}`}
                   l2={m.body} time={when(m.createdAt)}
                   onClick={() => onOpen({ kind: "squad", id: m.squadronId, at: m.id })} />
            ))}
          </>
        )}

        <div className="rr-sect">
          <span className="rr-micro">Right seat</span>
          <span className="rr-grow" />
          <button type="button" className="rr-lnk is-inline" onClick={onSeeSeats}>See all</button>
        </div>
        {faces.length ? (
          <div className="rr-seats">
            {faces.map((f) => (
              <button type="button" className="rr-seat" key={f.id} onClick={onSeeSeats}
                      aria-label={`${who(f.id)}, ${f.on === "seat" ? "in the right seat with you" : f.on === "1" ? "in the room" : "away"}. See the right seat.`}>
                <span className="rr-avwrap">
                  <Av id={f.id} name={who(f.id)} size={42} />
                  <span className="rr-dot" data-on={f.on} />
                </span>
                <span className="rr-nm">{who(f.id).split(" ")[0]}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="rr-ghostbtn is-inline" onClick={onSeeSeats}>Find a right seat</button>
        )}

        <div className="rr-hr" />

        <div className="rr-sect">
          <span className="rr-micro">Squadrons</span>
          <span className="rr-grow" />
          <button type="button" className="rr-lnk is-inline" onClick={onFindSquadron}>Find one</button>
        </div>
        {squads.map((s) => {
          const unread = chatUnread(messages, s.id, s.lastReadAt, me);
          return (
            <Row key={s.id}
                 current={cur.kind === "squad" && cur.id === s.id}
                 unread={unread > 0 && !s.muted}
                 avatar={<Av id={s.id} name={s.name} label={initials(s.name)} size={44} square />}
                 l1={s.name}
                 l2={s.last ? `${s.last.authorId === me ? "You" : who(s.last.authorId)}: ${s.last.body}` : "Start it off"}
                 time={s.last ? when(s.last.createdAt) : ""}
                 badge={unread} mute={s.muted}
                 onClick={() => onOpen({ kind: "squad", id: s.id })} />
          );
        })}
        {!squadrons.length && (
          <button type="button" className="rr-ghostbtn is-inline" onClick={onFindSquadron}>Find a squadron</button>
        )}

        <div className="rr-sect"><span className="rr-micro">Modules</span></div>
        {mods.map(({ m, code, newest, waiting }) => (
          <Row key={code}
               current={cur.kind === "module" && cur.id === code}
               avatar={<Av id={code} name={code} size={44} mod />}
               l1={m.name}
               l2={newest ? titleOf(newest) : "Ask the first one"}
               time={newest ? when(newest.createdAt) : ""}
               badge={waiting} mute
               onClick={() => onOpen({ kind: "module", id: code })} />
        ))}
      </div>
    </aside>
  );
}
