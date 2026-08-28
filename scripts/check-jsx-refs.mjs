// Every component used in JSX must be imported or defined in the same file.
//
// eslint's no-undef does not see JSX element names, and eslint-plugin-react
// (which has jsx-no-undef) is not installed. So <RouteError> with no import
// passes lint, builds cleanly, and throws "RouteError is not defined" the
// moment the page renders — which is exactly what happened, and is the same
// class of bug as the setAccentColor incident the eslint config was written
// for. This closes it without adding a dependency.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// Anything React itself provides, plus the lowercase host elements we skip.
const BUILTIN = new Set(["Fragment", "Suspense", "StrictMode", "Profiler"]);
const fails = [];
let files = 0, used = 0;

for (const f of walk("src").filter((x) => x.endsWith(".jsx"))) {
  const src = readFileSync(f, "utf8");
  files++;
  // Strip strings and comments so a component name inside prose or a CSS
  // template does not count as a usage.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

  // Collect every name this file brings into scope, then ask whether each JSX
  // element is one of them. Matching per-name with a regex cannot see a name
  // in the middle of `import { A, B, C }`, which is most of them.
  const scope = new Set();
  for (const [, names] of code.matchAll(/import\s+(?:[A-Za-z0-9_$]+\s*,\s*)?\{([^}]*)\}\s+from/g)) {
    for (const part of names.split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) scope.add(n);
    }
  }
  for (const [, n] of code.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|from)/g)) scope.add(n);
  for (const [, n] of code.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) scope.add(n);

  for (const [, n] of code.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) {
    if (BUILTIN.has(n)) continue;
    used++;
    if (!scope.has(n)) fails.push(`${f}: <${n}> is used but never imported or defined`);
  }
}

console.log(`jsx: ${used} component usages across ${files} files`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `UNDEFINED COMPONENTS: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
