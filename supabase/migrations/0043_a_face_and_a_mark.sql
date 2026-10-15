-- ===========================================================================
-- 0043 · THE PEOPLE LIST CARRIES A STAMP, AND SORTS ITS OWN STRAGGLERS LAST
-- ===========================================================================
-- Owner, 2026-10-12, on the People list: "the stamp is the identity so i want
-- that integrated too", and then "keep the profile but also add the stamp near
-- the name"; and of the A/B/C headers, "it doesnt have to show it just do it
-- quietly theyll understand".
--
-- ---------------------------------------------------------------------------
-- 1 · THE STAMP COLUMNS
-- ---------------------------------------------------------------------------
-- 0041's two functions return a callsign and nothing else about the person, so
-- the rail drew a coloured initial — a hash of the user id, which identifies
-- nobody. A stamp is what a student actually signs with, and it is already on
-- the quiz row and the leaderboard through `quiz_finishers`. Same eleven
-- columns here, in the same order, so the client shapes them for `stampOf`
-- exactly as board.js already does and the app keeps ONE stamp renderer.
--
-- Somebody who has not issued one comes back with nulls and is drawn as the
-- un-inked outline — the licence's own "not yet" mark. That is deliberate:
-- the one place students look at each other is the place where a missing
-- stamp is worth noticing.
--
-- NO REAL NAME COMES WITH THIS. `people_browse` still has no column for one,
-- and `people_search` still returns one only when the name was asked for
-- (0041). A stamp is a mark the student made for everybody to see; a name is
-- not, and widening one is not an excuse to widen the other.
--
-- ---------------------------------------------------------------------------
-- 2 · AND THE ORDER HAS TO CARRY WHAT THE HEADERS WERE CARRYING
-- ---------------------------------------------------------------------------
-- The list was grouped under A, B, C … with a "#" bucket at the end, and
-- `byLetter` in roomModel.js put anything not starting with a letter into it.
-- The headers are gone now — a sorted list does not need to announce that it
-- is sorted, and on a class of five they were five dividers for five people.
--
-- BUT ONE THING THOSE HEADERS WERE DOING WAS REAL: `_vnx` belongs at the END,
-- and 0041's `order by upper(callsign)` puts it FIRST, because the database
-- collation sorts punctuation before letters. Measured on the live list, not
-- assumed. Dropping the grouping without moving that rule would have silently
-- reordered the screen.
--
-- So it moves into the SQL, where the rest of the order already lives. The
-- client formats and does not sort — the same division as the leaderboard,
-- and `check:people` asserts it by refusing a `.sort(` in the people block.
-- ===========================================================================

-- Both return types change, so both are a drop and a create. 0041's bodies
-- are carried over unchanged except where this file says otherwise.
drop function if exists people_search(text, text);
drop function if exists people_browse(text, interval, integer);

create function people_search(p_me text, p_q text)
returns table (
  user_id        text,
  callsign       text,
  real_name      text,       -- ONLY when the term matched it (0041)
  module_code    text,
  shares_squadron boolean,
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
as $$
  with q as (
    select t as term,
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') as esc
      from (select btrim(coalesce(p_q, '')) as t) r
  ),
  pool as (
    select
      p.user_id,
      p.callsign,
      case when coalesce(up.identity_display, 'real') = 'username'
           then null else p.real_name end as findable_name,
      (select c.module_code from chapter_completions c
        where c.user_id = p.user_id order by c.completed_at desc limit 1) as module_code,
      exists (
        select 1 from squadron_members a
        join squadron_members b on b.squadron_id = a.squadron_id
        where a.user_id = p_me and b.user_id = p.user_id
      ) as shares_squadron,
      p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
      p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
      p.stamp_seed, p.stamp_issued_at
    from pilot_profiles p
    left join user_prefs up on up.user_id = p.user_id
    cross join q
    where q.term <> ''
      and p.user_id is distinct from p_me
      and coalesce(btrim(p.callsign), '') <> ''
      and p.discoverable
      and not coalesce(p.invisible, false)
      and not exists (select 1 from blocks b
                      where (b.user_id = p_me and b.blocked_id = p.user_id)
                         or (b.user_id = p.user_id and b.blocked_id = p_me))
  )
  select
    pool.user_id,
    pool.callsign,
    /* Disclosure is stricter than matching: three characters or more that
       START a word of the name. A plain substring reveal handed a real name
       back for two letters of somebody's CALLSIGN (0041). */
    case when length(q.term) >= 3 and pool.findable_name is not null
          and (lower(pool.findable_name) like lower(q.esc) || '%' escape '\'
            or lower(pool.findable_name) like '% ' || lower(q.esc) || '%' escape '\')
         then pool.findable_name else null end as real_name,
    pool.module_code,
    pool.shares_squadron,
    pool.stamp_shape, pool.stamp_code, pool.stamp_rim, pool.stamp_ring, pool.stamp_pattern,
    pool.stamp_pscope, pool.stamp_ink, pool.stamp_pink, pool.stamp_cink,
    pool.stamp_seed, pool.stamp_issued_at
    from pool cross join q
   where pool.callsign ilike '%' || q.term || '%'
      or pool.findable_name ilike '%' || q.term || '%'
   order by
     case
       when lower(pool.callsign) = lower(q.term)
         or lower(pool.findable_name) = lower(q.term) then 0
       when pool.callsign ilike q.term || '%'
         or pool.findable_name ilike q.term || '%' then 1
       else 2
     end,
     pool.shares_squadron desc,
     /* Same straggler rule as the browse list, so a search result and the
        list it came out of do not disagree about where `_vnx` sits. */
     case when upper(pool.callsign) ~ '^[A-Z]' then 0 else 1 end,
     upper(pool.callsign)
   limit 40;
$$;


create function people_browse(p_me text, p_since interval default null,
                              p_limit integer default 400)
returns table (
  user_id        text,
  callsign       text,
  module_code    text,
  shares_squadron boolean,
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
as $$
  with acted as (
    select user_id, max(at) as at from (
      select pr.user_id, pr.last_seen    as at from presence pr
      union all
      select t.author_id, t.created_at   as at from lesson_threads t
      union all
      select r.author_id, r.created_at   as at from lesson_replies r
      union all
      select c.user_id, c.completed_at   as at from chapter_completions c
      union all
      select qr.user_id, qr.submitted_at as at from quiz_runs qr
       where qr.submitted_at is not null
    ) s
    group by user_id
  )
  select
    p.user_id,
    p.callsign,
    (select c.module_code from chapter_completions c
      where c.user_id = p.user_id order by c.completed_at desc limit 1) as module_code,
    exists (
      select 1 from squadron_members a
      join squadron_members b on b.squadron_id = a.squadron_id
      where a.user_id = p_me and b.user_id = p.user_id
    ) as shares_squadron,
    p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
    p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
    p.stamp_seed, p.stamp_issued_at
  from pilot_profiles p
  left join acted on acted.user_id = p.user_id
  where p.user_id is distinct from p_me
    and coalesce(btrim(p.callsign), '') <> ''
    and p.discoverable
    and not coalesce(p.invisible, false)
    and not exists (select 1 from blocks b
                    where (b.user_id = p_me and b.blocked_id = p.user_id)
                       or (b.user_id = p.user_id and b.blocked_id = p_me))
    and (p_since is null or (acted.at is not null and acted.at >= now() - p_since))
  /* A TO Z, AND ANYTHING THAT IS NOT A LETTER LAST. The grouping that used to
     do this in the client is gone; the collation alone would put `_vnx`
     first. */
  order by case when upper(p.callsign) ~ '^[A-Z]' then 0 else 1 end,
           upper(p.callsign), p.user_id
  limit greatest(coalesce(p_limit, 400), 1);
$$;


do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('people_search', 'people_browse')
     and pronamespace = 'public'::regnamespace;
  if n <> 2 then
    raise exception '0043 did not take: expected 2 functions, found %', n;
  end if;
end $$;
