// Shared credential loading for the admin scripts.
//
// Vite reads .env.local itself for anything named VITE_. These scripts are
// plain node and also need the server-side secrets, which deliberately are NOT
// named VITE_ so they can never be compiled into the browser bundle.

import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

let fileEnv = null;
function load() {
  if (fileEnv) return fileEnv;
  fileEnv = {};
  for (const name of [".env.local", ".env"]) {
    const p = new URL(name, ROOT);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (line.trimStart().startsWith("#")) continue;
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
      if (m) fileEnv[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    break;
  }
  return fileEnv;
}

export function env(...keys) {
  const f = load();
  return keys.map((k) => process.env[k] || f[k]).find(Boolean);
}

// Never print a secret in full. Enough to tell two keys apart, not enough to use.
export const redact = (s) => (s ? `${s.slice(0, 8)}…${s.slice(-4)} (${s.length} chars)` : "(unset)");

export function require1(keys, what, where) {
  const v = env(...keys);
  if (!v) {
    console.error(`Missing ${keys[0]} in .env.local.\n\n  ${what}\n  ${where}\n`);
    process.exit(2);
  }
  return v;
}
