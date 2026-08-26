# Verifying against the live backend

Nothing in this codebase has been exercised against real Supabase or on a
physical device. Every pass to date used a stubbed client in a desktop browser,
which is why bugs like the progress clobber only appeared once two writers were
simulated. This is the checklist for closing that gap.

Work top to bottom. Each step assumes the one above it passed.

## 0. Credentials

    cp .env.example .env.local

Fill in all three values. `.env.local` is gitignored. Use the Supabase **anon**
key, never `service_role` — anything in a `VITE_` variable is compiled into the
browser bundle and shipped to every visitor.

## 1. Schema

    npm run check:backend

Read-only: it reads PostgREST's OpenAPI document and compares it against every
table, view and RPC the code actually calls. It does not invoke the functions,
because `assign_squadron` and `post_opener_if_quiet` both write.

Expect it to report 0005-0007 missing until they are applied. To apply them,
paste `supabase/SETUP.sql` into the Supabase SQL editor — one paste, top to
bottom, every statement guarded and safe to re-run. Then run the check again;
it should come back clean before you go any further.

`0000_user_progress.sql` is a no-op against this project. It exists so the
series can rebuild an empty database — see the note in the file.

## 2. The app against real services

    npm run dev

Sign in with a real Clerk account and confirm, in this order:

- **Sign-in and sign-out** both complete, and a reload keeps you signed in.
- **Progress writes survive a second writer.** Complete a chapter, then change
  any appearance setting, then reload. The completion must still be there.
  This is the exact shape of the progress clobber; it is worth doing twice.
- **Progress survives sign-out and back in** — it is keyed on the Clerk id.
- **A second account sees its own progress**, not the first account's.
- **The Supabase network calls succeed.** Watch the network panel for 4xx or
  5xx on `merge_progress`; RLS is open, so a failure here is a real bug rather
  than a permissions setting.

## 3. Surfaces that are still dark

`module.interior`, `social.readyroom`, `page.logbook`, `page.bookmarks`,
`nav.root`, `chrome.boarding`, `chrome.patoast`, `prefs.notices` and
`appearance.grain` are `off: true` — off for everyone, admins included, until
their design is approved. They 404 rather than falling through to the Flight
Deck.

To exercise one, sign in as an admin (`publicMetadata.role = "admin"`), open
`/admin`, and turn it on. That override is device-local and admin-only, so it
changes nothing for anyone else.

## 4. On a real phone

    npm run dev:host

Vite prints a LAN address. Open it on a phone on the same network. What the
desktop browser cannot tell you:

- **`100dvh` against a real mobile URL bar.** The shell is a three-row grid at
  `100dvh` with `.deck` as the only scroller; desktop devtools emulation does
  not reproduce the collapsing bar.
- **Safe areas** on a notched device — the top bar and the runway lights.
- **Touch targets** and whether the account menu opens on a real tap. A real
  tap has already caught one bug that `element.click()` did not.
- **`theme-color`** actually tinting the address bar, in both light and dark.
- **Reduced motion** honoured from the OS setting rather than a devtools toggle.

## 5. Link previews

Only after `og.png` exists. Paste `https://www.wingman.institute` into WhatsApp
and Slack and confirm the card renders the image, `Wingman — Never fly alone`,
and `Every hour we wasted is an hour you won't.`

Until the image exists the card is text-only, which is expected, not a bug.
