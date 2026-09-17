/* Every reader test. Run: npm run test:reader
 *
 * `v5/` holds the suite for the reader v6 replaced. It is out of this file
 * deliberately — see the header of either file in there.
 *
 * `quiz.mjs` sat the chapter quiz here, and never opened a paper. It drove the
 * screen the exam port replaced — a cover with a Start button, `.opt`, `.q-btn`
 * — so every case waited 30s for a button that no longer exists and failed.
 * `npm run test:exam` drives the ported screen and holds each thing it proved:
 * nothing marked while the paper is open, the count of what is answered, a
 * hand-in that names the blanks and the flags, the lessons the misses came
 * from, and a paper of just the missed ones. */
import "./v6.mjs";
import { run } from "../harness/run.mjs";
await run(process.argv[2] || null);
