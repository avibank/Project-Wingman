// A closed list of events. Not a free-text name.
//
// The union is the point: track() accepts only these, so a typo is a thrown
// error at the call site rather than a silent event nobody ever queries. This
// is JavaScript rather than TypeScript, so the union is enforced at runtime
// and by check:analytics rather than by a compiler — the guarantee is the
// same, it just arrives when the line runs instead of when it is written.
//
// This said "four events, not five" for as long as there were four. Six more
// arrived with Bookmarks, which is the surface a beta has most to learn from —
// what students keep, and whether they ever go back to it. The rule that
// mattered was never the number; it was that the list is closed and named
// here, so check:analytics names all ten rather than counting them.
//
// session_end is still the valuable one. The page people leave from is the
// page that is broken, and no amount of asking your classmates will tell you
// which.
export const EVENTS = /** @type {const} */ ({
  lesson_progress: ["lessonId", "pct"],
  lesson_replay: ["lessonId", "fromPct", "toPct"],
  question_unanswered: ["questionId", "lessonId", "ageHours"],
  session_end: ["route", "seconds"],
  // Bookmarks. `kind` is one of question | card | video | page, and `from`
  // says which screen a run was started from, because "practise these" from a
  // folder and from the home screen are different decisions.
  save_added: ["kind", "moduleId"],
  save_removed: ["kind"],
  practise_started: ["from"],
  test_started: ["from"],
  card_set_opened: ["moduleId", "chapter"],
  bookmarks_opened: ["moduleId"],
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
