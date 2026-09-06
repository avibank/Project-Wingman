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
  chat: ["comms_messages"],
};
