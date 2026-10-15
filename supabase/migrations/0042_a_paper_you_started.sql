-- ===========================================================================
-- 0042 · ONE ANSWER COUNTS, AND EVERY ATTEMPT GETS ITS OWN STAMP
-- ===========================================================================
-- Owner, 2026-10-12: "if you open the exam and answer at least one question,
-- so you have progress, and leave it or submit it, whatever it is ... answer
-- one question, you stamp it, and if you complete it, you also get stamped."
-- And: "if you complete it more than once, you just get stamped twice ... we
-- will work towards something where an attempt that you have made shows a
-- different version, but as of right now, just stamp it twice."
--
-- ---------------------------------------------------------------------------
-- WHY NOT ON OPEN, WHICH IS WHAT WAS ASKED FOR FIRST
-- ---------------------------------------------------------------------------
-- A row already exists the moment a paper opens: `start_quiz_run` fires from
-- an effect in Exam.jsx, with `submitted_at` null. So "who opened this" has
-- been in the table all along and reading it would have been a one-line
-- change. It is deliberately NOT the rule.
--
-- Opening is free and repeatable, so a stamp on open is inflatable to the
-- point of noise — ten taps, ten rows — and it would have contradicted the
-- screen it sits on: a chapter quiz is an EXAM, nothing is marked before
-- hand-in, and `check:exam` asserts no mark reaches the question screen. The
-- end-exam dialog offers "Leave it for now" precisely so a mis-tap costs
-- nothing; stamping on open would have given that choice a permanent public
-- consequence, and the student likeliest to open and back out is a nervous
-- one. ONE ANSWER is the bar instead: it cannot be reached by accident, it
-- cannot be reached by curiosity, and it is reached long before a paper is
-- finished — which is the liveness the owner is actually after.
--
-- ---------------------------------------------------------------------------
-- LEAVING KEEPS YOUR PLACE, AND THAT WAS THE CONDITION
-- ---------------------------------------------------------------------------
-- "Note that leaving it should save your progress. Whenever you come back to
-- it, you are stopped at this exact time and at this exact question. So if we
-- can achieve that, then I think, yes, we stamp it."
--
-- It already does, and it was MEASURED rather than assumed before this
-- migration was written: answer two questions, step to the third, leave by
-- the arrow and "Leave it for now", wait, come back — question 3, 2 of 40
-- answered, and the clock 0 seconds further on than it was left. The attempt
-- carries `at` (which question is on screen) and `left` (seconds), and the
-- clock only moves while the paper is on screen (quiz.js §1).
--
-- THE ONE LIMIT, STATED RATHER THAN DISCOVERED: the attempt lives in
-- localStorage under `wingman.attempt.<quizId>` and is not mirrored anywhere.
-- Resume is therefore PER DEVICE. Leave a paper on a phone and open it on a
-- laptop and you get a fresh one, and the stamp this migration grants is the
-- only trace the first sitting leaves. Carrying the attempt to the server is
-- a separate piece of work and is not done here.
-- ===========================================================================

-- ------------------------------------------------- 1 · the progress stamp
-- Additive, nullable, and with the same shape of CHECK as `submitted_at`:
-- a run cannot have been answered before it was started.
alter table quiz_runs add column if not exists answered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_runs_answered_after_start') then
    alter table quiz_runs add constraint quiz_runs_answered_after_start
      check (answered_at is null or answered_at >= started_at);
  end if;
end $$;

create index if not exists quiz_runs_counted_idx
  on quiz_runs (quiz_id, user_id)
  where answered_at is not null or submitted_at is not null;

-- WRITTEN ONCE AND NEVER MOVED. The client calls this on the first answer of
-- a sitting and does not track whether it already has; `coalesce` makes a
-- second call a no-op rather than a lie about when the paper was started.
-- Scoped to the caller's own run, because every table here is readable with
-- the publishable key (0009) and "mark somebody else's paper as begun" is not
-- a thing this should allow.
create or replace function mark_quiz_progress(p_me text, p_run uuid)
returns timestamptz
language sql
volatile
as $$
  update quiz_runs
     set answered_at = coalesce(answered_at, now())
   where id = p_run and user_id = p_me
  returning answered_at;
$$;


-- ------------------------------------------- 2 · a stamp per ATTEMPT, not per person
-- 0038 grouped runs into PEOPLE (`max(submitted_at)`, one row each) so a
-- repeat kept its place on the board but not its stamp. The owner wants the
-- other thing for now: "if I attempt it twice, I get stamped" twice.
--
-- So this returns ONE ROW PER RUN. The de-duplication is gone from the server
-- rather than from the client, because the cap is applied here — a client
-- that expanded rows after a cap of eleven would be capping people and
-- drawing attempts, which is the bug 0038's own header warns about in the
-- other direction.
--
-- `run_id` is new and is what the client keys on. Without it two attempts by
-- one person collide on `user_id` in React and the second silently does not
-- render — which would have looked exactly like the de-duplication this
-- migration removes.
--
-- WHAT COUNTS: answered or submitted. An opened-and-abandoned paper with no
-- answer on it is not an attempt and never becomes one.
drop function if exists quiz_finishers(text, text[], integer);

create function quiz_finishers(uid text, p_quizzes text[], p_cap integer default 11)
returns table (
  quiz_id         text,
  run_id          uuid,
  user_id         text,
  callsign        text,
  code            text,
  finished_at     timestamptz,
  is_you          boolean,
  finishers       integer,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_pscope    text,
  stamp_ink       text,
  stamp_pink      text,
  stamp_cink      text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.id, r.quiz_id, r.user_id,
           /* The moment the attempt began to count. A finished paper is
              dated by its hand-in; one still open is dated by its first
              answer, so the order reads as "most recently active". */
           coalesce(r.submitted_at, r.answered_at) as at
      from quiz_runs r
      join pilot_profiles p on p.user_id = r.user_id
     where r.quiz_id = any(coalesce(p_quizzes, array[]::text[]))
       and (r.answered_at is not null or r.submitted_at is not null)
       /* 0034's visibility rules, unchanged: Fly solo, and a block cutting
          both ways. You always see your own. */
       and (r.user_id = uid
            or (not coalesce(p.invisible, false)
                and not exists (select 1 from blocks b
                                where (b.user_id = uid and b.blocked_id = r.user_id)
                                   or (b.user_id = r.user_id and b.blocked_id = uid))))
  ),
  ranked as (
    select v.*,
           count(*) over (partition by v.quiz_id) as n,
           row_number() over (
             partition by v.quiz_id
             /* You first, then most recent — 0038's order, kept. */
             order by (v.user_id = uid) desc, v.at desc, v.id
           ) as rn
      from visible v
  )
  select r.quiz_id, r.id, r.user_id, p.callsign, p.code, r.at, r.user_id = uid,
         r.n::integer,
         p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
         p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
         p.stamp_seed, p.stamp_issued_at
    from ranked r
    join pilot_profiles p on p.user_id = r.user_id
   where r.rn <= greatest(1, least(coalesce(p_cap, 11), 400))
   order by r.quiz_id, r.rn;
$$;


do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('quiz_finishers', 'mark_quiz_progress')
     and pronamespace = 'public'::regnamespace;
  if n < 2 then
    raise exception '0042 did not take: expected quiz_finishers and mark_quiz_progress, found %', n;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'quiz_runs' and column_name = 'answered_at') then
    raise exception '0042 did not take: quiz_runs.answered_at is missing';
  end if;
end $$;
