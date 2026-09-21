-- =============================================================================
-- 0036 — THE STAMP ENGINE OF 20 SEPTEMBER, ALL OF IT.
-- -----------------------------------------------------------------------------
-- The owner (2026-09-21) replaced the stamp engine and the creator with the
-- launch pack's own (docs/launch/code/05, 15, 03). Measured against the live
-- database before writing this, 0029's checks still described the stamp of
-- an earlier pack:
--
--   stamp_shape_known    seal, roundel, window, gauge, postage, tag
--   stamp_pattern_known  none, rays, waves, checks, swirl, guilloche
--
-- so a student who chose Crochet or Knurl — two of the six patterns the
-- creator has offered since 20 September — could not issue their stamp at
-- all, and shield and hex could never be stored. And the creator's three
-- other choices had nowhere to go: where the pattern sits (Both / Centre /
-- Rim), the pattern's own ink, and the code's own ink.
--
--   1. The shape check takes all eight shapes.
--   2. The pattern check takes the six, AND the two retired names (waves,
--      swirl): a check is re-validated against every existing row, and a
--      stamp is permanent, so a name that was ever issuable stays storable.
--   3. Three columns: stamp_pscope, stamp_pink, stamp_cink. Inks are stored
--      by NAME, like stamp_ink, and held to the same thirty-six.
--   4. They are as permanent as the rest of the stamp (the 0029 trigger).
--   5. issue_licence gains the three, as a NEW overload. PostgREST picks an
--      overload by the names of the arguments it is sent, so the bundle
--      deployed before this — which sends seven — keeps reaching the old
--      one, and the new bundle, which sends ten, reaches this one.
--
-- ADDITIVE for the data: no column or row is dropped. Two READ functions are
-- dropped and recreated wider, in this same transaction — see the foot.
-- =============================================================================

alter table pilot_profiles drop constraint if exists stamp_shape_known;
alter table pilot_profiles add constraint stamp_shape_known
  check (stamp_shape is null or stamp_shape in
    ('seal','roundel','window','gauge','postage','tag','shield','hex'));

alter table pilot_profiles drop constraint if exists stamp_pattern_known;
alter table pilot_profiles add constraint stamp_pattern_known
  check (stamp_pattern is null or stamp_pattern in
    ('none','rays','checks','guilloche','crochet','knurl','waves','swirl'));

alter table pilot_profiles add column if not exists stamp_pscope text;
alter table pilot_profiles add column if not exists stamp_pink   text;
alter table pilot_profiles add column if not exists stamp_cink   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stamp_pscope_known') then
    alter table pilot_profiles add constraint stamp_pscope_known
      check (stamp_pscope is null or stamp_pscope in ('both','centre','rim'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_pink_known') then
    alter table pilot_profiles add constraint stamp_pink_known
      check (stamp_pink is null or stamp_pink in (
        'Midnight','Lapiz','Miami','Baby','Powder','Glacier','Teal','Seafoam','Emerald','Racing','Sage','Matcha',
        'Olive','Khaki','Sand','Butter','Honey','Papaya','Clementine','Coral','Ruby','Cherry','Peach','Latte',
        'Mocha','Espresso','Nardo','Gunmetal','Chalk','Mauve','Blush','Bubblegum','Barbie','Lilac','Lavender','Plum'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_cink_known') then
    alter table pilot_profiles add constraint stamp_cink_known
      check (stamp_cink is null or stamp_cink in (
        'Midnight','Lapiz','Miami','Baby','Powder','Glacier','Teal','Seafoam','Emerald','Racing','Sage','Matcha',
        'Olive','Khaki','Sand','Butter','Honey','Papaya','Clementine','Coral','Ruby','Cherry','Peach','Latte',
        'Mocha','Espresso','Nardo','Gunmetal','Chalk','Mauve','Blush','Bubblegum','Barbie','Lilac','Lavender','Plum'));
  end if;
end $$;

create or replace function stamp_is_permanent() returns trigger
language plpgsql as $$
begin
  if old.stamp_issued_at is not null and (
       new.stamp_shape   is distinct from old.stamp_shape
    or new.stamp_code    is distinct from old.stamp_code
    or new.stamp_rim     is distinct from old.stamp_rim
    or new.stamp_ring    is distinct from old.stamp_ring
    or new.stamp_pattern is distinct from old.stamp_pattern
    or new.stamp_pscope  is distinct from old.stamp_pscope
    or new.stamp_ink     is distinct from old.stamp_ink
    or new.stamp_pink    is distinct from old.stamp_pink
    or new.stamp_cink    is distinct from old.stamp_cink
    or new.stamp_seed    is distinct from old.stamp_seed
    or new.stamp_issued_at is distinct from old.stamp_issued_at
    or new.code          is distinct from old.code)
  then
    raise exception 'a stamp cannot be changed once it is issued';
  end if;
  return new;
end $$;

create or replace function issue_licence(
  uid text, p_code text, p_shape text, p_rim boolean,
  p_ring text, p_pattern text, p_ink text,
  p_pscope text, p_pink text, p_cink text)
returns pilot_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  want text;
  out_row pilot_profiles;
begin
  if uid is null or uid = '' then raise exception 'no pilot'; end if;

  want := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if want !~ '^[A-Z0-9]{3}$' then
    raise exception 'a licence needs a three-character code';
  end if;

  insert into pilot_profiles (user_id) values (uid)
  on conflict (user_id) do nothing;

  if exists (select 1 from pilot_profiles p where p.user_id = uid and p.stamp_issued_at is not null) then
    raise exception 'that stamp is already issued';
  end if;

  if exists (select 1 from pilot_profiles p where p.code = want and p.user_id <> uid) then
    raise exception 'that code is taken';
  end if;

  update pilot_profiles p set
    code = want,
    stamp_code = want,
    stamp_shape = p_shape,
    stamp_rim = coalesce(p_rim, true),
    stamp_ring = nullif(left(upper(regexp_replace(coalesce(p_ring, ''), '[^A-Za-z0-9 .''-]', '', 'g')), 10), ''),
    stamp_pattern = coalesce(p_pattern, 'none'),
    stamp_pscope = case when coalesce(p_pattern, 'none') = 'none' then null else coalesce(p_pscope, 'both') end,
    stamp_ink = p_ink,
    stamp_pink = case when coalesce(p_pattern, 'none') = 'none' then null else p_pink end,
    stamp_cink = p_cink,
    stamp_seed = 1 + floor(random() * 999998)::int,
    stamp_issued_at = now()
  where p.user_id = uid
  returning p.* into out_row;

  return out_row;
exception
  when unique_violation then raise exception 'that code is taken';
end $$;

grant execute on function issue_licence(text, text, text, boolean, text, text, text, text, text, text) to anon, authenticated;

-- ===========================================================================
-- AND EVERYBODY ELSE SEES ALL OF IT
-- ===========================================================================
-- licence_card (what a classmate opens) and quiz_leaderboard (the stamp beside
-- a run) return fixed column lists, so a stamp read through either would be
-- drawn without where its pattern sits or its two extra inks. The three go on
-- the end of each. DROPPED AND RECREATED, as 0033 and 0034 did and for their
-- reason: a function's return columns cannot be widened in place. Each drop
-- and create is in this one script and therefore one transaction, so there is
-- no moment when either is missing; and a bundle deployed before this reads
-- the columns it knows and ignores three more.
drop function if exists licence_card(text, text);
create or replace function licence_card(p_viewer text, p_user text)
returns table (
  user_id text, callsign text, real_name text, code text,
  bio text, phrase text, cover text, cover_ink text, cover_image text,
  is_staff boolean, hours_s integer, lessons_signed integer, days_flown integer,
  stamp_shape text, stamp_code text, stamp_rim boolean, stamp_ring text,
  stamp_pattern text, stamp_ink text, stamp_seed integer, stamp_issued_at timestamptz,
  photo_url text, photo_zoom integer, photo_x integer, photo_y integer,
  stamp_pscope text, stamp_pink text, stamp_cink text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.callsign, p.real_name, p.code,
         p.bio, p.phrase, p.cover, p.cover_ink, p.cover_image,
         p.is_staff, p.hours_s, p.lessons_signed, p.days_flown,
         p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring,
         p.stamp_pattern, p.stamp_ink, p.stamp_seed, p.stamp_issued_at,
         p.photo_url, p.photo_zoom, p.photo_x, p.photo_y,
         p.stamp_pscope, p.stamp_pink, p.stamp_cink
    from pilot_profiles p
   where p.user_id = p_user
     and (p.user_id = p_viewer or p.invisible = false)
     and not exists (
       select 1 from blocks b
        where (b.user_id = p_viewer and b.blocked_id = p_user)
           or (b.user_id = p_user   and b.blocked_id = p_viewer))
$$;

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
  stamp_cink      text
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
      sp.stamp_pscope, sp.stamp_pink, sp.stamp_cink
    from visible v
    left join pilot_profiles sp on sp.user_id = v.user_id
  )
  select rank, run_id, user_id, callsign, code, score, total, seconds, is_you, runs_total,
         stamp_shape, stamp_code, stamp_rim, stamp_ring,
         stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at,
         stamp_pscope, stamp_pink, stamp_cink
    from ranked
   order by rank
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
