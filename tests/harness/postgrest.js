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

const clone = (v) => JSON.parse(JSON.stringify(v));

/* Reset per page load so tests do not leak into each other. */
export function makeStore() {
  return {
    paper_annotations: clone(MARKS),
    paper_ink: clone(INK),
    pilot_profiles: Object.values(clone(PROFILES)),
    lesson_threads: clone(THREADS),
    lesson_replies: [],
    user_progress: [],
    blocks: [], mutes: [], wingmen: [],
    formation_members: [], squadron_members: [], squadrons: [],
    chapter_completions: [], quiz_attempts: [],
    /* Everything else the app touches while a paper is open. Empty, but
       PRESENT: a 501 here is the harness failing, not the product, and it
       would drown the console assertion that catches real errors. */
    presence: [], comms_messages: [], reports: [], question_attempts: [],
    paper_reads: [], lesson_progress: [],
    /* Empty, but present — the state after 0018 has been run. The Library asks
       for it on every module view, and a 501 here is the harness missing a
       table rather than the product failing. */
    papers: [],
  };
}

const isStaff = (store, uid) =>
  !!store.pilot_profiles.find((p) => p.user_id === uid)?.is_staff;
const isInvisible = (store, uid) =>
  !!store.pilot_profiles.find((p) => p.user_id === uid)?.invisible;
const nameOf = (store, uid) =>
  store.pilot_profiles.find((p) => p.user_id === uid)?.callsign || "Someone";

/* ring_covers, as SQL has it. The fixture has no wingmen or formations, so
   anything narrower than `module` reaches only its author — which is exactly
   what makes the correction test meaningful. */
function ringCovers(store, author, viewer, ring, moduleCode) {
  if (author === viewer) return true;
  if (ring === "solo") return false;
  if (ring === "wingman" || ring === "formation") {
    return store.wingmen.some((w) =>
      (w.user_id === author && w.wingman_user_id === viewer)
      || (w.user_id === viewer && w.wingman_user_id === author));
  }
  if (ring === "module") return !!moduleCode;
  return false;
}

function marksFor(store, uid, paperId, since) {
  const solo = isInvisible(store, uid);
  const staff = isStaff(store, uid);
  return store.paper_annotations
    .filter((a) => a.paper_id === paperId)
    .filter((a) => !since || a.updated_at > since)
    .filter((a) => {
      if (a.author_id === uid) return true;
      if (solo || isInvisible(store, a.author_id)) return false;
      if (store.blocks.some((b) =>
        (b.user_id === uid && b.blocked_id === a.author_id)
        || (b.user_id === a.author_id && b.blocked_id === uid))) return false;
      if (store.mutes.some((m) => m.user_id === uid && m.muted_id === a.author_id)) return false;
      /* R9 — the KIND decides who sees a correction, not the ring it was
         stored with. */
      if (a.kind === "correction") return staff;
      return ringCovers(store, a.author_id, uid, a.ring, a.module_code);
    })
    .map((a) => {
      const mine = a.author_id === uid;
      /* §6.2 — anonymity is enforced HERE, on the way out, not in the browser.
         The id is not hidden, it is absent. Instructors still get it, and the
         UI says so plainly rather than promising what it does not deliver. */
      const hide = a.anonymous && !mine && !staff;
      return {
        ...a,
        author_id: hide ? null : a.author_id,
        author_name: mine ? "You" : hide ? "Anonymous" : nameOf(store, a.author_id),
        close: mine || ringCovers(store, a.author_id, uid, "formation", a.module_code),
      };
    })
    .sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
}

function inkFor(store, uid, paperId) {
  const solo = isInvisible(store, uid);
  return store.paper_ink
    .filter((k) => k.paper_id === paperId)
    .filter((k) => k.author_id === uid
      || (!solo && !isInvisible(store, k.author_id)
        && ringCovers(store, k.author_id, uid, k.ring, k.module_code)))
    .map((k) => ({ ...k, author_name: k.author_id === uid ? "You" : nameOf(store, k.author_id), mine: k.author_id === uid }));
}

/* 0021 moved every write behind a function, because the tables themselves now
   refuse the anon key. The harness models the half that matters here: the
   author_id comes from `uid` and is NOT taken from the caller, and an update
   or a delete only touches rows that uid wrote. A test that could still edit
   somebody else's mark against this fixture would be testing nothing. */
const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));

const EDITABLE = ["body", "colour", "ring", "kind", "style", "hint", "anonymous", "resolved_at"];

const RPC = {
  paper_mark_add: (s, b) => {
    if (!b.uid || !b.p_paper || !b.p_anchor) return null;
    const now = new Date().toISOString();
    const row = {
      id: b.p_id || uuid(), paper_id: b.p_paper, module_code: b.p_module,
      paper_version: 1, author_id: b.uid,
      kind: b.p_kind || "highlight", ring: b.p_ring || "module",
      body: b.p_body ?? null, thread_id: b.p_thread_id ?? null,
      colour: b.p_colour ?? null, anchor: b.p_anchor, hint: b.p_hint ?? null,
      anonymous: b.p_anonymous ?? (b.p_kind === "question" || b.p_colour === "unsure"),
      status: "ok", agree_count: 0, created_at: now, updated_at: now,
    };
    const at = s.paper_annotations.findIndex((a) => a.id === row.id);
    if (at >= 0) s.paper_annotations[at] = row; else s.paper_annotations.push(row);
    return row;
  },
  paper_mark_edit: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id && a.author_id === b.uid);
    if (!row) return false;
    for (const k of EDITABLE) if (b.p_patch && k in b.p_patch) row[k] = b.p_patch[k];
    row.updated_at = new Date().toISOString();
    return true;
  },
  paper_mark_delete: (s, b) => {
    const at = s.paper_annotations.findIndex((a) => a.id === b.p_id && a.author_id === b.uid);
    if (at < 0) return false;
    s.paper_annotations.splice(at, 1);
    return true;
  },
  paper_ink_add: (s, b) => {
    if (!b.uid || !b.p_paper || !b.p_page || !b.p_points) return null;
    const row = {
      id: b.p_id || uuid(), paper_id: b.p_paper, module_code: b.p_module,
      paper_version: 1, author_id: b.uid, page: b.p_page,
      tool: b.p_tool || "pen", colour: b.p_colour || "graphite",
      width: b.p_width ?? 0.0032, ring: b.p_ring || "solo", points: b.p_points,
      created_at: new Date().toISOString(),
    };
    const at = s.paper_ink.findIndex((k) => k.id === row.id);
    if (at >= 0) s.paper_ink[at] = row; else s.paper_ink.push(row);
    return row;
  },
  paper_ink_delete: (s, b) => {
    const ids = new Set(b.p_ids || []);
    let n = 0;
    for (let i = s.paper_ink.length - 1; i >= 0; i--) {
      if (ids.has(s.paper_ink[i].id) && s.paper_ink[i].author_id === b.uid) { s.paper_ink.splice(i, 1); n++; }
    }
    return n;
  },
  progress_for: (s, b) => (s.user_progress.find((r) => r.user_id === b.uid)?.data || {}),
  progress_clear: (s, b) => {
    const at = s.user_progress.findIndex((r) => r.user_id === b.uid);
    if (at >= 0) s.user_progress.splice(at, 1);
    return true;
  },

  paper_marks_for: (s, b) => marksFor(s, b.uid, b.p_paper, b.p_since),
  paper_annotations_for: (s, b) => marksFor(s, b.uid, b.p_paper, b.p_since),
  paper_ink_for: (s, b) => inkFor(s, b.uid, b.p_paper),
  paper_corrections_for: (s, b) => (isStaff(s, b.uid)
    ? s.paper_annotations.filter((a) => a.kind === "correction" && a.module_code === b.p_module && !a.resolved_at)
      .map((a) => ({ ...a, author_name: nameOf(s, a.author_id) }))
    : []),
  paper_annotation_status: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id);
    if (row) { row.status = b.p_status === "orphaned" ? "orphaned" : "ok"; row.updated_at = new Date().toISOString(); }
    return null;
  },
  merge_progress: (s, b) => {
    const row = s.user_progress.find((r) => r.user_id === b.uid) || { user_id: b.uid, data: {} };
    row.data = { ...row.data, ...b.patch };
    if (!s.user_progress.includes(row)) s.user_progress.push(row);
    return null;
  },
  agree_with_mark: (s, b) => {
    const row = s.paper_annotations.find((a) => a.id === b.p_id);
    if (!row) return null;
    row.agree_count = (row.agree_count || 0) + 1;
    row.updated_at = new Date().toISOString();
    return row.agree_count;
  },
  /* Normally there are no uploaded papers in the harness — the reader is
     exercised against the committed dev paper. `scripts/measure-manual.mjs`
     sets this to the real 1012-page manual's row so the timings are measured
     against the real file over the real wire, not a 14-page stand-in. */
  papers_for: () => (process.env.HARNESS_REAL_PAPER ? JSON.parse(process.env.HARNESS_REAL_PAPER) : []),
  add_paper: (s, b) => [{ made_id: b.p_id, made_visibility: b.p_visibility || "solo", made_status: "pending", downgraded: false }],
  paper_status: () => null,
  delete_paper: () => true,
  my_modules: () => [],
  right_seat: () => [],
  presence_touch: () => null,
  suggest_code: () => "T3T",
  claim_code: (s, b) => b.want,
  assign_squadron: () => null,
  squadron_roster: () => [],
  people_search: () => [],
};

/* PostgREST's filter syntax, only the operators the app actually sends. */
function applyFilters(rows, url) {
  let out = rows;
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const val = rest.join(".");
    if (op === "eq") out = out.filter((r) => String(r[key]) === val);
    else if (op === "neq") out = out.filter((r) => String(r[key]) !== val);
    else if (op === "in") {
      const set = val.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      out = out.filter((r) => set.includes(String(r[key])));
    } else if (op === "is") out = out.filter((r) => (val === "null" ? r[key] == null : true));
  }
  return out;
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
    if (!url.pathname.startsWith("/rest/v1/") && !url.pathname.startsWith("/harness/")) return next();

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
    if (req.method !== "GET" && req.method !== "DELETE") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const text = Buffer.concat(chunks).toString("utf8");
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    }

    const store = storeFor(req);

    /* A door for tests: reset, seed, or read the whole store. */
    if (url.pathname === "/harness/reset") { stores.set(req.headers["x-harness-store"] || "default", makeStore()); return send(200, { ok: true }); }
    if (url.pathname === "/harness/store") return send(200, store);

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.slice("/rest/v1/rpc/".length);
      const fn = RPC[name];
      if (!fn) { console.warn(`[harness] no RPC "${name}"`); return send(501, { message: `harness: rpc ${name} not implemented` }); }
      return send(200, fn(store, body || {}));
    }

    const table = url.pathname.slice("/rest/v1/".length).split("?")[0];
    if (!(table in store)) { console.warn(`[harness] no table "${table}"`); return send(501, { message: `harness: table ${table} not implemented` }); }

    if (req.method === "GET") return send(200, applyFilters(store[table], url));

    if (req.method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map((r) => ({
        id: r.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "ok",
        ...r,
      }));
      for (const r of rows) {
        const at = store[table].findIndex((x) => x.id === r.id);
        if (at >= 0) store[table][at] = { ...store[table][at], ...r };
        else store[table].push(r);
      }
      return send(201, rows);
    }

    if (req.method === "PATCH") {
      const hit = applyFilters(store[table], url);
      for (const r of hit) Object.assign(r, body, { updated_at: new Date().toISOString() });
      return send(200, hit);
    }

    if (req.method === "DELETE") {
      const hit = applyFilters(store[table], url);
      store[table] = store[table].filter((r) => !hit.includes(r));
      return send(200, hit);
    }

    return send(405, { message: "harness: method not allowed" });
  };
}
