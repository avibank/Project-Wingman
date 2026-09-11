/* The archived v5 suite. See the header of either file. */
import "./phase1.mjs";
import "./phases.mjs";
import { run } from "../../harness/run.mjs";
await run(process.argv[2] || null);
