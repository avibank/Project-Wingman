import { useEffect, useRef } from "react";

export const HOBBS_KEY = "pw-hobbs";
export const LAST_FLOWN_KEY = "pw-last-flown";

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
        p.set(LAST_FLOWN_KEY, new Date().toISOString());
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

// TENTHS OF AN HOUR, ON A DRUM — 0013.9 — because that is what an hour meter
// reads and what the hours in a logbook are written in. It used to read h:mm,
// which is a clock, and a clock is the one thing this must not be mistaken
// for: the meter counts time flown in this module and nothing else.
//
// Always DOWN. 360 seconds is one tenth, and a meter that rounded up would
// credit time nobody has flown. Four integer digits, zero-padded, and the
// whole thing wraps at 9999.9 the way a real drum does — no student will see
// it, and a number that silently stops counting would be worse.
export const hobbsDrum = (seconds) => {
  const tenths = Math.floor(Math.max(0, seconds || 0) / 360) % 100000;
  const whole = Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return {
    int: String(whole).padStart(4, "0"),
    tenth,
    // What a screen reader says, and what the caption asks: has anything been
    // flown yet at all? Below a tenth the drum reads 0000.0 and the cell says
    // so in words instead.
    reads: `${whole}.${tenth}`,
    flown: tenths > 0,
  };
};
