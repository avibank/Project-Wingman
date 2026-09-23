/* 0035 — THE CODE IS THE STAMP, and 0036 — ALL OF THE STAMP, driven against
 * the live database.
 *
 * Over the anon REST path the app itself uses, as two throwaway accounts, and
 * every row deleted afterwards. The trigger and the cleanup need the database
 * URL, so like check:board-db this is NOT in `npm run check`: that suite must
 * not need credentials.
 *
 * Run: npm run check:licence-db
 */
import pg from "pg";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
if (!url || !key || !dbUrl) {
  console.error("Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_DB_URL in .env.local.");
  process.exit(2);
}

const rpc = async (fn, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, j };
};

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(name); console.log(`  FAIL ${name}  ${detail}`); }
};

const tag = Date.now().toString(36);
const A = `chk_lic_A_${tag}`, B = `chk_lic_B_${tag}`, C = `chk_lic_C_${tag}`, D = `chk_lic_D_${tag}`;
const stamp = { p_shape: "seal", p_rim: true, p_ring: "", p_pattern: "none", p_ink: null };
const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  const r1 = await rpc("issue_licence", { uid: A, p_code: "a10", ...stamp });
  ok("a code with a 1 and a 0 is issued, lifted to upper case",
     r1.status === 200 && r1.j?.code === "A10" && r1.j?.stamp_code === "A10", JSON.stringify(r1).slice(0, 200));
  ok("and the seed and the date are the server's", Number.isInteger(r1.j?.stamp_seed) && Boolean(r1.j?.stamp_issued_at));

  const r2 = await rpc("issue_licence", { uid: A, p_code: "Z99", ...stamp });
  ok("a second licence is refused", r2.status >= 400 && /already issued/.test(JSON.stringify(r2.j)), JSON.stringify(r2).slice(0, 200));

  const r3 = await rpc("issue_licence", { uid: B, p_code: "A10", ...stamp });
  ok("somebody else's code is refused by name, which the creator reads",
     r3.status >= 400 && /code is taken/.test(JSON.stringify(r3.j)), JSON.stringify(r3).slice(0, 200));
  const b3 = (await c.query("select stamp_issued_at from pilot_profiles where user_id = $1", [B])).rows[0];
  ok("and issues nothing", !b3?.stamp_issued_at);

  /* TWO CHARACTERS IS A CODE SINCE 0039, so what is refused here is four:
     that migration lowered the floor to one and left the ceiling alone. B has
     to come out of this with no stamp, because the two claim_code assertions
     below are about an account that has not issued one. */
  const r4 = await rpc("issue_licence", { uid: B, p_code: "Q7X9", ...stamp });
  ok("four characters is not a code", r4.status >= 400 && /one to three/.test(JSON.stringify(r4.j)), JSON.stringify(r4).slice(0, 200));

  const r5 = await rpc("claim_code", { uid: A, want: "B22" });
  ok("claim_code will not move an issued code", r5.status === 200 && r5.j === null, JSON.stringify(r5));

  const r6 = await rpc("claim_code", { uid: B, want: "C01" });
  ok("claim_code takes digits", r6.status === 200 && r6.j === "C01", JSON.stringify(r6));

  let refused = "no error";
  try { await c.query("update pilot_profiles set code = 'X99' where user_id = $1", [A]); } catch (e) { refused = e.message; }
  ok("and the trigger holds an issued code too", /cannot be changed/.test(refused), refused);

  const def = (await c.query("select pg_get_constraintdef(oid) d from pg_constraint where conname = 'pilot_code_shape'")).rows[0]?.d;
  ok("the CHECK is A-Z and 0-9, one to three of them", /\[A-Z0-9\]\{1,3\}/.test(def || ""), def);

  /* 0036 — the ten-argument call the creator makes now: a shape and a
     pattern the old checks refused, where the pattern sits, and two inks. */
  const full = { p_shape: "roundel", p_rim: true, p_ring: "wng", p_pattern: "crochet", p_ink: "Ruby",
                 p_pscope: "rim", p_pink: "Matcha", p_cink: "Plum" };
  const r7 = await rpc("issue_licence", { uid: C, p_code: "H3X", ...full });
  ok("0036: Crochet issues, with where the pattern sits and both extra inks",
     r7.status === 200 && r7.j?.stamp_shape === "roundel" && r7.j?.stamp_pattern === "crochet" && r7.j?.stamp_pscope === "rim"
     && r7.j?.stamp_pink === "Matcha" && r7.j?.stamp_cink === "Plum" && r7.j?.stamp_ring === "WNG", JSON.stringify(r7).slice(0, 240));
  const r8 = await rpc("issue_licence", { uid: D, p_code: "S7D", ...stamp, p_shape: "tag", p_pattern: "knurl" });
  ok("0036: the seven-argument call a deployed bundle makes still reaches its own overload, with Knurl",
     r8.status === 200 && r8.j?.stamp_shape === "tag" && r8.j?.stamp_pattern === "knurl", JSON.stringify(r8).slice(0, 240));
  const r8b = await rpc("issue_licence", { uid: `${D}h`, p_code: "H3X", ...full, p_shape: "hex" });
  const r8c = await rpc("issue_licence", { uid: `${D}s`, p_code: "S1D", ...full, p_shape: "shield" });
  ok("0037: the hex and the shield are refused by the server", r8b.status >= 400 && r8c.status >= 400, `${r8b.status} ${r8c.status}`);
  const r9 = await rpc("issue_licence", { uid: `${C}x`, p_code: "Q1Z", ...full, p_pink: "Neon" });
  ok("0036: an ink that is not one of the thirty-six is refused", r9.status >= 400, JSON.stringify(r9).slice(0, 200));
  let held = "no error";
  try { await c.query("update pilot_profiles set stamp_pink = 'Ruby' where user_id = $1", [C]); } catch (e) { held = e.message; }
  ok("0036: and the new three are as permanent as the rest", /cannot be changed/.test(held), held);
  /* ---------------------------------------------------------------- 0039 */
  const E = `chk_lic_E_${tag}`, F = `chk_lic_F_${tag}`;
  const r10 = await rpc("issue_licence", { uid: E, p_code: "k", ...stamp });
  ok("0039: a code of ONE character is issued", r10.status === 200 && r10.j?.code === "K", JSON.stringify(r10).slice(0, 200));
  const r11 = await rpc("issue_licence", { uid: F, p_code: "4z", ...stamp });
  ok("0039: and one of two", r11.status === 200 && r11.j?.code === "4Z", JSON.stringify(r11).slice(0, 200));
  const r12 = await rpc("issue_licence", { uid: `${F}x`, p_code: "ABCD", ...stamp });
  ok("0039: four is still refused", r12.status >= 400, JSON.stringify(r12).slice(0, 160));
  const r13 = await rpc("issue_licence", { uid: `${F}y`, p_code: "!!", ...stamp });
  ok("0039: and a code with nothing in the alphabet is refused", r13.status >= 400, JSON.stringify(r13).slice(0, 160));

  /* The one change: refused with no credit, allowed with one, refused again
     after it is spent — and the code moves with the stamp. */
  const r14 = await rpc("issue_licence", { uid: E, p_code: "KK", ...stamp, p_shape: "tag" });
  ok("0039: a second stamp is refused when no change is owed", r14.status >= 400, JSON.stringify(r14).slice(0, 160));
  ok("0039: and the account starts with none owed",
     (await c.query("select stamp_redo from pilot_profiles where user_id = $1", [E])).rows[0]?.stamp_redo === 0);
  const granted = await c.query("select grant_stamp_redo($1) as n", [E]);
  ok("0039: the owner can grant one", granted.rows[0].n === 1, JSON.stringify(granted.rows[0]));
  const r15 = await rpc("issue_licence", { uid: E, p_code: "KK9", ...stamp, p_shape: "tag", p_pattern: "rays" });
  ok("0039: which spends on ONE change, stamp and code together",
     r15.status === 200 && r15.j?.code === "KK9" && r15.j?.stamp_code === "KK9"
     && r15.j?.stamp_shape === "tag" && r15.j?.stamp_redo === 0, JSON.stringify(r15).slice(0, 240));
  const r16 = await rpc("issue_licence", { uid: E, p_code: "K7", ...stamp });
  ok("0039: and then it is permanent again", r16.status >= 400, JSON.stringify(r16).slice(0, 160));

  /* The credit is the whole of the permission, so it must not be writable by
     the key every browser carries. */
  const raise = await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${E}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ stamp_redo: 3 }),
  });
  const raised = (await c.query("select stamp_redo from pilot_profiles where user_id = $1", [E])).rows[0]?.stamp_redo;
  ok("0039: nobody can hand themselves a change with the publishable key",
     raise.status >= 400 && raised === 0, `${raise.status} redo=${raised}`);
  let stampHeld = "no error";
  try { await c.query("update pilot_profiles set stamp_shape = 'seal' where user_id = $1", [E]); } catch (e) { stampHeld = e.message; }
  ok("0039: and a stamp that has had its change is as permanent as it ever was",
     /cannot be changed/.test(stampHeld), stampHeld);

  const card = await rpc("licence_card", { p_viewer: A, p_user: C });
  ok("0036: a classmate opening the licence gets all of it",
     card.status === 200 && card.j?.[0]?.stamp_pscope === "rim" && card.j?.[0]?.stamp_cink === "Plum", JSON.stringify(card).slice(0, 200));
} finally {
  const del = await c.query("delete from pilot_profiles where user_id = any($1)",
    [[A, B, C, D, `${C}x`, `${D}h`, `${D}s`, `chk_lic_E_${tag}`, `chk_lic_F_${tag}`, `chk_lic_F_${tag}x`, `chk_lic_F_${tag}y`]]);
  ok("every row it made is deleted", del.rowCount >= 4, String(del.rowCount));
  const left = await c.query("select count(*)::int n from pilot_profiles where user_id like $1", [`chk_lic_%_${tag}%`]);
  ok("and none is left behind", left.rows[0].n === 0, String(left.rows[0].n));
  await c.end();
}

console.log(`\nlicence-db: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
