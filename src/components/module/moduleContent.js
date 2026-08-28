// The one place the screen meets content.
//
// Two sources, one shape. When content.test is on the app loads the seeded
// file; otherwise it reads whatever data.js holds. The screens cannot tell
// the difference, which is the point — replacing placeholder content with
// real content is a data change here and nowhere else.
//
// The seeded file is imported DYNAMICALLY. A static import bundles it into
// the main chunk and every visitor downloads it whether the flag is on or
// not — measured at 21KB, and the brief is explicit that no placeholder
// string should reach the app at all. This way it is a separate chunk that is
// only ever fetched by someone who has turned the flag on.
import { MODULES, chaptersForModule } from "../../data.js";
import { loadContent } from "../../lib/contentLoader.js";

let cache = null;
let pending = null;

export function testContentSync() {
  return cache;
}

export function loadTestContent() {
  if (cache) return Promise.resolve(cache);
  pending ||= import("../../content/test-content.json")
    .then((m) => { cache = loadContent(m.default); return cache; });
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

export function papersFor(code, content) {
  return content ? moduleByCode(code, content).papers : [];
}

export function allModules(content) {
  return content ? content.modules : MODULES;
}
