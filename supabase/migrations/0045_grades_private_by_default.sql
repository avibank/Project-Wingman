-- 0045 · grades are private by default (owner, 2026-11-14).
--
-- 0044 made an attempt's score, grade and time visible to everyone unless its
-- owner pressed the eye. The owner has turned that round: they are HIDDEN from
-- the public unless the owner ticks the eye, and an admin sees them all.
--
-- 1. quiz_runs.hidden defaults to true. A finished run is private until its
--    owner chooses to show it.
-- 2. Existing runs follow the new rule ONCE: every run that is visible today was
--    visible only because that was the old default, not because anybody chose
--    it, so they become hidden. The update is guarded by the column's old
--    default, so a second run of this file cannot hide a run somebody has since
--    chosen to show.
-- 3. quiz_leaderboard takes p_admin. When true the numbers behind hidden runs
--    come back. It is asked for by the CLIENT, from Clerk's admin role: this
--    database has no notion of an admin to check (no pilot_profiles row is
--    staff, and the owner's is not), and `quiz_runs` is readable with the
--    publishable key under 0034's open policy anyway, so a parameter hands
--    nobody anything they could not already read. It keeps the board honest for
--    ordinary use; it is not a lock.
--
-- Safe to run twice (see the guard in 2, and both signatures drop first).

do $$
begin
  if (select column_default from information_schema.columns
       where table_name = 'quiz_runs' and column_name = 'hidden') = 'false' then
    update quiz_runs set hidden = true where hidden = false;
    alter table quiz_runs alter column hidden set default true;
  end if;
end $$;

drop function if exists quiz_leaderboard(text, text, integer);
drop function if exists quiz_leaderboard(text, text, integer, boolean);
create or replace function quiz_leaderboard(uid text, p_quiz text, p_limit integer default 50, p_admin boolean default false)
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
                 v.submitted_at asc)
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
         case when hidden and not is_you and not coalesce(p_admin, false) then null else score end,
         total,
         case when hidden and not is_you and not coalesce(p_admin, false) then null else seconds end,
         is_you, runs_total,
         stamp_shape, stamp_code, stamp_rim, stamp_ring,
         stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at,
         stamp_pscope, stamp_pink, stamp_cink,
         hidden
    from ranked
   order by rank
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
grant execute on function quiz_leaderboard(text, text, integer, boolean) to anon, authenticated;

do $$
begin
  if (select column_default from information_schema.columns
       where table_name = 'quiz_runs' and column_name = 'hidden') <> 'true' then
    raise exception '0045: quiz_runs.hidden does not default to true';
  end if;
end $$;
