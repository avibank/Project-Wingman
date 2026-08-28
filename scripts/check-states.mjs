// Loading, empty, error — the three states every route has to have an answer
// for. The brief calls this "the single test most likely to catch what
// actually turns people off", and it is right: none of the three is the happy
// path, and all three are what a student meets on a bad connection.
//
// There is no browser driver here, so this checks that the answers EXIST and
// are wired, rather than rendering each route three ways. It says so plainly
// rather than implying more coverage than it has.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const src = (f) => readFileSync(f, "utf8");
const all = walk("src").filter((f) => /\.jsx?$/.test(f));
const app = src("src/App.jsx");
const fails = [];

// 1 · Loading — a skeleton in the shape of the page, never a spinner on blank.
if (!/PageSkeleton/.test(app)) fails.push("no loading skeleton");
if (!/<Suspense/.test(app)) fails.push("nothing catches a route chunk still in flight");
if (!/aria-busy/.test(app)) fails.push("the loading state is not announced");

// 2 · Error — one boundary, and it must wrap the routed area rather than sit
//     beside it, or it catches nothing.
const boundary = all.find((f) => /RouteError\.jsx$/.test(f));
if (!boundary) fails.push("no error boundary exists");
else {
  const b = src(boundary);
  if (!/getDerivedStateFromError/.test(b)) fails.push("the boundary does not derive state from an error");
  if (!/componentDidCatch/.test(b)) fails.push("the boundary does not catch");
  if (!/role="alert"/.test(b)) fails.push("the error state is not announced");
  if (!/Try again|Reload/.test(b)) fails.push("the error state offers no way out");
}
if (!/<RouteError>/.test(app)) fails.push("the route boundary is never mounted");
else {
  const sus = app.indexOf("<Suspense"), eb = app.indexOf("<RouteError>");
  if (eb < sus) fails.push("the boundary sits outside Suspense, so a failed chunk escapes it");
}

// 2b · The top-level boundary must survive: it is the last resort, and it is
//      deliberately token-free so it works when the token layer is what broke.
if (!all.some((f) => /^src\/ErrorBoundary\.jsx$/.test(f))) fails.push("the top-level boundary is gone");
else if (!/main\.jsx/.test("main") && !/<ErrorBoundary>/.test(src("src/main.jsx"))) fails.push("the top-level boundary is not mounted in main.jsx");

// 3 · Empty — says what will fill it, never a bare count of nothing. The rule
//     from the voice section: never state absence, name the next action.
const NEVER = [/>\s*No (?:items|results|data)\s*</i, /Nothing here\.?\s*</i, />\s*0 results\s*</i];
for (const f of all) {
  const t = src(f);
  for (const re of NEVER) if (re.test(t)) fails.push(`${f}: an empty state states absence instead of naming what fills it`);
}

// 4 · The report control — one tap, carrying the route.
const rpt = all.find((f) => /ReportProblem\.jsx$/.test(f));
if (!rpt) fails.push("no way for someone to say a page is wrong");
else if (!/route/.test(src(rpt))) fails.push("the report does not carry the route, so it says nothing useful");
if (!/<ReportProblem/.test(app)) fails.push("the report control is never mounted");

console.log(`states: loading, error and empty checked across ${all.length} components`);
console.log("        not covered: rendering each route three ways against a stubbed API");
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `STATES: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
