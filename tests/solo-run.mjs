/* =============================================================================
   FLY SOLO, DRIVEN. §6: "Fly solo must actually hide the student from Crew,
   the route strip, the radar and presence, and hide others from them."
   -----------------------------------------------------------------------------
   check:solo reads the source and holds every reader to the gate. This turns
   the switch on in Preferences, like a student would, and then goes and looks
   at each surface — because the half that matters is the one you cannot see
   from your own screen, and the only honest way to check it is to be somebody
   else.

   TWO STUDENTS, in two browser contexts, against one harness store:

     student_one   turns it on, then walks every surface and must see nobody
     student_two   walks the same surfaces and must not find student_one
                   anywhere: not in Crew, not in presence, not in search,
                   not on a licence card

   Both halves of the switch are seeded first, so nothing in the walk depends
   on a heartbeat having run.

     npm run harness, then:  npm run test:solo
   ========================================================================= */
import { chromium } from "playwright";

const BASE = process.env.SOLO_BASE || "http://127.0.0.1:5190";
const ME = "student_one";
const THEM = "student_two";
/* A THIRD STUDENT WHO IS NEVER HIDDEN. Without one, "student_one is not on
   student_two's Crew wall" is satisfied by an empty wall, and an empty wall is
   also what a broken query returns. The third is what makes the absence of the
   first mean something. */
const OTHER = "student_three";
const NOISE = /WebSocket|realtime|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch|Download the React DevTools|harness:|blocked by CORS policy/;

let failures = 0;
const report = (name, problems) => {
  if (!problems.length) { console.log(`ok    ${name}`); return; }
  failures += 1;
  console.log(`FAIL  ${name}`);
  for (const p of problems.slice(0, 6)) console.log(`        ${p}`);
};

const rest = (path, init) => fetch(`${BASE}/rest/v1/${path}`, init);
const rpc = (name, body) => rest(`rpc/${name}`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}).then((r) => r.json()).catch(() => null);

/* Both students exist, both are somewhere, and both have finished a chapter —
   so each is on the other's Crew wall and in the other's presence before
   anything is hidden. Without that the walk would pass on an empty room. */
const seed = async (invisible) => {
  await setSolo(ME, invisible);
  await setSolo(THEM, false);
  await setSolo(OTHER, false);
  for (const [id, callsign] of [[ME, "Alex"], [THEM, "Sam"], [OTHER, "Jo"]]) {
    await rest("pilot_profiles?on_conflict=user_id", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: id, callsign, invisible: id === ME ? invisible : false }),
    });
    await rest("presence?on_conflict=user_id", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: id, display_name: callsign, module_code: "M1",
        chapter_id: "M1.01", last_seen: new Date().toISOString(),
      }),
    });
    await rest("chapter_completions?on_conflict=user_id,chapter_id", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: id, chapter_id: "M1.01", module_code: "M1" }),
    });
  }
};

/* THE SWITCH IS SEEDED ON THE ACCOUNT, NOT IN localStorage. App.jsx mirrors
   `pw-invisible` out of the progress store on every change including the first
   load — which is right, and is exactly what makes a localStorage seed
   pointless: the account's value lands a frame later and overwrites it. It is
   also why the mirror exists at all, so a second device finds out. */
const setSolo = (uid, on) => rpc("merge_progress", { uid, patch: { "pw-invisible": on } });

/* A page as one student. `uid` is the harness's Clerk stub. */
const open = async (browser, uid, path) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}${path}${path.includes("?") ? "&" : "?"}uid=${uid}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app", { timeout: 20000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
};

const run = async () => {
  const browser = await chromium.launch();

  /* ------------------------------------------- 1 · the switch is reachable */
  {
    await seed(false);
    const { ctx, page } = await open(browser, ME, "/account/preferences");
    const problems = [];
    const sw = page.locator("#fly-solo");
    if (!await sw.count()) problems.push("no Fly solo switch in Preferences");
    else {
      const where = await sw.evaluate((el) => el.closest(".block")?.querySelector(".eyebrow")?.textContent);
      if (where !== "How social") problems.push(`it is filed under "${where}", not How social (§6)`);
      if (await sw.getAttribute("aria-checked") !== "false") problems.push("it starts on");
      await sw.click();
      // Wait on what the press produces, not on a duration.
      await page.waitForFunction(
        () => document.querySelector("#fly-solo")?.getAttribute("aria-checked") === "true",
        null, { timeout: 5000 },
      ).catch(() => problems.push("pressing it did not turn it on"));
      await page.waitForTimeout(700);   // the three writes it starts
      /* BOTH HALVES. The mirror is what lib/ reads; the profile row is the
         only half other people's queries can see. */
      const mirror = await page.evaluate(() => localStorage.getItem("pw-invisible"));
      if (mirror !== "true") problems.push(`the local mirror says ${mirror}`);
      const rows = await rest(`pilot_profiles?user_id=eq.${ME}&select=invisible`).then((r) => r.json());
      if (rows?.[0]?.invisible !== true) problems.push("the profile row was not marked invisible");
      /* And the presence row is gone THEN, not on the next beat. */
      const pres = await rest(`presence?user_id=eq.${ME}&select=user_id`).then((r) => r.json());
      if (pres?.length) problems.push("their presence row survived the switch");
    }
    report("the switch is in How social, and writes both halves at once", problems);
    await ctx.close();
  }

  /* --------------------------------------------- 2 · outbound: see nobody */
  {
    await seed(true);
    const problems = [];
    const surfaces = [
      ["Crew", "/m/m1/crew", ".crew-person, .person"],
      ["the Flight Deck's radar", "/", ".radar-dot, [class*=radar] [class*=dot]"],
      ["the module screen", "/m/m1", ".crew-face, .face, .av"],
    ];
    for (const [what, path, sel] of surfaces) {
      const { ctx, page, errs } = await open(browser, ME, path);
      const n = await page.locator(sel).count();
      if (n) problems.push(`${what}: ${n} other people still drawn`);
      for (const e of errs.slice(0, 2)) problems.push(`${what}: ${e.slice(0, 120)}`);
      await ctx.close();
    }
    /* And the libraries say so directly, which is what the screens read. */
    const { ctx, page } = await open(browser, ME, "/m/m1/crew");
    const said = await page.evaluate(async () => {
      const crew = await import("/src/lib/crew.js");
      const presence = await import("/src/lib/presence.js");
      const room = await import("/src/lib/readyRoom.js");
      return {
        crew: await crew.fetchCrew("M1", "student_one"),
        presence: await presence.fetchAllPresence("student_one"),
        formations: await room.fetchFormations("M1"),
      };
    });
    if (said.crew.people.length) problems.push(`fetchCrew returned ${said.crew.people.length} people`);
    if (said.crew.solo !== true) problems.push("fetchCrew did not say it was flying solo");
    if (said.presence.length) problems.push(`fetchAllPresence returned ${said.presence.length} rows`);
    if (said.formations.length) problems.push(`fetchFormations returned ${said.formations.length}`);
    await ctx.close();
    report("flying solo, every surface shows nobody", problems);
  }

  /* ------------------------------ 3 · inbound: the other student's screen */
  {
    await seed(true);
    const problems = [];
    const { ctx, page, errs } = await open(browser, THEM, "/m/m1/crew");
    const text = await page.locator(".deck").innerText().catch(() => "");
    if (/Alex/.test(text)) problems.push("Crew still names them");

    const seen = await page.evaluate(async (me) => {
      const crew = await import("/src/lib/crew.js");
      const presence = await import("/src/lib/presence.js");
      const licence = await import("/src/lib/licence.js");
      const c = await crew.fetchCrew("M1", "student_two");
      return {
        crew: c.people.map((p) => p.user_id ?? p.userId),
        presence: (await presence.fetchAllPresence("student_two")).map((p) => p.user_id),
        card: await licence.fetchCard("student_two", me),
      };
    }, ME);
    if (seen.crew.includes(ME)) problems.push("they are on somebody else's Crew wall");
    if (seen.presence.includes(ME)) problems.push("they are in somebody else's presence");
    if (seen.card) problems.push("somebody else can open their licence card");
    /* The other student is NOT hidden, which is what makes the three above
       mean something: an empty room would pass them all. */
    if (!seen.crew.includes(OTHER)) problems.push("the visible third student is missing from Crew — this walk proved nothing");
    if (!seen.presence.includes(OTHER)) problems.push("the visible third student is missing from presence — this walk proved nothing");
    if (!(await page.evaluate(async (o) => {
      const licence = await import("/src/lib/licence.js");
      return Boolean(await licence.fetchCard("student_two", o));
    }, OTHER))) problems.push("the visible third student's card cannot be opened either — this walk proved nothing");
    for (const e of errs.slice(0, 2)) problems.push(e.slice(0, 120));
    await ctx.close();
    report("nobody else can see them — and the room is not simply empty", problems);
  }

  /* ---------------------------------------- 4 · and it comes back off again */
  {
    await seed(false);
    const problems = [];
    const { ctx, page } = await open(browser, THEM, "/m/m1/crew");
    const back = await page.evaluate(async () => {
      const crew = await import("/src/lib/crew.js");
      return (await crew.fetchCrew("M1", "student_two")).people.map((p) => p.user_id ?? p.userId);
    });
    if (!back.includes(ME)) problems.push("turning it off left them hidden");
    await ctx.close();
    report("turning it off puts them back", problems);
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exitCode = failures ? 1 : 0;
};

run().catch((e) => { console.error(e); process.exit(1); });
