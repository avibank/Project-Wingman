-- 0032 — Fly solo hides you from search, and from the roster, on the server.
--
-- Run after 0031. Replaces two functions in place; adds no columns and drops
-- nothing. Safe to re-run.
--
-- ===========================================================================
-- WHAT WAS LEAKING
-- ===========================================================================
-- §6 of the launch handoff: "Fly solo must actually hide the student from
-- Crew, the route strip, the radar and presence, and hide others from them."
--
-- Most of that already held, and each in the strongest way available:
--
--   presence      gated at the WRITE, and the row is deleted (presence.js).
--                 There is nothing left for anybody to read, so no reader has
--                 to cooperate. right_seat reads presence, so it follows.
--   Crew          crew.js selects `invisible` and drops those rows.
--   the roster     squadron.js asks for `.eq("invisible", false)`.
--   the licence    0030's licence_card refuses a pilot who is invisible.
--
-- `people_search` did not. It filters on `discoverable`, which is 0011's
-- separate opt-out of BEING SUGGESTED, and a student who had never touched
-- that setting stayed findable by callsign while flying solo. Type somebody's
-- name into Discover and there they were, having asked not to be seen.
--
-- The two settings are not the same thing and neither replaces the other:
-- `discoverable` is "don't put me forward", Fly solo is "I am not here". The
-- second has to imply the first.
--
-- `squadron_roster` did not either. squadron.js already hides them from the
-- member list on its own query, which is exactly the shape 0009's header warns
-- about: a rule the client enforces is not a rule. The server says it too now,
-- so the two cannot drift.
--
-- ===========================================================================
-- WHAT THIS DELIBERATELY DOES NOT DO
-- ===========================================================================
-- It does not remove a solo student from their squadron, from a thread they
-- wrote in, or from anything they did. Fly solo is about being SEEN standing
-- somewhere, not about unwriting the past — and a message with no author is a
-- worse surface than a message from somebody quiet. Their words stay; their
-- presence goes.

-- BODY COPIED FROM THE LIVE DEFINITION, with one line added — the same
-- discipline 0013 used: "Body copied from the live definition
-- (pg_get_functiondef) ... Nothing else changed." 0011 wrote this function and
-- 0012 replaced it: the live one returns `display_name`, not `callsign`, and
-- carries the identity_display rule. Replacing 0011's text would have changed
-- the return type, which Postgres refuses, and would have silently undone
-- 0012's rule if it had not.
create or replace function people_search(p_me text, p_q text)
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
    -- Fly solo. The one line this migration exists for.
    and not coalesce(p.invisible, false)
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

-- Body as 0013 rebuilt it (without the livery column), with the same one line.
-- YOU ARE STILL ON YOUR OWN ROSTER: hiding yourself from the squadron you are
-- looking at would make your own membership look like it had lapsed.
create or replace function squadron_roster(uid text, sid uuid)
returns table (user_id text, callsign text, marking text, is_staff boolean, joined_at timestamptz)
language sql
stable
as $$
  select m.user_id, p.callsign, m.marking,
         coalesce(p.is_staff, false), m.joined_at
    from squadron_members m
    left join pilot_profiles p on p.user_id = m.user_id
   where m.squadron_id = sid
     and (m.user_id = uid or not coalesce(p.invisible, false))
     and m.user_id not in (select blocked_id from blocks where blocks.user_id = uid)
     and m.user_id not in (select b.user_id from blocks b where b.blocked_id = uid)
   order by m.joined_at;
$$;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('people_search', 'squadron_roster')
     and prosrc like '%invisible%';
  if n <> 2 then raise exception '0032: Fly solo is still not on the server (%)', n; end if;
end $$;

-- ===========================================================================
-- AND PRESENCE READS IT TOO, BECAUSE THE WRITE SIDE IS PER-DEVICE
-- ===========================================================================
-- presence.js gates the WRITE and deletes the row, which is the strongest
-- shape available: nothing is left for anybody to read, so no reader has to
-- cooperate. That is true, and it is true PER DEVICE.
--
-- The switch is stored twice on purpose (flySolo.js): `pilot_profiles.invisible`
-- is the account, and a localStorage mirror is what the plain functions read
-- synchronously. Only the second one gates the heartbeat — so a student who
-- turns Fly solo on on their phone is hidden from their phone, and their
-- LAPTOP, still open on a module, carries on writing presence rows for them
-- every forty-five seconds. Nobody sees them, except everybody.
--
-- The same gap swallows a row when the switch goes on with the tab already
-- closed: the delete never runs and the row sits there until the window
-- expires.
--
-- So the read cooperates as well. `presence_visible` is the presence table
-- minus anybody whose account says invisible, and it is a view so every
-- existing reader becomes one string different rather than one query more.
create or replace view presence_visible as
  select p.*
    from presence p
    left join pilot_profiles pp on pp.user_id = p.user_id
   where not coalesce(pp.invisible, false);

grant select on presence_visible to anon, authenticated;

do $$
declare n integer;
begin
  select count(*) into n from pg_views where viewname = 'presence_visible';
  if n <> 1 then raise exception '0032: presence_visible is missing'; end if;
end $$;
