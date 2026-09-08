/* The app against the REAL backend, with only identity stubbed.
 *
 * The fixture harness replaces Postgres, which is right for behaviour tests and
 * useless for proving an upload works — storage is not part of it. This one
 * keeps the real Supabase project and swaps only Clerk, so an upload really
 * goes to the real bucket and the row really lands in the real table.
 *
 * Used deliberately and cleaned up after. Never in the automated suite.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const STUB = fileURLToPath(new URL("../clerkStub.jsx", import.meta.url));

export default defineConfig({
  root: ROOT,
  envDir: ROOT,
  publicDir: `${ROOT}/public`,
  plugins: [react()],
  resolve: { alias: [{ find: /^@clerk\/clerk-react$/, replacement: STUB }] },
  server: { port: 5191, strictPort: true, host: "127.0.0.1" },
});
