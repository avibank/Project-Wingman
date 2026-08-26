// Clerk admin, for the things the app itself cannot do.
//
//   npm run clerk -- users               list users and their ids
//   npm run clerk -- role <id> admin     grant the admin surfaces
//   npm run clerk -- role <id> --clear   take it away
//   npm run clerk -- app                 instance name, as shown on the sign-in modal
//
// Needs CLERK_SECRET_KEY in .env.local — Clerk dashboard -> API Keys -> Secret
// key, starting sk_. Not named VITE_, so it never reaches the browser. It can
// read and modify every user in the instance; treat it like a password.
//
// role writes publicMetadata.role, which is exactly what useFlags() reads to
// decide whether /admin renders, so this is the switch for the flag panel.

import { require1, redact } from "./env.mjs";

const KEY = require1(
  ["CLERK_SECRET_KEY"],
  "Clerk dashboard -> API Keys -> Secret key (sk_...).",
  "Put it in .env.local as CLERK_SECRET_KEY=sk_…  (not VITE_).",
);

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = json?.errors?.map((e) => e.message).join("; ") || body.slice(0, 200);
    throw new Error(`${res.status} ${res.statusText} — ${msg}`);
  }
  return json;
};

const [cmd, ...rest] = process.argv.slice(2);

const email = (u) =>
  u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address
  ?? u.email_addresses?.[0]?.email_address ?? "—";

try {
  if (cmd === "users") {
    const users = await api("/users?limit=100&order_by=-created_at");
    console.log(`${users.length} user(s)  [key ${redact(KEY)}]\n`);
    for (const u of users) {
      const role = u.public_metadata?.role;
      console.log(
        `  ${u.id}  ${email(u).padEnd(32)} ${(u.username ?? "").padEnd(14)}` +
        `${role ? `role=${role}` : ""}`,
      );
    }
  } else if (cmd === "role") {
    const [id, value] = rest;
    if (!id) throw new Error("Usage: npm run clerk -- role <user_id> <admin|--clear>");
    const clear = !value || value === "--clear";
    const before = await api(`/users/${id}`);
    const merged = { ...(before.public_metadata ?? {}) };
    if (clear) delete merged.role; else merged.role = value;
    // Clerk merges top-level keys, so removing one means sending the whole object.
    await api(`/users/${id}/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ public_metadata: clear ? { ...merged, role: null } : merged }),
    });
    const after = await api(`/users/${id}`);
    console.log(`${email(after)}  role: ${before.public_metadata?.role ?? "(none)"} -> ${after.public_metadata?.role ?? "(none)"}`);
  } else if (cmd === "app") {
    const inst = await api("/instance");
    console.log(JSON.stringify(inst, null, 2).slice(0, 1200));
  } else {
    console.error("Commands: users | role <id> <admin|--clear> | app");
    process.exit(2);
  }
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
}
