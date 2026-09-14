import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

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
