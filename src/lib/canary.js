/* =============================================================================
   IS THE PAGE ACTUALLY STYLED? Asked of the page, not of the network.
   -----------------------------------------------------------------------------
   The owner's iPhone drew the Flight Deck in Safari's own grey buttons, twice,
   after two fixes to how the stylesheet is fetched — while Chrome on the same
   phone, the same WebKit, drew it whole, and every simulator here did too.
   recover.js never reported anything from that phone, so whatever Safari is
   doing, the stylesheet arrives looking complete. This asks the question the
   student sees instead: are the stylesheet's rules in force?

   Three seconds after load it checks two things the entry stylesheet decides
   on every screen — a token on :root, and the wordmark's background, which
   is transparent when the stylesheet applies and Safari's grey button when
   it does not. If either is wrong, it sends what it can see about every
   stylesheet to `reports` (target_id 'layout'), through fieldReport, which
   reaches the real database even from inside the demo.

   `?diag` on any address sends the same report whatever the result, and
   draws it on the page in a panel that needs no stylesheet, so it can be
   read, or photographed, on the phone itself.
   ========================================================================= */
import { fieldReport } from "./fieldReport.js";

const short = (href) => (href ? href.replace(/^https?:\/\/[^/]+/, "") : null);
const sel = (r) => (r ? (r.selectorText || r.cssText || "").slice(0, 60) : null);

function sheetInfo(s) {
  const info = { href: short(s.href) || "inline", disabled: s.disabled, media: s.media?.mediaText || "" };
  let rules;
  try { rules = s.cssRules; } catch (e) { return { ...info, error: e.name }; }
  const types = {};
  for (const r of rules) types[r.constructor.name] = (types[r.constructor.name] || 0) + 1;
  const out = { ...info, rules: rules.length, first: sel(rules[0]), last: sel(rules[rules.length - 1]), types };
  /* The entry stylesheet in more detail: a sample of where its rules are, so
     a sheet that lost its middle can be told from one that lost its end. */
  if (/\/assets\/index-/.test(s.href || "")) {
    out.sample = [];
    for (let i = 0; i < rules.length; i += Math.max(1, Math.floor(rules.length / 12))) out.sample.push(`${i}:${sel(rules[i])}`);
    out.has = {
      topbar: [...rules].some((r) => /\.topbar\b/.test(r.selectorText || "")),
      strip: [...rules].some((r) => /\.strip\b/.test(r.selectorText || "")),
      buttons: [...rules].some((r) => /(^|,)\s*button\b/.test(r.selectorText || "")),
    };
  }
  return out;
}

export function diagnose() {
  const root = getComputedStyle(document.documentElement);
  const brand = document.querySelector(".topbar .brandmark");
  const brandBg = brand ? getComputedStyle(brand).backgroundColor : null;
  const token = root.getPropertyValue("--fs-base").trim();
  const clear = !brandBg || brandBg === "transparent" || /rgba\(0, 0, 0, 0\)/.test(brandBg);
  const mq = (q) => window.matchMedia?.(q).matches;
  return {
    ok: Boolean(token) && clear,
    token,
    brandBg,
    script: short(document.querySelector('script[type="module"][src]')?.src),
    links: [...document.querySelectorAll('link[rel~="stylesheet"]')].map((l) => ({ href: short(l.href), sheet: Boolean(l.sheet), media: l.media, disabled: l.disabled })),
    sheets: [...document.styleSheets].map(sheetInfo),
    app: document.querySelector(".app")?.className || null,
    html: [...document.documentElement.attributes].map((a) => `${a.name}=${a.value}`).join(" "),
    view: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
    media: {
      dark: mq("(prefers-color-scheme: dark)"), reduce: mq("(prefers-reduced-motion: reduce)"),
      contrast: mq("(prefers-contrast: more)"), invert: mq("(inverted-colors: inverted)"), forced: mq("(forced-colors: active)"),
    },
  };
}

function show(d) {
  const box = document.createElement("div");
  box.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;background:#0b1526;color:#e8edf2;font:12px/1.45 ui-monospace,Menlo,monospace;padding:16px;overflow:auto;white-space:pre-wrap;-webkit-text-size-adjust:100%");
  const close = document.createElement("button");
  close.textContent = "Close";
  close.setAttribute("style", "all:initial;display:block;margin:0 0 12px;padding:10px 16px;background:#e8edf2;color:#0b1526;font:600 14px system-ui;border-radius:8px");
  close.onclick = () => box.remove();
  box.append(close, document.createTextNode(`${d.ok ? "STYLED" : "NOT STYLED"} — sent to Wingman\n\n${JSON.stringify(d, null, 1)}`));
  document.body.append(box);
}

export function watchLayout() {
  if (typeof window === "undefined") return;
  const asked = new URLSearchParams(window.location.search).has("diag");
  setTimeout(() => {
    let d;
    try { d = diagnose(); } catch (e) { d = { ok: false, error: String(e).slice(0, 200) }; }
    if (!d.ok || asked) fieldReport("layout", { asked, ...d });
    if (asked) show(d);
  }, 3000);
}
