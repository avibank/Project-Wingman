-- Wingman — searchable names, and suggestions that rank rather than list
--
-- Run after 0011. Safe to re-run. Adds one column and replaces three functions.
--
-- ===========================================================================
-- 1 · A NAME IS SEARCHABLE UNTIL ITS OWNER SAYS OTHERWISE
-- ===========================================================================
-- People are found by callsign OR real name. But "Go by callsign" already
-- exists as a preference — user_prefs.identity_display, 'real' | 'username' —
-- and when somebody has chosen it, their real name is not merely hidden from
-- the result, it is NOT MATCHED AT ALL. Searching their real name finds
-- nothing, which is the only version of that promise worth making: a name that
-- is unmatchable cannot be confirmed by guessing it.
--
-- And the function never RETURNS the real name of somebody who goes by
-- callsign. Filtering it in the client would leave it in the response, which is
-- the same leak with a curtain over it.
alter table pilot_profiles add column if not exists real_name text;

/* DROPPED AND RECREATED, not replaced. The signature changes — it returned
   `callsign` and now returns `display_name`, because what a searcher may see is
   no longer always the same string — and Postgres will not let a replace change
   a return type. Dropping a function is not data loss; the guard on the SQL
   runner treats every drop the same and this one needs saying out loud. */
drop function if exists people_search(text, text);

create function people_search(p_me text, p_q text)
returns table (user_id text, display_name text, module_code text, shares_squadron boolean)
language sql
stable
as $$
  with me_prefs as (select p_me as uid)
  select
    p.user_id,
    /* What the searcher is allowed to see them as. Never coalesce to real_name
       for somebody who goes by callsign — that is the leak. */
    case when coalesce(up.identity_display, 'real') = 'username'
         then p.callsign
         else coalesce(p.real_name, p.callsign) end as display_name,
    (select c.module_code from chapter_completions c
      where c.user_id = p.user_id order by c.completed_at desc limit 1) as module_code,
    exists (
      select 1 from squadron_members a
      join squadron_members b on b.squadron_id = a.squadron_id
      where a.user_id = p_me and b.user_id = p.user_id
    ) as shares_squadron
  from pilot_profiles p
  left join user_prefs up on up.user_id = p.user_id
  cross join me_prefs
  where p.discoverable
    and in_my_orbit(p_me, p.user_id)
    and not exists (select 1 from blocks b
                    where (b.user_id = p_me and b.blocked_id = p.user_id)
                       or (b.user_id = p.user_id and b.blocked_id = p_me))
    and coalesce(btrim(p_q), '') <> ''
    and (
      p.callsign ilike '%' || btrim(p_q) || '%'
      /* The real name is matchable ONLY while they have not chosen otherwise. */
      or (coalesce(up.identity_display, 'real') <> 'username'
          and p.real_name ilike '%' || btrim(p_q) || '%')
    )
  order by shares_squadron desc, display_name
  limit 20;
$$;

-- ===========================================================================
-- 2 · SUGGESTIONS — ranked, with the reason attached
-- ===========================================================================
-- Modelled on what a suggestion feed actually does: score on overlap, order by
-- score, and say WHY. A list of rooms in creation order is a directory; the
-- same rooms ordered by how much they have to do with you, each carrying the
-- one fact that earned it its place, is a suggestion.
--
-- WHAT IT MAY NOT DO. It cannot suggest a person outside the orbit. A feed that
-- surfaces strangers is a directory with a ranking function in front of it, and
-- §3 forbids the directory however it is sorted. Squadrons are unrestricted —
-- that is the point of them, and it is why the room is the recommended door and
-- the person is what is behind it.
--
-- The weights are stated as numbers rather than buried in a case expression so
-- they can be argued with. In order of how much they say about whether you
-- belong somewhere: the module you study, then people you already know, then
-- the exam you are sitting, then how alive the room is.

create or replace function suggest_squadrons(p_me text, p_limit integer default 12)
returns table (
  id uuid, name text, blurb text, module_code text, exam_window text,
  join_policy text, members integer, active_week integer, is_full boolean,
  known_ids text[], score integer, reason text
)
language sql
stable
as $$
  with mine as (select squadron_id from squadron_members where user_id = p_me),
  my_mods as (select * from my_modules(p_me)),
  my_exam as (select exam_window e from pilot_profiles where user_id = p_me),
  active as (
    select m.squadron_id, count(distinct pr.user_id)::int n
    from squadron_members m
    left join presence pr on pr.user_id = m.user_id and pr.last_seen > now() - interval '7 days'
    group by m.squadron_id
  ),
  scored as (
    select s.*,
      coalesce(a.n, 0) as active_week,
      squadron_headcount(s.id) as members,
      coalesce(squadron_is_full(s.id), false) as full_now,
      coalesce((select array_agg(sm.user_id) from squadron_members sm
                where sm.squadron_id = s.id and in_my_orbit(p_me, sm.user_id)), '{}') as known,
      (s.module_code in (select * from my_mods))                            as mod_hit,
      (s.exam_window is not null
        and s.exam_window = (select e from my_exam))                        as exam_hit,
      (select count(*) from squadron_members sm
        where sm.squadron_id = s.id and in_my_orbit(p_me, sm.user_id))::int as known_n
    from squadrons s
    left join active a on a.squadron_id = s.id
    where s.join_policy in ('open', 'request')
      and s.id not in (select squadron_id from mine)
      /* Never suggest a room where somebody has blocked you, or you them. */
      and not exists (
        select 1 from squadron_members m
        join blocks b on (b.user_id = p_me and b.blocked_id = m.user_id)
                      or (b.user_id = m.user_id and b.blocked_id = p_me)
        where m.squadron_id = s.id)
  )
  select id, name, blurb, module_code, exam_window, join_policy,
    members, active_week, full_now as is_full, known,
    (   case when mod_hit  then 40 else 0 end
      + case when exam_hit then 20 else 0 end
      + least(known_n * 8, 24)
      + least(active_week, 10) * 2
      + case when full_now then -35 else 0 end
    )::int as score,
    /* ONE REASON, THE STRONGEST. Three reasons on a card is a specification;
       one is a suggestion. Ordered by what actually persuades somebody to join:
       who is already in there beats what it is about. */
    case
      when known_n > 0    then 'known'
      when mod_hit        then 'module'
      when exam_hit       then 'exam'
      when active_week > 0 then 'busy'
      else 'open'
    end as reason
  from scored
  order by score desc, active_week desc, members desc
  limit greatest(1, p_limit);
$$;

-- People, and only ever from inside the orbit. Ranked on the things that
-- predict whether two students are useful to each other: rooms in common,
-- the module they are both in, the sitting they are both working toward, and
-- whether they are awake at the same time.
create or replace function suggest_people(p_me text, p_limit integer default 8)
returns table (
  user_id text, display_name text, module_code text,
  shared_squadrons integer, score integer, reason text
)
language sql
stable
as $$
  with me as (
    select p.exam_window, p.active_window
    from pilot_profiles p where p.user_id = p_me
  ),
  cand as (
    select p.user_id, p.callsign, p.real_name, p.exam_window, p.active_window,
      coalesce(up.identity_display, 'real') as ident,
      (select count(*) from squadron_members a
        join squadron_members b on b.squadron_id = a.squadron_id
        where a.user_id = p_me and b.user_id = p.user_id)::int as shared_sq,
      (select count(*) from lesson_threads t
        where t.author_id = p.user_id and t.module_id in (select * from my_modules(p_me)))::int as posts_here,
      (select max(pr.last_seen) from presence pr where pr.user_id = p.user_id) as seen
    from pilot_profiles p
    left join user_prefs up on up.user_id = p.user_id
    where p.discoverable
      and in_my_orbit(p_me, p.user_id)
      and not exists (select 1 from blocks b
                      where (b.user_id = p_me and b.blocked_id = p.user_id)
                         or (b.user_id = p.user_id and b.blocked_id = p_me))
  )
  select c.user_id,
    case when c.ident = 'username' then c.callsign
         else coalesce(c.real_name, c.callsign) end as display_name,
    (select ch.module_code from chapter_completions ch
      where ch.user_id = c.user_id order by ch.completed_at desc limit 1) as module_code,
    c.shared_sq as shared_squadrons,
    (   least(c.shared_sq * 25, 50)
      + least(c.posts_here * 6, 18)
      + case when c.exam_window is not null
              and c.exam_window = (select exam_window from me) then 15 else 0 end
      + case when c.active_window is not null
              and c.active_window = (select active_window from me) then 10 else 0 end
      + case when c.seen > now() - interval '7 days' then 8 else 0 end
    )::int as score,
    case
      when c.shared_sq > 0 then 'squadron'
      when c.posts_here > 0 then 'answers'
      when c.exam_window = (select exam_window from me) then 'exam'
      when c.active_window = (select active_window from me) then 'hours'
      else 'module'
    end as reason
  from cand c
  order by score desc, c.seen desc nulls last
  limit greatest(1, p_limit);
$$;
