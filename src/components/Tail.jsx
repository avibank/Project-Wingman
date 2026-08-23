import { LIVERIES } from "./LiveryPicker.jsx";

// §2.9 — a tail is hue + marking + initial, always, at every size. Colour is
// never the sole channel for identity anywhere in this app. Below ~16px the
// initial stops being legible and drops; the marking stays.

const HUE = Object.fromEntries(LIVERIES.map((l) => [l.id, l.hw]));
const IDS = new Set(LIVERIES.map((l) => l.id));
export const hueOf = (livery) => HUE[livery] ?? HUE["dawn-patrol"];
// The paint comes from the generated livery tokens, never from a hue
// re-derived here: the liveries are authored in oklch, and the same number
// read as an HSL hue lands in a different colour entirely.
const liveryId = (id) => (IDS.has(id) ? id : "dawn-patrol");

const MARKING_LABEL = {
  solid: "solid ring",
  double: "double ring",
  dashed: "dashed ring",
  notched: "notched ring",
};

function Tail({ name, livery = "dawn-patrol", marking = "solid", size = 40, staff = false }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showInitial = size >= 16;
  const stroke = Math.max(1.5, size * 0.075);
  const r = (size - stroke * (marking === "double" ? 4 : 2)) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  // Rendered as one ring, varied by dash pattern, so a marking can never
  // disagree with itself across sizes.
  const dash =
    marking === "dashed" ? `${circumference / 16} ${circumference / 16}`
    : marking === "notched" ? `${circumference * 0.72} ${circumference * 0.28}`
    : undefined;

  return (
    <span
      className={`tail ${staff ? "is-staff" : ""}`}
      style={{
        "--tail-ink": `var(--tail-${liveryId(livery)})`,
        "--tail-bg": `var(--tail-${liveryId(livery)}-bg)`,
        width: size, height: size,
      }}
      title={`${name || "Pilot"} · ${MARKING_LABEL[marking] || marking}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} className="tail-ring"
          style={{ strokeWidth: stroke, strokeDasharray: dash }} />
        {marking === "double" && (
          <circle cx={c} cy={c} r={r + stroke * 2} className="tail-ring tail-ring--outer"
            style={{ strokeWidth: stroke }} />
        )}
      </svg>
      {showInitial && <span className="tail-initial" style={{ fontSize: size * 0.38 }}>{initial}</span>}
      {/* §7.1 — staff hold real seats only when badged as such */}
      {staff && size >= 32 && <span className="tail-staff" aria-label="Wingman staff">✦</span>}
      <span className="sr-only">
        {name || "Pilot"}{staff ? ", Wingman staff" : ""}, {MARKING_LABEL[marking] || marking}
      </span>
    </span>
  );
}

export function TailStyles() {
  return (
    <style>{`
      .tail { position: relative; display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; border-radius: 50%; background: var(--tail-bg); }
      .tail svg { position: absolute; inset: 0; }
      .tail-ring { fill: none; stroke: var(--tail-ink); stroke-linecap: round; }
      .tail-ring--outer { opacity: 0.55; }
      .tail-initial { position: relative; font-family: var(--font-mono); line-height: 1;
        color: var(--tail-ink); letter-spacing: 0; }
      .tail-staff { position: absolute; right: -1px; bottom: -1px; font-size: 12px; line-height: 1;
        color: var(--text-1); background: var(--surface-0); border-radius: 50%;
        width: 13px; height: 13px; display: grid; place-items: center; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    `}</style>
  );
}

export default Tail;
