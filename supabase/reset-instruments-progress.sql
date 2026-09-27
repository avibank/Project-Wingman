-- =============================================================================
-- RESET WHAT ANYBODY DID AGAINST MODULE 13d · INSTRUMENTS (M1.02).
-- -----------------------------------------------------------------------------
-- The owner replaced both source documents on 2026-09-27 and asked for the
-- progress to go with them: "commit those in place of the older versions and
-- reset progress… remove all traces of the older versions".
--
-- WHY IT HAS TO GO rather than being left to age out: the ids are positional
-- within the chapter (`M1.02.Q7`, `M1.02.C014`) and the new documents are not
-- a superset of the old ones — 275 cards where there were 345, 27 of the 40
-- quiz questions replaced, and 217 of the cards that kept their wording given
-- different options or a different answer. So a score, a saved card, a
-- caution pile or a board run against one of those ids now points at a
-- question that is not the one it was earned on. Keeping them would not be
-- history; it would be wrong answers attributed to the wrong questions.
--
-- SCOPED TO M1.02 ON PURPOSE. Module 13d's first chapter did not change, so
-- its scores, its board runs and its saves stay. Nothing here touches notes,
-- the logbook, hours flown, preferences, blocks or mutes.
--
-- The device half of this is `STORAGE_EPOCH` in src/lib/storage.js, bumped to
-- 2 in the same commit: a browser holding `pw-quiz-scores` from before would
-- otherwise patch the old M1.02 score straight back onto the server on its
-- next load.
--
-- Safe to run twice.
-- =============================================================================

-- 1 · the board
delete from quiz_runs where quiz_id like 'M1.02%' or chapter_id like 'M1.02%';

-- 2 · sign-offs (none at the time of writing, and the statement costs nothing)
delete from chapter_completions where chapter_id like 'M1.02%';

-- 3 · saved questions and cards pointing into the chapter. By ref_id alone:
--     `saves.chapter` is the chapter NUMBER, not its code, and the chapter has
--     no lessons or papers, so every save that belongs to it carries an id
--     starting `M1.02.`.
delete from saves where ref_id like 'M1.02.%';

-- 4 · the progress document: scores, the place in a half-finished paper,
--     which cards have been turned over, which ones stuck, and both
--     retention piles. Each one is rebuilt without its M1.02 entries rather
--     than dropped whole, because every one of these keys also holds M1.01.
update user_progress set data = data
  || case when data ? 'pw-quiz-scores'
       then jsonb_build_object('pw-quiz-scores', (data -> 'pw-quiz-scores') - 'M1.02')
       else '{}'::jsonb end
  || case when data ? 'pw-quiz-run'
       then jsonb_build_object('pw-quiz-run', (data -> 'pw-quiz-run') - 'M1.02')
       else '{}'::jsonb end
  || case when data ? 'pw-cards-seen'
       then jsonb_build_object('pw-cards-seen', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-seen') e(k, v) where k not like 'M1.02.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-cards-got'
       then jsonb_build_object('pw-cards-got', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-got') e(k, v) where k not like 'M1.02.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-retention'
       then jsonb_build_object('pw-retention', (
         select coalesce(jsonb_object_agg(pile, kept), '{}'::jsonb)
           from (
             select pile, (
               select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                 from jsonb_each(items) e(k, v) where k not like 'M1.02.%'
             ) as kept
               from jsonb_each(data -> 'pw-retention') p(pile, items)
           ) t))
       else '{}'::jsonb end
where data ?| array['pw-quiz-scores', 'pw-quiz-run', 'pw-cards-seen', 'pw-cards-got', 'pw-retention'];

-- 5 · proof, in the same transaction the deletes ran in
do $$
declare n integer;
begin
  select count(*) into n from quiz_runs where quiz_id like 'M1.02%';
  if n <> 0 then raise exception 'reset: % quiz runs left', n; end if;

  select count(*) into n from saves where ref_id like 'M1.02.%';
  if n <> 0 then raise exception 'reset: % saves left', n; end if;

  select count(*) into n from user_progress
   where (data -> 'pw-quiz-scores') ? 'M1.02'
      or (data -> 'pw-quiz-run') ? 'M1.02'
      or exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-cards-seen', '{}'::jsonb)) k where k like 'M1.02.%')
      or exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-cards-got', '{}'::jsonb)) k where k like 'M1.02.%')
      or exists (select 1 from jsonb_each(coalesce(data -> 'pw-retention', '{}'::jsonb)) p(pile, items),
                      jsonb_object_keys(items) k where k like 'M1.02.%');
  if n <> 0 then raise exception 'reset: % progress rows still mention M1.02', n; end if;
end $$;
