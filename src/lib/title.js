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
    default:
      // Module and chapter titles are not specified yet. They get the default
      // rather than an invented string; formatTitle already supports the
      // three-part shape for when that copy is written.
      return HOME_TITLE;
  }
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
