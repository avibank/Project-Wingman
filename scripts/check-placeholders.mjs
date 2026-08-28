// Nothing placeholder ships.
//
// The most embarrassing failure available here is a classmate opening Chapter
// 2 and being asked how many minutes are in a day. This greps a PRODUCTION
// BUILD rather than the source, because that is what actually reaches a
// browser: the seeded content is imported behind a flag, and the question is
// whether the bundler dropped it, not whether the file exists on disk.
//
// It fails on: the placeholder papers, Google's sample video bucket, and the
// words that mark test material. Passing does not mean the file is deleted —
// it means nothing in it reaches a user.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const NEEDLES = [
  // Every host the seeded content has ever pointed at. The first one is dead
  // now (403 on every file) but it stays: a check that forgets an old marker
  // stops catching content that was never updated.
  "commondatastorage.googleapis.com",
  "archive.org/download",
  "cc0-videos",
  "placeholder-1-page",
  "PLACEHOLDER",
  "TEST CONTENT",
  "How many minutes are there in a day",
];

if (!existsSync(DIST)) {
  console.log("placeholders: no dist/ — run `npm run build` first");
  process.exit(0);
}

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(DIST).filter((f) => /\.(js|css|html|json)$/.test(f));

// Two very different failures, so they are reported separately.
//   in the main bundle  — every visitor downloads it. A bug now.
//   in its own chunk    — only someone with the flag on fetches it, but the
//                         file still has to be gone before launch.
const shipped = [];
const lazy = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const found = NEEDLES.filter((n) => src.includes(n));
  if (!found.length) continue;
  (/test-content/.test(f) ? lazy : shipped).push(`${f}: ${found.join(", ")}`);
}

console.log(`placeholders: ${files.length} built files scanned for ${NEEDLES.length} markers`);
for (const h of shipped) console.log("  IN MAIN BUNDLE  " + h);
for (const h of lazy) console.log("  lazy chunk      " + h);

if (shipped.length) {
  console.log(`PLACEHOLDERS REACH EVERY VISITOR: ${shipped.length}`);
  process.exitCode = 1;
} else if (lazy.length) {
  // Not a failure today. It is the launch gate: --ship makes it one.
  const gate = process.argv.includes("--ship");
  // content.test is ON for everyone, so this chunk is not merely present in
  // the build — every visitor fetches it and the app is showing placeholder
  // lessons, papers and questions to whoever opens a module. That is a
  // deliberate state and it has to be loud, because the failure mode is
  // forgetting it and launching on top of it.
  console.log(gate
    ? "PLACEHOLDER CONTENT IS BEING SERVED — replace the content file before launch"
    : "SHIPPING placeholder content deliberately — not in the main bundle, but live to every visitor. `npm run check:ship` is the gate.");
  if (gate) process.exitCode = 1;
} else {
  console.log("CLEAN");
}
