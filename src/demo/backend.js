/* =============================================================================
   THE DEMO'S DATABASE, IN THIS TAB.
   -----------------------------------------------------------------------------
   supabaseClient.js hands every request here while the demo is on. The store
   is built once, from seed.js, and answered by the same PostgREST core the
   harness serves (pgcore.js), so the demo shows exactly the screens the tests
   drive. Nothing leaves the tab: there is no network in this file.

   THE ROOM STAYS AWAKE. Crew and the right seat count somebody as "here" if
   they were seen in the last few minutes, and a walkthrough takes longer than
   that. So before every request the classmates who were online are seen
   again, now.
   ========================================================================= */
import { makeStore, handle } from "./pgcore.js";
import { seed, DEMO_RPC } from "./seed.js";
import { demoState } from "./mode.js";

let store = null;
const ready = () => {
  if (!store) store = makeStore(seed(demoState || {}));
  return store;
};

function awake(s) {
  const now = new Date().toISOString();
  const me = demoState?.me;
  for (const p of s.presence) if (p.user_id !== me) p.last_seen = now;
}

const json = (status, body) => new Response(body == null ? "null" : JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

export async function demoFetch(input, init = {}) {
  const s = ready();
  awake(s);
  const req = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input), window.location.origin);
  const method = String(init.method || req?.method || "GET").toUpperCase();
  const headers = {};
  new Headers(init.headers || req?.headers || {}).forEach((v, k) => { headers[k.toLowerCase()] = v; });
  let body = null;
  const raw = init.body ?? (req && method !== "GET" && method !== "HEAD" ? await req.text() : null);
  if (raw != null && raw !== "") {
    try { body = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { body = null; }
  }

  /* The social functions the harness never needed come first. */
  if (url.pathname.includes("/rest/v1/rpc/")) {
    const name = url.pathname.split("/rest/v1/rpc/")[1];
    if (DEMO_RPC[name]) {
      try { return json(200, DEMO_RPC[name](s, body || {})); }
      catch (e) { return json(400, { message: String(e?.message || e), code: "P0001" }); }
    }
  }

  /* pgcore reads the path from /rest/v1/ on. The real project's URL has the
     same path, so it is passed through as it came. */
  const path = url.pathname.slice(url.pathname.indexOf("/rest/v1/"));
  const local = new URL(path + url.search, window.location.origin);
  const r = handle(s, { method, url: local, headers, body });
  return json(r.status, r.body);
}

/* For whoever is writing the demo: the store, in the console, in development. */
if (import.meta.env.DEV) window.__demoStore = () => ready();
