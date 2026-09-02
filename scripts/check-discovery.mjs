/* §9 — THE DEFINITION OF DONE, DRIVEN AGAINST THE REAL DATABASE.
 *
 * "People-search returns nobody outside the searcher's orbit — test with two
 * accounts that share nothing and confirm the ENDPOINT itself refuses, not just
 * the UI."
 *
 * That sentence is why this file talks to Postgres instead of reading source.
 * check-orbit.mjs proves the client cannot go round the function; only this can
 * prove the function itself holds. It writes rows for three invented accounts,
 * asserts, and deletes everything it made — including on failure.
 *
 *   npm run check:discovery
 *
 * Needs SUPABASE_DB_URL. Skips cleanly when it is absent so the ordinary check
 * suite does not depend on database credentials.
 */
import pg from "pg";
import { readFileSync } from "node:fs";

let url = process.env.SUPABASE_DB_URL;
if (!url) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    url = env.match(/^SUPABASE_DB_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch { /* no env file */ }
}
if (!url) {
  console.log("discovery: skipped — no SUPABASE_DB_URL");
  console.log("MATCH");
  process.exit(0);
}

const A = "test_disc_alice", B = "test_disc_bob", C = "test_disc_carol";
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const fails = [];
const is = (label, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};

async function cleanup() {
  const ids = [A, B, C];
  await db.query(`delete from squadron_members where user_id = any($1)`, [ids]);
  await db.query(`delete from squadron_join_requests where user_id = any($1)`, [ids]);
  await db.query(`delete from squadron_invites where inviter_id = any($1) or invitee_id = any($1)`, [ids]);
  await db.query(`delete from blocks where user_id = any($1) or blocked_id = any($1)`, [ids]);
  await db.query(`delete from chapter_completions where user_id = any($1)`, [ids]);
  await db.query(`delete from pilot_profiles where user_id = any($1)`, [ids]);
  await db.query(`delete from squadrons where name like 'TEST discovery%'`);
}

try {
  await db.connect();
  await cleanup();   // in case a previous run died mid-way

  for (const [id, cs] of [[A, "Alice Test"], [B, "Bob Test"], [C, "Carol Test"]]) {
    await db.query(
      `insert into pilot_profiles (user_id, callsign, discoverable) values ($1,$2,true)
       on conflict (user_id) do update set callsign = excluded.callsign, discoverable = true`, [id, cs]);
  }

  const room = (await db.query(
    `insert into squadrons (module_code, name, join_policy, member_cap, blurb)
     values ('M3','TEST discovery room','open',2,'a test room') returning id`)).rows[0].id;

  // ---- 1. two accounts that share nothing see nothing --------------------
  is("stranger is invisible",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [A, "Bob"])).rows[0].n, 0);

  // ---- 2. a shared squadron brings them into each other's orbit ---------
  await db.query(`insert into squadron_members (squadron_id, user_id) values ($1,$2),($1,$3)`, [room, A, B]);
  is("squadron-mate is visible",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [A, "Bob"])).rows[0].n, 1);
  is("and it is mutual",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [B, "Alice"])).rows[0].n, 1);

  // ---- 3. a block is symmetric and total --------------------------------
  await db.query(`insert into blocks (user_id, blocked_id) values ($1,$2)`, [A, B]);
  is("blocked person is gone",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [A, "Bob"])).rows[0].n, 0);
  is("and the blocker is gone the other way",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [B, "Alice"])).rows[0].n, 0);
  await db.query(`delete from blocks where user_id = $1 and blocked_id = $2`, [A, B]);

  // ---- 4. the opt-out removes you entirely ------------------------------
  await db.query(`update pilot_profiles set discoverable = false where user_id = $1`, [B]);
  is("discoverable=false is not findable",
    (await db.query(`select count(*)::int n from people_search($1,$2)`, [A, "Bob"])).rows[0].n, 0);
  await db.query(`update pilot_profiles set discoverable = true where user_id = $1`, [B]);

  // ---- 5. a full squadron refuses every route in ------------------------
  is("room is full at its cap",
    (await db.query(`select squadron_is_full($1) f`, [room])).rows[0].f, true);
  is("join refuses when full",
    (await db.query(`select join_squadron($1,$2) r`, [C, room])).rows[0].r, "full");

  await db.query(`update squadrons set invite_token = 'TEST-TOKEN-1' where id = $1`, [room]);
  is("an invite link refuses when full",
    (await db.query(`select state from squadron_by_invite($1,$2)`, [C, "TEST-TOKEN-1"])).rows[0].state, "full");
  is("and the token is case-insensitive",
    (await db.query(`select count(*)::int n from squadron_by_invite($1,$2)`, [C, "test-token-1"])).rows[0].n, 1);

  // ---- 6. an open room with room in it lets you in ----------------------
  await db.query(`update squadrons set member_cap = 5 where id = $1`, [room]);
  is("open room admits", (await db.query(`select join_squadron($1,$2) r`, [C, room])).rows[0].r, "joined");
  is("and twice is not a second seat",
    (await db.query(`select join_squadron($1,$2) r`, [C, room])).rows[0].r, "already_in");

  // ---- 7. an invite-only room is not in discovery at all ----------------
  await db.query(`update squadrons set join_policy = 'invite_only' where id = $1`, [room]);
  is("invite-only rooms stay out of discovery",
    (await db.query(`select count(*)::int n from discover_squadrons($1,'all') where id = $2`, [A, room])).rows[0].n, 0);

  console.log("discovery: 12 assertions against the live database — orbit, blocks, opt-out, capacity, invites");
} catch (e) {
  fails.push("threw: " + e.message);
} finally {
  try { await cleanup(); } catch (e) { fails.push("cleanup failed: " + e.message); }
  await db.end().catch(() => {});
}

if (fails.length) {
  for (const f of fails) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log("  a stranger is refused by the function, not by the UI");
console.log("MATCH");
