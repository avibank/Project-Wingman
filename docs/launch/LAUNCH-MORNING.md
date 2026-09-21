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

## 2 · The three accounts: the sign-ins are yours to delete

**Everything they left in the database is gone**, deleted on 2026-09-21 at your
word and verified by connecting: every text and JSON column of all 100 tables
in every schema was searched for the three ids, and none turned up. That was
3 profiles (and their stamps), 3 `enrollments`, 11 ink strokes, 3 marks, a
comment, a report, a presence row and a preferences row.

What is left is **the sign-ins themselves**, and they cannot be deleted from
here: there is no `CLERK_SECRET_KEY` in `.env.local`. Clerk dashboard → Users,
and delete the three. Their ids are not written here, because that would leave
a trace in the repo. They are in `backups/accounts-2026-09-21/IDS.txt`, on
this machine only.

- [ ] **Delete them before you sign in to wingman.institute again.** The
      profile rows went first, which is the opposite of the order the brief
      asked for, so a sign-in that still exists now has no profile. Sign in
      with one and First Flight will build it a new one, and that new row
      is a trace again.
- [ ] **The first of the three is almost certainly yours.** It is the
      oldest and the only staff account. Whether it also held the admin role
      could not be checked without the Clerk key. Sign up again afterwards
      and you arrive as a student. Getting staff back is two
      writes, both of them one line: `publicMetadata.role = "admin"` on the
      new user in the Clerk dashboard, and `update pilot_profiles set
      is_staff = true where user_id = '<new id>';`
- [ ] **The M1 paper stayed.** *B2 13d Instruments, Rotary Wing
      Aerodynamics…* is course material, not a person, so it is still on
      every M1 student's shelf. Only your id was taken off it, and it now
      reads as added by "Someone". Nobody owns it, so nobody can delete it
      from the app. To take it back: `update papers set owner_id = '<new id>',
      uploaded_by = '<new id>' where id =
      'M1-B2-13D-INSTRUMENTS-ROTARY-WING-AERODYNAMICS-A';`
- [ ] **A backup exists, and it is personal data.** Every deleted row is in
      `backups/accounts-2026-09-21/rows.json`, on this machine only. Git
      ignores it. It is the only way back for a stamp. Delete the folder once
      you are sure.

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
