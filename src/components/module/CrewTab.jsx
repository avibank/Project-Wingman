/* =============================================================================
   CREW — who else is on this module.
   -----------------------------------------------------------------------------
   §2 of the launch handoff, and the parenthesis in its heading is the whole
   design: "about the module, not your friends". So it is not a contact list.
   It answers three things and stops:

     · how many people are on the module, how many are studying right now, and
       how many have finished it
     · for each chapter: who is on it now, and the stamps of everyone who has
       signed it off — the student's own among them
     · who is answering questions in this module's threads

   FOUR RULES IT KEEPS, each of them the reference's:

   · CHAPTER-LEVEL POSITION ONLY, never a lesson and never a score. crew.js
     never asks for one, so there is nothing here to leak.
   · SQUADRON MATES ARE NOT GROUPED. They get a thin teal ring and stay in
     place. Sorting them to the top would make this a friends list, which is
     the thing the heading says it is not.
   · NO DMs ANYWHERE. A face and a stamp both open the profile viewer; talking
     happens in squadron chat or a right seat, and neither is reachable from
     here except through that card.
   · THE WALL IS NEVER EMPTY-LOOKING. With no stamps on it, it says "No stamps
     yet. The first one here could be yours." — §10's rule about naming the
     next action rather than stating an absence.
   ========================================================================= */
import { useEffect, useMemo, useState } from "react";
import Stamp from "../Stamp.jsx";
import { stampTilt } from "../../lib/stamp.js";
import { fetchCrew } from "../../lib/crew.js";
import { initials, hueFor } from "../../lib/familiar.js";
import "./crew.css";

/* One face. `on` is a live presence dot; `mate` is the teal ring.
 *
 * A BUTTON ON ITS OWN, A SPAN INSIDE ONE. In a stack the face IS the control —
 * tapping it opens the person. Inside an "Answering questions" pill the pill is
 * already the button, and a button inside a button is nested interactive
 * content: invalid HTML, which a browser fixes by splitting the nesting, and
 * the row lays out wrong. Instruments.jsx carries the same note about a lamp
 * inside a chapter header. The reference does it this way too — `face()` there
 * is a span, and the stack's click is delegated. */
function Face({ p, mate, onOpen, inert = false }) {
  const cls = `crew-av${p.on ? " is-on" : ""}${mate ? " crew-sqring" : ""}`;
  const style = { background: `oklch(.55 .09 ${hueFor(p.name)})` };
  const title = `${p.name}${mate ? " · your squadron" : ""}`;
  if (inert) {
    return <span className={cls} style={style} title={title} aria-hidden="true">{initials(p.name)}</span>;
  }
  return (
    <button type="button" className={cls} style={style} title={title}
            aria-label={`Open ${p.name}`} onClick={() => onOpen?.(p)}>
      {initials(p.name)}
    </button>
  );
}

function Stack({ people, mates, onOpen, cap = 6 }) {
  const shown = people.slice(0, cap);
  return (
    <span className="crew-stack">
      {shown.map((p) => <Face key={p.userId} p={p} mate={mates.has(p.userId)} onOpen={onOpen} />)}
      {people.length > cap && <span className="crew-more">+{people.length - cap}</span>}
    </span>
  );
}

export default function CrewTab({ moduleCode, moduleName, chapters = [], me, myStamp,
                                  mates = new Set(), query = "", onOpenPerson, onOpenThreads, myDone = new Set() }) {
  const [crew, setCrew] = useState(null);

  useEffect(() => {
    let live = true;
    setCrew(null);
    fetchCrew(moduleCode, me, { chapterIds: chapters.map((c) => c.id) })
      .then((c) => { if (live) setCrew(c); });
    return () => { live = false; };
  }, [moduleCode, me, chapters]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = crew?.people || [];
    return q ? all.filter((p) => `${p.name} ${p.callsign || ""}`.toLowerCase().includes(q)) : all;
  }, [crew, query]);

  if (!crew) return <div className="crew-wait" aria-busy="true" />;

  /* FLY SOLO IS SYMMETRIC, and this is what it looks like from the inside:
     the tab says so plainly rather than pretending the module is empty. */
  if (crew.solo) {
    return (
      <div className="crew">
        <div className="crew-empty">
          You are flying solo, so nobody here can see you and you cannot see them.
          Turn it off in Preferences to meet the rest of {moduleName || "this module"}.
        </div>
      </div>
    );
  }

  if (query.trim() && !hits.length) {
    /* The reference's sentence, plus the half this app's voice asks for: §10
       says an empty state names its next action, and the Library's own search
       answers the same way ("Try a paper title, a chapter name, or the All
       chip."). A name that matches nothing is usually a callsign. */
    return (
      <div className="crew">
        <div className="crew-empty">
          Nobody by that name on {moduleName}. Try a callsign, or clear the search to see everyone.
        </div>
      </div>
    );
  }

  const onNow = hits.filter((p) => p.on);
  /* "+1" everywhere below is the student themselves: they are on the module,
     and crew.js leaves them out of the list so they are never their own row. */
  const total = hits.length + 1;

  return (
    <div className="crew">
      <div className="crew-sum">
        <div>
          <b>{total} on {moduleName}</b>
          {/* NEVER A ZERO COUNT (CLAUDE.md, Voice). "0 have finished it" is
              the thing that rule exists to stop: a number whose only job is
              to say nothing happened. On a module nobody has finished yet the
              clause simply is not there, and the line says what IS true. */}
          <p>
            {onNow.length + 1} studying right now
            {crew.finished > 0 && (
              <> · {crew.finished} {crew.finished === 1 ? "has" : "have"} finished it</>
            )}
          </p>
        </div>
        <Stack people={onNow} mates={mates} onOpen={onOpenPerson} />
      </div>

      {chapters.map((ch, i) => {
        const onIt = hits.filter((p) => p.chapterId === ch.id);
        const done = hits.filter((p) => p.done.has(ch.id));
        const mineDone = myDone.has(ch.id);
        const youAreHere = crew.here === ch.id;
        return (
          <div className="crew-ch" key={ch.id}>
            <div className="crew-chh">
              <div>
                <h3>{ch.title || `Chapter ${i + 1}`}</h3>
                <div className="crew-cm">
                  {done.length + (mineDone ? 1 : 0)} signed off
                  {youAreHere && <> · <span className="crew-here">you are here</span></>}
                </div>
              </div>
              <div className="crew-onit">
                {onIt.length
                  ? <><span>On it now</span><Stack people={onIt} mates={mates} onOpen={onOpenPerson} cap={5} /></>
                  : <span>Nobody on it right now</span>}
              </div>
            </div>
            <div className="crew-wall">
              <span className="crew-wl">SIGNED OFF</span>
              {done.length || mineDone ? (
                <>
                  {mineDone && (
                    <button type="button" className="crew-mine" title="Your stamp" onClick={() => onOpenPerson?.({ userId: me, name: "You", stamp: myStamp })}>
                      <Stamp stamp={myStamp} size={44} rot={stampTilt(myStamp?.seed || 1, ch.id)} label="Your stamp" />
                    </button>
                  )}
                  {done.map((p) => (
                    <button type="button" key={p.userId} title={p.name} onClick={() => onOpenPerson?.(p)}>
                      <Stamp stamp={p.stamp} size={44} rot={stampTilt(p.stamp?.seed || 1, ch.id + p.userId)} label={`${p.name}'s stamp`} />
                    </button>
                  ))}
                </>
              ) : (
                <span className="crew-none">No stamps yet. The first one here could be yours.</span>
              )}
            </div>
          </div>
        );
      })}

      {(() => {
        const helpers = hits.filter((p) => p.answers > 0).sort((a, b) => b.answers - a.answers).slice(0, 4);
        if (!helpers.length) return null;
        return (
          <div className="crew-helpers">
            <h3>Answering questions</h3>
            <p className="crew-cm">Most answers in {moduleName} threads</p>
            <div className="crew-hrow">
              {helpers.map((p) => (
                <button type="button" className="crew-hp" key={p.userId} onClick={() => onOpenPerson?.(p)}
                        aria-label={`Open ${p.name}, ${p.answers} ${p.answers === 1 ? "answer" : "answers"}`}>
                  <Face p={p} mate={mates.has(p.userId)} inert />
                  <span>{p.name.split(" ")[0]}<small>{p.answers} {p.answers === 1 ? "answer" : "answers"}</small></span>
                </button>
              ))}
              <button type="button" className="crew-pill" onClick={() => onOpenThreads?.()}>
                Open {moduleName} threads
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
