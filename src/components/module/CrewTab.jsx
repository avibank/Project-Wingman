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
import { useMemo } from "react";
import Stamp from "../Stamp.jsx";
import { stampTilt } from "../../lib/stamp.js";
import { initials, hueFor } from "../../lib/familiar.js";
import "./crew.css";
import "./ref-module.css";
import CrewEmpty from "./CrewEmpty.jsx";

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
  const cls = `av${p.on ? " on" : ""}${mate ? " sqring" : ""}`;
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
    <span className="stack">
      {shown.map((p) => <Face key={p.userId} p={p} mate={mates.has(p.userId)} onOpen={onOpen} />)}
      {people.length > cap && <span className="more">+{people.length - cap}</span>}
    </span>
  );
}

/* `crew` COMES DOWN, it is not fetched here. The count is on the TAB in the
   reference ("Crew 15"), which is one level above this panel, so the read is
   in ModuleScreen and both sides take the same answer — see useCrew in
   crew.js. Two fetches would be two round trips for one fact and two chances
   for them to disagree. */
export default function CrewTab({ crew = null, moduleName, chapters = [], me, myStamp,
                                  mates = new Set(), query = "", onOpenPerson, onOpenThreads,
                                  myDone = new Set(), onFindSquadron, onInviteClass }) {

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = crew?.people || [];
    return q ? all.filter((p) => `${p.name} ${p.callsign || ""}`.toLowerCase().includes(q)) : all;
  }, [crew, query]);

  if (!crew) return <div className="crew ref-mod crew-wait" aria-busy="true" />;

  /* FLY SOLO IS SYMMETRIC, and this is what it looks like from the inside:
     the tab says so plainly rather than pretending the module is empty. */
  if (crew.solo) {
    return (
      <div className="crew ref-mod">
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
      <div className="crew ref-mod">
        <div className="crew-empty">
          Nobody by that name on {moduleName}. Try a callsign, or clear the search to see everyone.
        </div>
      </div>
    );
  }

  /* NOBODY ELSE HERE YET, AND THAT IS ITS OWN SCREEN. It used to fall through
     to the wall below and draw a chapter row per chapter with "No stamps yet"
     in each — the absence said three times, and what Crew IS said nowhere.
     §2: "An empty Crew tab would be bad; a dead one is worse." */
  if (!crew.people.length) {
    return (
      <div className="crew ref-mod">
        <CrewEmpty moduleName={moduleName}
                   onFind={() => onFindSquadron?.()}
                   onInvite={() => onInviteClass?.()} />
      </div>
    );
  }

  const onNow = hits.filter((p) => p.on);
  /* "+1" everywhere below is the student themselves: they are on the module,
     and crew.js leaves them out of the list so they are never their own row. */
  const total = hits.length + 1;

  return (
    <div className="crew ref-mod">
      <div className="csum">
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
        const signedOff = done.length + (mineDone ? 1 : 0);
        const youAreHere = crew.here === ch.id;
        return (
          <div className="cch" key={ch.id}>
            <div className="cch-h">
              <div>
                <h3>{ch.title || `Chapter ${i + 1}`}</h3>
                {/* NEVER A ZERO COUNT, here as well — and this one said it
                    once per chapter. "0 signed off" under every heading on a
                    module nobody has started is the same number saying the
                    same nothing, five times down the page, above a wall that
                    already says "No stamps yet. The first one here could be
                    yours." The line is what IS true instead, and on a chapter
                    with nobody on it and nobody through it there is no line
                    at all — the wall below carries the invitation. */}
                {(signedOff > 0 || youAreHere) && (
                  <div className="cm">
                    {signedOff > 0 && <>{signedOff} signed off</>}
                    {signedOff > 0 && youAreHere && " · "}
                    {youAreHere && <span className="here">you are here</span>}
                  </div>
                )}
              </div>
              <div className="onit">
                {onIt.length
                  ? <><span>On it now</span><Stack people={onIt} mates={mates} onOpen={onOpenPerson} cap={5} /></>
                  : <span>Nobody on it right now</span>}
              </div>
            </div>
            <div className="wall">
              <span className="wl">SIGNED OFF</span>
              {done.length || mineDone ? (
                <>
                  {mineDone && (
                    <button type="button" className="mine" title="Your stamp" onClick={() => onOpenPerson?.({ userId: me, name: "You", stamp: myStamp })}>
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
                <span className="none">No stamps yet. The first one here could be yours.</span>
              )}
            </div>
          </div>
        );
      })}

      {(() => {
        const helpers = hits.filter((p) => p.answers > 0).sort((a, b) => b.answers - a.answers).slice(0, 4);
        if (!helpers.length) return null;
        return (
          <div className="helpers">
            <h3>Answering questions</h3>
            <p className="cm">Most answers in {moduleName} threads this month</p>
            <div className="hrow">
              {helpers.map((p) => (
                <button type="button" className="hp" key={p.userId} onClick={() => onOpenPerson?.(p)}
                        aria-label={`Open ${p.name}, ${p.answers} ${p.answers === 1 ? "answer" : "answers"}`}>
                  <Face p={p} mate={mates.has(p.userId)} inert />
                  <span>{p.name.split(" ")[0]}<small>{p.answers} {p.answers === 1 ? "answer" : "answers"}</small></span>
                </button>
              ))}
              <button type="button" className="pill" onClick={() => onOpenThreads?.()}>
                Open {moduleName} threads
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
