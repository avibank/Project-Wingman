-- 0034 — every sitting is a row, and the board is ranked on the server.
--
-- R5 and R6 of the exam brief (docs/launch/BRIEF-exam.md), which the owner
-- asked for as drawn. Conflict 1 of BRIEF-exam-conflicts.md, now settled.
--
-- WHAT DID NOT EXIST. A quiz score lived in `pw-quiz-scores`, one number per
-- chapter, inside the student's own `user_progress` row. It was the LATEST
-- score, overwritten by the next sitting, private to that account, and carried
-- no time at all. `question_attempts` is per question rather than per sitting,
-- so it cannot say how long a paper took either. There was nothing to rank.
--
-- ADDITIVE. Nothing is dropped, nothing is rewritten, nothing is migrated out
-- of `pw-quiz-scores` — the Library row and the Flight Deck's gyro keep
-- reading it exactly as they do, and this sits beside them.
--
-- ------------------------------------------------------------------ the time
-- R5: "Time is submittedAt − startedAt in real seconds, decided server-side,
-- never from the countdown in the browser."
--
-- Taken literally, and that is a decision with a cost worth writing down. A
-- paper in this app is RESUMABLE: the attempt is saved on every change, the
-- clock stops when the paper leaves the screen, and "Leave it for now" is a
-- first-class choice in the end-exam dialog. So a student who starts a paper,
-- leaves it overnight and finishes it in the morning has a wall clock of
-- fourteen hours and a countdown that barely moved.
--
-- The wall clock is what is stored, because it is the only number the browser
-- cannot make up, and R5 exists to stop the browser making it up. The cost is
-- bounded by the ordering itself: rank is SCORE first and time only splits
-- ties, so leaving a paper costs you nothing unless somebody matched your
-- score exactly. The board says "Ranked on score, then time taken", which is
-- true of the wall clock in a way it would not be of a paused countdown.
--
-- Both ends are stamped by THIS function, never sent: `start_quiz_run` writes
-- started_at = now(), `finish_quiz_run` writes submitted_at = now().
--
-- ------------------------------------------------------- an unfinished run
-- R5's own test list ends "an unfinished attempt never appearing". A run is
-- inserted when the paper opens, with submitted_at null, and the board filters
-- those out. Re-opening a paper you already started returns the SAME row
-- rather than a second one, because resuming a paper is not a new sitting and
-- must not restart the clock.
--
-- ------------------------------------------------------ the callsign is per run
-- R6: "One account can appear several times under different callsigns, each
-- ranked normally." A callsign here is one per account, claimed and unique, so
-- there is nothing to pick per run. What there is instead is TIME: the run
-- snapshots the callsign and the three-character code the account had at the
-- moment it was handed in. Change your callsign and sit the paper again and
-- the board shows two rows, under two names, against one code — which is
-- exactly the shape R6 describes, without inventing a second identity system
-- for one screen. `[CODE] Callsign` is what a row reads.
--
-- -------------------------------------------------------------- who is on it
-- Everyone on the module, minus two:
--   · anyone flying solo (`pilot_profiles.invisible`) — 0032 is explicit that
--     Fly solo means "I am not here", and a leaderboard is the loudest place
--     to be somewhere;
--   · anyone blocked either way.
-- YOU ARE ALWAYS ON YOUR OWN BOARD, flying solo or not, for the same reason
-- 0032 keeps you on your own roster: a board that leaves you off cannot tell
-- you where you came, and "You're 3rd of 12" would be a lie about a list you
-- are not in.
--
-- ---------------------------------------------------------------- the policies
-- Open, like every other table here: the client is a bare PostgrestClient
-- sending the publishable key as its own bearer, so `auth.uid()` and
-- `auth.jwt()` are NULL on every request (0009's header). The cost is the same
-- one 0028 states: anyone holding the publishable key can read `quiz_runs`.
-- What that exposes is what the board already shows to everyone on the module.

create table if not exists quiz_runs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
  module_code  text        not null,
  chapter_id   text        not null,
  quiz_id      text        not null,
  total        integer     not null,
  score        integer,
  callsign     text,
  code         text,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  constraint quiz_runs_total_positive check (total > 0),
  constraint quiz_runs_score_in_range check (score is null or (score >= 0 and score <= total)),
  -- A run is either open or finished. A score without a time, or a time
  -- without a score, is a row nothing can rank and nothing can resume.
  constraint quiz_runs_finished_together check (
    (submitted_at is null and score is null) or (submitted_at is not null and score is not null)),
  constraint quiz_runs_not_before_it_started check (
    submitted_at is null or submitted_at >= started_at)
);

create index if not exists quiz_runs_board_idx
  on quiz_runs (quiz_id, score desc, submitted_at)
  where submitted_at is not null;
-- The open run a student comes back to. Partial, so it is small however many
-- sittings the table ends up holding.
create index if not exists quiz_runs_open_idx
  on quiz_runs (user_id, quiz_id) where submitted_at is null;

alter table quiz_runs enable row level security;
drop policy if exists quiz_runs_open on quiz_runs;
create policy quiz_runs_open on quiz_runs for all using (true) with check (true);

-- --------------------------------------------------------------- the writes
-- Opening a paper. Returns the run to carry, which is the one already open if
-- there is one: coming back to a paper is the same sitting.
create or replace function start_quiz_run(
  uid text, p_module text, p_chapter text, p_quiz text, p_total integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if uid is null or p_quiz is null or coalesce(p_total, 0) <= 0 then return null; end if;

  select id into v_id from quiz_runs
   where user_id = uid and quiz_id = p_quiz and submitted_at is null
   order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into quiz_runs (user_id, module_code, chapter_id, quiz_id, total)
       values (uid, p_module, p_chapter, p_quiz, p_total)
    returning id into v_id;
  return v_id;
end $$;

-- Handing it in. The time is decided here and the name is snapshotted here.
-- Idempotent: a second call on a finished run changes nothing, so a retry
-- after a dropped connection cannot move somebody's time.
create or replace function finish_quiz_run(uid text, p_run uuid, p_score integer)
returns quiz_runs
language plpgsql
security definer
set search_path = public
as $$
declare v_row quiz_runs;
begin
  update quiz_runs r
     set submitted_at = now(),
         score        = greatest(0, least(p_score, r.total)),
         callsign     = (select p.callsign from pilot_profiles p where p.user_id = uid),
         code         = (select p.code     from pilot_profiles p where p.user_id = uid)
   where r.id = p_run and r.user_id = uid and r.submitted_at is null
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from quiz_runs where id = p_run and user_id = uid;
  end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------- the board
-- R5: the client only formats. Rank, seconds and place all come from here —
-- and so does the STAMP, in the same answer, because R7 puts one on every row
-- and a board of fifty rows must not be fifty more round trips.
--
-- The stamp is the account's CURRENT one, not a snapshot like the callsign
-- beside it. That is R7 rather than an oversight: "One mark per student ...
-- Changing a student's ink changes the mark in both places at once." A
-- callsign names a sitting; a stamp is who signed it.
--
-- DROPPED AND CREATED, not replaced: a function's return columns cannot be
-- widened in place (0017 learned this the hard way and had to take a new
-- name). Nothing is deployed against this one yet, so it can keep its name.
drop function if exists quiz_leaderboard(text, text, integer);
create or replace function quiz_leaderboard(uid text, p_quiz text, p_limit integer default 50)
returns table (
  rank        bigint,
  run_id      uuid,
  user_id     text,
  callsign    text,
  code        text,
  score       integer,
  total       integer,
  seconds     integer,
  is_you      boolean,
  runs_total  bigint,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_ink       text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.*
      from quiz_runs r
      left join pilot_profiles p on p.user_id = r.user_id
     where r.quiz_id = p_quiz
       and r.submitted_at is not null
       and (
         r.user_id = uid                                   -- always on your own board
         or (
           not coalesce(p.invisible, false)                -- Fly solo means not here
           and not exists (select 1 from blocks b
                            where (b.user_id = uid      and b.blocked_id = r.user_id)
                               or (b.user_id = r.user_id and b.blocked_id = uid))
         )
       )
  ),
  ranked as (
    select
      row_number() over (
        order by v.score desc,
                 extract(epoch from (v.submitted_at - v.started_at)) asc,
                 v.submitted_at asc)                       -- a stable third key
        as rank,
      v.id as run_id,
      v.user_id,
      coalesce(nullif(btrim(v.callsign), ''), 'Someone') as callsign,
      coalesce(nullif(btrim(v.code), ''), '---')          as code,
      v.score,
      v.total,
      greatest(0, floor(extract(epoch from (v.submitted_at - v.started_at)))::integer) as seconds,
      (v.user_id = uid) as is_you,
      count(*) over () as runs_total,
      sp.stamp_shape, sp.stamp_code, sp.stamp_rim, sp.stamp_ring,
      sp.stamp_pattern, sp.stamp_ink, sp.stamp_seed, sp.stamp_issued_at
    from visible v
    left join pilot_profiles sp on sp.user_id = v.user_id
  )
  select rank, run_id, user_id, callsign, code, score, total, seconds, is_you, runs_total,
         stamp_shape, stamp_code, stamp_rim, stamp_ring,
         stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at
    from ranked
   order by rank
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public' and table_name = 'quiz_runs';
  if n <> 1 then raise exception '0034: quiz_runs is missing'; end if;

  select count(*) into n from pg_constraint
   where conname in ('quiz_runs_total_positive', 'quiz_runs_score_in_range',
                     'quiz_runs_finished_together', 'quiz_runs_not_before_it_started');
  if n <> 4 then raise exception '0034: the run constraints are incomplete (%)', n; end if;

  select count(*) into n from pg_proc
   where proname in ('start_quiz_run', 'finish_quiz_run', 'quiz_leaderboard');
  if n <> 3 then raise exception '0034: the run functions are incomplete (%)', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'quiz_runs';
  if n < 1 then raise exception '0034: quiz_runs has no policy'; end if;
end $$;
