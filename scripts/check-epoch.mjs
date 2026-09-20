/* THE STORAGE EPOCH — one sweep, once. Run: npm run check:epoch
 *
 * The database wipe cannot reach a tester's browser. This is the half that
 * can, and it has three ways to be silently wrong:
 *
 *   · IT RUNS TOO LATE. flags.js reads `pw-flags` and UserProgressProvider
 *     reads its keys while the first render is being built, so a sweep in a
 *     component clears them a frame after the app has already read them.
 *   · IT KEEPS SOMETHING IT SHOULD NOT. `pw-flags` above all — flags.js says
 *     in its own words that a stale override is how "I still cannot tap
 *     modules" happened, with no way to find out why from inside the app.
 *   · IT SWEEPS SOMETHING IT SHOULD NOT. Fly solo is a safety decision, not a
 *     setting: the SQL wipe keeps `blocks` and `mutes` for that reason and
 *     this keeps `pw-invisible` for the same one.
 *
 * The sweep itself is driven against a stand-in localStorage rather than
 * asserted from the source, because "an allowlist, not a wipe list" is only
 * true if an UNKNOWN key is actually swept — and no regex can tell you that.
 */
import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* A localStorage that behaves like one, including the live `length`/`key(i)`
   pair the sweep walks — which is where a naive implementation breaks, because
   removing while iterating shifts the indices under it. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _all: () => Object.fromEntries(map),
  };
}

const SEED = {
  /* state, all of it should go */
  "pw-hobbs": '{"M1":68400}', "pw-last-place": '[{"kind":"quiz"}]', "pw-last-flown": '"today"',
  "pw-quiz-scores": '{"M1.01":{"correct":4,"total":8}}', "pw-completed": '["M1.01"]',
  "pw-lesson-done": "{}", "pw-retention": "{}", "pw-notes": "{}", "pw-logbook": "[]",
  "pw-flags": '{"content.test":true}',
  /* a key nobody has written yet — the allowlist's whole point */
  "pw-something-invented-next-month": "1",
  /* preferences, all of it should stay */
  "pw-livery": '"runway"', "pw-finish": '"manual"', "pw-variant-pin": '"night"',
  "pw-font-size": '"large"', "pw-minimums": "86", "pw-invisible": "true",
  "pw-greet-name": '"Hassan"', "pw-reduce-motion": "true",
  /* not ours at all */
  "wm.reader.outbox.v1": '[{"t":"mark.add"}]', "clerk-db": "x",
};

const src = readFileSync(new URL("../src/lib/storage.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

/* ---- 1 · it runs before anything reads ---------------------------------- */
console.log("\nwhen it runs");
{
  ok("boot", "the sweep is called from the entry, not from a component",
     /import \{ sweepStorage \} from "\.\/lib\/storage\.js";/.test(main)
     && /^sweepStorage\(\);$/m.test(main));
  ok("boot", "and before the root is created",
     main.indexOf("sweepStorage();") < main.indexOf("ReactDOM.createRoot"));
  const comps = ["src/App.jsx", "src/lib/userProgress.jsx", "src/lib/flags.js"];
  const late = comps.filter((f) => /sweepStorage/.test(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")));
  ok("boot", "and nowhere else", late.length === 0, late.join(" "));
}

/* ---- 2 · what it does, driven -------------------------------------------- */
console.log("\nwhat it sweeps");
{
  const { sweepStorage, STORAGE_EPOCH } = await import("../src/lib/storage.js");
  const store = fakeStorage(SEED);
  globalThis.localStorage = store;

  const first = sweepStorage();
  ok("sweep", "it runs on a device that has never seen this epoch", first.ran === true);

  const after = store._all();
  ok("sweep", "state is gone", !("pw-hobbs" in after) && !("pw-last-place" in after)
     && !("pw-quiz-scores" in after) && !("pw-completed" in after) && !("pw-logbook" in after));
  /* The one flags.js warns about by name. */
  ok("sweep", "`pw-flags` is gone, which is the one that mattered", !("pw-flags" in after));
  /* An allowlist is only an allowlist if it sweeps what it has never heard of. */
  ok("sweep", "a key nobody has written yet is swept, not kept",
     !("pw-something-invented-next-month" in after));

  ok("keep", "the livery, the lighting and the finish stay",
     after["pw-livery"] === '"runway"' && after["pw-variant-pin"] === '"night"'
     && after["pw-finish"] === '"manual"');
  ok("keep", "type size, motion, the greeter and Your bar stay",
     after["pw-font-size"] === '"large"' && after["pw-reduce-motion"] === "true"
     && after["pw-greet-name"] === '"Hassan"' && after["pw-minimums"] === "86");
  /* Fly solo is a safety decision. The SQL wipe keeps blocks and mutes on the
     same reasoning; sweeping this would put somebody back on a roster they
     had asked to be off. */
  ok("keep", "Fly solo stays", after["pw-invisible"] === "true");
  /* Not ours: the reader's outbox holds marks that have not reached the
     server, and the pause was explicitly "nothing is deleted". */
  ok("keep", "keys that are not ours are untouched",
     after["wm.reader.outbox.v1"] === '[{"t":"mark.add"}]' && after["clerk-db"] === "x");

  ok("epoch", "and the epoch is written", after["pw-epoch"] === String(STORAGE_EPOCH));

  /* ---- 3 · and never again ---------------------------------------------- */
  console.log("\nand then never again");
  store.setItem("pw-hobbs", '{"M1":10}');
  const second = sweepStorage();
  ok("epoch", "a second load does nothing at all",
     second.ran === false && second.swept === 0 && store._all()["pw-hobbs"] === '{"M1":10}');

  /* A device from an older epoch is swept; one from a newer is not. */
  store.setItem("pw-epoch", "0");
  store.setItem("pw-junk-from-before", "1");
  ok("epoch", "a device on an older epoch is swept",
     sweepStorage().ran === true && !("pw-junk-from-before" in store._all()));
  store.setItem("pw-epoch", String(STORAGE_EPOCH + 5));
  store.setItem("pw-from-the-future", "1");
  ok("epoch", "a device on a newer epoch is left alone",
     sweepStorage().ran === false && store._all()["pw-from-the-future"] === "1");

  /* ---- 4 · storage that throws ------------------------------------------ */
  console.log("\nwhere storage is blocked");
  globalThis.localStorage = { get length() { throw new Error("denied"); },
    key() { throw new Error("denied"); }, getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  let threw = false;
  try { sweepStorage(); } catch { threw = true; }
  ok("blocked", "a private window or a locked-down webview does not take the app down", !threw);
  delete globalThis.localStorage;
}

/* ---- 5 · the source says which half is which ---------------------------- */
console.log("\nthe list itself");
{
  ok("list", "it is an allowlist, and everything under pw- that is not on it goes",
     /const KEEP = new Set\(\[/.test(src)
     && /k\.startsWith\("pw-"\) && !KEEP\.has\(k\)/.test(src));
  ok("list", "and `pw-flags` is not on it", !/"pw-flags"/.test(src.split("const KEEP")[1].split("]);")[0]));
}

console.log(`\nepoch: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
