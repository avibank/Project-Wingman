/* The app, with identity and the database replaced by fixtures.
 *
 * Everything else is the real thing: the real bundle, the real Supabase client,
 * the real reader. Only the far end of the wire is ours — see postgrest.js for
 * why that matters more than a stubbed client object would.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { postgrestMiddleware } from "./postgrest.js";
import { refRoutes } from "../../tools/vite-ref-routes.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: ROOT,
  publicDir: `${ROOT}/public`,
  plugins: [
    react(),
    /* The bookmarks demos, at /__ref/bookmarks and /__ref/flight-bag. The
       harness is where scripts/visual-diff.mjs runs, because the fixture data
       it compares against lives here. */
    refRoutes(),
    {
      name: "harness-postgrest",
      configureServer(server) { server.middlewares.use(postgrestMiddleware()); },
    },
    /* /m/:module/l:n -> that module's nth lesson, IN THE HARNESS ONLY.
       ---------------------------------------------------------------------
       tools/ref-diff.mjs was supplied with `/m/m1/l1` as the lesson screen's
       address. This app's is `/m/m1/M1.01/lesson/M1.01.1` — the chapter and
       the lesson both carry their ids, which is what made every lesson URL
       answer Vercel's 404 in production once (BUGS #12) and is not going to
       change for a measuring tool.

       So the short address is resolved HERE rather than in the app: a
       redirect in the test server, which never ships, instead of a product
       route that exists for a diff. The app's router is untouched and
       check:doors still sees one set of addresses. */
    {
      name: "harness-short-lesson",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const m = /^\/m\/([^/?]+)\/l(\d+)(\?.*)?$/.exec(req.url || "");
          if (!m) return next();
          const [, mod, n, query = ""] = m;
          const num = String(n).padStart(2, "0");
          const code = mod.toUpperCase();
          res.statusCode = 302;
          res.setHeader("location", `/m/${mod}/${code}.${num}/lesson/${code}.${num}.1${query}`);
          res.end();
        });
      },
    },
  ],
  resolve: {
    alias: [{ find: /^@clerk\/clerk-react$/, replacement: `${HERE}clerkStub.jsx` }],
  },
  define: {
    // The client talks to this same origin, so the browser makes real requests
    // and Playwright can read the actual response bodies.
    /* Same server, deliberately a different ORIGIN when measuring the real
       manual: `sameOrigin()` in paperText.js decides between pdf.js's own
       loader and this app's range transport, and production always takes the
       second branch because storage is on supabase.co. Pointing the client at
       localhost while the page is served from 127.0.0.1 reproduces that
       without a second server. */
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.HARNESS_STORAGE_ORIGIN ? "http://localhost:5190" : "http://127.0.0.1:5190"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("harness-anon-key"),
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("pk_test_harness"),
  },
  server: {
    port: 5190, strictPort: true, host: "127.0.0.1",
    /* The client's VITE_SUPABASE_URL is rewritten to this origin, so a real
       paper's storage URL resolves here too. When measuring against the real
       manual, storage is proxied through to the real project — Range headers
       and all, which is the point. */
    proxy: process.env.HARNESS_STORAGE_ORIGIN
      ? {
          "/storage": {
            target: process.env.HARNESS_STORAGE_ORIGIN, changeOrigin: true, secure: true,
            configure(proxy) {
              /* Supabase's own CORS, minus the two headers it does not expose —
                 which is exactly the condition that made pdf.js give up on
                 ranging in the first place. Reproducing it is the point. */
              proxy.on("proxyRes", (res) => {
                res.headers["access-control-allow-origin"] = "*";
                res.headers["access-control-allow-headers"] = "range, authorization, apikey";
                delete res.headers["access-control-expose-headers"];
              });
            },
          },
        }
      : undefined,
  },
});
