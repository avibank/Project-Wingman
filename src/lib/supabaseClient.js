import { PostgrestClient } from "@supabase/postgrest-js";

// PostgREST directly, not the full supabase-js client.
//
// The app calls exactly two things on this object: `.from()` and `.rpc()`,
// across 65 call sites and nothing else. It never touches supabase auth,
// storage, realtime or edge functions, and it never will — Clerk owns identity
// and this client is anonymous from Postgres' point of view, which is the whole
// reason RLS is open and access control happens in the app.
//
// createClient() bundles all of it anyway. Measured off the sourcemap, that was
// auth-js, storage-js, realtime-js and phoenix sitting in the ENTRY chunk — the
// one that blocks first paint — for features with no call site. PostgrestClient
// is the part that answers .from() and .rpc(), and it is the part we keep.
//
// The two headers are what supabase-js sends for an anonymous REST request: the
// key identifies the project, and the bearer token is the same key because
// there is no user session to carry. Changing this file changes every data call
// in the app, so `npm run check:backend` is the gate.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// PostgrestClient parses its base URL eagerly, so a missing VITE_SUPABASE_URL
// throws inside the first .from() — and because the progress provider queries
// on mount, that took the whole tree down with "Invalid URL" rather than
// failing the queries. createClient() failed later and softer. A same-origin
// base keeps that shape: requests 404, the app keeps running, and the console
// says which variable is missing instead of leaving a stack to decipher.
const configured = Boolean(url && anonKey);
if (!configured && typeof console !== "undefined") {
  console.error(
    "Supabase is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "are read at build time. Nothing that reads or writes shared data will work.",
  );
}

export const supabase = new PostgrestClient(
  configured ? `${url}/rest/v1` : "/rest/v1",
  configured
    ? { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    : {},
);
