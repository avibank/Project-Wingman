// §2.2 — real URLs. Kept as a pure parser plus pure builders, free of any React
// or router import, so the whole URL contract can be checked without mounting
// anything and so the app never constructs a path by hand.
//
//   /                            home
//   /m/:module                   module (chapters)
//   /m/:module/library           module library
//   /m/:module/crew              module crew
//   /m/:module/paper/:paper      one paper, in the reader
//   /m/:module/:chapter          chapter, brief
//   /m/:module/:chapter/quiz
//   /m/:module/:chapter/comments
//   /m/:module/library/cards/:chapter   one chapter quiz, as study cards
//   /ready-room                  ready room
//   /ready-room/:module          ready room, filtered
//   /bookmarks                   everything this student saved
//   /bookmarks/:folder           one folder of it
//   /logbook  /signin
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
//
// /saved and /settings are here for the bookmarks pass. The old Saved screen
// became Bookmarks, and Settings was retired into the two tabs that already
// held its contents — so both of their addresses resolve here rather than
// 404ing somebody's bookmark or a link in a group chat.
const LEGACY = {
  "/appearance": "/account/appearance",
  "/preferences": "/account/preferences",
  "/licence": "/account/licence",
  "/saved": "/bookmarks",
  "/settings": "/bookmarks",
};

// The four folders, and the only slugs /bookmarks/:folder accepts. Anything
// else is somebody's typo and goes to Bookmarks rather than to a dead end.
export const BOOKMARK_FOLDERS = ["questions", "cards", "videos", "pages"];

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

  /* §6 — THE INVITE LINK, and it is deliberately the shortest path in the app.
     wingman.institute/j/<token>. Most people arrive this way: a classmate
     pastes it into the group chat they already have, so it has to survive
     being retyped, and it is matched case-insensitively for the same reason.
     Signed out, the app routes through sign-in and comes back here. */
  if (parts[0] === "j" && parts[1]) {
    return { name: "invite", token: parts[1] };
  }

  if (parts[0] === "m") {
    const moduleCode = (parts[1] || "").toUpperCase();
    if (!moduleCode) return { name: "modules" };
    if (!parts[2]) return { name: "module", moduleCode, tab: "chapters" };
    // The Library's two halves are separate addresses: a student sharing the
    // quizzes record should not land on the papers.
    if (parts[2] === "library") {
      // A card set is its own page, with its own back link to the Library it
      // was filed in, so it is a route rather than a third sub-tab.
      if (parts[3] === "cards") {
        const chapter = Number(parts[4]);
        return chapter >= 1 ? { name: "cards", moduleCode, chapter }
                            : { name: "redirect", to: `/m/${moduleCode.toLowerCase()}/library` };
      }
      return { name: "module", moduleCode, tab: "pdf", sub: parts[3] === "quizzes" ? "quizzes" : "papers" };
    }
    if (parts[2] === "crew") return { name: "module", moduleCode, tab: "crew" };
    if (parts[2] === "people") return { name: "module", moduleCode, tab: "people" };
    // A paper is its own page, and its address carries the paper so a student
    // can send a classmate the handout they are looking at rather than the
    // Library it is filed in.
    if (parts[2] === "paper" && parts[3]) return { name: "paper", moduleCode, paperId: parts[3] };

    if (parts[2] === "caution") return { name: "review", moduleCode, flow: "caution" };
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
    // "…/quiz/resume" means put me back inside the run, not on its cover.
    if (parts[3] === "quiz" && parts[4] === "resume")
      return { name: "chapter", moduleCode, chapterId, tab: "quiz", resume: true };
    return { name: "chapter", moduleCode, chapterId, tab };
  }

  // The third part is a question. The room's Share has always copied
  // /ready-room/<module>/<thread>, and this dropped the thread, so a shared
  // link opened the module and left the reader to find the question.
  if (parts[0] === "ready-room") {
    return { name: "ready", moduleCode: parts[1] ? parts[1].toUpperCase() : null, threadId: parts[1] && parts[2] ? parts[2] : null };
  }
  if (parts[0] === "logbook") return { name: "logbook" };
  if (parts[0] === "signin") return { name: "signin" };
  /* A folder nobody recognises is not a 404 — it is Bookmarks. The brief is
     explicit that /bookmarks/<nonsense> lands on Bookmarks rather than a dead
     end, and a redirect is how every other renamed path here does it. */
  if (parts[0] === "bookmarks") {
    if (!parts[1]) return { name: "bookmarks", folder: null };
    return BOOKMARK_FOLDERS.includes(parts[1])
      ? { name: "bookmarks", folder: parts[1] }
      : { name: "redirect", to: "/bookmarks" };
  }
  // The old profile screen is gone; the licence replaced it.
  if (parts[0] === "settings" && parts[1] === "profile") return { name: "redirect", to: "/account/licence" };
  // Settings itself is gone. /settings is in LEGACY above; a deeper one lands
  // in the same place rather than on a page that no longer exists.
  if (parts[0] === "settings") return { name: "redirect", to: "/bookmarks" };
  if (parts[0] === "modules") return { name: "modules" };
  // §6 — the profile's three tabs are real URLs, not a tab state. They sit
  // under /account now; settings should not sit at the root.
  if (parts[0] === "account" && PROFILE_TABS.includes(parts[1])) return { name: "profile", tab: parts[1] };

  return { name: "notfound", pathname: clean(pathname) };
}

export const path = {
  home: () => "/",
  modules: () => "/modules",
  module: (m) => `/m/${String(m).toLowerCase()}`,
  library: (m, sub) => `/m/${String(m).toLowerCase()}/library` + (sub === "quizzes" ? "/quizzes" : ""),
  lesson: (m, c, l, q) =>
    `/m/${String(m).toLowerCase()}/${c}/lesson/${l}` + (q ? `/q/${q}` : ""),
  crew: (m) => `/m/${String(m).toLowerCase()}/crew`,
  people: (m) => `/m/${String(m).toLowerCase()}/people`,
  paper: (m, id) => `/m/${String(m).toLowerCase()}/paper/${id}`,
  chapter: (m, c, tab) =>
    `/m/${String(m).toLowerCase()}/${c}` + (tab && tab !== "brief" ? `/${tab}` : ""),
  question: (m, c, n) => `/m/${String(m).toLowerCase()}/${c}/q/${n}`,
  quizResume: (m, c) => `/m/${String(m).toLowerCase()}/${c}/quiz/resume`,
  review: (m, flow) => `/m/${String(m).toLowerCase()}/${flow}`,
  ready: (m, threadId) => (m ? `/ready-room/${String(m).toLowerCase()}${threadId ? `/${threadId}` : ""}` : "/ready-room"),
  logbook: () => "/logbook",
  bookmarks: (folder) => "/bookmarks" + (BOOKMARK_FOLDERS.includes(folder) ? `/${folder}` : ""),
  cards: (m, chapter) => `/m/${String(m).toLowerCase()}/library/cards/${chapter}`,
  signin: () => "/signin",
  invite: (token) => `/j/${token}`,
  profile: (tab) => `/account/${PROFILE_TABS.includes(tab) ? tab : "licence"}`,
};
