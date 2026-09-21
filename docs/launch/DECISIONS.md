# Decisions and departures from the reference

Record anything built differently from the reference builds, and why. One entry per
departure. If it's a guess, say so and flag it for review.

| Date | Screen | Reference says | What we did | Why |
|---|---|---|---|---|
| 2026-09-21 | Deleting the three accounts | "Delete all three accounts and all traces of it" | Deleted every row that names them; **kept the M1 paper** the staff account had uploaded for the whole module, and cleared `owner_id`/`uploaded_by` on it | A module-wide paper is course material. It is not a trace of a person, and deleting it would have emptied M1's shelf the day before launch. Their own marks and ink on it went. One `delete` finishes it if that call was wrong. |
| 2026-09-21 | Deleting the three accounts | The brief: sign-in first, profile second | Profile rows first, sign-ins left to the owner | No Clerk secret key on this machine. The cost is written in LAUNCH-MORNING §2: a surviving sign-in now has no profile, and signing in with it builds a new one. |
| 2026-09-21 | Deleting the three accounts | — | Backed the rows up to `backups/accounts-2026-09-21/`, git-ignored, instead of into the committed `backups/` | A stamp cannot be issued twice, so without a copy this is the one deletion with no way back. It is personal data, so it stays off GitHub, and the owner deletes it once sure. |
\n
| 2026-09-21 | Sign-up | Four First Flight screens: squadron, module, study time, callsign and code | One screen: callsign and code | The owner asked for the livery and study-time steps gone. The module step was only there to feed a squadron placement by study time, and the Ready Room's discovery does that job now. The tour on the Flight Deck explains the app. |
| 2026-09-21 | Sign-up | A username gate in front of First Flight | First Flight in front; it writes the callsign to Clerk as the username | A new student was asked for the same name twice, in two different styles. |
| 2026-09-21 | Login | A Back button, a "Sign In" title and a Sign In / Sign Up tab strip above Clerk's card | No Back button, Clerk's header as the only title, one switch line under the card | The app bar's wordmark is the way back, and the extra headers were three titles for one form. |
| 2026-09-21 | Sign-up, second pass | One screen: callsign and code, before the app | No screen. Sign up, then the walkthrough, then the licence | The owner: account setup should not come before the walkthrough. The profile is made in the background from the Clerk username; the code and stamp are chosen after the walkthrough. |
| 2026-09-21 | The walkthrough | A spotlight over the live app, offered by a card | Twelve full-screen slides you swipe through, opening by themselves for a new student | The owner found it laggy and wanted it swipeable and clear to a newcomer. Every step of the spotlight was a route change; a slide change is one transform. |
| 2026-09-21 | The code | 31 characters, no 0/1/O/I/L; claimed at sign-up or on sight; typed separately in the stamp creator | Any letter or digit; claimed with the stamp in one statement; permanent with it | "The code is the stamp and the stamp is the code, they are issued together", and digits were being dropped silently. Suggestions still avoid the five confusable characters. |
