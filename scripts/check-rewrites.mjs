/* =============================================================================
   EVERY ADDRESS THE APP CAN PRODUCE HAS TO SURVIVE A REFRESH.
   -----------------------------------------------------------------------------
   This is a single-page app: the router is JavaScript, so the SERVER has to
   answer index.html for every address the app can be at. vercel.json's rewrite
   does that, with an exclusion so real files — the bundles, the fonts, the
   favicon — are still served as themselves.

   THE EXCLUSION WAS `.*\.[a-zA-Z0-9]+$`, WHICH MEANS "any last segment with a
   dot in it". Chapter and lesson ids in this app are M1.01 and M1.01.1, and
   papers are M1.DEV, so every one of these answered Vercel's own 404 page in
   production, for months:

       /m/m1/M1.01                     a chapter
       /m/m1/M1.01/lesson/M1.01.1      every lesson there is
       /library/M1.DEV                 a paper

   A student who refreshed on a lesson, opened a bookmark, or followed a link
   somebody sent them got "This page doesn't exist". It never showed in the dev
   server or the harness, because both serve the fallback for everything.

   So the exclusion is a LIST OF EXTENSIONS now, and this check holds it
   against the addresses routes.js can actually build, from the real content.

   Run: npm run check:rewrites
   ========================================================================= */
import { readFileSync } from "node:fs";
import { path as routePath } from "../src/lib/routes.js";

const conf = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const doc = JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url), "utf8"));

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

const rw = conf.rewrites || [];
ok("there is exactly one SPA rewrite", rw.length === 1 && rw[0].destination === "/index.html");
const re = new RegExp(`^${rw[0].source}$`);
const served = (p) => re.test(p);

/* Every address routes.js can build.
   ---------------------------------------------------------------------------
   THE SHAPES ARE NAMED HERE RATHER THAN COUNTED OUT OF THE CONTENT DOCUMENT.
   This file exists for one bug: a path whose LAST SEGMENT contains a dot —
   `/m/m1/M1.01/lesson/M1.01.1` — looks like a request for a file, and without
   the rewrite the host answers 404 on a refresh or a pasted link. The
   addresses were derived entirely from src/content/test-content.json, so
   emptying that document for the beta left nothing dotted to test and the
   guard reported "0 of them" — the one bug it was written to catch would
   have walked straight back in, quietly, on the day the app had no content.

   So the canonical shapes are stated. The document's own addresses are still
   added below when it has any, which keeps real ids covered as they arrive. */
const SHAPES = [
  routePath.module("M1"),
  routePath.chapter("M1", "M1.01"),
  routePath.chapter("M1", "M1.01", "quiz"),
  routePath.quizResume("M1", "M1.01"),
  routePath.lesson("M1", "M1.01", "M1.01.1"),
  routePath.lesson("M1", "M1.01", "M1.01.1", "q_a1b2c3"),
  routePath.library("M1"),
  routePath.library("M1", "quizzes"),
  routePath.cards("M1", 1),
  routePath.crew("M1"),
  routePath.ready("M1"),
  routePath.bookmarks("questions"),
  routePath.profile("licence"),
];
const addresses = ["/", "/bookmarks", "/account", "/admin", ...SHAPES];
for (const m of doc.modules) {
  const code = m.id;
  addresses.push(routePath.module(code));
  for (const p of m.papers || []) addresses.push(routePath.library ? routePath.library(code, p.id) : `/library/${p.id}`);
  for (const c of m.chapters || []) {
    addresses.push(routePath.chapter(code, c.id));
    addresses.push(routePath.chapter(code, c.id, "quiz"));
    for (const l of c.lessons || []) {
      addresses.push(routePath.lesson(code, c.id, l.id));
      const q = (c.quiz?.questions || [])[0];
      if (q) addresses.push(routePath.lesson(code, c.id, l.id, q.id));
    }
  }
}
const dead = addresses.filter((a) => !served(a));
ok(`all ${addresses.length} addresses the app can build survive a refresh`,
   dead.length === 0, dead.slice(0, 4).join("  "));

/* And the ones with a dot in the last segment specifically, named, because
   that is the bug this file exists for. */
const dotted = addresses.filter((a) => /\.[^/]*$/.test(a.split("/").pop()));
ok("addresses whose last part carries a dot are among them", dotted.length > 0,
   `${dotted.length} of them, e.g. ${dotted[0]}`);

/* Real files are still real files. */
for (const f of ["/assets/index-abc123.js", "/assets/index-abc.css", "/assets/ReaderV6-x.js.map",
                 "/fonts/InstrumentSans.woff2", "/favicon.svg", "/robots.txt", "/index.html",
                 "/manual.pdf", "/clip.mp4", "/sw.wasm"]) {
  ok(`${f} is served as itself`, !served(f));
}

/* A redirect must not point at an address the rewrite would refuse — that is
   a 308 into a 404, which is worse than either on its own. */
for (const r of conf.redirects || []) {
  const dest = r.destination.replace(/:(\w+)/g, "x");
  ok(`the redirect to ${r.destination} lands somewhere served`, served(dest));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
