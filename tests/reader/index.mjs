/* Every reader test, in phase order. Run: npm run test:reader */
import "./phase1.mjs";
import { run } from "../harness/run.mjs";
await run(process.argv[2] || null);
