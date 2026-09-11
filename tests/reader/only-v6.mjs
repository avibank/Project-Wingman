/* Just the v6 group, for driving one part of the build. `npm run test:reader`
   is still the whole suite. */
import "./v6.mjs";
import { run } from "../harness/run.mjs";
await run(process.argv[2] || null);
