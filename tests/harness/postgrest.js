/* =============================================================================
   A FAKE POSTGREST, SERVED OVER REAL HTTP.
   -----------------------------------------------------------------------------
   The app keeps its real Supabase client and makes real `fetch` calls; only the
   thing at the other end is ours. That matters for one test in particular.

   §15b.2: "assert on the NETWORK RESPONSE BODY, not the DOM, that another
   student's client never receives the author id of an anonymous question."
   A stubbed `supabase` object cannot answer that question — there is no
   response body to inspect, and asserting on what a stub returned is asserting
   on the stub. With a real HTTP endpoint, Playwright reads the actual bytes
   that crossed the wire.

   The visibility rules below are a deliberate re-implementation of what
   `paper_marks_for` and `paper_ink_for` do in SQL — the rings, the correction
   rule, Fly solo, and the anonymity strip. Where the two could drift, a static
   assertion in check-reader.mjs compares them, because a harness that is
   kinder than the server is worse than no harness.

   Anything not implemented answers 501 rather than [] — a silent empty array is
   how a harness passes a test the product would fail.
   ========================================================================= */
import { MARKS, INK, PROFILES, THREADS } from "./fixture.js";
import { makeStore as coreStore, handle, clone } from "../../src/demo/pgcore.js";

/* A FIXTURE STUDENT HAS BEEN THROUGH THE WALKTHROUGH. It opens by itself for
   anybody who has not, full screen, so without this every suite that loads the
   Flight Deck would load the walkthrough instead. A uid starting "new" is a
   brand-new student and gets it, which is how the walkthrough is walked. */
const startingProgress = (uid) => (/^new/.test(String(uid || ""))
  ? {}
  : { "pw-tour": { at: "2026-09-01T00:00:00.000Z", how: "fixture" } });


/* Reset per page load so tests do not leak into each other. The logic is
   src/demo/pgcore.js's; the fixture and the walkthrough rule are the
   harness's own. */
export function makeStore() {
  return coreStore({
    paper_annotations: clone(MARKS),
    paper_ink: clone(INK),
    pilot_profiles: Object.values(clone(PROFILES)),
    lesson_threads: clone(THREADS),
    defaultProgress: startingProgress,
  });
}

export function postgrestMiddleware() {
  const stores = new Map();       // one store per browser context, keyed by header
  const storeFor = (req) => {
    const key = req.headers["x-harness-store"] || "default";
    if (!stores.has(key)) stores.set(key, makeStore());
    return stores.get(key);
  };

  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/rest/v1/") && !url.pathname.startsWith("/harness/")
        && !url.pathname.startsWith("/storage/v1/object/")) return next();

    /* `.single()` in supabase-js asks for ONE OBJECT with an Accept header,
       and a real PostgREST answers with a bare object rather than an array of
       one. Ignoring that header made every `.insert().select().single()`
       resolve to an array, which the client then spread into an object with
       numeric keys — a saved row that looked saved and rendered as nothing.
       A harness that is kinder than the server is worse than no harness. */
    const wantsOne = String(req.headers.accept || "").includes("pgrst.object");
    const send = (code, body) => {
      if (wantsOne && Array.isArray(body)) {
        if (body.length !== 1) {
          res.statusCode = 406;
          res.setHeader("content-type", "application/json");
          return res.end(JSON.stringify({ message: `harness: expected 1 row, got ${body.length}` }));
        }
        [body] = body;
      }
      res.statusCode = code;
      res.setHeader("content-type", "application/json");
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.end(JSON.stringify(body ?? null));
    };
    if (req.method === "OPTIONS") return send(200, {});

    let body = null;
    /* The raw bytes as well as the parsed object: an upload's body is a WEBP,
       not JSON, and the stream is drained exactly once here. Reading it again
       further down attaches a listener to a finished stream, so `end` never
       fires and the request hangs for ever — which is what the first version
       of the storage branch below did. */
    let raw = null;
    if (req.method !== "GET" && req.method !== "DELETE") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      raw = Buffer.concat(chunks);
      const text = raw.toString("utf8");
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    }

    const store = storeFor(req);

    /* STORAGE, ENOUGH OF IT TO TEST AN UPLOAD. A POST or PUT to an object
       path remembers the byte count; a GET of the public path answers a 1x1
       so an <img> can load. That is the whole of what a screen needs to be
       driven through pick -> crop -> upload -> the cover changing, with no
       real bucket and nothing left in one afterwards.

       It is NOT a proxy. HARNESS_STORAGE_ORIGIN sends this prefix to the real
       project when a test wants the real manual, and vite.config.js decides
       that, not this file — a stub that answered first would silently replace
       the thing that walk exists to measure. */
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const key = url.pathname.replace("/storage/v1/object/", "").replace(/^public\//, "");
      if (req.method === "POST" || req.method === "PUT") {
        store.uploads[key] = raw ? raw.length : 0;
        return send(200, { Key: key });
      }
      if (req.method === "GET") {
        if (!(key in store.uploads)) return send(404, { message: "Object not found" });
        res.statusCode = 200;
        res.setHeader("content-type", "image/gif");
        res.setHeader("access-control-allow-origin", "*");
        return res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
      }
    }

    /* A door for tests: reset, seed, or read the whole store. */
    if (url.pathname === "/harness/reset") { stores.set(req.headers["x-harness-store"] || "default", makeStore()); return send(200, { ok: true }); }
    if (url.pathname === "/harness/store") return send(200, store);

    /* Everything else is the shared core's (src/demo/pgcore.js). The same
       headers it needs, lower-cased, and the body already parsed. */
    const r = handle(store, { method: req.method, url, headers: req.headers, body });
    if (r.status === 501) console.warn(`[harness] ${r.body?.message}`);
    res.statusCode = r.status;
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
    return res.end(JSON.stringify(r.body ?? null));
  };
}
