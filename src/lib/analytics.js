// Four events. Not five, and not a free-text name.
//
// The union is the point: track() accepts only these, so a typo is a thrown
// error at the call site rather than a silent event nobody ever queries. This
// is JavaScript rather than TypeScript, so the union is enforced at runtime
// and by check:analytics rather than by a compiler — the guarantee is the
// same, it just arrives when the line runs instead of when it is written.
//
// session_end is the valuable one. The page people leave from is the page
// that is broken, and no amount of asking your classmates will tell you which.
export const EVENTS = /** @type {const} */ ({
  lesson_progress: ["lessonId", "pct"],
  lesson_replay: ["lessonId", "fromPct", "toPct"],
  question_unanswered: ["questionId", "lessonId", "ageHours"],
  session_end: ["route", "seconds"],
});

const NAMES = Object.keys(EVENTS);
let sink = null;

// Nothing is sent anywhere until a sink is installed. Before the beta there is
// no destination, and events that go nowhere are better than a vendor wired in
// before anyone has decided which one.
export function installSink(fn) { sink = typeof fn === "function" ? fn : null; }

export function track(name, props = {}) {
  if (!NAMES.includes(name)) {
    throw new Error(`Unknown event "${name}". The four are: ${NAMES.join(", ")}`);
  }
  const required = EVENTS[name];
  const missing = required.filter((k) => props[k] === undefined);
  if (missing.length) {
    throw new Error(`Event "${name}" is missing ${missing.join(", ")}`);
  }
  sink?.({ name, props, at: Date.now() });
}

// The one event that cannot be fired from a component, because by the time a
// component knows the session is ending it has already unmounted.
export function trackSessionEnd(getRoute, startedAt) {
  const send = () => {
    try {
      track("session_end", { route: getRoute(), seconds: Math.round((Date.now() - startedAt) / 1000) });
    } catch { /* never let analytics break a page teardown */ }
  };
  // pagehide fires where unload does not, including a phone being backgrounded.
  window.addEventListener("pagehide", send, { once: true });
  return () => window.removeEventListener("pagehide", send);
}
