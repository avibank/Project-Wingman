-- ===========================================================================
-- 0041 · A NAME FINDS ANYBODY, AND THE PEOPLE LIST IS CALLSIGNS
-- ===========================================================================
-- Owner, 2026-10-11, having searched for somebody he knows by name AND by
-- username and got nothing back: "disregard anything we decided earlier. This
-- is the new rule. You type the name of the person, or the username, and if it
-- is registered on a server, it will show their name. Think of like the
-- Instagram suggestions."
--
-- Then, 2026-10-12, on where that list lives and what it may show: "if you
-- select people, it shows every current person ... they are filtered in
-- alphabetical order ... we filter as per username ... you can only get the
-- name if you search it up. If you actually search for the name you get the
-- name, otherwise it only shows the username. If you press it you can see the
-- real name, but you don't get it just through looking at it."
--
-- THIS FILE HAS NOT BEEN RUN YET, which is why it is being rewritten rather
-- than followed by an 0042: the live database is still on 0032's
-- `people_search`. Once it HAS run, nothing here may be edited again — the
-- next change is a new file.
--
-- ---------------------------------------------------------------------------
-- WHY NOTHING CAME BACK, AND IT WAS NOT THE MATCHING
-- ---------------------------------------------------------------------------
-- The matching was already on both: 0012 matches `callsign` and `real_name`,
-- case-insensitively, as substrings. What refused the row was the SCOPE.
--
-- 0011 built `people_search` so that it "cannot return a stranger whatever it
-- is asked", through `in_my_orbit(p_me, p_them)` — true only if you share a
-- squadron, or they authored a thread in one of YOUR modules, or they replied
-- in one. `my_modules` is itself derived from `chapter_completions` and
-- `lesson_threads`, so a student who has not finished a chapter has no
-- modules, and for them orbit collapses to "shares a squadron with me".
--
-- So on a class this size the function was mostly answering "is this person
-- already in a room with me" — and the honest answer to a search for somebody
-- who has signed up, done nothing yet and joined nothing was an empty list.
-- The feature was not broken; it was scoped to something other than what it
-- says on the box.
--
-- THE ORBIT RULE IS WITHDRAWN FOR SEARCH. `in_my_orbit` is NOT dropped —
-- `discover_squadrons` (0011) still uses it to decide which faces it may show
-- on a room's card, which is a different question and still the right one.
--
-- ---------------------------------------------------------------------------
-- A LIST SHOWS CALLSIGNS. A NAME IS SOMETHING YOU ASKED FOR.
-- ---------------------------------------------------------------------------
-- This is the shape change, and it is a privacy rule rather than a layout
-- one, so it lives here rather than in the component that draws it.
--
--   `people_browse`  returns CALLSIGNS AND NO NAMES AT ALL. It is the list
--                    you scroll when you have not typed anything, so nobody
--                    can read a roster of real names off the side of the
--                    screen. There is no column for a name to arrive in.
--
--   `people_search`  returns the callsign always, and `real_name` ONLY on the
--                    rows whose name actually matched what you typed. Search
--                    "Hamdan" and Sara's name comes back, because you already
--                    knew it; search "SRH", or scroll the list, and it does
--                    not. The client cannot leak what it was never sent.
--
-- The third way in is the profile sheet, which is a deliberate press on one
-- person and has always shown the name. That is "if you press it you can see
-- the real name".
--
-- 0012'S IDENTITY RULE SURVIVES ON TOP OF THIS and is stricter: a student
-- whose `identity_display` is 'username' is never matched on `real_name` and
-- never has it returned, however it was asked for. They are still findable —
-- their callsign finds them — and that is the point of the two rules sitting
-- together rather than one replacing the other.
--
-- ---------------------------------------------------------------------------
-- WHAT IS KEPT
-- ---------------------------------------------------------------------------
--   Fly solo (`pilot_profiles.invisible`)  0032 exists to make "I am not
--       here" mean it on this surface. Untouched.
--   Blocks, both ways                      symmetric and total.
--   `discoverable`                         0011's separate "don't put me
--       forward". No screen sets it today, so it is `true` for every real
--       account and costs nothing to honour.
--   Never yourself. Orbit used to do this incidentally (`p_me <> p_them`);
--       it is explicit now, and `is distinct from` so a null searcher does
--       not silently empty the result.
--   A PROFILE WITH NO CALLSIGN IS NOT LISTED. Both functions require one,
--       because the list has nothing else to draw and a blank row is worse
--       than an absent one. FirstFlightGate sets the callsign when it makes a
--       profile and heals it for older accounts, so this excludes nobody in
--       practice; if it ever does, that profile is the bug.
-- ===========================================================================

-- THE RETURN TYPE CHANGES, so this is a drop and a create rather than a
-- replace: Postgres refuses to change a function's output columns in place
-- (0017's header has the same note, and 0012 dropped this very function for
-- the same reason). Dropping is safe here because the only caller is the app,
-- and the app ships with the client that matches.
drop function if exists people_search(text, text);

create function people_search(p_me text, p_q text)
returns table (
  user_id        text,
  callsign       text,       -- always; this is what a list may draw
  real_name      text,       -- ONLY when the term matched it, else null
  module_code    text,
  shares_squadron boolean
)
language sql
stable
as $$
  with q as (
    select t as term,
           /* the same text with LIKE's own wildcards neutralised */
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') as esc
      from (select btrim(coalesce(p_q, '')) as t) r
  ),
  pool as (
    select
      p.user_id,
      p.callsign,
      /* The real name is matchable ONLY while they have not chosen
         otherwise. Null here means "do not match on this", and `ilike`
         against null is null, which is not true — so it never matches. */
      case when coalesce(up.identity_display, 'real') = 'username'
           then null else p.real_name end as findable_name,
      (select c.module_code from chapter_completions c
        where c.user_id = p.user_id order by c.completed_at desc limit 1) as module_code,
      exists (
        select 1 from squadron_members a
        join squadron_members b on b.squadron_id = a.squadron_id
        where a.user_id = p_me and b.user_id = p.user_id
      ) as shares_squadron
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
    /* THE NAME ONLY TRAVELS WHEN THE NAME WAS ASKED FOR, and asking is
       stricter than matching.
       ------------------------------------------------------------------
       MATCHING stays a loose substring, so any fragment still FINDS people.
       DISCLOSURE does not: the term has to be at least three characters and
       has to start one of the words of the name.

       Without both halves the rule is worthless. A plain substring reveal
       hands back a name for "a", and measured on the fixture it handed back
       "Kai Lindqvist" for the two letters "KA" — somebody typing the start
       of a CALLSIGN was being given a real name. Three letters off the front
       of a word is what "actually searching for the name" means; one letter
       is harvesting.

       `escape '\'` because the term is a student's text: a bare `%` or `_`
       in it would otherwise be a wildcard and match far more than was
       typed. */
    case when length(q.term) >= 3 and pool.findable_name is not null
          and (lower(pool.findable_name) like lower(q.esc) || '%' escape '\'
            or lower(pool.findable_name) like '% ' || lower(q.esc) || '%' escape '\')
         then pool.findable_name else null end as real_name,
    pool.module_code,
    pool.shares_squadron
    from pool cross join q
   where pool.callsign ilike '%' || q.term || '%'
      or pool.findable_name ilike '%' || q.term || '%'
   /* What you typed comes first: exact, then starts-with, then merely
      contains; then somebody you share a squadron with; then by callsign,
      which is the order the browse list is in, so the two agree. */
   order by
     case
       when lower(pool.callsign) = lower(q.term)
         or lower(pool.findable_name) = lower(q.term) then 0
       when pool.callsign ilike q.term || '%'
         or pool.findable_name ilike q.term || '%' then 1
       else 2
     end,
     pool.shares_squadron desc,
     pool.callsign
   limit 40;
$$;


-- ===========================================================================
-- THE PEOPLE LIST
-- ===========================================================================
-- "If you select people, it shows every current person ... you can look up
-- the exact name, or you can just swipe through them."
--
-- Alphabetical BY CALLSIGN, because that is the only thing the list shows and
-- sorting by a name nobody can see would look arbitrary. No names, by
-- construction: there is no column for one.
--
-- AND NO COUNT, which is the rule from the first version of this and still
-- holds (owner, 2026-10-11: a directory "that doesn't expose if we have small
-- users"). It returns rows and nothing else — no total, and deliberately no
-- `count(*)` companion, because the moment one exists a screen will print it.
--
-- `p_since` is null by default, which is EVERYONE. It was a fortnight's
-- activity in the first draft; "every current person" is what was asked for,
-- and the window stays only as a knob for a class large enough to want one.
create or replace function people_browse(p_me text, p_since interval default null,
                                         p_limit integer default 400)
returns table (
  user_id        text,
  callsign       text,
  module_code    text,
  shares_squadron boolean
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
    ) as shares_squadron
  from pilot_profiles p
  left join acted on acted.user_id = p.user_id
  where p.user_id is distinct from p_me
    and coalesce(btrim(p.callsign), '') <> ''
    and p.discoverable
    and not coalesce(p.invisible, false)
    and not exists (select 1 from blocks b
                    where (b.user_id = p_me and b.blocked_id = p.user_id)
                       or (b.user_id = p.user_id and b.blocked_id = p_me))
    /* Null window means everybody; a window asks for somebody who has done
       one of the five things inside it. */
    and (p_since is null or (acted.at is not null and acted.at >= now() - p_since))
  order by upper(p.callsign), p.user_id
  limit greatest(coalesce(p_limit, 400), 1);
$$;


do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('people_search', 'people_browse')
     and pronamespace = 'public'::regnamespace;
  if n < 2 then
    raise exception '0041 did not take: expected people_search and people_browse, found %', n;
  end if;
end $$;
