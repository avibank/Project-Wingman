import { defineConfig, devices } from "@playwright/test";

/* Point baseURL at the dev server; the harness lives at /?bog=1 and is not linked
   from anywhere in the app. */
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: {
    baseURL: process.env.BOG_BASE || "http://localhost:5173",
    viewport: { width: 1280, height: 1000 },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.BOG_BASE || "http://localhost:5173",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
