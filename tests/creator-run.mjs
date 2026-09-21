/* =============================================================================
   THE STAMP CREATOR, CHECKED THE WAY THE OWNER ASKED — ON A REAL PAGE.
   -----------------------------------------------------------------------------
   The owner's list (2026-09-21), one PASS or FAIL a line, against any base:

     CREATOR_BASE=https://www.wingman.institute npm run test:creator
     CREATOR_BASE=http://127.0.0.1:5190 npm run test:creator      (harness)
     CREATOR_BROWSER=webkit CREATOR_WIDTH=390 ...                  (Safari's engine, a phone)
     CREATOR_PLANT=1 ...   doubles the rim text; the last line must FAIL

   It opens /account/licence?creator, which shows the creator to anybody —
   as a preview, whose only missing part is the button that issues — so it
   runs signed out and makes nothing.

   "Rim text never touches either border" is measured in PIXELS with the
   page's own font: the preview's stamp is copied, drawn twice at 900px — the
   rim text alone, then everything else alone — and a pixel inked in both is
   a touch. Shield and hex are no longer offered (owner, later the same day),
   so the shapes checked are the six the creator shows.
   ========================================================================= */
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";

const BASE = process.env.CREATOR_BASE || "http://127.0.0.1:5190";
const ENGINE = process.env.CREATOR_BROWSER === "webkit" ? webkit : chromium;
const WIDTH = Number(process.env.CREATOR_WIDTH || 1440);
const SIX = ["seal", "roundel", "window", "gauge", "postage", "tag"];
const PATTERNS = ["None", "Rays", "Checks", "Guilloche", "Crochet", "Knurl"];
const rows = [];
const line = (ok, what, detail = "") => { rows.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  — ${detail}` : ""}`); };

const browser = await ENGINE.launch();
const cx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 700 ? 844 : 900 }, deviceScaleFactor: 1 });
const pg = await cx.newPage();
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const harness = /127\.0\.0\.1|localhost/.test(BASE) ? "&uid=none" : "";
await pg.goto(`${BASE}/account/licence?creator${harness}`);
await pg.waitForSelector(".studio", { timeout: 20000 });
if (process.env.CREATOR_PLANT) await pg.evaluate(() => { window.__plant = true; });
await pg.waitForTimeout(800);
const tab = async (n) => { await pg.locator(".stabs button", { hasText: n }).click(); await pg.waitForTimeout(250); };
/* Rows and columns of a set of tiles, from where they are drawn. */
const grid = (sel) => pg.evaluate((s) => {
  const r = [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
  const ys = [...new Set(r.map((x) => Math.round(x.top)))], xs = [...new Set(r.map((x) => Math.round(x.left)))];
  return { n: r.length, rows: ys.length, cols: xs.length };
}, sel);

/* 1 · Shape tab */
await tab("Shape");
{
  const names = await pg.$$eval(".srow.shp [data-shape]", (b) => b.map((x) => x.dataset.shape));
  const g = await grid(".srow.shp [data-shape]");
  line(JSON.stringify(names) === JSON.stringify(SIX) && g.cols === 3 && g.rows === 2,
       "Shape tab: 6 shapes (seal, roundel, window, gauge, postage, tag), three across, two rows — no shield, no hex",
       `${names.join(", ")} · ${g.cols} across, ${g.rows} rows`);
}

/* 2 · Pattern tab */
await tab("Pattern");
{
  const names = await pg.$$eval(".srow.pat3 [data-pat] small", (s) => s.map((x) => x.textContent.trim()));
  const g = await grid(".srow.pat3 [data-pat]");
  const retired = await pg.evaluate(() => /\b(Lace|Polka|Waves|Swirl|Stars)\b/.test(document.querySelector(".sbody").innerText));
  line(JSON.stringify(names) === JSON.stringify(PATTERNS) && g.cols === 3 && g.rows === 2 && !retired,
       "Pattern tab: exactly None, Rays, Checks, Guilloche, Crochet, Knurl — three across, two rows, none retired",
       `${names.join(", ")} · ${g.cols} across, ${g.rows} rows${retired ? " · a retired name is on the tab" : ""}`);
}

/* 3 · Both / Centre / Rim */
{
  await pg.locator('[data-pat="none"]').click(); await pg.waitForTimeout(200);
  const before = await pg.locator(".seg2 [data-scope]").count();
  await pg.locator('[data-pat="rays"]').click(); await pg.waitForTimeout(250);
  const after = await pg.$$eval(".seg2 [data-scope]", (b) => b.map((x) => x.textContent.trim()));
  line(before === 0 && JSON.stringify(after) === JSON.stringify(["Both", "Centre", "Rim"]),
       "Pattern tab: Both / Centre / Rim appear once a pattern is picked", `before ${before}, after ${after.join(" / ")}`);
}

/* 4 · the two colour grids */
{
  const pat = await pg.evaluate(() => ({ grid: document.querySelectorAll(".sbody .pal [data-pink]").length, same: [...document.querySelectorAll(".sbody .schip")].some((b) => b.textContent.trim() === "Same as the ink") }));
  await tab("Ink");
  const ink = await pg.evaluate(() => ({ grid: document.querySelectorAll(".sbody .pal [data-ink]").length, code: document.querySelectorAll(".sbody .pal [data-cink]").length, same: [...document.querySelectorAll(".sbody .schip")].some((b) => b.textContent.trim() === "Same as the ink") }));
  line(pat.grid === 36 && pat.same && ink.grid === 36 && ink.same && ink.code === 36,
       "Pattern and Ink tabs each have their own colour grid with \"Same as the ink\"",
       `pattern grid ${pat.grid}${pat.same ? " + same" : ""}; ink grid ${ink.grid}, code grid ${ink.code}${ink.same ? " + same" : ""}`);
}

/* 5 · the code box */
{
  const ph = await pg.getAttribute(".crow .cin", "placeholder");
  line(ph === "WNG", "The code box placeholder says WNG", `"${ph}"`);
}

/* 8 (checked here, while the Ink tab is open) · Matcha */
{
  const rgb = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('.sbody .pal [data-ink]')].find((x) => x.getAttribute("aria-label") === "Matcha");
    const c = getComputedStyle(b.querySelector("i")).backgroundColor;
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const g = cv.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  const hex = `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const want = [0x9c, 0xc4, 0x4e];
  line(rgb.every((v, i) => Math.abs(v - want[i]) <= 3), "Matcha in the colour grid is a bright yellow-green (#9CC44E), not a grey sage", hex);
}

/* the preview's stamp, drawn twice at 900px, black on white: the rim text
   alone, then the borders alone — every stroked outline and the code frame.
   Everything else (the code in the middle, the stars, the rim's invisible
   carrier paths) is in neither. */
const variants = async (only) => pg.evaluate(async (which) => {
  const src = document.querySelector(".spaper .big svg");
  const host = document.getElementById("rimtest") || Object.assign(document.createElement("div"), { id: "rimtest" });
  host.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;background:#fff;width:900px;height:900px;line-height:0";
  document.body.append(host);
  const svg = src.cloneNode(true);
  svg.setAttribute("width", "900"); svg.setAttribute("height", "900");
  svg.style.color = "#000";
  svg.querySelectorAll("[filter]").forEach((e) => e.removeAttribute("filter"));
  svg.querySelectorAll("[opacity]").forEach((e) => e.removeAttribute("opacity"));
  /* EACH UNWANTED ELEMENT HIDDEN ON ITS OWN. Hiding the whole <svg> and
     showing the wanted parts is what this did first, and WebKit does not let
     a child's `visibility: visible` show through a hidden <svg> root: both
     layers came out blank there, and a blank layer "touches" nothing —
     measured, the Safari run passed with nothing drawn. */
  const rimText = (e) => e.tagName === "text" && !!e.querySelector("textPath");
  /* CREATOR_PLANT=1 doubles the rim text, which must then be caught touching:
     the proof that this measurement can fail. */
  if (which === "rim" && window.__plant) svg.querySelectorAll("text").forEach((t) => t.setAttribute("font-size", String(2 * +t.getAttribute("font-size"))));
  for (const e of svg.querySelectorAll("path,circle,rect,ellipse,text")) {
    if (e.closest("mask,clipPath,defs")) continue;
    const inText = e.tagName !== "text" && e.closest("text");
    if (inText) continue;
    const border = e.tagName !== "text" && e.getAttribute("stroke") !== "none" && !e.closest('[stroke="none"]');
    const keep = which === "rim" ? rimText(e) : border;
    if (!keep) e.style.visibility = "hidden";
  }
  host.replaceChildren(svg);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, only);
const ink = (buf) => { const p = PNG.sync.read(buf), m = new Uint8Array(p.width * p.height);
  for (let i = 0; i < m.length; i++) m[i] = p.data[i * 4] < 200 ? 1 : 0; return { m, w: p.width, h: p.height }; };
async function touches(shape, ring) {
  await tab("Shape"); await pg.locator(`.srow.shp [data-shape="${shape}"]`).click();
  await tab("Rim"); await pg.locator(".sin").fill(ring); await pg.waitForTimeout(250);
  await variants("rim"); const A = ink(await pg.locator("#rimtest").screenshot());
  await variants("rest"); const B = ink(await pg.locator("#rimtest").screenshot());
  await pg.evaluate(() => document.getElementById("rimtest")?.remove());
  let both = 0, near = 0;
  const inkA = A.m.reduce((n, v) => n + v, 0), inkB = B.m.reduce((n, v) => n + v, 0);
  /* A layer with nothing in it proves nothing: say so rather than pass. */
  if (inkA < 200 || inkB < 200) return { both: -1, gap: NaN, empty: `rim ${inkA}px, borders ${inkB}px` };
  for (let i = 0; i < A.m.length; i++) if (A.m[i] && B.m[i]) both++;
  /* and the closest approach, in stamp units (900px = 49.2 units) */
  const pts = []; for (let y = 0; y < A.h; y += 2) for (let x = 0; x < A.w; x += 2) if (A.m[y * A.w + x]) pts.push([x, y]);
  let best = Infinity;
  for (let y = 0; y < B.h; y += 2) for (let x = 0; x < B.w; x += 2) if (B.m[y * B.w + x]) {
    for (const [ax, ay] of pts) { const d = Math.abs(ax - x) + Math.abs(ay - y); if (d < best) best = d; if (best === 0) break; }
  }
  near = best;
  return { both, gap: (near * 49.2 / 900) };
}

/* 6 · WNG sits small and centred at the top — on a plain stamp */
{
  await pg.locator(".cin").fill("");
  await tab("Pattern"); await pg.locator('[data-pat="none"]').click(); await pg.waitForTimeout(200);
  const out = [];
  for (const shape of SIX) {
    await tab("Shape"); await pg.locator(`.srow.shp [data-shape="${shape}"]`).click();
    await tab("Rim"); await pg.locator(".sin").fill("WNG"); await pg.waitForTimeout(250);
    out.push(await pg.evaluate((s) => {
      const t = [...document.querySelectorAll(".spaper .big svg text")].find((x) => x.querySelector("textPath")?.getAttribute("href")?.startsWith("#rt"));
      const p = document.querySelector(t.querySelector("textPath").getAttribute("href"));
      const L = p.getTotalLength(), tl = +t.querySelector("textPath").getAttribute("textLength");
      const a = t.getStartPositionOfChar(0), z = t.getEndPositionOfChar(t.getNumberOfChars() - 1);
      const cx = s === "tag" ? 25 : 20;
      return { s, frac: tl / L, mid: (a.x + z.x) / 2, y: (a.y + z.y) / 2, cx };
    }, shape));
  }
  /* positions are in the stamp's own units, before the preview's -5° tilt */
  const bad = out.filter((o) => !(o.frac <= 0.5 && Math.abs(o.mid - o.cx) < 1 && o.y < 20));
  line(!bad.length, "Rim text WNG sits small and centred at the top, not stretched across the arc (all six shapes; shield and hex are no longer offered)",
       out.map((o) => `${o.s} ${(o.frac * 100).toFixed(0)}% of the arc`).join(", ") + (bad.length ? ` · off: ${bad.map((o) => o.s).join(", ")}` : ""));
}

/* 7 · never touches either border */
{
  const res = [];
  for (const shape of SIX) for (const ring of ["WNG", "WINGMAN", "HANGAR SIX"]) res.push({ shape, ring, ...(await touches(shape, ring)) });
  const bad = res.filter((r) => r.both !== 0);
  const tight = res.reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity });
  line(!bad.length, "Rim text never touches either border on any of the six shapes (WNG, WINGMAN, HANGAR SIX; pixels in both)",
       bad.length ? bad.map((r) => `${r.shape}/${r.ring}: ${r.empty ? `nothing drawn (${r.empty})` : `${r.both}px in both`}`).join(", ") : `closest approach ${tight.gap.toFixed(2)} units (${tight.shape}, ${tight.ring})`);
}

if (errs.length) console.log("page errors:", errs.slice(0, 3));
await browser.close();
console.log(`\ncreator: ${rows.filter(Boolean).length} of ${rows.length} pass`);
process.exit(rows.every(Boolean) ? 0 : 1);
