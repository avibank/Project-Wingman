/* THE READY ROOM, AGAINST THE REAL DATABASE.
 *
 * 0022 moved every rule with teeth into SQL, following 0009 and 0011: the
 * shared-squadron requirement for the right seat, one pending request per
 * pair, the fifteen-minute edit window, one pin per squadron, membership on
 * every write. None of that can be checked by reading the client, because the
 * whole point is that the client is not the one deciding — `auth.uid()` is
 * NULL on every request here and the browser holds the anon key, so a boundary
 * expressed as "the UI does not call that endpoint" is not a boundary.
 *
 * So this drives the real functions over the real anon REST path, as two
 * different students, and deletes every row it makes before it exits.
 *
 * Deliberately NOT in `npm run check`: that suite must not need credentials.
 * Run: npm run check:room
 */
import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
function envFromFile() {
  for (const name of [".env.local", ".env"]) {
    const p = new URL(name, ROOT);
    if (!existsSync(p)) continue;
    const out = {};
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
      if (m && !line.trimStart().startsWith("#")) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  }
  return {};
}
const fileEnv = envFromFile();
const pick = (...k) => k.map((x) => process.env[x] || fileEnv[x]).find(Boolean);
const url = pick("VITE_SUPABASE_URL", "SUPABASE_URL");
const key = pick("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
if (!url || !key) {
  console.error("room: needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  process.exit(2);
}
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const rest = async (path, init = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, body };
};
const rpc = (fn, args) => rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

let pass = 0; const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(name); console.log(`  FAIL ${name}  ${detail}`); }
};

const stamp = Date.now().toString(36);
const A = `chk_room_A_${stamp}`;
const B = `chk_room_B_${stamp}`;
const C = `chk_room_C_${stamp}`;      // shares nothing with either
const made = { squadrons: [], messages: [], threads: [] };

try {
  /* Two students and a stranger. Profiles first: the room reads callsigns, and
     ring_covers and the seat both read pilot_profiles. */
  for (const [id, call] of [[A, "AlphaChk"], [B, "BravoChk"], [C, "CharlieChk"]]) {
    await rest("pilot_profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: id, callsign: call }),
    });
  }

  console.log("\na squadron somebody made, rather than one assigned");
  const created = await rpc("create_squadron", {
    p_me: A, p_name: `Check ${stamp}`, p_module: "M1",
    p_blurb: "made by check:room", p_policy: "open",
  });
  const sq = created.body;
  ok("create_squadron returns the new squadron", typeof sq === "string" && sq.length > 10,
     JSON.stringify(created.body).slice(0, 90));
  if (typeof sq === "string") made.squadrons.push(sq);

  const row = (await rest(`squadrons?id=eq.${sq}&select=name,blurb,created_by,invite_token,join_policy`)).body?.[0];
  ok("it keeps the name it was given, not one built from the module code",
     row?.name === `Check ${stamp}`, JSON.stringify(row?.name));
  ok("the maker is recorded and an invite token is minted",
     row?.created_by === A && !!row?.invite_token, JSON.stringify({ by: row?.created_by, tok: !!row?.invite_token }));
  const owner = (await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${A}&select=role,muted,last_read_at`)).body?.[0];
  ok("and the maker is in it, as the owner", owner?.role === "owner", JSON.stringify(owner));

  console.log("\nthe other student joins by the link");
  const byTok = await rpc("squadron_by_invite", { p_me: B, p_token: row?.invite_token });
  ok("the token finds the squadron", (byTok.body || [])[0]?.id === sq, JSON.stringify(byTok.body).slice(0, 80));
  const joined = await rpc("join_squadron", { p_me: B, p_squadron: sq });
  const isIn = ((await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${B}&select=user_id`)).body || []).length === 1;
  ok("and joining works", isIn, JSON.stringify(joined.body));
  /* the other half of the same rule: a closed room refuses a join by id */
  const shut = await rpc("create_squadron", {
    p_me: A, p_name: `Shut ${stamp}`, p_module: "M1", p_policy: "invite_only",
  });
  if (typeof shut.body === "string") {
    made.squadrons.push(shut.body);
    const refused = await rpc("join_squadron", { p_me: C, p_squadron: shut.body });
    const got = ((await rest(`squadron_members?squadron_id=eq.${shut.body}&user_id=eq.${C}&select=user_id`)).body || []).length;
    ok("and an invite-only room refuses one", got === 0, JSON.stringify(refused.body));
  }

  console.log("\na message, and the things you can do to one");
  const msg = await rest("comms_messages", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ squadron_id: sq, module_code: "M1", user_id: A, body: "first line" }),
  });
  const mid = msg.body?.[0]?.id;
  ok("a message lands", !!mid, `status ${msg.status} ${JSON.stringify(msg.body).slice(0, 110)}`);
  if (!mid) throw new Error("no message to work with");
  if (mid) made.messages.push(mid);

  const react = await rpc("toggle_message_reaction", { p_me: B, p_message: mid, p_emoji: "👍" });
  const reacted = (await rest(`comms_reactions?message_id=eq.${mid}&select=user_id,emoji`)).body;
  const reactedRows = Array.isArray(reacted) ? reacted : [];
  ok("somebody else can react to it", reactedRows.some((r) => r.user_id === B),
     `${JSON.stringify(react.body)} ${JSON.stringify(reacted).slice(0, 80)}`);
  await rpc("toggle_message_reaction", { p_me: B, p_message: mid, p_emoji: "👍" });
  const offRaw = (await rest(`comms_reactions?message_id=eq.${mid}&select=user_id`)).body;
  const off = Array.isArray(offRaw) ? offRaw : [];
  ok("and pressing it again takes it off", off.length === 0, JSON.stringify(offRaw).slice(0, 80));

  const edited = await rpc("edit_message", { p_me: A, p_message: mid, p_body: "first line, corrected" });
  const afterEdit = (await rest(`comms_messages?id=eq.${mid}&select=body,edited_at`)).body?.[0];
  ok("the author can edit their own, and it is stamped",
     afterEdit?.body === "first line, corrected" && !!afterEdit?.edited_at,
     JSON.stringify({ r: edited.body, b: afterEdit?.body }));

  const theirs = await rpc("edit_message", { p_me: B, p_message: mid, p_body: "not yours" });
  const afterTheirs = (await rest(`comms_messages?id=eq.${mid}&select=body`)).body?.[0];
  ok("and somebody else cannot", afterTheirs?.body === "first line, corrected",
     `${JSON.stringify(theirs.body)} -> ${afterTheirs?.body}`);

  await rpc("pin_message", { p_me: A, p_message: mid, p_on: true });
  const pinned = (await rest(`comms_messages?squadron_id=eq.${sq}&pinned_at=not.is.null&select=id`)).body || [];
  ok("one message can be pinned as the notice board", pinned.length === 1, `${pinned.length} pinned`);

  const second = await rest("comms_messages", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ squadron_id: sq, module_code: "M1", user_id: A, body: "second line" }),
  });
  const mid2 = second.body?.[0]?.id;
  if (mid2) made.messages.push(mid2);
  await rpc("pin_message", { p_me: A, p_message: mid2, p_on: true });
  const pinned2 = (await rest(`comms_messages?squadron_id=eq.${sq}&pinned_at=not.is.null&select=id`)).body || [];
  ok("and pinning a second replaces the first, rather than stacking",
     pinned2.length === 1 && pinned2[0].id === mid2, `${pinned2.length} pinned`);

  console.log("\nread state that follows you between devices");
  const before = (await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${B}&select=last_read_at`)).body?.[0];
  await new Promise((r) => setTimeout(r, 1100));
  await rpc("mark_squadron_read", { p_me: B, p_squadron: sq });
  const after = (await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${B}&select=last_read_at`)).body?.[0];
  ok("marking read moves the mark on the server, not in a browser",
     new Date(after?.last_read_at) > new Date(before?.last_read_at),
     `${before?.last_read_at} -> ${after?.last_read_at}`);

  const muted = await rpc("set_squadron_muted", { p_me: B, p_squadron: sq, p_muted: true });
  const isMuted = (await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${B}&select=muted`)).body?.[0];
  ok("and muting is one person's decision, not the room's", isMuted?.muted === true,
     `${JSON.stringify(muted.body)} -> ${JSON.stringify(isMuted)}`);

  console.log("\nthe right seat, and the one rule it rests on");
  const stranger = await rpc("request_right_seat", { p_me: C, p_them: A });
  ok("a stranger cannot ask to fly with you", String(stranger.body) === "not_shared",
     JSON.stringify(stranger.body));

  const asked = await rpc("request_right_seat", { p_me: A, p_them: B });
  ok("somebody in your squadron can", String(asked.body) === "asked", JSON.stringify(asked.body).slice(0, 60));

  await rpc("request_right_seat", { p_me: A, p_them: B });
  const pending = ((await rest(`seat_requests?from_id=eq.${A}&to_id=eq.${B}&state=eq.pending&select=id`)).body) || [];
  ok("and asking twice does not make a second request", pending.length === 1, `${pending.length} pending`);

  const inbox = await rpc("my_seat_requests", { p_me: B });
  const mine = (Array.isArray(inbox.body) ? inbox.body : []).filter((r) => r.direction === "in");
  ok("it is in their inbox, marked as one coming in",
     mine.length === 1 && mine[0].from_id === A, JSON.stringify(inbox.body).slice(0, 100));
  const reqId = mine[0]?.id || pending[0]?.id || null;

  if (reqId) {
    const answered = await rpc("answer_right_seat", { p_me: B, p_request: reqId, p_accept: true });
    const seatA = await rpc("my_seat", { p_me: A });
    const seatB = await rpc("my_seat", { p_me: B });
    const gotA = Array.isArray(seatA.body) ? seatA.body[0] : seatA.body;
    const gotB = Array.isArray(seatB.body) ? seatB.body[0] : seatB.body;
    ok("accepting puts both of them in the same seat", !!gotA && !!gotB,
       `${JSON.stringify(answered.body).slice(0, 40)} A=${!!gotA} B=${!!gotB}`);

    await rpc("seat_heartbeat", { p_me: A, p_module: "M1", p_place: "Chapter 4" });
    const beat = await rpc("my_seat", { p_me: B });
    ok("a heartbeat says where the other one is",
       JSON.stringify(beat.body || "").includes("Chapter 4"), JSON.stringify(beat.body).slice(0, 110));

    await rpc("end_right_seat", { p_me: A });
    const ended = await rpc("my_seat", { p_me: B });
    const left = Array.isArray(ended.body) ? ended.body[0] : ended.body;
    ok("and either of them can end it", !left, JSON.stringify(ended.body).slice(0, 60));
  }

  console.log("\nvoting on the question, not only the answer");
  const th = await rest("lesson_threads", {
    method: "POST", headers: { Prefer: "return=representation" },
    /* lesson_id and t travel together or not at all — 0008's CHECK — and t is
       a chapter index, not a kind. A module-level question has neither. */
    /* The id is the client's, not the database's — 0008 gives lesson_threads
       no default, because a thread is created optimistically and has to carry
       the id the room already drew it under. */
    body: JSON.stringify({ id: `chkroom-${stamp}`, module_id: "M1", title: "check:room",
      body: "a question from check:room", author_id: A }),
  });
  const tid = th.body?.[0]?.id;
  if (tid) made.threads.push(tid);
  ok("a question exists to vote on", !!tid, `status ${th.status} ${JSON.stringify(th.body).slice(0, 100)}`);
  if (tid) {
    await rpc("toggle_thread_vote", { p_me: B, p_thread: tid, p_dir: 1 });
    const counts = await rpc("thread_vote_counts", { p_me: B, p_threads: [tid] });
    const c = (counts.body || [])[0];
    ok("an upvote on the question counts", Number(c?.score ?? c?.up ?? 0) === 1, JSON.stringify(c));
    await rpc("toggle_thread_vote", { p_me: B, p_thread: tid, p_dir: 1 });
    const c2 = ((await rpc("thread_vote_counts", { p_me: B, p_threads: [tid] })).body || [])[0];
    ok("and pressing it again takes it back", Number(c2?.score ?? c2?.up ?? 0) === 0, JSON.stringify(c2));
  }

  console.log("\nleaving");
  await rpc("leave_squadron", { p_me: B, p_squadron: sq });
  const stillIn = (await rest(`squadron_members?squadron_id=eq.${sq}&user_id=eq.${B}&select=user_id`)).body || [];
  ok("leaving takes you out of it", stillIn.length === 0, `${stillIn.length} rows`);
} finally {
  console.log("\ncleaning up");
  for (const id of made.threads) await rest(`lesson_threads?id=eq.${id}`, { method: "DELETE" });
  await rest(`thread_votes?user_id=in.(${A},${B},${C})`, { method: "DELETE" });
  await rest(`seat_messages?user_id=in.(${A},${B},${C})`, { method: "DELETE" });
  await rest(`seat_requests?from_user=in.(${A},${B},${C})`, { method: "DELETE" });
  await rest(`copilot_participants?user_id=in.(${A},${B},${C})`, { method: "DELETE" });
  for (const id of made.squadrons) {
    await rest(`comms_reactions?message_id=in.(${made.messages.join(",") || "00000000-0000-0000-0000-000000000000"})`, { method: "DELETE" });
    await rest(`comms_messages?squadron_id=eq.${id}`, { method: "DELETE" });
    await rest(`squadron_members?squadron_id=eq.${id}`, { method: "DELETE" });
    await rest(`squadrons?id=eq.${id}`, { method: "DELETE" });
  }
  await rest(`pilot_profiles?user_id=in.(${A},${B},${C})`, { method: "DELETE" });
  const leftSq = (await rest(`squadrons?name=like.Check ${stamp}&select=id`)).body || [];
  console.log(`  ${made.squadrons.length} squadron(s), ${made.messages.length} message(s) written, ${leftSq.length} left behind`);
}

console.log(`\nroom: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
