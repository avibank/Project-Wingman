/* FIRST, BEFORE ANY OTHER MODULE EVALUATES: in the demo, localStorage becomes
   a copy in memory (src/demo/boot.js). Imports run in order, so this line
   has to stay above every other one. Outside the demo it does nothing. */
import "./demo/boot.js";
import { installRecovery } from "./lib/recover.js";
import { watchLayout } from "./lib/canary.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { sweepStorage } from "./lib/storage.js";
/* LAST, so its one rule closes the stylesheet the build emits. recover.js
   reads that rule to tell a whole stylesheet from one that was cut short. */
import "./sheet-end.css";

/* BEFORE ANYTHING READS STORAGE. The epoch sweep takes the old course's state
   off a tester's device — see storage.js. It has to run here rather than in an
   effect: flags.js reads `pw-flags` and UserProgressProvider reads its keys
   while the first render is still being built, so a sweep in a component would
   clear them one frame too late and the first paint would be the old app. */
sweepStorage();

/* A stylesheet that failed to download is fetched again, or the page reloads
   once (src/lib/recover.js). Before the first render, so a page that arrived
   without its stylesheet is mended before anybody sees it. */
installRecovery();
/* And three seconds in, whether the stylesheet's rules are actually in force,
   with a line in `reports` if they are not (src/lib/canary.js). */
watchLayout();

const root = ReactDOM.createRoot(document.getElementById("root"));

/* The Back on the ground harness, at ?bog=1 in development only. Nothing links
   to it, and the DEV guard comes first so a production build drops this branch
   and the import inside it. */
if (import.meta.env.DEV && new URLSearchParams(location.search).has("bog")) {
  import("./dev/GroundHarness.jsx").then((m) => root.render(React.createElement(m.GroundHarness)));
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

/* A STALE CHUNK AFTER A DEPLOY, CAUGHT AT THE WINDOW. `chunk()` in App.jsx
   already catches a lazy SCREEN failing to arrive and reloads once; Vite also
   raises `vite:preloadError` for a stylesheet or module preload that 404s,
   which is the shape the owner hit — "Unable to preload CSS for
   /assets/LibraryBatches-….css" — and which no screen's own catch sees if it
   fires before the import rejects. Same budget as the other: one reload per
   tab-incident, guarded in sessionStorage so it can never loop, and the guard
   is cleared by App.jsx the moment any chunk loads. */
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => {
    let already = true;
    try { already = sessionStorage.getItem("pw-chunk-reloaded") === "1"; } catch { /* private mode */ }
    if (already) return;
    try { sessionStorage.setItem("pw-chunk-reloaded", "1"); } catch { return; }
    e.preventDefault();
    window.location.reload();
  });
}
