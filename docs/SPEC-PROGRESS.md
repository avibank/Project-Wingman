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
| 1 | Livery tokens + cheatline | §2 (all), §2.14 | **done** — see below |
| 2 | Auto-squadrons + fill ladder | §7.1, §10 | **data layer done** — UI pending |
| 3 | Presence as a data type | §8.3 | not started |
| 4 | Safety primitives | §9 | **data layer done** — UI pending |
| 5 | Flight Deck horizon | §7.2, §4 | not started |
| 6 | Social tab | §7.3, §8.2 | not started |
| 7 | Ambient glow | §7.6, §2.8 | **maths done + verified** — wiring pending |
| 8 | Completion tip + Call a wingman | §7.6, §7.7, §11 | not started |
| 9 | Comms as chat | §7.8, §2.12 | not started |
| 10 | Livery picker + wash | §7.11, §2.11 | **done** |
| 11 | Instruments, Formation, desktop | §5, §7.9, §12 | not started |

## Step 1 — done

- `scripts/build-liveries.mjs` generates `src/styles/liveries.css` from the §2.3
  formulas. Hue is the only input. Run `node scripts/build-liveries.mjs` after any
  change; never edit the CSS by hand.
- The generator's sRGB fallbacks were cross-checked against the §2.4 published table:
  **0/255 maximum deviation across all 24 channel values**, which verifies the oklch
  implementation rather than assuming it.
- Root carries `data-livery` / `data-variant`. Day/Night auto-switches on local time
  with a settings pin overriding (§2.10).
- The cheatline ships as `.app::before` — warm channel, 40vh, 6% alpha (§2.6).
- Existing component token names (`--accent`, `--panel`, `--text` …) are now **aliases**
  onto livery tokens in one block in App.jsx: cold for machine, warm for people (§2.2).
  This repaints every screen without rewriting each component. The old ACCENT_COLORS
  livery lookup is removed.

### Still owed on step 1

- The alias block is a bridge, not the destination. §18 wants components referencing
  livery tokens directly; each later step should replace aliases in the screens it
  touches rather than leaving the shim permanently.
- The cheatline must be suppressed on the chapter body (§7.6) — not yet done, because
  the chapter body is restructured in a later step.
- `--r-sm/md/lg` were folded to spec radii (12/16/16); sheets at 24 arrive with §7.6.

## Carried over from the previous product

See `NOTES.md` for decisions, reversals, and known gaps predating this spec. The spec
supersedes NOTES.md wherever they disagree — in particular it replaces the entire accent
system, the font pairing, and the tab structure.

## Blocked on inputs, not effort

These cannot be built without something arriving from outside the repo:

- ~~Font files~~ **resolved.** All three self-hosted as woff2 in `public/fonts` (297KB
  total, latin subsets), declared in `src/styles/fonts.css`. Fraunces, Inter, JetBrains
  and Space Grotesk are purged from the codebase per §3.
- **Presence infrastructure.** §8.3 mandates SSE + in-memory/Redis with a 5-minute TTL
  and forbids writing presence to the primary database. The current implementation is a
  Postgres `presence` table, which the spec disallows. Needs a Redis instance and an SSE
  endpoint — Supabase alone does not satisfy this.
- **Image scanning + moderation queue.** §9 requires scanning before display and a human
  review queue with a 24h first-response target. That is a service dependency and an
  operational commitment, not just code.
- **Cohort intake.** §7.1's weekly-batch signup is an ops decision.

## Spec discrepancy found

§7.6 gives the glow alpha as `clamp(0.03 + 0.022n, 0.03, 0.12)` and then lists the
worked example "four or more 0.120". The formula yields **0.118** at n=4; the clamp only
bites at n=5. The implementation follows the formula, since it is the normative rule and
the difference is imperceptible, but the worked example in the spec is off by 0.002.

## Conflicts to resolve before starting

- §8.3 forbids persisting presence; migration 0001 created a `presence` table. Step 3
  must migrate off it and drop the table.
- §3 bans Fraunces; it is currently the display face from the previous pass.
- §6 specifies four root tabs (Deck · Social · Modules · You); the app currently has no
  root tab bar at all, having removed it in a prior pass.
