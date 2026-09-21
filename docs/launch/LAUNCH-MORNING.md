# Launch morning — the short list

Everything in `CLAUDE-CODE-BRIEF.md` is done, merged and deployed.
`docs/launch/SESSION-REPORT.md` is the account of it and `STATUS.md` is what is
live. This page is only the things that need **you**, in the order they matter.

---

## 1 · Ten minutes on your own phone

**Nothing in this repo has ever been opened on a physical device.** Every width
quoted anywhere in these documents is an emulated viewport in a desktop
browser, which is not the same as a thumb on glass. This is the largest single
gap on the page and it is the one thing no script can close.

Walk this, on the phone you actually carry:

- [ ] Sign in. The Flight Deck offers **"Show me around"** — take it once,
      all twelve steps. Every card should be readable without scrolling and
      every Next should be legible.
- [ ] Open a module → Library → sit a quiz. The clock reads **20:00**. Leave
      it with the arrow; it asks. Come back; the clock is where you left it.
- [ ] Open a paper. Scroll it. Press the page counter — the tray opens with
      Fit, rotate and Download. Press the bookmark — the pill takes over and
      says so. **Download it**, and confirm the file lands somewhere you can
      find it.
- [ ] Bookmarks → Pages → Open. It should land on the page you bookmarked.
- [ ] Share a Ready Room thread. The iOS share sheet should open. If it says
      "Link copied" instead, paste it somewhere and confirm it really did.
- [ ] Set a profile photo **from the camera roll**. HEIC is no longer greyed
      out; if a photo cannot be used you should get a sentence explaining why,
      never a silent rejection.

If any of these misbehave, the fix is small and the cause is written down —
`lib/outside.js` for the share and the download, `coverImage.js` for the photo,
`paper/viewer/` for the paper.

## 2 · The three Clerk accounts

There are **three** `pilot_profiles` rows. I could not tell a classmate from a
test account — reading the names is blocked in this session as PII — so all
three were left alone, which is what the brief says to do in that case.

If you want the rosters clean:

1. Look at them: Clerk dashboard, or `select user_id, callsign, real_name,
   is_staff from pilot_profiles order by callsign;`
2. **Delete the sign-in first, the profile row second.** That way round leaves
   an orphaned row rather than an account with no profile.
3. **A profile row carries that account's STAMP, and migration 0029 issues a
   stamp once and refuses to issue a second.** Delete a real student's row and
   their stamp is gone permanently. There is no undo.

The optional block at the bottom of `supabase/wipe-demo-content.sql` does the
second step; read the paragraph above it before you run it.

## 3 · Put the content in

`src/content/test-content.json` is a valid empty document and it is the slot
your course goes into. `src/data.js` holds four named module shells with no
chapters.

- `npm run check:question-ids` runs in **prebuild** and fails the build if a
  question has no stable id, if two share one, or if an answer indexes nothing.
- `npm run check:ship` is clean now and will go red again if placeholder
  content ever reaches a build.
- A chapter needs **no lessons**. The app is built for quizzes, cards and
  papers, and the Lessons tab says so warmly until there is video.

## 4 · If something looks wrong on the day

- `npm run check` — 50 checks and a real build.
- `npm run qa` — the four sweeps, against the harness. It reports what it saw.
- `npm run harness` — the real app on :5190 with Clerk and the database stubbed.

**The one switch worth knowing:** `VITE_PAPERS_READER` is off and pauses the
*annotation reader*. It is not the papers switch — papers open in the viewer,
which is `paper.viewer` in `src/lib/flags.js` and is on for everyone. Turning
the reader back on brings the marking tools with it, which is not what the
beta is for.
