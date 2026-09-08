#!/usr/bin/env node
/* Linearize a paper before uploading it.
 *
 * The one step of §4.7's pipeline that cannot run in the browser: it needs
 * qpdf, and there is no server in this architecture to host one (see
 * docs/reader/DISCOVERY.md §7). So it runs here, on the machine of whoever is
 * adding the paper, and takes ten seconds.
 *
 * What it buys: pdf.js can jump straight to page one's objects instead of
 * fetching the trailer first to find the cross-reference table. On a 200MB
 * manual that is the difference between a first page in well under a second
 * and a first page after a round trip to the end of the file.
 *
 *   npm run paper:linearize -- ~/Downloads/M13.pdf
 *
 * If qpdf is not installed it says so and stops rather than pretending: the
 * reader records whether a paper is linearized and shows it in Document
 * details, so an unlinearized one is honest rather than invisible.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run paper:linearize -- <file.pdf>");
  process.exit(2);
}
if (!existsSync(file)) { console.error(`No such file: ${file}`); process.exit(2); }

const head = readFileSync(file).subarray(0, 2048).toString("latin1");
if (/\/Linearized/.test(head)) {
  console.log(`${basename(file)} is already linearized. Nothing to do.`);
  process.exit(0);
}

const has = spawnSync("qpdf", ["--version"], { stdio: "ignore" }).status === 0;
if (!has) {
  console.error(`qpdf is not installed, so this cannot linearize ${basename(file)}.

  brew install qpdf        (macOS)
  apt install qpdf         (Debian/Ubuntu)

The paper will still work without it — range loading just has to fetch the
trailer first to find the cross-reference table. The reader records which state
a paper is in and shows it under Document details, so nothing is pretended.`);
  process.exit(1);
}

const out = join(dirname(file), basename(file).replace(/\.pdf$/i, "") + ".linear.pdf");
const before = statSync(file).size;
execFileSync("qpdf", ["--linearize", file, out], { stdio: "inherit" });
const after = statSync(out).size;
console.log(`\nLinearized -> ${out}`);
console.log(`  ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`);
console.log(`\nUpload the .linear.pdf, not the original.`);
