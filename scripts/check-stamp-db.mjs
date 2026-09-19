/* THE RULE ONLY THE DATABASE CAN KEEP: a stamp is issued once and never changes.
 *
 * §4 of the handoff: "Issuing is one time only. The server rejects changes once
 * issued_at is set. Validate the code, rim text, shape, pattern and ink on the
 * server as well as in the UI." None of that can be checked by reading the
 * client — the whole point is that the client is not the one deciding, and this
 * client is anonymous from Postgres' point of view, so anyone holding the
 * publishable key can PATCH a row directly.
 *
 * So this drives the real function and the real table over the anon REST path,
 * exactly as a browser would, and deletes every row it makes.
 *
 * Deliberately NOT in `npm run check`, like check:paper-db and check:discovery:
 * that suite must not need credentials. Run it with them:
 *   node --env-file=.env.local scripts/check-stamp-db.mjs
 */
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"); process.exit(2); }
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const made = [];
const uid = (tag) => { const u = `probe_stamp_${tag}_${Date.now()}`; made.push(u); return u; };
const issue = (u, s) => fetch(`${url}/rest/v1/rpc/issue_stamp`, {
  method: "POST", headers: H,
  body: JSON.stringify({ uid: u, p_shape: s.shape, p_code: s.code, p_rim: s.rim !== false, p_ring: s.ring || "", p_pattern: s.pattern || "none", p_ink: s.ink ?? null }),
});

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

try {
  /* ---------------------------------------------------------- it issues */
  const u1 = uid("a");
  let r = await issue(u1, { shape: "roundel", code: "a-r!", rim: true, ring: 'tor"que', pattern: "rays", ink: "Ruby" });
  const row = r.ok ? await r.json() : null;
  ok("issue", "a stamp is issued and comes back as stored", r.status === 200 && !!row);
  ok("issue", "the code is cleaned to the alphabet, upper-cased", row?.stamp_code === "AR", row?.stamp_code);
  ok("issue", "the rim text is cleaned too", row?.stamp_ring === "TORQUE", row?.stamp_ring);
  ok("issue", "the seed is the server's, and a whole number in range",
     Number.isInteger(row?.stamp_seed) && row.stamp_seed >= 1 && row.stamp_seed <= 999999, String(row?.stamp_seed));
  ok("issue", "and it is marked issued", !!row?.stamp_issued_at);

  /* ------------------------------------------------------ and only once */
  r = await issue(u1, { shape: "seal", code: "XX", rim: false, pattern: "none", ink: "Plum" });
  ok("once", "a second issue is refused", r.status === 400 && /already issued/.test(await r.text()));

  r = await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${u1}`, { method: "PATCH", headers: H, body: JSON.stringify({ stamp_code: "ZZ" }) });
  ok("once", "and so is a direct PATCH, which is the path a policy could not close",
     r.status === 400 && /cannot be changed/.test(await r.text()));

  /* The rest of the row is still editable — the stamp is frozen, not the pilot. */
  r = await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${u1}`, { method: "PATCH", headers: H, body: JSON.stringify({ callsign: "Torque" }) });
  ok("once", "the pilot's other fields still are not frozen", r.status === 200);

  /* ------------------------------------------- what the server refuses */
  for (const [what, stamp, con] of [
    ["a shape the renderer cannot draw", { shape: "hexagon", code: "AR" }, "stamp_shape_known"],
    ["a pattern it cannot draw", { shape: "seal", code: "AR", pattern: "tartan" }, "stamp_pattern_known"],
    ["an ink that is a colour rather than a name", { shape: "seal", code: "AR", ink: "oklch(.5 .2 20)" }, "stamp_ink_known"],
    ["a code of nothing but symbols", { shape: "seal", code: "!!" }, "stamp_code_shape"],
    ["a code longer than three", { shape: "seal", code: "ABCD" }, "stamp_code_shape"],
  ]) {
    const r2 = await issue(uid("x"), stamp);
    const body = await r2.text();
    ok("refuses", what, r2.status === 400 && body.includes(con), `${r2.status} ${body.slice(0, 80)}`);
  }

  /* A code of four is cleaned to three rather than refused? It must not be:
     silently keeping the first three would give somebody a stamp they did not
     choose, for ever. The check above asserts the refusal. */

  /* --------------------------------------- every ink in the palette is known */
  const { PALETTE } = await import("../src/lib/stamp.js");
  const refused = [];
  for (const p of PALETTE) {
    const r3 = await issue(uid("i"), { shape: "seal", code: "A", ink: p.n });
    if (r3.status !== 200) refused.push(p.n);
  }
  ok("refuses", `and accepts all thirty-six palette names (${PALETTE.length})`, refused.length === 0, refused.join(" "));
} finally {
  for (const u of made) await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${u}`, { method: "DELETE", headers: H }).catch(() => {});
  const left = await (await fetch(`${url}/rest/v1/pilot_profiles?user_id=like.probe_stamp*&select=user_id`, { headers: H })).json().catch(() => []);
  ok("clean", `every row this made is deleted (${made.length} made)`, Array.isArray(left) && left.length === 0, `${left.length} left`);
}

console.log(`\nstamp-db: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
