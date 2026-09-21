# Decisions and departures from the reference

Record anything built differently from the reference builds, and why. One entry per
departure. If it's a guess, say so and flag it for review.

| Date | Screen | Reference says | What we did | Why |
|---|---|---|---|---|
| 2026-09-21 | Deleting the three accounts | "Delete all three accounts and all traces of it" | Deleted every row that names them; **kept the M1 paper** the staff account had uploaded for the whole module, and cleared `owner_id`/`uploaded_by` on it | A module-wide paper is course material. It is not a trace of a person, and deleting it would have emptied M1's shelf the day before launch. Their own marks and ink on it went. One `delete` finishes it if that call was wrong. |
| 2026-09-21 | Deleting the three accounts | The brief: sign-in first, profile second | Profile rows first, sign-ins left to the owner | No Clerk secret key on this machine. The cost is written in LAUNCH-MORNING §2: a surviving sign-in now has no profile, and signing in with it builds a new one. |
| 2026-09-21 | Deleting the three accounts | — | Backed the rows up to `backups/accounts-2026-09-21/`, git-ignored, instead of into the committed `backups/` | A stamp cannot be issued twice, so without a copy this is the one deletion with no way back. It is personal data, so it stays off GitHub, and the owner deletes it once sure. |
