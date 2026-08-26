// Writes one value from the clipboard into .env.local.
//
//   npm run setenv -- VITE_SUPABASE_ANON_KEY
//
// You click "copy" in the dashboard; this reads the clipboard and writes the
// line. The value is never printed, never echoed to a terminal, and never
// passes through a chat message — only a redacted fingerprint is shown, enough
// to tell two keys apart and not enough to use.
//
// It also checks the shape, because the costly mistake here is putting a secret
// key in a VITE_ variable: those are compiled into the bundle every visitor
// downloads, and a Supabase secret key ignores row level security entirely.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const ENV = new URL(".env.local", ROOT);

const SHAPES = {
  VITE_CLERK_PUBLISHABLE_KEY: { ok: /^pk_(test|live)_/, want: "pk_test_… or pk_live_…" },
  CLERK_SECRET_KEY:           { ok: /^sk_/,             want: "sk_…" },
  VITE_SUPABASE_URL:          { ok: /^https:\/\/[\w-]+\.supabase\.(co|in)\/?$/, want: "https://<project>.supabase.co" },
  VITE_SUPABASE_ANON_KEY:     { ok: /^(sb_publishable_|eyJ)/, want: "sb_publishable_… or the legacy anon JWT (eyJ…)" },
  SUPABASE_DB_URL:            { ok: /^postgres(ql)?:\/\//, want: "postgresql://…" },
};

// Anything that must never end up in a browser-visible variable.
const SECRET = /^(sb_secret_|sk_live_|sk_test_)/;

const name = process.argv[2];
if (!name || !SHAPES[name]) {
  console.error("Usage: npm run setenv -- <NAME>\n\nNames:");
  for (const k of Object.keys(SHAPES)) console.error(`  ${k}`);
  process.exit(2);
}

let value;
try {
  value = execFileSync("pbpaste", { encoding: "utf8" }).trim();
} catch {
  console.error("Could not read the clipboard (pbpaste). macOS only.");
  process.exit(1);
}

if (!value) { console.error("Clipboard is empty. Copy the value first."); process.exit(1); }

if (name.startsWith("VITE_") && SECRET.test(value)) {
  console.error(`REFUSED. That looks like a secret key, and ${name} is compiled`);
  console.error("into the bundle every visitor downloads. Copy the publishable one.");
  process.exit(1);
}

const shape = SHAPES[name];
if (!shape.ok.test(value)) {
  console.error(`That does not look like ${name}.`);
  console.error(`  expected: ${shape.want}`);
  console.error(`  clipboard starts: ${value.slice(0, 12)}… (${value.length} chars)`);
  console.error("Nothing was written.");
  process.exit(1);
}

let text = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = `${name}=${value}`;
const re = new RegExp(`^${name}=.*$`, "m");
text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
writeFileSync(ENV, text);

const fp = `${value.slice(0, 6)}…${value.slice(-4)}`;
console.log(`${name} written to .env.local  [${fp}, ${value.length} chars]`);

const missing = Object.keys(SHAPES).filter((k) => !new RegExp(`^${k}=.+$`, "m").test(text));
console.log(missing.length ? `still empty: ${missing.join(", ")}` : "all five values are set");
