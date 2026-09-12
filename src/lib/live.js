/* =============================================================================
   Live updates — the socket, kept off the first-paint path.
   -----------------------------------------------------------------------------
   supabaseClient.js takes PostgrestClient alone and explains why: createClient()
   drags auth-js, storage-js, realtime-js and phoenix into the entry chunk for
   features with no call site. That reasoning still holds — so realtime-js is
   imported HERE, dynamically, and only when something actually wants to listen.
   Nobody who never opens a social surface pays for it.

   What this is not: presence, cursors, or a second copy of the data. A message
   arriving tells the app to re-read the rows it already knows how to read. The
   payload is a doorbell, not a delivery — which means there is exactly one code
   path that turns rows into state, and the socket cannot drift from it.
   ========================================================================= */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* One socket for the whole app. Two components listening is two subscriptions
   on one connection, not two connections. */
let clientPromise = null;

async function getClient() {
  if (!url || !anonKey) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/realtime-js")
      .then(({ RealtimeClient }) => new RealtimeClient(
        `${url.replace(/^http/, "ws")}/realtime/v1`,
        {
          params: { apikey: anonKey, eventsPerSecond: 20 },
          // A dropped socket on a phone that went in a pocket has to come back
          // on its own; the caller is not expected to babysit it.
          reconnectAfterMs: (tries) => [1000, 2000, 5000, 10000][tries - 1] || 10000,
        },
      ))
      .catch((e) => { console.error(e); return null; });
  }
  return clientPromise;
}

/* Listen to a set of tables. Returns an unsubscribe function, always — a caller
   that gets null back and forgets to check is the classic way a socket outlives
   the screen that opened it.

   `onChange` is called with the table name. It is deliberately not given the
   row: see the header. */
export function listen(tables, onChange, onStatus) {
  let channel = null;
  let live = true;

  getClient().then((client) => {
    if (!client || !live) return;
    if (client.connectionState() === "closed") client.connect();
    channel = client.channel(`wingman:${tables.join("-")}:${Math.random().toString(36).slice(2, 8)}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (live) onChange(table);
      });
    }
    channel.subscribe((status) => {
      // SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED. The caller uses this to
      // decide how hard its fallback timer has to work.
      if (live) onStatus?.(status);
    });
  });

  return () => {
    live = false;
    if (channel) { try { channel.unsubscribe(); } catch { /* already gone */ } }
  };
}

export const LIVE_TABLES = {
  discussion: ["lesson_threads", "lesson_replies"],
  chat: ["comms_messages", "comms_reactions"],
  seat: ["seat_requests", "copilot_sessions", "seat_messages"],
};

/* =============================================================================
   TYPING — the one thing that must NOT go through a table.

   "X is typing" is true for about two seconds and is worthless the moment it
   is stale. Writing it to Postgres would mean a row per keystroke burst, a
   realtime event per row, and a tombstone to clean up — for a fact with a two
   second shelf life. Realtime's broadcast channel is the right shape: it is
   fire-and-forget, it never touches the database, and a dropped packet costs a
   missing indicator rather than a wrong one.

   The indicator EXPIRES ON THE RECEIVER, not on a stop signal. Somebody who
   starts typing and then closes the tab never sends the stop, so a design that
   waits for one shows them typing for ever.
   ========================================================================= */
export function typingChannel(room, me, onTyping) {
  let channel = null;
  let live = true;
  const seen = new Map();
  let timer = null;

  const sweep = () => {
    const cut = Date.now() - 4000;
    let changed = false;
    for (const [id, at] of seen) if (at < cut) { seen.delete(id); changed = true; }
    if (changed && live) onTyping([...seen.keys()]);
    if (!seen.size && timer) { clearInterval(timer); timer = null; }
  };

  getClient().then((client) => {
    if (!client || !live) return;
    if (client.connectionState() === "closed") client.connect();
    channel = client.channel(`typing:${room}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!live || !payload?.id || payload.id === me) return;
      seen.set(payload.id, Date.now());
      onTyping([...seen.keys()]);
      if (!timer) timer = setInterval(sweep, 1000);
    });
    channel.subscribe();
  });

  return {
    /* Called on a keystroke and throttled by the caller — one packet a second
       is plenty for a two second indicator. */
    ping() {
      try { channel?.send({ type: "broadcast", event: "typing", payload: { id: me } }); }
      catch { /* the socket is down; the indicator is the least of it */ }
    },
    stop() {
      live = false;
      if (timer) clearInterval(timer);
      if (channel) { try { channel.unsubscribe(); } catch { /* already gone */ } }
    },
  };
}
