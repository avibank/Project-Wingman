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
      if (!document.hidden) start();
    };
    const onVisibility = () => { if (document.hidden) collect(); else start(); };

    if (!document.hidden) start();
    const timer = setInterval(write, FLUSH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", write);

    return () => {
      write();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", write);
    };
  }, [moduleCode]);
}

// What the meter has counted for one module.
export const hobbsSeconds = (store, moduleCode) => (store || {})[moduleCode] || 0;

// HOURS AND MINUTES. 13h 54m.
//
// THIS REVERSES A DECISION THIS FILE USED TO ARGUE FOR, and the old argument
// is kept because it was not silly: it read in tenths on a drum — 0013.9 —
// "because that is what an hour meter reads and what the hours in a logbook
// are written in", and a clock face was the one thing it must not be mistaken
// for. What the owner answered is that nobody outside a cockpit reads a
// tenth: .9 of an hour is a number you have to convert before it means
// anything, and this cell is read by somebody deciding whether they have done
// enough today. So it says the thing it means.
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
    // What is drawn. Under an hour it is minutes alone — "0h 54m" spends its
    // widest character saying nothing — and under a minute it is an em dash,
    // because a meter reading 0m is a zero count (CLAUDE.md, Voice) and the
    // caption beside it already says "Your first hour". Same dash the licence
    // card's Hours flown uses, for the same reason.
    reads: !flown ? '—' : h ? `${h}h ${m}m` : `${m}m`,
    // What a screen reader hears: words, plurals that agree, and no trailing
    // "0 minutes" on the hour.
    spoken: !flown ? 'under a minute'
      : h ? (m ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(h, 'hour'))
      : plural(m, 'minute'),
  };
};
