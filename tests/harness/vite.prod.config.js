/* The harness, built for production and served by `vite preview`.
 *
 * Frame timings mean nothing on the dev server: React's development build does
 * several times the work per commit, and the transition walk measured frames
 * that production never has. This is the same app with the same fixtures —
 * identity stubbed, the database in memory — minified.
 *
 *   npm run harness:prod, then:
 *   VT_BASE=http://127.0.0.1:5191 VT_GPU=1 VT_CPU=4 VT_FRAMES=1 npm run test:vt
 *
 * Its own port, and its Supabase client pointed at that port: the dev config
 * points the client at 5190, so a build served anywhere else would read the dev
 * server's store while a test wrote its preferences here. The test paper is
 * added under import.meta.env.DEV only, so the walk skips the reader.
 */
import { fileURLToPath } from "node:url";
import base from "./vite.config.js";
import { postgrestMiddleware } from "./postgrest.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PORT = 5191;

export default {
  ...base,
  define: { ...base.define, "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(`http://127.0.0.1:${PORT}`) },
  plugins: [...base.plugins, {
    name: "harness-postgrest-preview",
    configurePreviewServer(server) { server.middlewares.use(postgrestMiddleware()); },
  }],
  build: { outDir: `${HERE}dist`, emptyOutDir: true },
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
};
