/* Every reader test. Run: npm run test:reader
 *
 * `v5/` holds the suite for the reader v6 replaced. It is out of this file
 * deliberately — see the header of either file in there. */
import "./v6.mjs";
import "./quiz.mjs";
import { run } from "../harness/run.mjs";
await run(process.argv[2] || null);
