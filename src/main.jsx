/* FIRST, BEFORE ANY OTHER MODULE EVALUATES: in the demo, localStorage becomes
   a copy in memory (src/demo/boot.js). Imports run in order, so this line
   has to stay above every other one. Outside the demo it does nothing. */
import "./demo/boot.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { sweepStorage } from "./lib/storage.js";

/* BEFORE ANYTHING READS STORAGE. The epoch sweep takes the old course's state
   off a tester's device — see storage.js. It has to run here rather than in an
   effect: flags.js reads `pw-flags` and UserProgressProvider reads its keys
   while the first render is still being built, so a sweep in a component would
   clear them one frame too late and the first paint would be the old app. */
sweepStorage();

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
