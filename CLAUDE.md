# Project Wingman — Claude Code Project Brief

## What this is

A subscription-based Part-66 Aircraft Maintenance Engineering (AME) study platform for
aviation students, modeled on UULA. Live at wingman.institute, deployed via Vercel,
repo at avibank/Project-Wingman on GitHub.

Aviation-themed naming is a deliberate, consistent design choice throughout — it's for
AME students, not pilots. Established theme vocabulary: Logbook (bio), Livery (accent
color), Smooth Air (reduce motion), Lights Out (calm discussion buttons), Plain Language
(dyslexia-friendly font), Turbulence (haptic/visual feedback), Day Ops/Night Ops (theme),
Point of No Return (account deletion), Flight Deck (the home/dashboard screen).

## Tech stack

- React 18 + Vite
- Clerk for all authentication (email verification, Google OAuth, admin roles via
  publicMetadata.role="admin") — this is the authoritative auth layer
- Supabase for Comments/Discussion, user progress sync, and module enrollments (NOT
  auth — Supabase client is effectively "anonymous" from Supabase's own perspective,
  since real auth is Clerk; RLS policies on all tables are intentionally open
  (using (true)) because access control happens at the app level)
- Vercel for deployment; GoDaddy for DNS

## Critical architecture notes

- App.jsx is split into outer App (renders ClerkProvider) and inner AppInner
  (everything else, including useUser() and useUserProgress()). Never call Clerk
  hooks outside the ClerkProvider tree — this caused a real production crash once.
- Navigation model: view state is "hub" or "module". Flight Deck (formerly "Hub") is
  the landing screen. Clicking into a module sets view="module" and activeModuleCode;
  Chapters/Discussion/Library nest under whichever module is active.
- Only the Jet Turbine ("JT") module has real chapter content. ChaptersPanel.jsx reads
  one global CHAPTERS array from data.js — not yet partitioned per module. Propulsion
  Systems ("PROP") is status: "locked" in MODULES (no content built yet). Known,
  deliberate gap, not a bug.
- All user progress syncs to Supabase via useUserProgress for signed-in users,
  localStorage fallback for guests. Known inefficiency: multiple components each call
  useUserProgress() independently, causing redundant fetches — worth consolidating.
- Module enrollment is real (Supabase enrollments table, self-serve free enroll/unenroll,
  no payment yet).

## Status as of this brief

Local build (npm run build) succeeds cleanly. A prior Vercel deploy failed with
"Command npm run build exited with 1" but the real error was never captured — this may
already be resolved. npm install reports 3 vulnerabilities (1 moderate, 2 high) and 3
packages with pending install scripts (@clerk/shared, esbuild, fsevents) — all
legitimate, well-known packages, safe to approve.
