// One string per state, app-wide. Per-screen variants are how an app ends up
// with five ways of saying the same thing.

export const SPOOLING = "Spooling up.";

// For a generic failure. Where a service hands back a specific, actionable
// message — Clerk telling you a username is taken — that message still wins;
// this is the fallback for everything that has nothing useful to say.
export const ERROR_GENERIC = "Something's snagged. Try again.";

// Decided, but nothing uses it yet: the app has no share control, and this
// pass is not allowed to create one. Wire it up when a share entry point
// lands. text and url are deliberately separate — putting the URL inside the
// text makes the link appear twice in WhatsApp.
export const SHARE = {
  text: "Quizzes, papers and lessons for our course. We made the mistakes, you get the answers.",
  url: "https://www.wingman.institute/",
};
