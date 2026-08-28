// One adapter between whatever ships as content and the shape the screen
// reads. The screen never touches data.js directly, so replacing placeholder
// content with real content is a change here and nowhere else — which is the
// only way the "swapping in real content is a data change, not a code change"
// promise can actually hold.
import { MODULES, chaptersForModule } from "../../data.js";

export function moduleByCode(code) {
  return MODULES.find((m) => m.code === code) || MODULES[0];
}

export function chaptersFor(code) {
  return chaptersForModule(code).map((ch) => ({
    id: ch.id,
    code: ch.code,
    title: ch.title,
    // Quiz count is not in the current content. Left undefined rather than
    // guessed; the row falls back to the brief's stated 8.
    quizCount: ch.quizCount,
    lessons: (ch.lessons || []).map((l) => ({
      id: l.id,
      code: l.code,
      title: l.title,
      duration: l.duration,     // seconds, or undefined until content lands
    })),
  }));
}
