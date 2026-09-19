-- 0029 — the stamp a pilot issues once, and never changes.
--
-- Run after 0028. Additive: eight columns on pilot_profiles, four CHECKs and
-- one function. Drops nothing. Safe to re-run.
--
-- ===========================================================================
-- WHY IT IS COLUMNS AND NOT A JSONB BLOB
-- ===========================================================================
-- The handoff writes the model as an object —
--   stamp { shape, code, rim, ring, pattern, ink, seed, issued_at }
-- — and it would fit in one jsonb column. It is eight columns instead, for the
-- reason 0016 gave for `code`: "the CHECK below is that alphabet, written
-- where it cannot be bypassed". A jsonb blob can hold a shape this app cannot
-- draw, an ink that is not in the palette, or a code with a bracket in it, and
-- nothing would notice until a licence rendered wrong for one person. Every
-- constraint below mirrors src/lib/stamp.js, and npm run check:stamp holds the
-- two together.
--
-- ===========================================================================
-- ISSUING IS ONE TIME ONLY, AND THAT IS ENFORCED HERE
-- ===========================================================================
-- §4: "Issuing is one time only. The server rejects changes once issued_at is
-- set." A client-side check cannot make that true — this client is anonymous
-- from Postgres' point of view (0009's header) and anyone with the publishable
-- key can PATCH a row. So the columns are written through `issue_stamp` only,
-- a SECURITY DEFINER function that refuses a second call, and the direct
-- UPDATE path is closed by a trigger rather than by a policy: a policy naming
-- a user would deny every row, because auth.jwt() is NULL on every request.
--
-- The seed is the SERVER'S, not the client's. It is what gives an account its
-- own permanent ink texture, and a client that chose it could choose somebody
-- else's.

alter table pilot_profiles add column if not exists stamp_shape     text;
alter table pilot_profiles add column if not exists stamp_code      text;
alter table pilot_profiles add column if not exists stamp_rim       boolean;
alter table pilot_profiles add column if not exists stamp_ring      text;
alter table pilot_profiles add column if not exists stamp_pattern   text;
alter table pilot_profiles add column if not exists stamp_ink       text;
alter table pilot_profiles add column if not exists stamp_seed      integer;
alter table pilot_profiles add column if not exists stamp_issued_at timestamptz;

do $$
begin
  -- The six shapes and the six patterns the renderer can draw, and nothing else.
  if not exists (select 1 from pg_constraint where conname = 'stamp_shape_known') then
    alter table pilot_profiles add constraint stamp_shape_known
      check (stamp_shape is null or stamp_shape in ('seal','roundel','window','gauge','postage','tag'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_pattern_known') then
    alter table pilot_profiles add constraint stamp_pattern_known
      check (stamp_pattern is null or stamp_pattern in ('none','rays','waves','checks','swirl','guilloche'));
  end if;
  -- §4: "a code of 1-3 characters, A-Z or 0-9, required. There are no symbols."
  if not exists (select 1 from pg_constraint where conname = 'stamp_code_shape') then
    alter table pilot_profiles add constraint stamp_code_shape
      check (stamp_code is null or stamp_code ~ '^[A-Z0-9]{1,3}$');
  end if;
  -- The rim text is the student's own, at most ten, from an alphabet that
  -- cannot close an SVG tag. src/lib/stamp.js cleans it; this is the floor.
  if not exists (select 1 from pg_constraint where conname = 'stamp_ring_shape') then
    alter table pilot_profiles add constraint stamp_ring_shape
      check (stamp_ring is null or stamp_ring ~ '^[A-Z0-9 .''-]{0,10}$');
  end if;
  -- An ink is a NAME from the palette. Storing the colour would mean a
  -- re-tuned palette could never reach the stamps already issued.
  if not exists (select 1 from pg_constraint where conname = 'stamp_ink_known') then
    alter table pilot_profiles add constraint stamp_ink_known
      check (stamp_ink is null or stamp_ink in (
        'Midnight','Lapiz','Miami','Baby','Powder','Glacier','Teal','Seafoam','Emerald','Racing','Sage','Matcha',
        'Olive','Khaki','Sand','Butter','Honey','Papaya','Clementine','Coral','Ruby','Cherry','Peach','Latte',
        'Mocha','Espresso','Nardo','Gunmetal','Chalk','Mauve','Blush','Bubblegum','Barbie','Lilac','Lavender','Plum'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_seed_whole') then
    alter table pilot_profiles add constraint stamp_seed_whole
      check (stamp_seed is null or stamp_seed between 1 and 999999);
  end if;
end $$;

-- ISSUE IT ONCE. Returns the row as issued; raises if there already is one.
create or replace function issue_stamp(
  uid text, p_shape text, p_code text, p_rim boolean,
  p_ring text, p_pattern text, p_ink text)
returns pilot_profiles
language plpgsql
security definer
set search_path = public
as $$
declare out_row pilot_profiles;
begin
  if uid is null or uid = '' then raise exception 'no pilot'; end if;

  insert into pilot_profiles (user_id) values (uid)
  on conflict (user_id) do nothing;

  -- The one rule this function exists for.
  if exists (select 1 from pilot_profiles p where p.user_id = uid and p.stamp_issued_at is not null) then
    raise exception 'that stamp is already issued';
  end if;

  update pilot_profiles p set
    stamp_shape = p_shape,
    -- Cleaned here as well as in the UI: this is the last gate before storage.
    stamp_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')),
    stamp_rim = coalesce(p_rim, true),
    stamp_ring = nullif(left(upper(regexp_replace(coalesce(p_ring, ''), '[^A-Za-z0-9 .''-]', '', 'g')), 10), ''),
    stamp_pattern = coalesce(p_pattern, 'none'),
    stamp_ink = p_ink,
    -- The server's, not the client's.
    stamp_seed = 1 + floor(random() * 999998)::int,
    stamp_issued_at = now()
  where p.user_id = uid
  returning p.* into out_row;

  if out_row.stamp_code is null or out_row.stamp_code = '' then
    raise exception 'a stamp needs a code';
  end if;
  return out_row;
end $$;

-- AND THE DIRECT PATH IS CLOSED. Without this, `issued once` is a promise the
-- function keeps and a PATCH ignores.
create or replace function stamp_is_permanent() returns trigger
language plpgsql as $$
begin
  if old.stamp_issued_at is not null and (
       new.stamp_shape   is distinct from old.stamp_shape
    or new.stamp_code    is distinct from old.stamp_code
    or new.stamp_rim     is distinct from old.stamp_rim
    or new.stamp_ring    is distinct from old.stamp_ring
    or new.stamp_pattern is distinct from old.stamp_pattern
    or new.stamp_ink     is distinct from old.stamp_ink
    or new.stamp_seed    is distinct from old.stamp_seed
    or new.stamp_issued_at is distinct from old.stamp_issued_at)
  then
    raise exception 'a stamp cannot be changed once it is issued';
  end if;
  return new;
end $$;

drop trigger if exists pilot_stamp_permanent on pilot_profiles;
create trigger pilot_stamp_permanent
  before update on pilot_profiles
  for each row execute function stamp_is_permanent();

grant execute on function issue_stamp(text, text, text, boolean, text, text, text) to anon, authenticated;
