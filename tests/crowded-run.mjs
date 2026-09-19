/* =============================================================================
   CROWDED, AND LONG. The state nothing had ever met.
   -----------------------------------------------------------------------------
   The launch checklist asks for "long names, long titles, crowded chapter walls
   (100+ stamps)", and nothing drove it. Every other walk in this repo runs
   against a fixture with two lessons and five people, which is the shape where
   a layout looks fine and a cache is never tested.

   So: a hundred and twenty people on one Crew wall, each with their own stamp,
   and a licence carrying the longest callsign, name and bio the fields accept.
   Three questions:

     · does anything overflow sideways, or get clipped, at three widths
     · is the stamp cache actually shared — §8: "Crew walls with 100+ stamps
       stay smooth. Cache the rendered SVG per user stamp and share the filter
       defs." A hundred and twenty stamps drawn from twelve distinct accounts
       must produce twelve filters, not a hundred and twenty
     · does the page still arrive in a reasonable time

     npm run harness, then:  npm run test:crowded
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.CR_BASE || "http://127.0.0.1:5190";
const WIDTHS = (process.env.CR_WIDTHS || "1280x900,820x1180,390x844")
  .split(",").map((s) => s.split("x").map(Number));
const N = Number(process.env.CR_PEOPLE || 120);
const SEEDS = 12;          // distinct accounts' ink; the rest repeat
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch|Download the React DevTools|harness:|blocked by CORS policy/;

/* The longest each field accepts, in characters that cannot break: a name
   with a space in it wraps and tells you nothing. */
const LONG_CALLSIGN = "Bartholomewsington-Fitzgerald";      // 29, no spaces
const LONG_NAME = "Maximilian Bartholomew Fitzgerald-Rutherford";
const LONG_BIO = "Third year, night shift, and I have never once found the 10mm socket where I left it.";  // 84 -> clipped to 80

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}`);
  const seen = new Map();
  for (const p of problems) {
    const kind = p.replace(/[\d.]+px/g, "Npx").replace(/"[^"]*"/g, '"…"');
    if (!seen.has(kind)) seen.set(kind, { n: 0, first: p });
    seen.get(kind).n += 1;
  }
  for (const [kind, { n, first }] of [...seen].slice(0, 6)) {
    console.log(`        ${n} × ${kind}${n > 1 ? `\n            e.g. ${first}` : ""}`);
  }
};

const post = (table, row, conflict) => fetch(
  `${BASE}/rest/v1/${table}${conflict ? `?on_conflict=${conflict}` : ""}`,
  { method: "POST",
    headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row) },
);

const SHAPES = ["seal", "roundel", "window", "gauge", "postage", "tag"];
const PATTERNS = ["none", "rays", "waves", "checks", "swirl", "guilloche"];
const INKS = ["Midnight", "Lapiz", "Miami", "Teal", "Emerald", "Olive",
              "Honey", "Coral", "Ruby", "Nardo", "Mauve", "Plum"];

const seed = async () => {
  await fetch(`${BASE}/harness/reset`, { method: "POST" });
  const now = new Date().toISOString();
  for (let i = 0; i < N; i++) {
    const id = `crowd_${String(i).padStart(3, "0")}`;
    await post("pilot_profiles", {
      user_id: id,
      /* Every fifth one carries the longest name the field takes, so the wall
         is a realistic mix rather than uniformly long or uniformly short. */
      callsign: i % 5 === 0 ? LONG_CALLSIGN : `Pilot${i}`,
      real_name: i % 5 === 0 ? LONG_NAME : null,
      bio: i % 5 === 0 ? LONG_BIO.slice(0, 80) : null,
      invisible: false,
      stamp_shape: SHAPES[i % SHAPES.length],
      stamp_code: String(i % 1000).padStart(3, "0"),
      stamp_rim: i % 3 !== 0,
      stamp_ring: i % 3 !== 0 ? "WINGMAN" : null,
      stamp_pattern: PATTERNS[i % PATTERNS.length],
      stamp_ink: INKS[i % SEEDS],
      /* SEEDS distinct seeds across N people: the filter defs are keyed on the
         seed, so this is what makes "twelve filters, not a hundred and twenty"
         a real measurement rather than a coincidence. */
      stamp_seed: 1 + (i % SEEDS),
      stamp_issued_at: now,
    }, "user_id");
    await post("chapter_completions",
      { user_id: id, chapter_id: "M1.01", module_code: "M1" }, "user_id,chapter_id");
    if (i % 4 === 0) {
      await post("presence",
        { user_id: id, display_name: `Pilot${i}`, module_code: "M1",
          chapter_id: "M1.01", last_seen: now }, "user_id");
    }
  }
  /* And the student's own licence, at the same extremes. */
  await post("pilot_profiles", {
    user_id: "student_one", callsign: LONG_CALLSIGN, real_name: LONG_NAME,
    bio: LONG_BIO.slice(0, 80), phrase: "Torqued to spec. Emotionally too.",
    cover: "chart", cover_ink: "Ruby", invisible: false,
    stamp_shape: "gauge", stamp_code: "WXY", stamp_rim: true,
    stamp_ring: "LONGESTRIM", stamp_pattern: "guilloche", stamp_ink: "Plum",
    stamp_seed: 7, stamp_issued_at: new Date().toISOString(),
  }, "user_id");
};

/* Anything wider than its own container, or cut off inside it. Measured
   against the region rather than the window, so a legitimately scrolling
   element is not reported. */
const OVERFLOW = (root) => {
  const bad = [];
  const box = document.querySelector(root);
  if (!box) return ["the region never rendered"];
  const rb = box.getBoundingClientRect();
  box.querySelectorAll("*").forEach((el) => {
    /* NOT INSIDE AN <svg>. A drawing's own elements are supposed to run past
       the viewBox — the cover is `preserveAspectRatio="slice"`, which is what
       "fill this band" means — and the svg clips them. Walking into one
       reports the design working as three failures. */
    if (el.closest("svg")) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const name = el.className && typeof el.className === "string"
      ? `.${el.className.split(" ")[0]}` : el.tagName;
    if (r.right > rb.right + 1.5 || r.left < rb.left - 1.5) bad.push(`${name} overflows sideways`);
    /* Clipped text: the content is wider than the box and nothing is doing
       anything about it. An ellipsis or a line clamp is a decision; a plain
       overflow:hidden that cuts a word in half is not. */
    const s = getComputedStyle(el);
    if (el.children.length === 0 && el.textContent.trim()
        && el.scrollWidth > el.clientWidth + 2
        && s.textOverflow !== "ellipsis" && s.overflowX !== "auto" && s.overflowX !== "scroll") {
      bad.push(`${name} is cut off: "${el.textContent.trim().slice(0, 24)}"`);
    }
  });
  return [...new Set(bad)];
};

const run = async () => {
  await seed();
  const browser = await chromium.launch();

  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text()); });
    const problems = [];

    const t0 = Date.now();
    await page.goto(`${BASE}/m/m1/crew`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".crew-wall .insp-stamp", { timeout: 25000 })
      .catch(() => problems.push("the wall never drew anybody"));
    await page.waitForTimeout(1500);
    const took = Date.now() - t0;

    const drawn = await page.locator(".insp-stamp").count();
    if (drawn < 40) problems.push(`only ${drawn} stamps drawn of ${N} people`);

    /* §8's own claim, measured: the filter defs are shared. */
    const filters = await page.locator('svg defs filter[id^="ink2_"]').count();
    if (filters > SEEDS) problems.push(`${filters} ink filters for ${SEEDS} distinct seeds`);
    if (!filters) problems.push("no ink filters at all — every stamp is drawing plain");

    for (const p of await page.evaluate(OVERFLOW, ".deck")) problems.push(`${w}px: ${p}`);
    if (took > 20000) problems.push(`${w}px: took ${took}ms to draw`);
    for (const e of errs.slice(0, 3)) problems.push(e.slice(0, 140));
    report(`a ${N}-person Crew wall at ${w}px  (${drawn} stamps, ${filters} filters, ${took}ms)`, problems);
    await page.close();
  }

  /* The licence, at the longest everything. */
  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const problems = [];
    await page.goto(`${BASE}/account/licence`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lic-card", { timeout: 20000 })
      .catch(() => problems.push("the card never rendered"));
    await page.waitForTimeout(1200);
    for (const p of await page.evaluate(OVERFLOW, ".lic-card")) problems.push(`${w}px: ${p}`);
    /* The name is the one line that must not be cut: it is who they are. */
    const name = await page.locator(".lic-name").evaluate((el) => ({
      text: (el.value ?? el.textContent).trim(),
      cut: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
    })).catch(() => null);
    if (name && name.cut) problems.push(`${w}px: the callsign is cut off: "${name.text.slice(0, 24)}"`);
    report(`a licence with the longest name and bio at ${w}px`, problems);
    await page.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exitCode = failures ? 1 : 0;
};

run().catch((e) => { console.error(e); process.exit(1); });
