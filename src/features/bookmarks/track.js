/* The feature's one analytics call, and it is here rather than on the content
   adapter so the saves store can be driven outside a browser: content.js
   imports React, and check:saves runs the store in plain node.

   src/lib/analytics.js keeps a closed union of event names and THROWS on one
   it does not know, which is the point of it — a typo is an error at the call
   site rather than an event nobody ever queries. The six Bookmarks events are
   in that list. The try/catch is not a way round the union: it is there so a
   metric can never take a screen down, and the throw still reaches the console
   in development. */
import { track as appTrack } from "../../lib/analytics.js";

export function track(name, props) {
  try { appTrack(name, props || {}); }
  catch (e) { if (typeof console !== "undefined") console.error("[bookmarks] analytics", e); }
}
