/* THE RANKING RULES, DRIVEN AGAINST THE REAL DATABASE. Run:
 *   node --env-file=.env.local scripts/check-board-db.mjs
 *
 * R5 of the exam brief asks for exactly this: "A unit test on the ranking
 * function covering: equal scores split by time; a faster but lower score
 * ranking below; an unfinished attempt never appearing."
 *
 * It has to be the real function, not a model of it. R5's other half is that
 * the ranking is decided SERVER-SIDE and the client only formats — so a test
 * that re-implements the ordering in JavaScript is testing the thing that is
 * explicitly not allowed to decide. Everything below goes over the anon REST
 * path, exactly as the browser does, and deletes every row it makes.
 *
 * Deliberately NOT in `npm run check`, like check:stamp-db and check:paper-db:
 * that suite must not need credentials.
 */
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"); process.exit(2); }
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };

const STAMP = Date.now();
const QUIZ = `probe.board.${STAMP}`;
const users = [];
const uid = (tag) => { const u = `probe_board_${tag}_${STAMP}`; users.push(u); return u; };

const rpc = (name, body) => fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: H, body: JSON.stringify(body) });
const json = async (r) => (r.ok ? r.json() : null);

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* A run with a time we choose. `start_quiz_run` stamps started_at = now(), so
 * the only way to sit a paper that took four minutes without waiting four
 * minutes is to move its start backwards afterwards — which is a PATCH on the
 * row, the same anonymous access every other table here has. That is the cost
 * 0034's header states, and it is what makes this test possible. */
async function run({ user, score, secs, finish = true }) {
  const started = await json(await rpc("start_quiz_run",
    { uid: user, p_module: "M1", p_chapter: "M1.01", p_quiz: QUIZ, p_total: 8 }));
  const id = typeof started === "string" ? started : started?.[0] || started;
  if (!finish) return id;
  await rpc("finish_quiz_run", { uid: user, p_run: id, p_score: score });
  if (secs != null) {
    await fetch(`${url}/rest/v1/quiz_runs?id=eq.${id}`, {
      method: "PATCH", headers: H,
      body: JSON.stringify({ started_at: new Date(Date.now() - secs * 1000).toISOString() }),
    });
  }
  return id;
}
const board = async (me, limit) => (await json(await rpc("quiz_leaderboard",
  { uid: me, p_quiz: QUIZ, ...(limit ? { p_limit: limit } : {}) }))) || [];

try {
  const fast = uid("fast"), slow = uid("slow"), low = uid("low"), unfinished = uid("open"), solo = uid("solo");

  await run({ user: slow, score: 7, secs: 600 });   // same score, slower
  await run({ user: fast, score: 7, secs: 120 });   // same score, faster
  await run({ user: low,  score: 5, secs: 30 });    // faster, but lower
  await run({ user: unfinished, finish: false });   // never handed in

  let rows = await board(fast);

  /* ---- R5 · score first, then time ------------------------------------- */
  ok("rank", "equal scores are split by time, faster first",
     rows[0]?.user_id === fast && rows[1]?.user_id === slow,
     rows.map((r) => `${r.rank}:${r.score}/${r.seconds}s`).join(" "));
  ok("rank", "a faster but lower score ranks below both",
     rows[2]?.user_id === low && rows[2]?.seconds < rows[0]?.seconds,
     `${rows[2]?.score} in ${rows[2]?.seconds}s`);
  ok("rank", "an unfinished attempt never appears",
     !rows.some((r) => r.user_id === unfinished), `${rows.length} rows`);
  ok("rank", "the rank is 1..n with no gaps and no ties",
     rows.map((r) => Number(r.rank)).join(",") === rows.map((_, i) => i + 1).join(","),
     rows.map((r) => r.rank).join(","));
  ok("rank", "the seconds are the server's, from the two stamps",
     rows[0]?.seconds >= 118 && rows[0]?.seconds <= 122, String(rows[0]?.seconds));
  ok("rank", "and every row carries the size of the board it is in",
     rows.every((r) => Number(r.runs_total) === rows.length), String(rows[0]?.runs_total));

  /* ---- R6 · a run is a row, and it is yours or it is not --------------- */
  ok("rows", "exactly one row is marked as yours", rows.filter((r) => r.is_you).length === 1);
  ok("rows", "and it is the one that is yours", rows.find((r) => r.is_you)?.user_id === fast);

  const twice = uid("twice");
  await run({ user: twice, score: 6, secs: 300 });
  await run({ user: twice, score: 8, secs: 400 });
  rows = await board(twice);
  const mine = rows.filter((r) => r.user_id === twice);
  ok("rows", "one account sitting twice is two ranked rows, not one",
     mine.length === 2 && mine[0].rank !== mine[1].rank,
     mine.map((r) => `${r.rank}:${r.score}`).join(" "));
  ok("rows", "and both are marked as yours", mine.every((r) => r.is_you));

  /* ---- resuming is the same sitting ------------------------------------ */
  const again = uid("again");
  const first = await run({ user: again, finish: false });
  const second = await run({ user: again, finish: false });
  ok("rows", "coming back to a paper is the same run, not a second one", first === second,
     `${first} vs ${second}`);

  /* ---- handing in twice cannot move a time ----------------------------- */
  const once = uid("once");
  const id = await run({ user: once, score: 4, secs: 200 });
  const before = (await board(once)).find((r) => r.run_id === id);
  await rpc("finish_quiz_run", { uid: once, p_run: id, p_score: 8 });
  const after = (await board(once)).find((r) => r.run_id === id);
  ok("rows", "handing in a second time changes nothing",
     before?.score === 4 && after?.score === 4 && before?.seconds === after?.seconds,
     `${before?.score}→${after?.score}`);

  /* ---- a score outside the paper is refused ---------------------------- */
  const cheat = uid("cheat");
  const cid = await run({ user: cheat, score: 99, secs: 100 });
  const crow = (await board(cheat)).find((r) => r.run_id === cid);
  ok("rows", "a score bigger than the paper is clamped, not stored",
     crow?.score === 8, String(crow?.score));

  /* ---- Fly solo, and the one exception --------------------------------- */
  await fetch(`${url}/rest/v1/pilot_profiles`, {
    method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: solo, callsign: `SOLO${STAMP % 10000}`, invisible: true }),
  });
  await run({ user: solo, score: 8, secs: 60 });
  const otherSees = await board(fast);
  const soloSees = await board(solo);
  ok("solo", "somebody flying solo is not on anybody else's board",
     !otherSees.some((r) => r.user_id === solo), `${otherSees.length} rows`);
  ok("solo", "but they are on their own, or it could not tell them where they came",
     soloSees.some((r) => r.user_id === solo && r.is_you));

  /* ---- the name is the one the run was handed in under ----------------- */
  const named = uid("named");
  await fetch(`${url}/rest/v1/pilot_profiles`, {
    method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: named, callsign: "FIRSTNAME", code: "Z9Z" }),
  });
  await run({ user: named, score: 3, secs: 90 });
  await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${named}`, {
    method: "PATCH", headers: H, body: JSON.stringify({ callsign: "SECONDNAME" }),
  });
  await run({ user: named, score: 3, secs: 95 });
  const two = (await board(named)).filter((r) => r.user_id === named);
  ok("name", "a run keeps the callsign it was handed in under",
     two.length === 2 && new Set(two.map((r) => r.callsign)).size === 2,
     two.map((r) => r.callsign).join(" "));
  ok("name", "under one account code, which is what makes them one person",
     two.every((r) => r.code === "Z9Z"), two.map((r) => r.code).join(" "));

  /* ---- R7 · every row carries a stamp, in the same answer --------------- */
  const stamped = uid("stamped");
  await fetch(`${url}/rest/v1/rpc/issue_stamp`, {
    method: "POST", headers: H,
    body: JSON.stringify({ uid: stamped, p_shape: "roundel", p_code: "B7Q", p_rim: true,
                           p_ring: "TORQUE", p_pattern: "rays", p_ink: "Ruby" }),
  });
  await run({ user: stamped, score: 2, secs: 150 });
  const srow = (await board(stamped)).find((r) => r.user_id === stamped);
  ok("stamp", "a row carries the student's stamp, not a second round trip",
     srow?.stamp_shape === "roundel" && srow?.stamp_ink === "Ruby"
     && Number.isInteger(srow?.stamp_seed) && !!srow?.stamp_issued_at,
     `${srow?.stamp_shape}/${srow?.stamp_ink}`);
  ok("stamp", "and a student with no stamp answers with nothing rather than a default",
     (await board(fast)).find((r) => r.user_id === fast)?.stamp_shape === null);

  /* ---- the limit is the server's ---------------------------------------- */
  ok("limit", "the board honours a limit", (await board(fast, 2)).length === 2);
} catch (e) {
  fails.push(`threw — ${e.message}`);
  console.log(`  FAIL threw — ${e.message}`);
} finally {
  await fetch(`${url}/rest/v1/quiz_runs?quiz_id=eq.${QUIZ}`, { method: "DELETE", headers: H });
  for (const u of users) {
    await fetch(`${url}/rest/v1/pilot_profiles?user_id=eq.${u}`, { method: "DELETE", headers: H });
  }
  const left = await (await fetch(`${url}/rest/v1/quiz_runs?quiz_id=eq.${QUIZ}&select=id`, { headers: H })).json();
  console.log(`\ncleanup: ${Array.isArray(left) && left.length === 0 ? "every row this made is gone" : `${left?.length} LEFT BEHIND`}`);
}

console.log(`\nboard: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
