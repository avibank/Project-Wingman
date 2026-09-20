import { useEffect, useRef } from "react";

export const HOBBS_KEY = "pw-hobbs";
export const LAST_FLOWN_KEY = "pw-last-flown";

/* DAYS FLOWN — §5's third stat on the licence card, and the only new thing it
   needed stored. A COUNT AND THE LAST DAY, never a list: a set of every date
   somebody ever studied grows without limit and is a thousand strings after
   three years, and nothing in the app ever asks WHICH days, only how many.

   It is written by the same writer as the meter and "last flown", because it
   is the same event. A second writer somewhere else is how the deck once told
   everyone this was their first flight. */
export const DAYS_KEY = "pw-days";
const today = (d = new Date()) => d.toISOString().slice(0, 10);
export function bumpDay(store, now = new Date()) {
  const day = today(now);
  const had = store && typeof store === "object" ? store : { n: 0, last: null };
  if (had.last === day) return had;
  return { n: (had.n || 0) + 1, last: day };
}
export const daysFlown = (store) => (store && typeof store === "object" ? store.n || 0 : 0);

// How often accumulated time is written down. Short enough that a closed lid
// loses a rounding error rather than a session, long enough that the whole
// tree is not re-rendering on a fast timer.
const FLUSH_MS = 20000;

// Time in the module, not time on the video.
//
// This is the hours-played meter. It runs from the moment a module is opened
// until it is left, and it does not care what is on screen while it runs — a
// lesson, a quiz, a paper from the Library, or a chapter list being read.
// Deriving it from video position was the wrong instrument: it read zero for
// someone who had spent an hour on the written material, which is most of
// what studying for Part-66 actually is.
//
// It stops on a backgrounded tab. A tab nobody is looking at is not time
// spent, and without that the meter would run all night on a forgotten
// window and quietly become fiction.
export function useHobbsMeter(moduleCode, progress) {
  const owed = useRef(0);       // seconds counted, not yet written down
  const since = useRef(null);   // when the current run of time started
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    if (!moduleCode) return undefined;

    const start = () => { if (since.current === null) since.current = Date.now(); };
    const collect = () => {
      if (since.current === null) return;
      owed.current += (Date.now() - since.current) / 1000;
      since.current = null;
    };
    /* WRITE DOWN WHAT IS OWED, AND DO NOT TOUCH THE CLOCK.

       This used to restart the clock itself at the end, which is right for the
       flush timer and WRONG for the teardown that runs when the module is
       left: the refs outlive the effect, so leaving a module parked a fresh
       `since` on the way out and nothing cleared it. The next time a module
       opened, the first flush added every second since the student had LEFT
       the last one — time on the Flight Deck, in the Ready Room, in
       Bookmarks, on a signed-out tab. That is the meter reading hours for an
       account that has studied for minutes.

       So restarting is the caller's decision. `tick` does it because it is
       still inside the module; the teardown does not, because it is not. */
    const write = () => {
      collect();
      const secs = Math.floor(owed.current);
      // Whole seconds go to the store and the remainder stays on the clock,
      // so flushing often does not round the meter down every time.
      if (secs >= 1) {
        owed.current -= secs;
        const p = progressRef.current;
        const all = p.get(HOBBS_KEY, {});
        p.set(HOBBS_KEY, { ...all, [moduleCode]: (all[moduleCode] || 0) + secs });
        // "Last flown" is the same event as time on the meter, so it is
        // stamped by the same writer. It had only one, in the old chapters
        // panel, which the module screen replaced — so the deck told everyone
        // this was their first flight no matter how much they had flown.
        const now = new Date();
        p.set(LAST_FLOWN_KEY, now.toISOString());
        // Same event, same writer: a day on which the meter ran is a day flown.
        const days = bumpDay(p.get(DAYS_KEY, null), now);
        if (days !== p.get(DAYS_KEY, null)) p.set(DAYS_KEY, days);
      }
    };
    // The flush that happens while the module is still open: write, then keep
    // counting.
    const tick = () => { write(); if (!document.hidden) start(); };
    const onVisibility = () => { if (document.hidden) collect(); else start(); };

    if (!document.hidden) start();
    const timer = setInterval(tick, FLUSH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", write);

    return () => {
      // The module is being left. Bank what is owed, then stop the clock dead
      // and drop the sub-second remainder, so nothing from outside a module —
      // and nothing belonging to this module — can land on the next one.
      write();
      since.current = null;
      owed.current = 0;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", write);
    };
  }, [moduleCode]);
}

// What the meter has counted for one module.
export const hobbsSeconds = (store, moduleCode) => (store || {})[moduleCode] || 0;

// HOURS AND MINUTES, AS DIGITS ONLY. 13:54.
//
// Two reversals live in this comment, and both are the owner's.
//
// FIRST, it read in tenths on a drum — 0013.9 — "because that is what an hour
// meter reads and what the hours in a logbook are written in". That went
// because nobody outside a cockpit reads a tenth: .9 of an hour is a number
// you have to convert before it means anything, and this cell is read by
// somebody deciding whether they have done enough today.
//
// SECOND, it printed its own unit letters — 13h 54m. Those are gone too: the
// cell is a meter, the caption under it already says what is being measured,
// and the letters were the only thing on the instrument that was not a
// number. So it is h:mm, minutes always two digits, the way every other
// counter a student has ever read is written. `spoken` still carries words,
// because a screen reader hearing "13 colon 54" learns nothing.
//
// ALWAYS DOWN, which is the one rule that survives. A meter that rounded up
// would credit time nobody has flown. Under a minute it has not started, and
// the cell says so in words rather than showing 0m — no zero counts
// (CLAUDE.md, Voice).
export const hobbsClock = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const flown = s >= 60;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    h,
    m,
    flown,
    // What is drawn: digits and one colon, nothing else. Under an hour it
    // still reads 0:54 rather than dropping to bare minutes — a meter that
    // changes shape at an hour is two instruments — and under a minute it is
    // an em dash, because a meter reading 0:00 is a zero count (CLAUDE.md,
    // Voice) and the caption beside it already says "Your first hour". Same
    // dash the licence card's Hours flown uses, for the same reason.
    reads: !flown ? '—' : `${h}:${String(m).padStart(2, '0')}`,
    // What a screen reader hears: words, plurals that agree, and no trailing
    // "0 minutes" on the hour.
    spoken: !flown ? 'under a minute'
      : h ? (m ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(h, 'hour'))
      : plural(m, 'minute'),
  };
};
