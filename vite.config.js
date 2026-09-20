import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import { refRoutes } from "./tools/vite-ref-routes.js";

/* THE REFERENCE PAGES ARE DEV ONLY. public/__ref/ holds the two handed-over
   reference builds split one page per screen (tools/make-ref-pages.mjs), so
   tools/ref-diff.mjs can photograph the design and the live screen side by
   side. Vite copies everything in public/ into the build, which would put a
   quarter of a megabyte of demo HTML — with its own sample people and a demo
   bar — on wingman.institute. This takes it back out after the copy. */
const noRefPagesInProduction = {
  name: "no-ref-pages-in-production",
  apply: "build",
  closeBundle() {
    rmSync(new URL("./dist/__ref", import.meta.url), { recursive: true, force: true });
  },
};

export default defineConfig({
  /* refRoutes serves the two bookmarks demos at /__ref/bookmarks and
     /__ref/flight-bag. `apply: "serve"` — they are never in a build, which is
     the same rule noRefPagesInProduction enforces for the other four. */
  plugins: [react(), refRoutes(), noRefPagesInProduction],
  build: {
    sourcemap: true,
  },
});
