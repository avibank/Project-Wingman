/* The test paper, fetched rather than committed.
 *
 * The brief names it: the pdf.js reference paper. Public, stable, fourteen
 * pages of dense body text, and — the reason it is the right one — it repeats
 * whole phrases, which is exactly what breaks naive anchoring. A handout with
 * no repetition would let a broken anchor look correct.
 *
 * It is not checked in: it is somebody else's paper, and the repo should not
 * carry it. papersFor() adds it to Module 1 in development only, so production
 * never references a file that is not there.
 *
 * Run: npm run paper:fetch
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const URL_ = "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";
const out = join(dirname(fileURLToPath(new URL("..", import.meta.url))), "Project Wingman");

const target = fileURLToPath(new URL("../public/papers/tracemonkey.pdf", import.meta.url));
void out;

const res = await fetch(URL_);
if (!res.ok) {
  console.error(`paper: ${res.status} from ${URL_}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
await mkdir(dirname(target), { recursive: true });
await writeFile(target, buf);
console.log(`paper: ${(buf.length / 1024).toFixed(0)}KB -> public/papers/tracemonkey.pdf`);
console.log("        development only; papersFor() adds it to Module 1 under import.meta.env.DEV");
