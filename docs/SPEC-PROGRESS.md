# Build progress against docs/SPEC.md

One §17 step per session. Update this file at the end of every session, before the
context runs out — it is the handoff between sessions.

## How to run a session

Do **not** paste the spec into a prompt. Say:

> Read docs/SPEC.md §<sections> and docs/SPEC-PROGRESS.md. Build step N. Stop when it
> is shippable, then commit and update SPEC-PROGRESS.md.

Read only the sections that step needs. §17 lists which.

## Status

| # | Step | Spec sections | State |
|---|---|---|---|
| 1 | Livery tokens + cheatline | §2 (all), §2.14 | not started |
| 2 | Auto-squadrons + fill ladder | §7.1, §10 | not started |
| 3 | Presence as a data type | §8.3 | not started |
| 4 | Safety primitives | §9 | not started |
| 5 | Flight Deck horizon | §7.2, §4 | not started |
| 6 | Social tab | §7.3, §8.2 | not started |
| 7 | Ambient glow | §7.6, §2.8 | not started |
| 8 | Completion tip + Call a wingman | §7.6, §7.7, §11 | not started |
| 9 | Comms as chat | §7.8, §2.12 | not started |
| 10 | Livery picker + wash | §7.11, §2.11 | not started |
| 11 | Instruments, Formation, desktop | §5, §7.9, §12 | not started |

## Carried over from the previous product

See `NOTES.md` for decisions, reversals, and known gaps predating this spec. The spec
supersedes NOTES.md wherever they disagree — in particular it replaces the entire accent
system, the font pairing, and the tab structure.

## Blocked on inputs, not effort

These cannot be built without something arriving from outside the repo:

- **Font files.** Instrument Sans, Geist Mono, Newsreader as self-hosted woff2 (§3).
  All three are OFL; they need downloading into the repo.
- **Presence infrastructure.** §8.3 mandates SSE + in-memory/Redis with a 5-minute TTL
  and forbids writing presence to the primary database. The current implementation is a
  Postgres `presence` table, which the spec disallows. Needs a Redis instance and an SSE
  endpoint — Supabase alone does not satisfy this.
- **Image scanning + moderation queue.** §9 requires scanning before display and a human
  review queue with a 24h first-response target. That is a service dependency and an
  operational commitment, not just code.
- **Cohort intake.** §7.1's weekly-batch signup is an ops decision.

## Conflicts to resolve before starting

- §8.3 forbids persisting presence; migration 0001 created a `presence` table. Step 3
  must migrate off it and drop the table.
- §3 bans Fraunces; it is currently the display face from the previous pass.
- §6 specifies four root tabs (Deck · Social · Modules · You); the app currently has no
  root tab bar at all, having removed it in a prior pass.
