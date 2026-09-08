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

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: ROOT,
  publicDir: `${ROOT}/public`,
  plugins: [
    react(),
    {
      name: "harness-postgrest",
      configureServer(server) { server.middlewares.use(postgrestMiddleware()); },
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
