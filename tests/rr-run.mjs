/* =============================================================================
   THE READY ROOM, ACROSS EVERY LIVERY, BOTH VARIANTS AND FOUR WIDTHS.
   -----------------------------------------------------------------------------
   The brief's check, run rather than eyeballed: six liveries × night and day
   × 1920 / 1512 / 1024 / 430, and at each the module, a squadron chat and the
   right seat — on a phone the rail, the list and the thread as well. Driven
   through the Playwright library, like the harness's other runners.

     npm run harness, then:  npm run test:rr
     RR_SHOTS=all keeps a screenshot of every state rather than a sample.
   ========================================================================= */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { seedRoom } from "./harness/room-seed.mjs";

const BASE = process.env.RR_BASE || "http://127.0.0.1:5190";
const LIVERIES = (process.env.RR_LIVERIES || "sky,amber,tarmac,beacon,runway,skydrol").split(",");
const VARIANTS = ["night", "day"];
const WIDTHS = [[1920, 1080], [1512, 945], [1024, 768], [430, 932]];
const SHOTS = "tests/screens/rr";
const ALL_SHOTS = process.env.RR_SHOTS === "all";
/* The harness has no realtime server, and a page that loads while it restarts
   logs refused connections. Neither is the room. */
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch/;

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}  (${problems.length} problems)`);
  const kinds = new Map();
  for (const p of problems) {
    const kind = p.replace(/^[^:]*: /, "").replace(/\d+px/g, "Npx");
    if (!kinds.has(kind)) kinds.set(kind, { count: 0, first: p });
    kinds.get(kind).count += 1;
  }
  for (const [kind, { count, first }] of kinds) console.log(`        ${count} × ${kind}\n            e.g. ${first}`);
};

/* Everything that must hold in every state. */
const audit = (page, expect) => page.evaluate((expect) => {
  const out = [];
  const shown = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  const doc = document.scrollingElement;
  if (doc.scrollWidth > innerWidth + 1) out.push(`the page scrolls sideways by ${doc.scrollWidth - innerWidth}px`);
  const rr = document.querySelector(".rr");
  if (!rr) return ["the room did not render"];
  for (const sel of [".rr-rail-scroll", ".rr-feed", ".rr-dscroll", ".rr-transcript", ".rr-seatgrid", ".rr-ctx", ".rr-phead", ".rr-composer", ".rr-abar"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (shown(el) && el.scrollWidth > el.clientWidth + 1) out.push(`${sel} scrolls sideways by ${el.scrollWidth - el.clientWidth}px`);
    }
  }
  const rail = document.querySelector(".rr-rail");
  const pane = document.querySelector(".rr-pane");
  if (!shown(rail) && !shown(pane)) out.push("neither the rail nor the pane is on screen");
  if (shown(pane) && !pane.textContent.trim()) out.push("the pane is empty");
  const day = Boolean(document.querySelector(".app")?.classList.contains("theme-light"));
  if (day !== (expect.variant === "day")) out.push(`the app is ${day ? "day" : "night"}, not ${expect.variant}`);
  const cs = getComputedStyle(rr);
  for (const t of ["--lit", "--on-mark", "--proud", "--recess", "--sunk", "--edge", "--bub-in", "--bub-out", "--nm-l"]) {
    if (!cs.getPropertyValue(t).trim()) out.push(`${t} is not set`);
  }
  for (const el of rr.querySelectorAll(".rr-bub, .rr-frow, .rr-row, .rr-seatcard, .rr-ctxcard, .rr-ans, .rr-ask, .rr-send")) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1) { out.push(`.${el.classList[0]} runs off the side of the screen`); break; }
  }
  /* Edge to edge, with no inset frame and nothing pushed down the screen. */
  const box = rr.getBoundingClientRect();
  if (Math.abs(box.left) > 1 || Math.abs(box.top) > 1 || Math.abs(box.right - innerWidth) > 1 || Math.abs(box.bottom - innerHeight) > 1) {
    out.push(`the room does not fill the screen: ${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)}`);
  }
  /* The app's fixed report pill never sits on a place you type. At 430px it
     covered the chat's message field, and no other rule could see it. */
  const rpt = document.querySelector(".rpt");
  if (rpt && getComputedStyle(rpt).display !== "none") {
    const p = rpt.getBoundingClientRect();
    for (const sel of [".rr-composer", ".rr-abar"]) {
      const hit = [...document.querySelectorAll(sel)].find((el) => {
        if (!shown(el)) return false;
        const r = el.getBoundingClientRect();
        return p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top;
      });
      if (hit) out.push(`the report pill covers ${sel}`);
    }
  }
  const h1 = document.querySelector(".rr .room-h1");
  if (h1 && h1.getBoundingClientRect().height > 2) out.push("the page heading is visible");
  const w = innerWidth;
  const q = (s) => document.querySelector(s);
  if (expect.view === "module") {
    if (w >= 1660 && !shown(q(".rr-ctx"))) out.push("the context column is missing at 1660px and up");
    if (w < 1660 && shown(q(".rr-ctx")) && !q('.rr[data-wide="1"]')) out.push("the context column shows under 1660px without Fill the pane");
    if (w > 1180 && !(shown(q(".rr-feed")) && shown(q(".rr-dmain")))) out.push("the list and the thread are not side by side above 1180px");
    if (w <= 1180 && shown(q(".rr-split"))) out.push("the splitter shows at 1180px and under");
  }
  if (w <= 900 && shown(rail) && shown(pane)) out.push("the rail and the pane share a phone screen");
  if (expect.view === "chat" && w <= 900) {
    const qa = q(".rr-qa");
    if (qa && getComputedStyle(qa).display !== "none") out.push("hover actions are on a phone");
  }
  if (expect.view === "chat") {
    for (const m of document.querySelectorAll(".rr-msg[data-msg]")) {
      const qa = m.querySelector(".rr-qa");
      if (qa && !m.querySelector(".rr-bub")?.contains(qa)) { out.push("a hover action is outside its bubble"); break; }
    }
  }
  return out;
}, expect);

const browser = await chromium.launch();
const problems = [];
const errors = [];
let states = 0;
try {
  console.log(await seedRoom(BASE));
  mkdirSync(SHOTS, { recursive: true });
  for (const variant of VARIANTS) {
    for (const livery of LIVERIES) {
      await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": livery, "pw-variant-pin": variant } }),
      });
      for (const [width, height] of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height } });
        page.on("pageerror", (e) => errors.push(`${variant} ${livery} ${width}: ${String(e).slice(0, 160)}`));
        page.on("console", (m) => {
          if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`${variant} ${livery} ${width}: ${m.text().slice(0, 160)}`);
        });
        const phone = width <= 900;
        const tag = `${variant} ${livery} ${width}`;
        const check = async (view) => {
          states += 1;
          await page.waitForTimeout(250);
          for (const p of await audit(page, { variant, view })) problems.push(`${tag} ${view}: ${p}`);
          if (ALL_SHOTS || ((livery === "sky" || livery === "runway") && (width === 1512 || width === 430))) {
            await page.screenshot({ path: `${SHOTS}/${variant}-${livery}-${width}-${view}.png` });
          }
        };
        await page.goto(`${BASE}/ready-room/m1?uid=student_one`);
        await page.locator(".rr .rr-row").first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(400);

        if (phone) {
          await check("rail");
          await page.locator(".rr-row", { hasText: "Module 13d" }).first().click();
          await page.locator(".rr-frow").first().waitFor();
          await check("list");
          await page.locator(".rr-fopen").first().click();
          await check("thread");
          await page.goto(`${BASE}/ready-room/m1?uid=student_one`);
          await page.locator(".rr .rr-row").first().waitFor({ timeout: 15000 });
        } else {
          await page.locator(".rr-frow").first().waitFor();
          await check("module");
        }

        await page.locator(".rr-row", { hasText: "JT Squadron" }).first().click();
        await page.locator(".rr-bub").first().waitFor();
        await check("chat");

        if (phone) {
          await page.goto(`${BASE}/ready-room/m1?uid=student_one`);
          await page.locator(".rr .rr-row").first().waitFor({ timeout: 15000 });
        }
        await page.locator(".rr-lnk", { hasText: "See all" }).first().click();
        await page.locator(".rr-seatgrid").first().waitFor();
        await check("seats");
        await page.close();
      }
    }
  }
  report(`every state lays out cleanly (${states} states)`, problems);

  /* ---------------------------------------------------------- the controls
     Once on a desktop and once on a phone, against a freshly seeded room:
     every control the brief lists, each checked by what it leaves on screen. */
  console.log(await seedRoom(BASE));
  await fetch(`${BASE}/rest/v1/rpc/merge_progress`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: "student_one", patch: { "pw-livery": "sky", "pw-variant-pin": "night" } }),
  });
  const acts = [];
  const expect = (name, cond) => { if (!cond) acts.push(name); };
  {
    const page = await browser.newPage({ viewport: { width: 1512, height: 945 } });
    page.on("pageerror", (e) => errors.push(`controls: ${String(e).slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`controls: ${m.text().slice(0, 160)}`); });
    const room = `${BASE}/ready-room/m1?uid=student_one`;
    const settle = (ms = 400) => page.waitForTimeout(ms);
    const blur = () => page.evaluate(() => document.activeElement?.blur?.());
    await page.goto(room);
    await page.locator(".rr-frow").first().waitFor();
    await settle();

    await page.locator(".rr-chip", { hasText: "Yours" }).click();
    await settle(200);
    expect("Yours lists the questions you asked or answered", (await page.locator(".rr-frow").count()) === 3);
    await page.locator(".rr-chip", { hasText: "All" }).click();
    await page.locator(".rr-search input").fill("synchro");
    await settle(200);
    expect("the search narrows the list", (await page.locator(".rr-frow").count()) === 1);
    expect("the chip counts ignore the search", (await page.locator(".rr-chip", { hasText: "All" }).locator(".rr-n").textContent()) === "5");
    await page.locator(".rr-search input").fill("");
    await settle(200);

    await blur();
    const t1 = await page.locator(".rr-dtitle").textContent();
    await page.keyboard.press("ArrowDown");
    await settle(200);
    expect("ArrowDown moves to the next question", (await page.locator(".rr-dtitle").textContent()) !== t1);
    await page.keyboard.press("ArrowUp");
    await settle(200);
    expect("ArrowUp comes back", (await page.locator(".rr-dtitle").textContent()) === t1);
    await page.keyboard.press("f");
    await settle(200);
    expect("F fills the pane", (await page.locator('.rr[data-wide="1"]').count()) === 1);
    expect("and the button says Show the list", /Show the list/.test(await page.locator(".rr-tbtn.rr-wide").textContent()));
    await page.keyboard.press("f");
    await settle(200);
    expect("F again restores the list", (await page.locator('.rr[data-wide="1"]').count()) === 0);

    const fwNow = () => page.evaluate(() => document.querySelector(".rr").style.getPropertyValue("--fw"));
    const sb = await page.locator(".rr-split").boundingBox();
    await page.mouse.move(sb.x, sb.y + 200);
    await page.mouse.down();
    await page.mouse.move(sb.x + 90, sb.y + 200, { steps: 8 });
    await page.mouse.up();
    await settle(200);
    const fw = await fwNow();
    expect("dragging the splitter sets the feed width", /^\d+px$/.test(fw));
    await page.reload();
    await page.locator(".rr-frow").first().waitFor();
    await settle();
    expect("the width survives a reload", (await fwNow()) === fw);
    const sb2 = await page.locator(".rr-split").boundingBox();
    await page.mouse.dblclick(sb2.x, sb2.y + 200);
    await settle(200);
    expect("a double-click resets the width", !(await fwNow()));
    const body = await page.locator(".rr-tbody").boundingBox();
    const sb3 = await page.locator(".rr-split").boundingBox();
    await page.mouse.move(sb3.x, sb3.y + 200);
    await page.mouse.down();
    await page.mouse.move(body.x + 120, sb3.y + 200, { steps: 8 });
    await page.mouse.up();
    await settle(200);
    expect("dragging under 190px fills the pane", (await page.locator('.rr[data-wide="1"]').count()) === 1);
    await page.locator(".rr-tbtn.rr-wide").click();
    await settle(200);

    const vote = page.locator(".rr-dactions .rr-vote");
    const v0 = await vote.locator("b").textContent();
    await vote.locator("i").first().click();
    await settle();
    expect("the up arrow moves the count", (await vote.locator("b").textContent()) !== v0);
    await vote.locator("i").first().click();
    await settle();
    expect("the same arrow twice leaves it where it was", (await vote.locator("b").textContent()) === v0);
    const save = page.locator(".rr-dactions .rr-mini", { hasText: /Save/ });
    const s0 = await save.getAttribute("data-on");
    await save.click();
    await settle();
    expect("Save toggles", (await save.getAttribute("data-on")) !== s0);

    await page.locator(".rr-abar textarea").fill("Checked it on the rig: the pitot side only.");
    await page.locator(".rr-abar .rr-ask").click();
    await settle(700);
    expect("an answer posts into the thread", (await page.locator(".rr-ans .rr-txt", { hasText: "Checked it on the rig" }).count()) === 1);

    await page.locator(".rr-chips .rr-ask").click();
    await page.locator(".rr-askform input").fill("What does a blocked drain hole do to the static reading?");
    await page.locator(".rr-askform textarea").fill("Asking for the lesson 3 worksheet.");
    await page.locator(".rr-askform .rr-ask").click();
    await settle(800);
    expect("a posted question is selected", /^What does a blocked drain hole/.test(await page.locator(".rr-dtitle").textContent()));
    expect("and it is at the top of the list", /^What does a blocked drain hole/.test(await page.locator(".rr-frow").first().locator(".rr-ftitle").textContent()));

    await page.locator(".rr-frow", { hasText: "Correction — the diagram" }).locator(".rr-fopen").click();
    await settle();
    await page.locator(".rr-ans .rr-sign").first().click();
    await settle(900);
    expect("signing off stamps the answer", (await page.locator('.rr-ans[data-signed="1"] .rr-stamp').count()) === 1);
    expect("and the question reads Signed off", (await page.locator(".rr-dmeta .rr-status").textContent()) === "Signed off");
    await page.locator(".rr-frow", { hasText: "Pitot blockage" }).locator(".rr-fopen").click();
    await settle();
    expect("somebody else's question offers no Sign off", (await page.locator(".rr-ans .rr-sign").count()) === 0);

    await page.locator(".rr-row", { hasText: "JT Squadron" }).click();
    await page.locator(".rr-bub").first().waitFor();
    await settle();
    expect("Send is idle with nothing typed", (await page.locator(".rr-cin .rr-send").getAttribute("data-idle")) === "1");
    await page.locator(".rr-cfield textarea").fill("Got it — the static one.");
    expect("and lights when there is text", (await page.locator(".rr-cin .rr-send").getAttribute("data-idle")) === "0");
    await page.keyboard.press("Enter");
    await settle(800);
    expect("Enter sends", (await page.locator(".rr-bub .rr-body", { hasText: "Got it — the static one." }).count()) === 1);
    await page.locator(".rr-cfield textarea").type("line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("line two");
    expect("Shift+Enter is a new line", (await page.locator(".rr-cfield textarea").inputValue()) === "line one\nline two");
    await page.locator(".rr-cfield textarea").fill("");

    const theirs = page.locator('.rr-msg[data-msg]:not([data-me="1"])').last();
    await theirs.hover();
    await theirs.locator('.rr-qa button[aria-label="Reply"]').click();
    await settle(200);
    expect("Reply puts the draft above the field", (await page.locator(".rr-composer .rr-draft").count()) === 1);
    await page.locator(".rr-composer .rr-draft button").click();
    await settle(200);
    expect("✕ drops the reply", (await page.locator(".rr-composer .rr-draft").count()) === 0);

    await page.locator(".rr-cin .rr-plus").click();
    await settle(200);
    expect("+ offers Photo, File and Paper passage", (await page.locator(".rr-sheet button").allTextContents()).join("|") === "PhotoFilePaper passage".replace(/(Photo)(File)(Paper passage)/, "$1|$2|$3"));
    expect("and the sheet is open", (await page.locator(".rr-sheetwrap:not([hidden])").count()) === 1);
    await page.mouse.click(760, 160);
    await settle(200);
    /* The sheet stays mounted so it has something to animate on the way out:
       closed is its wrapper hidden at once, and off the page once the fade
       has run — not the element gone. */
    expect("a press outside closes the sheet", (await page.locator(".rr-sheetwrap[hidden]").count()) === 1);
    await settle(500);
    expect("and it is off the page once it has faded", !(await page.locator(".rr-sheet").isVisible()));

    await page.locator('.rr-msg[data-me="1"]', { hasText: "caught me out" }).locator(".rr-mt").click();
    await settle(300);
    expect("the ticks open Message info", (await page.locator(".rr-seenpanel").count()) === 1);
    await blur();
    await page.keyboard.press("Escape");
    await settle(200);
    expect("Escape closes Message info", (await page.locator(".rr-seenpanel").count()) === 0);

    await page.locator(".rr-transcript").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("Control+k");
    await settle(200);
    expect("Ctrl K focuses the rail search", await page.evaluate(() => Boolean(document.activeElement?.closest(".rr-search"))));

    await page.locator(".rr-lnk", { hasText: "See all" }).click();
    await page.locator(".rr-seatcard").first().waitFor();
    expect("See all opens the seat cards", (await page.locator(".rr-seatcard").count()) >= 1);
    await page.locator(".rr-seatcard .rr-go", { hasText: "Take the right seat" }).first().click();
    await settle(500);
    expect("Take the right seat asks and says so", (await page.locator('.toast[data-open="true"]').count()) === 1);
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    page.on("pageerror", (e) => errors.push(`phone: ${String(e).slice(0, 160)}`));
    await page.goto(`${BASE}/ready-room/m1?uid=student_one`);
    await page.locator(".rr .rr-row").first().waitFor();
    await page.waitForTimeout(400);
    const view = () => page.evaluate(() => document.querySelector(".rr").dataset.view);
    expect("a phone opens on the rail", (await view()) === "rail");
    expect("with no topbar over the room", (await page.locator(".topbar").count()) === 0);
    await page.locator(".rr-row", { hasText: "Module 13d" }).click();
    await page.waitForTimeout(300);
    expect("a module opens its list", (await view()) === "list");
    await page.locator(".rr-fopen").first().click();
    await page.waitForTimeout(300);
    expect("a question opens the thread", (await view()) === "thread");
    await page.locator(".rr-phead .rr-backbtn").click();
    await page.waitForTimeout(300);
    expect("back from the thread is the list", (await view()) === "list");
    await page.locator(".rr-phead .rr-backbtn").click();
    await page.waitForTimeout(300);
    expect("back from the list is the rail", (await view()) === "rail");
    await page.close();
  }
  report("every control does what the brief says", acts);

  report("no console errors and no exceptions", errors);
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
