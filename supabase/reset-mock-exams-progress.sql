-- =============================================================================
-- RESET ANYTHING ANYBODY DID AGAINST THE FIVE MOCK EXAMS (M1.MA … M1.ME).
-- -----------------------------------------------------------------------------
-- The owner, 2026-10-15: the five mock exam documents came back "updated and
-- corrected" — the same five papers, the same forty questions each, the same
-- ids. "No one has attempted them yet, to my knowledge. So just replace them.
-- If someone has attempted them, erase their score and start fresh."
--
-- WHY THIS EXISTS EVEN THOUGH IT FOUND NOTHING. An id is positional inside a
-- chapter: replacing a document leaves every id in place and changes what each
-- one SAYS. Measured on the way in, 71 of the 200 questions changed — 51
-- stems, 47 option sets, 5 explanations — so a score against `M1.MA.Q19` from
-- before would be a result attributed to a question that no longer asks the
-- same thing. The attempt hash in quiz.js already refuses an IN-FLIGHT paper
-- whose questions no longer hash the same; this is for everything that has
-- already been written down.
--
-- SCOPED TO `M1.M%`, NOT `M1.%`, AND THAT IS THE WHOLE POINT. The ten
-- V-batches in the same module carry real work — 3 board runs and 15 saves
-- across 6 progress documents when this was written — and none of it is being
-- replaced. `M1.M%` matches M1.MA…M1.ME and their question ids and nothing
-- else: every other id the module has ever carried is M1.01-03, M1.B1, M1.B6,
-- M1.P1-P7, M1.T1-T10 or M1.V1-V10.
--
-- THE STORAGE EPOCH IS DELIBERATELY NOT RAISED WITH THIS ONE, which breaks
-- the pattern of every reset before it, so here is the argument. The epoch is
-- the DEVICE half: it stops a browser patching a stale score back onto the
-- server on its next load. It sweeps every `pw-` key that is not a preference
-- — scores, cards seen, cards got, both retention piles and `pw-hobbs` — for
-- EVERY module, not just this one. There is no mock progress anywhere to
-- sweep: this script found 0 runs, 0 saves, 0 completions and 0 progress
-- documents mentioning a mock, and progress writes are patch-only and
-- immediate, so a device cannot be holding a score the server has never seen.
-- Raising it would sweep three students' live V-batch state to guard against
-- something that does not exist. If this script ever deletes a row, raise the
-- epoch in the same commit.
--
-- Safe to run twice, and expected to be a no-op.
-- =============================================================================

-- 1 · the board
delete from quiz_runs where quiz_id like 'M1.M%' or chapter_id like 'M1.M%';

-- 2 · sign-offs
delete from chapter_completions where chapter_id like 'M1.M%';

-- 3 · saved questions and cards pointing into a mock. By ref_id alone:
--     `saves.chapter` is the chapter NUMBER, not its code.
delete from saves where ref_id like 'M1.M%';

-- 4 · anything a reader put on a mock paper. The reader is off
--     (`paper.viewer` is everyone:false) so these are expected to be empty,
--     and they are guarded because an environment rebuilt from the numbered
--     series alone may not have 0014/0017 yet.
do $$
begin
  if to_regclass('public.paper_annotations') is not null then
    execute $q$delete from paper_annotations where paper_id like 'M1.M%'$q$;
  end if;
  if to_regclass('public.paper_ink') is not null then
    execute $q$delete from paper_ink where paper_id like 'M1.M%'$q$;
  end if;
end $$;

-- 5 · the progress document: scores, the place in a half-finished paper,
--     which cards have been turned over, which ones stuck, and both retention
--     piles. Each key is rebuilt without its mock entries rather than dropped
--     whole — these keys are shaped per module or per question id and the ten
--     V-batches use the same ones.
--
--     `pw-batch` IS NOT TOUCHED. It is the batch whose row the student last
--     opened — wayfinding, not a result — and those rows still exist and are
--     still the same five. Clearing it would move somebody's light back to
--     batch one for no reason.
update user_progress set data = data
  || case when data ? 'pw-quiz-scores'
       then jsonb_build_object('pw-quiz-scores', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-quiz-scores') e(k, v) where k not like 'M1.M%'))
       else '{}'::jsonb end
  || case when data ? 'pw-quiz-run'
       then jsonb_build_object('pw-quiz-run', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-quiz-run') e(k, v) where k not like 'M1.M%'))
       else '{}'::jsonb end
  || case when data ? 'pw-cards-seen'
       then jsonb_build_object('pw-cards-seen', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-seen') e(k, v) where k not like 'M1.M%'))
       else '{}'::jsonb end
  || case when data ? 'pw-cards-got'
       then jsonb_build_object('pw-cards-got', (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(data -> 'pw-cards-got') e(k, v) where k not like 'M1.M%'))
       else '{}'::jsonb end
  || case when data ? 'pw-retention'
       then jsonb_build_object('pw-retention', (
         select coalesce(jsonb_object_agg(pile, kept), '{}'::jsonb)
           from (
             select pile, (
               select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                 from jsonb_each(items) e(k, v) where k not like 'M1.M%'
             ) as kept
               from jsonb_each(data -> 'pw-retention') p(pile, items)
           ) t))
       else '{}'::jsonb end
where data ?| array['pw-quiz-scores', 'pw-quiz-run', 'pw-cards-seen', 'pw-cards-got', 'pw-retention'];

-- `pw-hobbs` IS DELIBERATELY NOT HERE, for the reason every reset before it
-- gives: hours flown is time the student really spent in the module, not a
-- result attributed to a question that has changed. The questions go; the
-- logbook stays.

-- 6 · proof, in the same transaction the deletes ran in
do $$
declare n integer;
begin
  select count(*) into n from quiz_runs where quiz_id like 'M1.M%' or chapter_id like 'M1.M%';
  if n <> 0 then raise exception 'reset: % quiz runs left', n; end if;

  select count(*) into n from chapter_completions where chapter_id like 'M1.M%';
  if n <> 0 then raise exception 'reset: % completions left', n; end if;

  select count(*) into n from saves where ref_id like 'M1.M%';
  if n <> 0 then raise exception 'reset: % saves left', n; end if;

  select count(*) into n from user_progress where
       exists (select 1 from jsonb_each(coalesce(data->'pw-quiz-scores','{}'::jsonb)) e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-quiz-run','{}'::jsonb))    e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-cards-seen','{}'::jsonb))  e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-cards-got','{}'::jsonb))   e(k,v) where k like 'M1.M%')
    or exists (select 1 from jsonb_each(coalesce(data->'pw-retention','{}'::jsonb)) p(pile,items),
                    jsonb_each(items) e(k,v) where k like 'M1.M%');
  if n <> 0 then raise exception 'reset: % progress documents still mention a mock', n; end if;

  -- and the ten V-batches are untouched, which is the thing this scope is for
  select count(*) into n from quiz_runs where quiz_id like 'M1.V%' or chapter_id like 'M1.V%';
  raise notice 'reset: mocks clear; % V-batch board runs left standing', n;
end $$;
