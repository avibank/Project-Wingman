import { useEffect } from "react";

// The document title is the browser tab, the bookmark and the history entry —
// all real-user surfaces, so setting it from React is fine. The og: block is
// not: that one has to be static in index.html, because link-preview bots do
// not run the bundle.

export const SITE = "Wingman";

// The home page keeps the em-dash form. It is the only exception to the
// middot pattern below.
export const HOME_TITLE = "Wingman — Aircraft Maintenance Study";

// {Child} · {Parent} · Wingman, collapsing to {Page} · Wingman when there is
// no parent. Empty parts drop out, so formatTitle("Hydraulics", "Module 1")
// gives the three-part shape and formatTitle("Licence") gives the two-part one.
export function formatTitle(...parts) {
  return [...parts.filter(Boolean), SITE].join(" · ");
}

const PROFILE_TAB = {
  appearance: "Appearance",
  preferences: "Preferences",
  licence: "Licence",
};

export function titleForRoute(route) {
  if (!route) return HOME_TITLE;
  switch (route.name) {
    case "home":
      return HOME_TITLE;
    case "profile":
      return formatTitle(PROFILE_TAB[route.tab]);
    case "signin":
      return formatTitle("Sign in");
    case "features":
      return formatTitle("Admin");

    /* THE APP'S OWN PAGES HAVE NAMES ALREADY. These are not invented copy and
       not content: each string is the label the page is reached by or headed
       with -- Modules, Logbook and Ready Room are RootNav's own labels, Saved
       is the bookmarks h1, and Wrong bay is what the 404 says. Every one of
       these routes was falling through to the site title, so a tab, a
       bookmark and a history entry for the Ready Room were indistinguishable
       from the Flight Deck. */
    case "modules":
      return formatTitle("Modules");
    case "logbook":
      return formatTitle("Logbook");
    case "ready":
      return formatTitle("Ready Room");
    case "saved":
      return formatTitle("Saved");
    case "notfound":
      return formatTitle("Wrong bay");
    /* Settings was falling through with the rest, and it does not belong with
       them: "Settings" is this app's own name for the page, the same kind of
       fact as Modules and Ready Room, not content it has no access to. */
    case "settings":
      return formatTitle("Settings");
    /* The squadron's own name is not known until the token resolves, and this
       is often the first page a new student sees. The heading it renders is
       what the tab says. */
    case "invite":
      return formatTitle("You were invited");
    /* The paper's own name is content and this file has none, but "Paper" is
       the surface's name and beats the site title for a tab somebody has left
       open beside four others. */
    case "paper":
      return formatTitle("Paper");

    default:
      // Module, chapter and lesson titles still fall through, and deliberately.
      // Those names are CONTENT, this file has no access to it, and the rule
      // against inventing chapter copy applies to a browser tab as much as to
      // a page. formatTitle already supports the three-part shape for when
      // that copy exists.
      return HOME_TITLE;
  }
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
