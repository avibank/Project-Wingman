-- 0044 · hide my attempt (owner, 2026-11-14).
--
-- Tapping somebody on a quiz's hub shows their score, grade and time unless
-- they have pressed the eye on their attempt, which hides those three from
-- everybody else. It is ON by default: nothing is hidden until somebody hides it.
--
-- A RUN IS HIDDEN, NOT A PERSON. The eye sits on an attempt, so the flag is on
-- `quiz_runs`. What is withheld is withheld HERE, in the function that returns
-- the board, and not in the client: a score the server sends is a score a
-- browser can read. The rank, the callsign and the stamp are still returned —
-- hiding an attempt does not take somebody off the podium, it only keeps the
-- numbers behind it to themselves. You always see your own.
--
-- Safe to run twice: the column is guarded, and both functions drop first
-- (a function's return columns cannot be widened in place — see 0036).

alter table quiz_runs add column if not exists hidden boolean not null default false;

drop function if exists set_run_hidden(text, uuid, boolean);
create or replace function set_run_hidden(uid text, p_run uuid, p_hidden boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update quiz_runs set hidden = coalesce(p_hidden, false)
   where id = p_run and user_id = uid;
$$;
grant execute on function set_run_hidden(text, uuid, boolean) to anon, authenticated;

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
  stamp_issued_at timestamptz,
  stamp_pscope    text,
  stamp_pink      text,
  stamp_cink      text,
  hidden          boolean
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
      sp.stamp_pattern, sp.stamp_ink, sp.stamp_seed, sp.stamp_issued_at,
      sp.stamp_pscope, sp.stamp_pink, sp.stamp_cink,
      v.hidden
    from visible v
    left join pilot_profiles sp on sp.user_id = v.user_id
  )
  select rank, run_id, user_id, callsign, code,
         -- the numbers behind a hidden attempt stay with their owner
         case when hidden and not is_you then null else score end,
         total,
         case when hidden and not is_you then null else seconds end,
         is_you, runs_total,
         stamp_shape, stamp_code, stamp_rim, stamp_ring,
         stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at,
         stamp_pscope, stamp_pink, stamp_cink,
         hidden
    from ranked
   order by rank
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
grant execute on function quiz_leaderboard(text, text, integer) to anon, authenticated;

-- Proof that it took.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'quiz_runs' and column_name = 'hidden') then
    raise exception '0044: quiz_runs.hidden is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'set_run_hidden') then
    raise exception '0044: set_run_hidden is missing';
  end if;
end $$;
