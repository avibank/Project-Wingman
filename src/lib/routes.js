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
//   /ready                       ready room
//   /ready/:module               ready room, filtered
//   /logbook  /saved  /settings  /settings/:page  /signin
//   /licence  /preferences  /appearance     the three profile tabs (§6)

export const CHAPTER_TABS = ["brief", "quiz", "comments"];

const clean = (p) => (p || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

export function parseRoute(pathname) {
  const parts = clean(pathname).split("/").filter(Boolean);

  if (!parts.length) return { name: "home" };

  if (parts[0] === "m") {
    const moduleCode = (parts[1] || "").toUpperCase();
    if (!moduleCode) return { name: "modules" };
    if (!parts[2]) return { name: "module", moduleCode, tab: "chapters" };
    if (parts[2] === "library") return { name: "module", moduleCode, tab: "pdf" };
    const chapterId = parts[2];
    const tab = CHAPTER_TABS.includes(parts[3]) ? parts[3] : "brief";
    // §2.2 — a single question is permanent and shareable.
    const question = parts[3] === "q" && parts[4] ? Number(parts[4]) : null;
    if (question) return { name: "chapter", moduleCode, chapterId, tab: "quiz", question };
    return { name: "chapter", moduleCode, chapterId, tab };
  }

  if (parts[0] === "ready") return { name: "ready", moduleCode: parts[1] ? parts[1].toUpperCase() : null };
  if (parts[0] === "logbook") return { name: "logbook" };
  if (parts[0] === "saved") return { name: "saved" };
  if (parts[0] === "signin") return { name: "signin" };
  if (parts[0] === "settings") return { name: "settings", page: parts[1] || "index" };
  if (parts[0] === "modules") return { name: "modules" };
  // §6 — the profile's three tabs are real URLs, not a tab state.
  if (["licence", "preferences", "appearance"].includes(parts[0])) return { name: "profile", tab: parts[0] };

  return { name: "notfound", pathname: clean(pathname) };
}

export const path = {
  home: () => "/",
  modules: () => "/modules",
  module: (m) => `/m/${String(m).toLowerCase()}`,
  library: (m) => `/m/${String(m).toLowerCase()}/library`,
  chapter: (m, c, tab) =>
    `/m/${String(m).toLowerCase()}/${c}` + (tab && tab !== "brief" ? `/${tab}` : ""),
  question: (m, c, n) => `/m/${String(m).toLowerCase()}/${c}/q/${n}`,
  ready: (m) => (m ? `/ready/${String(m).toLowerCase()}` : "/ready"),
  logbook: () => "/logbook",
  saved: () => "/saved",
  settings: (page) => (page && page !== "index" ? `/settings/${page}` : "/settings"),
  signin: () => "/signin",
  profile: (tab) => `/${["licence", "preferences", "appearance"].includes(tab) ? tab : "licence"}`,
};
