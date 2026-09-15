/* The Ready Room rebuild's rules, held without a browser. Every function in
   src/lib/rrModel.js is here; each assertion names the rule it protects. */
import { readFileSync } from "node:fs";
import { deckVars, LIVERIES } from "../src/lib/liveryEngine.js";
import {
  RR_FILTERS, filterPass, statusOf, STATUS_WORD, chipCounts, visibleThreads, keepSelection,
  moveSelection, waitingOnAnswer, moduleLine, dragTo, FW_MIN, DETAIL_MIN, readLayout, layoutKey,
  receiptsFor, tickFor, chatRows, seatFaces, dayName, newestFirst,
} from "../src/lib/rrModel.js";

let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}`); if (!cond) fails += 1; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const me = "u_me";
const at = (h) => `2026-09-14T${String(h).padStart(2, "0")}:00:00.000Z`;
const T = [
  { id: "a", authorId: me, title: "Pitot blockage", body: "which instruments lie", createdAt: at(9) },
  { id: "b", authorId: "u_b", title: "Synchro vs resolver", body: "", createdAt: at(11), bestReplyId: "b.1" },
  { id: "c", authorId: "u_c", title: "Capsule in an ASI", body: "which way", createdAt: at(10) },
  { id: "d", authorId: "u_c", title: "Units", body: "psi or hPa", createdAt: at(11) },
];
const R = [
  { id: "b.1", threadId: "b", authorId: "u_c", parentId: null, createdAt: at(12) },
  { id: "c.1", threadId: "c", authorId: me, parentId: null, createdAt: at(12) },
  { id: "c.2", threadId: "c", authorId: "u_b", parentId: "c.1", createdAt: at(13) },
];
const who = (id) => ({ u_b: "Bader", u_c: "Jouri", [me]: "You" }[id] || "");

console.log("filters");
ok("the filters are locked to Yours, Answered, All", same(RR_FILTERS.map((f) => f.label), ["Yours", "Answered", "All"]));
ok("Yours is asked or answered", filterPass("yours", T[0], { replies: R, me }) && filterPass("yours", T[2], { replies: R, me }) && !filterPass("yours", T[1], { replies: R, me }));
ok("Answered is any answer, a reply to an answer is not one", filterPass("answered", T[1], { replies: R }) && filterPass("answered", T[2], { replies: R }) && !filterPass("answered", T[0], { replies: R }));
ok("chips count before the search", same(chipCounts(T, { replies: R, me }), { yours: 2, answered: 2, all: 4 }));

console.log("status");
ok("a row you asked says Yours", statusOf(T[0], { replies: R, me, row: true }) === "you");
ok("the detail pane never says Yours", statusOf(T[0], { replies: R, me }) === "open");
ok("a best answer signs it off", statusOf(T[1], { replies: R, me }) === "signed");
ok("a deleted best answer signs nothing off", statusOf({ ...T[1], bestReplyId: "gone" }, { replies: R, me }) === "ans");
ok("answers without a mark read Answered", statusOf(T[2], { replies: R, me }) === "ans");
ok("the words are exactly Waiting, Answered, Signed off, Yours", same(Object.values(STATUS_WORD), ["Waiting", "Answered", "Signed off", "Yours"]));

console.log("order and search");
const all = visibleThreads(T, { replies: R, me, who });
ok("newest first, ties by id", same(all.map((t) => t.id), ["b", "d", "c", "a"]));
ok("newestFirst is a stable comparator", newestFirst(T[1], T[3]) < 0 && newestFirst(T[3], T[1]) > 0);
ok("search reads the title, the body and the asker", same(visibleThreads(T, { q: "jouri", replies: R, me, who }).map((t) => t.id), ["d", "c"]) && same(visibleThreads(T, { q: "instruments", replies: R, me, who }).map((t) => t.id), ["a"]));
ok("search applies inside the filter", same(visibleThreads(T, { filter: "answered", q: "which", replies: R, me, who }).map((t) => t.id), ["c"]));

console.log("selection");
ok("a selection that is still listed survives", keepSelection(all, "c") === "c");
ok("one that is not falls to the top", keepSelection(all, "zz") === "b" && keepSelection([], "c") === null);
ok("down moves and stops at the end", moveSelection(all, "c", 1) === "a" && moveSelection(all, "a", 1) === "a");
ok("up moves and stops at the top", moveSelection(all, "d", -1) === "b" && moveSelection(all, "b", -1) === "b");
ok("nothing selected starts at the top", moveSelection(all, null, 1) === "b" && moveSelection([], null, 1) === null);

console.log("header line");
ok("waiting means no answer yet", waitingOnAnswer(T, R) === 2);
ok("a module nobody asked in names the action", moduleLine(0, 0) === "Ask the first one");
ok("counts and the waiting number", moduleLine(4, 2) === "4 questions · 2 waiting on an answer" && moduleLine(1, 1) === "1 question · 1 waiting on an answer");
ok("never a zero waiting", moduleLine(3, 0) === "3 questions · all answered");

console.log("splitter");
ok("under 190px snaps to the wide thread and keeps the width", same(dragTo(150, 1200), { wide: true }));
ok("clamped to 280px", dragTo(200, 1200).fw === `${FW_MIN}px`);
ok("clamped to leave the thread 420px", dragTo(1000, 1200).fw === `${1200 - DETAIL_MIN}px`);
ok("in between is where you let go", same(dragTo(412.4, 1200), { wide: false, fw: "412px" }));
ok("a narrow pane still gives the feed its floor", dragTo(300, 600).fw === "280px");
ok("layout reads back what was written", same(readLayout(JSON.stringify({ fw: "420px", wide: true })), { fw: "420px", wide: true }));
ok("garbage reads as never set", same(readLayout("{nope"), { fw: null, wide: false }) && same(readLayout({ fw: "calc(1px)", wide: "yes" }), { fw: null, wide: false }) && same(readLayout(null), { fw: null, wide: false }));
ok("the layout is kept per person", layoutKey("u_a") !== layoutKey("u_b"));

console.log("ticks");
const rows3 = [
  { user_id: "u_b", delivered_at: at(9), read_at: at(10) },
  { user_id: "u_c", delivered_at: at(9), read_at: null },
  { user_id: "u_d", delivered_at: null, read_at: null },
];
const r3 = receiptsFor(rows3);
ok("receipts split into read and delivered-not-read", r3.others === 3 && same(r3.seen, [["u_b", at(10)]]) && same(r3.deliv, [["u_c", at(9)]]));
ok("one reader of three is not blue", tickFor(r3) === "sent");
ok("everyone has it, one has read it: two grey ticks", tickFor(receiptsFor([rows3[0], rows3[1]])) === "deliv");
ok("everyone has read it: blue", tickFor(receiptsFor([rows3[0], { ...rows3[1], read_at: at(11) }])) === "read");
ok("nobody to send to stays one grey tick", tickFor(receiptsFor([])) === "sent");
ok("a message still sending is one grey tick", tickFor(receiptsFor([rows3[0]]), { pending: true }) === "sent");

console.log("transcript");
const day1 = "2026-09-13T20:14:00.000Z";
const M = [
  { id: "1", authorId: "u_b", createdAt: day1 },
  { id: "2", authorId: "u_b", createdAt: "2026-09-13T20:15:00.000Z" },
  { id: "3", authorId: me, createdAt: at(9) },
  { id: "4", authorId: "u_c", createdAt: at(10) },
  { id: "5", authorId: "u_c", createdAt: at(11), deletedAt: at(11) },
  { id: "6", authorId: "u_c", createdAt: at(12) },
];
const rows = chatRows(M, { lastReadAt: at(9) + "", me });
const kinds = rows.map((r) => (r.type === "msg" ? `${r.m.id}${r.first ? "*" : ""}` : r.type));
ok("a day pill, then grouped runs", same(kinds, ["day", "1*", "2", "day", "3*", "new", "4*", "5*", "6*"]));
ok("the unread line counts unread from others, not deleted ones", rows.find((r) => r.type === "new").count === 2);
ok("no unread line when everything is read", !chatRows(M, { lastReadAt: at(13), me }).some((r) => r.type === "new"));

console.log("rail faces");
const faces = seatFaces({
  seatPartner: "u_s",
  flightLog: [{ userId: "u_old", lastAt: at(1) }, { userId: "u_new", lastAt: at(5) }, { userId: "u_gone", lastAt: at(8) }],
  mates: ["u_old", "u_new", "u_on", "u_off"],
  online: new Set(["u_on", "u_new"]),
});
ok("the seat first, then the newest flight, never an ex-mate", same(faces.map((f) => f.id), ["u_s", "u_new", "u_old"]));
ok("dots say seat, online, away", same(faces.map((f) => f.on), ["seat", "1", "0"]));
ok("with no log, mates in the room come first", same(seatFaces({ mates: ["u_off", "u_on"], online: new Set(["u_on"]) }).map((f) => f.id), ["u_on", "u_off"]));
ok("nothing to show is an empty row", same(seatFaces({}), []));

console.log("days");
const now = new Date(2026, 8, 14, 12);
ok("today and yesterday", dayName(new Date(2026, 8, 14, 8).toISOString(), now) === "today" && dayName(new Date(2026, 8, 13, 23).toISOString(), now) === "yesterday");
ok("the weekday inside the week", dayName(new Date(2026, 8, 12, 9).toISOString(), now) === "Saturday");
ok("the date after that", dayName(new Date(2026, 8, 1, 9).toISOString(), now) === "1 Sept" || dayName(new Date(2026, 8, 1, 9).toISOString(), now) === "1 Sep");
ok("no date is no word", dayName(null, now) === "");

console.log("the stylesheet as sent, and what was fixed in it");
const css = readFileSync("src/components/room/ready-room.css", "utf8");
/* Declarations at the top level, outside any rule. The stripped keyboard hint
   left two lines of them, and a browser reads those as the start of a rule
   that runs on to the next `{` — the whole @media (min-width:1660px) block. */
const stray = [];
{
  let depth = 0;
  let text = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") { if (depth === 0 && text.includes(";")) stray.push(text.trim().slice(0, 60)); depth += 1; text = ""; }
    else if (ch === "}") { if (depth === 0) { if (text.includes(";")) stray.push(text.trim().slice(0, 60)); } else depth -= 1; text = ""; }
    else if (depth === 0) text += ch;
  }
  if (text.includes(";")) stray.push(text.trim().slice(0, 60));
}
ok("no declarations sit outside a rule, so nothing swallows the block after them", stray.length === 0);
ok("the wide screen keeps its context column", /@media \(min-width:1660px\)\{\s*\.rr-detail\{ grid-template-columns: minmax\(0,1fr\) 316px; \}\s*\.rr-ctx\{ display:block; \}/.test(css));
ok("day mode is on the app's own selector, .app.theme-light", (css.match(/\.app\.theme-light \.rr/g) || []).length === 3 && !/\.theme-light \.rr/.test(css.replace(/\.app\.theme-light/g, "")));
ok("the reset stays at zero specificity", css.includes(":where(.rr) :where(button, input, textarea){ font:inherit; color:inherit; background:none; border:0; }"));
ok("a short transcript sits at the bottom without column-reverse", /\.rr-tin\{ min-height:100%; display:flex; flex-direction:column; justify-content:flex-end;/.test(css) && !/column-reverse/.test(css));

console.log("what the markup has to hold that the stylesheet cannot");
const src = (f) => readFileSync(`src/components/room/rr/${f}`, "utf8");
ok("a feed row is not a button, so Save and Share are not nested inside one", /<div className="rr-frow"/.test(src("Threads.jsx")) && !/<button[^>]*className="rr-frow"/.test(src("Threads.jsx")));
ok("an answer's vote has no down arrow — 0010: endorsed, not buried", /downable=\{false\}/.test(src("Detail.jsx")));
ok("the hover actions sit inside the bubble, where the 66px offset lands beside it", /\n {10}<div className="rr-qa">/.test(src("Chat.jsx")));
ok("Message info's empty lines never state absence", !/No one yet/.test(src("SeenPanel.jsx")));
const fit = readFileSync("src/components/room/rr-app.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
ok("the room's own rules never key off .rr, which the reader's tray also uses",
  !/:has\(\.rr\)/.test(fit) && /\.app\.smooth-air \.rr\[data-view\] \*/.test(fit));
ok("and the reader undoes what the room's root would paint on its Ready Room row",
  /\.app \.rdr \.rr \{[^}]*flex-direction: row/.test(readFileSync("src/components/paper/v6/additions.css", "utf8")));
const live = readFileSync("src/lib/live.js", "utf8");
ok("receipts listen on their own list, never inside chat, which writes them", /receipts: \["comms_receipts"\]/.test(live) && !/chat: \[[^\]]*comms_receipts/.test(live));

console.log("contrast — every livery, both variants, on the surface actually behind the words");
{
  /* The same method as check:contrast: linear light, a surface composited over
     its own ground; color-mix in OKLab, premultiplied, as CSS mixes it. */
  const toLin = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => Math.min(1, Math.max(0, x)));
  };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const col = (L, C, H, A = 1) => { const h = (H * Math.PI) / 180; return { lab: [L, C * Math.cos(h), C * Math.sin(h)], a: A }; };
  const WHITE = { lab: [1, 0, 0], a: 1 };
  const CLEAR = { lab: [0, 0, 0], a: 0 };
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
    return m ? col(+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]) : null;
  };
  const mix = (x, p, y) => {
    const a = x.a * p + y.a * (1 - p);
    return a ? { lab: [0, 1, 2].map((i) => (x.lab[i] * x.a * p + y.lab[i] * y.a * (1 - p)) / a), a } : CLEAR;
  };
  const over = (fg, bg) => toLin(fg.lab).map((v, i) => bg[i] + (v - bg[i]) * fg.a);
  const worst = {};
  const need = (name, r, min) => { if (!worst[name] || r < worst[name].r) worst[name] = { r, min }; };
  for (const variant of ["night", "day"]) {
    for (const L of LIVERIES) {
      const v = deckVars(L.id, variant).vars;
      const t = (k) => parse(v[k]);
      const day = variant === "day";
      const ground = toLin(t("--ground").lab);
      const panel = over(t("--panel"), ground);
      const raised = over(t("--raised"), ground);
      const sunk = over(t("--sunk"), ground);
      const composer = over(mix(t("--ground"), 0.9, t("--panel")), ground);
      const bubIn = over(day ? mix(WHITE, 0.94, t("--panel")) : mix(t("--raised"), 0.88, t("--ground")), ground);
      const bubOut = over(day ? mix(t("--active"), 0.16, WHITE) : mix(t("--active"), 0.24, t("--raised")), ground);
      const tint = (k, p, base) => over(mix(t(k), p, CLEAR), base);
      const c = (x) => toLin(x.lab);
      const words = day ? t("--active-text") : t("--active");
      const onTint = day ? t("--active-text") : t("--lit");
      const at = (s) => `${s}, ${variant}`;
      need(at("white on a filled accent (badge, Ask, Post)"), ratio(c(t("--on-mark")), c(day ? t("--active-fill") : t("--active"))), 4.5);
      need(at("accent words on the ground (See all, unread line)"), ratio(c(words), ground), 4.5);
      need(at("the voted count"), ratio(c(words), sunk), 4.5);
      need(at("Yours on its tint"), ratio(c(onTint), tint("--active", 0.11, panel)), 4.5);
      need(at("the reply draft's name"), ratio(c(onTint), tint("--active", 0.11, composer)), 4.5);
      need(at("a quoted name in a bubble"), ratio(c(onTint), tint("--active", 0.12, bubIn)), 4.5);
      need(at("Waiting on its tint"), ratio(c(day ? mix(t("--caution"), 0.5, t("--t1")) : t("--caution")), tint("--caution", 0.11, panel)), 4.5);
      need(at("Signed off on its tint"), ratio(c(day ? t("--ok") : mix(t("--ok"), 0.7, t("--t1"))), tint("--ok", 0.11, panel)), 4.5);
      need(at("muted words on a selected row"), ratio(c(day ? t("--t3") : t("--t2")), raised), 4.5);
      need(at("the time in their bubble"), ratio(c(day ? t("--t3") : t("--t2")), bubIn), 4.5);
      need(at("the time in your bubble"), ratio(c(day ? t("--t3") : mix(t("--t2"), 0.7, t("--t1"))), bubOut), 4.5);
      need(at("grey ticks in your bubble, 3:1 for an icon"), ratio(c(day ? t("--t3") : t("--t2")), bubOut), 3);
      need(at("the quoted line in your bubble"), ratio(c(day ? t("--t2") : mix(t("--t2"), 0.5, t("--t1"))), tint("--active", 0.12, bubOut)), 4.5);
      need(at("the quoted line in their bubble"), ratio(c(day ? t("--t3") : mix(t("--t2"), 0.5, t("--t1"))), tint("--active", 0.12, bubIn)), 4.5);
      need(at("the reply draft's line"), ratio(c(t("--t2")), tint("--active", 0.11, composer)), 4.5);
      need(at("Message info's Read label"), ratio(c(t("--lit")), raised), 4.5);
      let name = Infinity;
      for (let h = 0; h < 360; h += 5) name = Math.min(name, ratio(c(col(day ? 0.47 : 0.74, 0.13, h)), bubIn));
      need(at("a sender's name at its worst hue"), name, 4.5);
    }
  }
  for (const [name, { r, min }] of Object.entries(worst)) ok(`${name} — worst ${r.toFixed(2)}`, r >= min);
  const app = readFileSync("src/components/room/rr-app.css", "utf8");
  ok("rr-app.css draws what was measured", [
    "background: var(--active-fill)", "color: var(--active-text)", "color: var(--lit)",
    "color-mix(in oklab, var(--caution) 50%, var(--t1))", "color-mix(in oklab, var(--ok) 70%, var(--t1))",
    "color-mix(in oklab, var(--t2) 70%, var(--t1))", "color-mix(in oklab, var(--t2) 50%, var(--t1))",
  ].every((d) => app.includes(d)));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
