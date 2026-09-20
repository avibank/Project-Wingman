import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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

/* AND THE ORPHANED pdf.js WORKER GOES WITH THEM.
   With papers paused (VITE_PAPERS_READER unset) Rollup shakes the reader and
   pdf.js out of the build entirely — no ReaderV6 chunk, no paperText chunk,
   nothing naming either in the entry. The worker is the one thing that
   survives, because `?url` imports are EMITTED when a module is transformed
   and the tree-shaking that drops its importer happens afterwards. 1.3MB of
   pdf.js nobody can reach, deployed. Removed by the same rule as the reference
   pages: if the build ships it, something has to be able to ask for it. */
const noOrphanWorker = {
  name: "no-orphan-pdf-worker",
  apply: "build",
  closeBundle() {
    const dir = new URL("./dist/assets/", import.meta.url);
    let names = [];
    try { names = readdirSync(dir); } catch { return; }
    const worker = names.filter((n) => /^pdf\.worker(\.|-)/.test(n));
    if (!worker.length) return;
    /* Only when nothing asks for it. With the switch ON the reader's chunk
       names it, and removing it would be breaking the reader rather than
       tidying the build. */
    const asked = names.some((n) => (n.endsWith(".js") || n.endsWith(".mjs") || n.endsWith(".css"))
      && !/^pdf\.worker/.test(n)
      && statSync(new URL(n, dir)).isFile()
      && readFileSync(new URL(n, dir), "utf8").includes("pdf.worker"));
    if (asked) return;
    for (const n of worker) rmSync(new URL(n, dir), { force: true });
  },
};

export default defineConfig({
  /* refRoutes serves the two bookmarks demos at /__ref/bookmarks and
     /__ref/flight-bag. `apply: "serve"` — they are never in a build, which is
     the same rule noRefPagesInProduction enforces for the other four. */
  plugins: [react(), refRoutes(), noRefPagesInProduction, noOrphanWorker],
  build: {
    sourcemap: true,
  },
});
