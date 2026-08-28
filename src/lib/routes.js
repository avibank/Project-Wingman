// §2.2 — real URLs. Kept as a pure parser plus pure builders, free of any React
// or router import, so the whole URL contract can be checked without mounting
// anything and so the app never constructs a path by hand.
//
//   /                            home
//   /m/:module                   module (chapters)
//   /m/:module/library           module library
//   /m/:module/:chapter          chapter, brief
//   /m/:module/:chapter/quiz
//   /m/:module/:chapter/comments
//   /ready-room                  ready room
//   /ready-room/:module          ready room, filtered
//   /logbook  /saved  /settings  /settings/:page  /signin
//   /account/licence  /account/preferences  /account/appearance
//                                the three profile tabs (§6)
//   /admin                       the flag panel, admin only
//
// The last three groups were renamed. Every old path still resolves: it comes
// back as { name: "redirect", to } and the app replaces the URL, and
// vercel.json carries the same map as a 308 so a bookmarked link is fixed at
// the edge without ever reaching the bundle.

export const CHAPTER_TABS = ["brief", "quiz", "comments"];

export const PROFILE_TABS = ["licence", "preferences", "appearance"];

// Renamed in the metadata pass. Nothing that used to work may 404.
const LEGACY = {
  "/appearance": "/account/appearance",
  "/preferences": "/account/preferences",
  "/licence": "/account/licence",
  "/features": "/admin",
};

const clean = (p) => (p || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

export function parseRoute(pathname) {
  const here = clean(pathname);
  const parts = here.split("/").filter(Boolean);

  if (!parts.length) return { name: "home" };

  if (LEGACY[here]) return { name: "redirect", to: LEGACY[here] };
  // /ready and /ready/:module both move under /ready-room.
  if (parts[0] === "ready") {
    return { name: "redirect", to: "/ready-room" + (parts[1] ? `/${parts[1]}` : "") };
  }

  if (parts[0] === "m") {
    const moduleCode = (parts[1] || "").toUpperCase();
    if (!moduleCode) return { name: "modules" };
    if (!parts[2]) return { name: "module", moduleCode, tab: "chapters" };
    if (parts[2] === "library") return { name: "module", moduleCode, tab: "pdf" };
    if (parts[2] === "people") return { name: "module", moduleCode, tab: "people" };
    const chapterId = parts[2];
    // A lesson is its own page, and its address carries the question that was
    // opened to reach it — "Watch at 6:12" from People has to land on the
    // right lesson with the right question already open, and a URL that
    // cannot say which question cannot do that.
    if (parts[3] === "lesson" && parts[4]) {
      return { name: "lesson", moduleCode, chapterId, lessonId: parts[4],
               question: parts[5] === "q" && parts[6] ? parts[6] : null };
    }
    const tab = CHAPTER_TABS.includes(parts[3]) ? parts[3] : "brief";
    // §2.2 — a single question is permanent and shareable.
    const question = parts[3] === "q" && parts[4] ? Number(parts[4]) : null;
    if (question) return { name: "chapter", moduleCode, chapterId, tab: "quiz", question };
    return { name: "chapter", moduleCode, chapterId, tab };
  }

  if (parts[0] === "ready-room") return { name: "ready", moduleCode: parts[1] ? parts[1].toUpperCase() : null };
  if (parts[0] === "logbook") return { name: "logbook" };
  if (parts[0] === "saved") return { name: "saved" };
  if (parts[0] === "signin") return { name: "signin" };
  // The old profile screen is gone; the licence replaced it.
  if (parts[0] === "settings" && parts[1] === "profile") return { name: "redirect", to: "/account/licence" };
  if (parts[0] === "settings") return { name: "settings", page: parts[1] || "index" };
  if (parts[0] === "modules") return { name: "modules" };
  // §6 — the profile's three tabs are real URLs, not a tab state. They sit
  // under /account now; settings should not sit at the root.
  if (parts[0] === "account" && PROFILE_TABS.includes(parts[1])) return { name: "profile", tab: parts[1] };
  if (parts[0] === "admin") return { name: "features" };

  return { name: "notfound", pathname: clean(pathname) };
}

export const path = {
  home: () => "/",
  modules: () => "/modules",
  module: (m) => `/m/${String(m).toLowerCase()}`,
  library: (m) => `/m/${String(m).toLowerCase()}/library`,
  lesson: (m, c, l, q) =>
    `/m/${String(m).toLowerCase()}/${c}/lesson/${l}` + (q ? `/q/${q}` : ""),
  people: (m) => `/m/${String(m).toLowerCase()}/people`,
  chapter: (m, c, tab) =>
    `/m/${String(m).toLowerCase()}/${c}` + (tab && tab !== "brief" ? `/${tab}` : ""),
  question: (m, c, n) => `/m/${String(m).toLowerCase()}/${c}/q/${n}`,
  ready: (m) => (m ? `/ready-room/${String(m).toLowerCase()}` : "/ready-room"),
  logbook: () => "/logbook",
  saved: () => "/saved",
  settings: (page) => (page && page !== "index" ? `/settings/${page}` : "/settings"),
  signin: () => "/signin",
  features: () => "/admin",
  profile: (tab) => `/account/${PROFILE_TABS.includes(tab) ? tab : "licence"}`,
};
