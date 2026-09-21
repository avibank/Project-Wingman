-- =============================================================================
-- 0035 — THE CODE IS THE STAMP.
-- -----------------------------------------------------------------------------
-- Until now they were two things. 0016's code was claimed at signup, or on the
-- first visit to the licence, from a 31-character alphabet. 0029's stamp
-- carried a code of its own, typed in the creator and never claimed. So a
-- student could issue a stamp reading one code while their account held
-- another. The owner (2026-09-21): "the code is the stamp and the stamp is the
-- code, they are issued together".
--
--   1. issue_licence claims the code AND issues the stamp around it, in one
--      statement. Either both happen or neither does, and they cannot differ.
--   2. The code takes any letter and any digit. 0016 left out 0, 1, O, I and L
--      so that a code read off a photograph could not be misread. But a
--      student typing "A10" watched the 1 and the 0 vanish, and read that as
--      "only letters". SUGGESTIONS still avoid those five (suggest_code is
--      unchanged), so nobody is handed an ambiguous one; they can choose one.
--   3. Once the stamp is issued, the code is as permanent as the stamp. claim_code
--      refuses to move it, and the trigger 0029 wrote refuses it too.
--
-- ADDITIVE. The constraint is replaced, not the column. issue_stamp and
-- claim_code keep their signatures, so a bundle deployed before this keeps
-- working until the new one lands.
-- =============================================================================

alter table pilot_profiles drop constraint if exists pilot_code_shape;
alter table pilot_profiles
  add constraint pilot_code_shape check (code is null or code ~ '^[A-Z0-9]{3}$');

create or replace function claim_code(uid text, want text)
returns text
language plpgsql
volatile
as $$
declare taken boolean;
begin
  if want is null or want !~ '^[A-Z0-9]{3}$' then
    return null;
  end if;

  -- An issued stamp carries its code. Moving one would reprint every stamp.
  if exists (select 1 from pilot_profiles p
              where p.user_id = uid and p.stamp_issued_at is not null
                and p.code is distinct from want) then
    return null;
  end if;

  select exists (
    select 1 from pilot_profiles p where p.code = want and p.user_id <> uid
  ) into taken;
  if taken then return null; end if;

  insert into pilot_profiles (user_id, code) values (uid, want)
  on conflict (user_id) do update set code = excluded.code;

  return want;
exception
  when unique_violation then return null;
end $$;

create or replace function issue_licence(
  uid text, p_code text, p_shape text, p_rim boolean,
  p_ring text, p_pattern text, p_ink text)
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
    stamp_ink = p_ink,
    stamp_seed = 1 + floor(random() * 999998)::int,
    stamp_issued_at = now()
  where p.user_id = uid
  returning p.* into out_row;

  return out_row;
exception
  -- Somebody took it between the check and the write.
  when unique_violation then raise exception 'that code is taken';
end $$;

grant execute on function issue_licence(text, text, text, boolean, text, text, text) to anon, authenticated;

-- 0029's trigger, with the code added to what an issued stamp holds still.
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
    or new.stamp_issued_at is distinct from old.stamp_issued_at
    or new.code          is distinct from old.code)
  then
    raise exception 'a stamp cannot be changed once it is issued';
  end if;
  return new;
end $$;
