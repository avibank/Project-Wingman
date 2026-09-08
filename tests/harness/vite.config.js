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
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://127.0.0.1:5190"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("harness-anon-key"),
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("pk_test_harness"),
  },
  server: { port: 5190, strictPort: true, host: "127.0.0.1" },
});
