/* Serves the reference demos at /__ref/* during development only.
   They live in reference/ (checked in) and are never part of a build.

   vite.config.js:
     import { refRoutes } from './tools/vite-ref-routes';
     export default defineConfig({ plugins: [react(), refRoutes()] });
*/
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/* ONE PLACE FOR REFERENCE BUILDS. The drop puts these two at `reference/`;
   this repo already had four of them under `docs/launch/reference/`, numbered,
   and `scripts/scope-ref-css.mjs` and `tools/make-ref-pages.mjs` both read
   from there. A second directory holding the same kind of file is how one of
   them goes stale unnoticed, so the paths point at the existing one and
   nothing else about this file is changed. */
const FILES = {
  '/__ref/bookmarks': 'docs/launch/reference/03-bookmarks-demo.html',
  '/__ref/flight-bag': 'docs/launch/reference/04-flight-bag.html',
};

export function refRoutes() {
  return {
    name: 'wingman-ref-routes',
    apply: 'serve',                       // dev only: never in the production bundle
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0].split('#')[0].replace(/\/$/, '');
        const file = FILES[path];
        if (!file) return next();
        const full = resolve(process.cwd(), file);
        if (!existsSync(full)) { res.statusCode = 404; return res.end(`Reference missing: ${file}`); }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        /* DARK, EXPLICITLY. The demos follow prefers-color-scheme and a
           headless browser reports light, while the app under test is pinned
           to night for the comparison — so without this the diff is 97% of
           two different palettes and says nothing about layout. It is the
           demo choosing its own dark: the value comes from its own
           [data-theme="dark"] block. tools/make-ref-pages.mjs does the same
           for the other four reference builds, for the same reason. */
        res.end(String(readFileSync(full)) +
          /* And the demo bar goes, which is not part of any screen — the same
             rule tools/make-ref-pages.mjs applies to the other four. */
          '\n<style>.demo{display:none!important}</style>' +
          '\n<script>document.documentElement.dataset.theme="dark"</script>\n');
      });
    },
  };
}
