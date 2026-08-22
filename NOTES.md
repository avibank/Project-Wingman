# Open decisions and known gaps

Written down deliberately: these are things decided in conversation that the code
alone does not explain. If you are picking this up fresh, read this before changing
anything it touches.

---

## Unresolved — waiting on a decision

### "Wingman" as a term
The most recent design audit said to retire invented social vocabulary. "cabin",
"channel open" and "first voice" were removed. **"Wingman" was kept**, because unlike
those it is load-bearing: a `wingmen` table, a `wingman_streaks` table, the joint-streak
logic and the shared-completion bump all key off it. Renaming it is a data migration,
not a copy edit. Undecided.

### Failed posts fail silently
Comment and reply posting is optimistic. If the insert fails, the comment stays on
screen with no error and no retry — `setPosts((p) => p.map((x) => x.id === temp.id ? saved || x : x))`
keeps the optimistic copy when `saved` is null. Deliberate (better than the comment
vanishing) but incomplete: there is no failed state and no retry affordance. Offered
several times, never actioned.

### `parent_id` cascades on delete
Deleting a comment deletes its entire reply subtree (`on delete cascade` in migration
0002). This is Reddit behaviour and the UI assumes it, but it is destructive and there
is no "[deleted]" tombstone. Flagged before the migration was run; proceeded as-is.
Changing it means `on delete set null` plus a placeholder render.

### `question_attempts` is readable
"N pilots also missed this" is served by the `question_miss_stats` RPC, which returns
counts only — the browser never reads individual answers. But under the project-wide
open-RLS convention the underlying table is still readable by anyone with the anon key.
The app does not read it; that is not the same as it being private. Tightening this one
table would depart from the convention every other table follows, so it is a deliberate
decision rather than an oversight.

### Locked-module unlock rule is not enforced
Nothing enforces "Unlocks at 100% Jet Turbine Fundamentals" — that caption was written
when PROP was `status: "locked"`. All modules are now open, so the caption no longer
renders, but if module gating is ever reintroduced, the rule must be enforced in code,
not just stated in copy.

---

## Never verified

**Nothing in this codebase has run against the live Supabase or on a physical device.**
Every check to date used a stubbed Supabase/Clerk harness in a desktop browser
(`scratchpad/preview`). Specifically unverified in production:

- the four RPCs (`merge_progress`, `question_miss_stats`, `shared_completions`, and the
  score/reply-count triggers)
- presence heartbeat write volume (one upsert per open chapter page per 45s)
- threaded replies and chip toggling end to end
- device-orientation tilt and the mobile gauge carousel — the tilt maths and the
  mouse↔sensor handover were confirmed with synthetic events only, never a real phone
- the 760px mobile breakpoint (exercised by temporarily raising it, not by a real
  viewport)

To close this gap: put a `.env` in the repo root with `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. It is gitignored. Without it
the app throws `supabaseUrl is required` at module load and never mounts.

---

## Reversals — why the current state is what it is

Several decisions were made, then explicitly overturned. Current state and reason:

| Decision | Current state |
|---|---|
| Accent colour | Sky blue default via HSL channels. Was blue, then amber, then red-as-brand, then blue again. It is user-selectable, so the *default* is the only thing at stake. |
| Module hues | **Kept.** Collapsed to a single hue in one pass, then explicitly restored as "layer one" of the two-layer model. Do not merge them again without re-reading that reasoning. |
| Glow | **Removed** from cards. Reserved for presence and the current chapter leg only. |
| Briefing panel / stat tiles / suggestion row | Built, deleted, restored on request, then trimmed again. Currently: three distinct stat tiles, no Checklist tile. |
| Presence gauge | Built app-wide as "highest-leverage", then **removed** as mystery-meat navigation. Presence now lives inside a module only. |
| Social sub-tabs | Feed/Threads/Team built, then **collapsed** into one chronological surface. |
| Compete | Built as a locked placeholder, then **deleted entirely**. |

---

## Bugs found and fixed (do not reintroduce)

- **The progress clobber.** `user_progress.data` was written with a whole-object upsert
  while eight components each held their own copy. Any write deleted keys the writer had
  never seen — completing a chapter then changing any setting discarded the completion.
  Fixed by patch-only writes through `merge_progress` plus a single provider. This was
  invisible in code review; it only showed up when two writers were simulated.
- **`resetAll` never existed.** App.jsx awaited it on "reset all progress"; the hook
  never returned it, so the reset threw and silently did nothing for signed-in users.
- **Global content arrays.** ChaptersPanel read the global `CHAPTERS` (every module
  showed all 20 chapters) and PdfPanel read the global `PDFS` (every module showed Jet
  Turbine handouts). Both now partition by module code.
- **Resume Flight did nothing.** `goToChapter(moduleCode, chapterId)` was called with one
  argument, so `MODULES.find` returned undefined and the navigation silently returned.
- **`color-mix()` in SVG presentation attributes** computes to `none`/black. It works as
  a CSS property but not as `stroke=` or `stop-color=`.
- **`@property { inherits: false }`** stopped pointer position reaching child layers.
- **A Cyrillic homoglyph** (`onМouseDown`) — builds fine, silently does nothing.

---

## Still needs assets

- Curated macro photography (one shoot, one lens, one grade) for module cards and
  headers. Stock from multiple sources would break the single-eye quality that is the
  whole point. The motif SVG system stands in until then.
- Micro-sound files for primary actions.
