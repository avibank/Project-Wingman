// The one place the screen meets content.
//
// Two sources, one shape. When content.test is on the app loads the seeded
// file; otherwise it reads whatever data.js holds. The screens cannot tell
// the difference, which is the point — replacing placeholder content with
// real content is a data change here and nowhere else.
//
// content.test is ON FOR EVERYONE again (2026-09-21): the document holds the
// course now — Module 13d's first chapter — rather than placeholder material,
// so every visitor fetches the chunk below. It stays a dynamic import for the
// reason that follows, which is about the entry chunk's size, not about
// hiding anything.
//
// The seeded file is imported DYNAMICALLY. A static import bundles it into
// the main chunk and every visitor downloads it whether the flag is on or
// not — measured at 21KB, and the brief is explicit that no placeholder
// string should reach the app at all. This way it is a separate chunk that is
// only ever fetched by someone who has turned the flag on.
import { MODULES, chaptersForModule } from "../../data.js";
import { loadContent } from "../../lib/contentLoader.js";
import { demoMode } from "../../demo/mode.js";
import { reloadOnce } from "../../lib/recover.js";
import { fetchLiveCourse } from "../../lib/courseStore.js";
import { flagDefault, readOverrides } from "../../lib/flags.js";

let cache = null;
let pending = null;
let liveVersion = null;
/* Read once, at module scope: the switch that takes the published course out
   of the path entirely if it ever misbehaves, without a deploy. */
const liveContentOn = (() => {
  /* An admin's own override wins; everybody else gets the flag's default.
     Read once here rather than through useFlags, because this module is not
     a component and the answer cannot change inside a page load. */
  const ov = readOverrides();
  return "content.live" in ov ? ov["content.live"] !== false : flagDefault("content.live", false);
})();

export function testContentSync() {
  return cache;
}

/* A FAILED DOWNLOAD IS TRIED AGAIN. It used to be kept: `pending` held the
   rejected promise for the rest of the visit, so one dropped request left
   every screen on its "goes in here" line until a reload (measured on the
   owner's phone, 2026-09-21). Three tries a few seconds apart, then one
   reload (src/lib/recover.js), because a browser may remember a failed
   module and refuse it again without asking the network. */
const importCourse = () => (demoMode ? import("../../demo/content.json") : import("../../content/test-content.json"));
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
async function fetchCourse() {
  for (let n = 0; ; n++) {
    try { return await importCourse(); } catch (err) {
      if (n >= 2) { reloadOnce(); throw err; }
      await wait(1500 * (n + 1));
    }
  }
}
/* WHERE THE COURSE ACTUALLY COMES FROM (migration 0040, 2026-09-30).
   The published document in `course_docs` wins; the document this build
   shipped with is the floor under it. In that order, and never the other way
   round: a publish has to be able to correct a mistake that is already in
   the bundle, and a database that is empty, paused or slow has to end with a
   Library rather than a blank one.

   THE DEMO NEVER READS IT. Its course is its own (src/demo/content.json) and
   the whole point of that state is that nothing outside it is consulted.

   Whatever comes back is validated before it is used — courseStore does that
   — so a bad publish costs a version rather than a class's evening. */
async function courseDocument() {
  if (!demoMode && liveContentOn) {
    const live = await fetchLiveCourse();
    if (live?.doc) { liveVersion = { id: live.id, at: live.at, note: live.note }; return live.doc; }
  }
  const m = await fetchCourse();
  liveVersion = null;
  return m.default;
}

/** Which published version is on screen, or null when it is the shipped one. */
export const publishedVersion = () => liveVersion;

export function loadTestContent() {
  if (cache) return Promise.resolve(cache);
  pending ||= courseDocument()
    .then((doc) => { cache = loadContent(doc); return cache; })
    .catch((err) => { pending = null; throw err; });
  return pending;
}

// `content` is whatever the app has loaded, or null. Every accessor falls back
// to data.js, so the screens render from the moment they mount rather than
// flashing empty while a chunk is in flight.
export function moduleByCode(code, content) {
  if (content) return content.modules.find((m) => m.code === code) || content.modules[0];
  return MODULES.find((m) => m.code === code) || MODULES[0];
}

export function chaptersFor(code, content) {
  if (content) return moduleByCode(code, content).chapters;
  return chaptersForModule(code).map((ch) => ({
    id: ch.id,
    code: ch.code,
    title: ch.title,
    quizCount: ch.quizCount,
    lessons: (ch.lessons || []).map((l) => ({
      id: l.id, code: l.code, title: l.title, duration: l.duration,
    })),
  }));
}

/* The reference paper, in development only.
 *
 * The brief asks for the pdf.js test paper on Module 1 so the annotation layer
 * is exercised against real body text with real repeated phrases. It is not
 * committed — `npm run paper:fetch` puts it in public/papers — so this entry
 * exists only under DEV, and production never points at a file that is not
 * there. Nothing else in the app treats it specially: it is a paper. */
const DEV_PAPER = {
  id: "M1.DEV",
  title: "Trace-based Just-in-Time Type Specialization",
  scope: { module: "M1", chapter: null, lesson: null },
  file: "papers/tracemonkey.pdf",
  pages: 14,
  kind: "PDF",
};

export function papersFor(code, content) {
  const own = content ? moduleByCode(code, content).papers : [];
  if (import.meta.env?.DEV && String(code).toUpperCase() === "M1") {
    return [DEV_PAPER, ...(own || [])];
  }
  return own;
}

export function allModules(content) {
  return content ? content.modules : MODULES;
}
