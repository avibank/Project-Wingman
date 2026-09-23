-- =============================================================================
-- 0038 — WHO HAS FINISHED A QUIZ.
-- -----------------------------------------------------------------------------
-- Rule 4 of the quiz-stamps brief (2026-09-23): each Library quiz row carries a
-- line of finisher stamps underneath — one per person, their most recent finish
-- first, at most eleven, then "+n", then the count in words.
--
--   1. ONE ROW PER PERSON, not per run. The brief keeps the board's rows as
--      runs and de-duplicates at render; this line is about PEOPLE, and a
--      student who sat a paper four times is one stamp. So the grouping is in
--      the query — `max(submitted_at)` is that person's most recent finish —
--      while `quiz_leaderboard` is untouched and still returns every run.
--   2. YOURS FIRST (owner, 2026-09-23, on the brief's open question 2), then
--      recency. It is in the ordering rather than the client so that the cap
--      cannot drop you: a student who finished first and is now thirtieth by
--      recency would otherwise never see their own stamp on the row.
--   3. `finishers` is the whole count for that quiz, not the capped one — it
--      is what the row says in words, and "+n" is the difference.
--   4. FLY SOLO AND BLOCKS, exactly as 0034's board has them: somebody
--      invisible is on nobody else's line, a block cuts both ways, and you are
--      always on your own.
--   5. Several quizzes in one call, because the Library draws a row per
--      chapter and a call per row is a call per row.
--
-- The stamp columns are the account's CURRENT ones (0029, 0036), like the
-- board's: a stamp is who signed it, not a snapshot of a night's run.
-- =============================================================================

create or replace function quiz_finishers(uid text, p_quizzes text[], p_cap integer default 11)
returns table (
  quiz_id         text,
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
    select r.quiz_id, r.user_id, r.submitted_at
      from quiz_runs r
      left join pilot_profiles p on p.user_id = r.user_id
     where r.quiz_id = any(coalesce(p_quizzes, array[]::text[]))
       and r.submitted_at is not null
       and (
         r.user_id = uid                                   -- always on your own
         or (
           not coalesce(p.invisible, false)                -- Fly solo means not here
           and not exists (select 1 from blocks b
                            where (b.user_id = uid       and b.blocked_id = r.user_id)
                               or (b.user_id = r.user_id and b.blocked_id = uid))
         )
       )
  ),
  people as (
    select v.quiz_id, v.user_id, max(v.submitted_at) as finished_at
      from visible v
     group by v.quiz_id, v.user_id
  ),
  ranked as (
    select
      pe.quiz_id, pe.user_id, pe.finished_at,
      count(*) over (partition by pe.quiz_id)                      as finishers,
      row_number() over (
        partition by pe.quiz_id
        order by (pe.user_id = uid) desc, pe.finished_at desc, pe.user_id) as rn
      from people pe
  )
  select
    r.quiz_id,
    r.user_id,
    coalesce(nullif(btrim(pp.callsign), ''), 'Someone') as callsign,
    coalesce(nullif(btrim(pp.code), ''), '---')         as code,
    r.finished_at,
    (r.user_id = uid)                                    as is_you,
    r.finishers::integer,
    pp.stamp_shape, pp.stamp_code, pp.stamp_rim, pp.stamp_ring,
    pp.stamp_pattern, pp.stamp_pscope, pp.stamp_ink, pp.stamp_pink, pp.stamp_cink,
    pp.stamp_seed, pp.stamp_issued_at
    from ranked r
    left join pilot_profiles pp on pp.user_id = r.user_id
   where r.rn <= greatest(1, least(coalesce(p_cap, 11), 24))
   order by r.quiz_id, r.rn
$$;

grant execute on function quiz_finishers(text, text[], integer) to anon, authenticated;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'quiz_finishers';
  if n <> 1 then raise exception '0038: quiz_finishers is missing (%)', n; end if;
end $$;
