-- =============================================================================
-- RESET EVERYTHING ANYBODY DID AGAINST MODULE 13d (M1), ALL THREE CHAPTERS.
-- -----------------------------------------------------------------------------
-- The owner, 2026-10-03: "delete all quizzes and sets and all traces of them."
-- All three chapters — M1.01 Rotary Wing, M1.02 Instruments, M1.03
-- Pitot-Static Systems — came out of the content document in the same commit,
-- along with the three papers on the Library's shelf, and new batches are on
-- their way.
--
-- WHY THE ROWS CANNOT JUST BE LEFT TO AGE OUT. This is not the usual revision,
-- where a chapter's questions change underneath their ids (that is what
-- reset-instruments-progress.sql was for, twice). It is a removal: after this
-- commit there is no M1 question, card or paper for any of those ids to point
-- at. A score, a saved card, a caution pile or a board run against one of them
-- would be a result attributed to a question that no longer exists anywhere —
-- and the Library row, the gyro and the flight bag would all keep counting it.
--
-- SCOPED TO M1 ON PURPOSE, and M1 is the only module with content, so in
-- practice that is everything. Nothing here touches notes, the logbook, hours
-- flown, preferences, licences, stamps, squadrons, blocks or mutes: what a
-- student IS stays, what they did against questions that are gone goes.
--
-- The device half is `STORAGE_EPOCH` in src/lib/storage.js, raised to 4 in the
-- same commit: a browser holding `pw-quiz-scores` from before would otherwise
-- patch an old M1 score straight back onto the server on its next load.
--
-- Safe to run twice.
-- =============================================================================

-- 1 · the board
delete from quiz_runs where quiz_id like 'M1.%' or chapter_id like 'M1.%';

-- 2 · sign-offs
delete from chapter_completions where chapter_id like 'M1.%';

-- 3 · saved questions, cards and pages pointing into the module. By ref_id
--     alone: `saves.chapter` is the chapter NUMBER, not its code, and every
--     save that belongs here carries an id starting `M1.`.
delete from saves where ref_id like 'M1.%';

-- 4 · anything a reader put on one of the three papers. The reader has been
--     off all along (`paper.viewer` is everyone:false) so these are expected
--     to be empty, and they are guarded because an environment rebuilt from
--     the numbered series alone may not have 0014/0017 yet.
do $$
begin
  if to_regclass('public.paper_annotations') is not null then
    execute $q$delete from paper_annotations where paper_id like 'M1%'$q$;
  end if;
  if to_regclass('public.paper_ink') is not null then
    execute $q$delete from paper_ink where paper_id like 'M1%'$q$;
  end if;
end $$;

-- 5 · the progress document: scores, the place in a half-finished paper,
--     which cards have been turned over, which ones stuck, and both
--     retention piles. Each key is rebuilt without its M1 entries rather than
--     dropped whole — these keys are shaped per module or per question id and
--     a later module will use the same ones.
update user_progress set data = data
  || case when data ? 'pw-quiz-scores'
       then jsonb_build_object('pw-quiz-scores', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-quiz-scores') e(k, v) where k <> 'M1' and k not like 'M1.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-quiz-run'
       then jsonb_build_object('pw-quiz-run', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-quiz-run') e(k, v) where k <> 'M1' and k not like 'M1.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-cards-seen'
       then jsonb_build_object('pw-cards-seen', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-seen') e(k, v) where k not like 'M1.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-cards-got'
       then jsonb_build_object('pw-cards-got', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-got') e(k, v) where k not like 'M1.%'))
       else '{}'::jsonb end
  || case when data ? 'pw-retention'
       then jsonb_build_object('pw-retention', (
         select coalesce(jsonb_object_agg(pile, kept), '{}'::jsonb)
           from (
             select pile, (
               select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                 from jsonb_each(items) e(k, v) where k not like 'M1.%'
             ) as kept
               from jsonb_each(data -> 'pw-retention') p(pile, items)
           ) t))
       else '{}'::jsonb end
where data ?| array['pw-quiz-scores', 'pw-quiz-run', 'pw-cards-seen', 'pw-cards-got', 'pw-retention'];

-- `pw-hobbs` IS DELIBERATELY NOT HERE. Hours flown is time the student
-- actually spent in the module, not a result attributed to a question that
-- has gone; the meter only ever counts down to a floor of zero and never up
-- (hobbs.js), and taking hours away would be the app erasing an evening
-- somebody really did sit through. The questions go; the logbook stays.

-- 6 · proof, in the same transaction the deletes ran in
do $$
declare n integer;
begin
  select count(*) into n from quiz_runs where quiz_id like 'M1.%' or chapter_id like 'M1.%';
  if n <> 0 then raise exception 'reset: % quiz runs left', n; end if;

  select count(*) into n from chapter_completions where chapter_id like 'M1.%';
  if n <> 0 then raise exception 'reset: % completions left', n; end if;

  select count(*) into n from saves where ref_id like 'M1.%';
  if n <> 0 then raise exception 'reset: % saves left', n; end if;

  select count(*) into n from user_progress
   where exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-quiz-scores', '{}'::jsonb)) k where k = 'M1' or k like 'M1.%')
      or exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-quiz-run', '{}'::jsonb)) k where k = 'M1' or k like 'M1.%')
      or exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-cards-seen', '{}'::jsonb)) k where k like 'M1.%')
      or exists (select 1 from jsonb_object_keys(coalesce(data -> 'pw-cards-got', '{}'::jsonb)) k where k like 'M1.%')
      or exists (select 1 from jsonb_each(coalesce(data -> 'pw-retention', '{}'::jsonb)) p(pile, items),
                      jsonb_object_keys(items) k where k like 'M1.%');
  if n <> 0 then raise exception 'reset: % progress rows still mention M1', n; end if;
end $$;
