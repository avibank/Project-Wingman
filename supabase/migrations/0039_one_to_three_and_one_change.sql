-- =============================================================================
-- 0039 — A CODE IS ONE TO THREE CHARACTERS, AND EVERYBODY WHO HAS A STAMP
--        ALREADY GETS ONE CHANGE.
-- -----------------------------------------------------------------------------
-- The owner, 2026-09-23: "the stamps are locked at three digits, it should be
-- letters and numbers, a max of 3 a min of 1, and allow all users to change,
-- as two users have made stamps they weren't satisfied with due to the min of
-- 3 rule — a fix for the two active users right now, then back to the one
-- time stamp rule."
--
-- Two changes, and the second one is the delicate one.
--
-- 1 · THE SHAPE. `^[A-Z0-9]{3}$` becomes `^[A-Z0-9]{1,3}$`, in the CHECK, in
--     claim_code and in both arities of issue_licence. Letters and numbers
--     were always both allowed; what was locked was the length.
--
-- 2 · ONE CHANGE, THEN PERMANENT AGAIN. A credit rather than an amnesty
--     window: `pilot_profiles.stamp_redo` is a count, every account that has
--     already issued a stamp is given exactly one here, and issue_licence
--     spends it. When it is spent the account is back under the original
--     rule with nothing to turn off later, and no date anywhere decides who
--     is allowed — which is what a window would have meant, and what would
--     have had to be remembered and reversed.
--
--     THE TRIGGER IS WHAT MAKES A STAMP PERMANENT, and it is not being
--     loosened. It now allows exactly one shape of change: the same UPDATE
--     that alters the stamp must also take the credit down by one. Anything
--     else raises, as before. And because RLS here is open by design (0009's
--     header: the anon key is the bearer on every request, access control is
--     the app's), the credit itself has to be protected or it would be a way
--     to hand yourself another change: the trigger refuses any UPDATE that
--     RAISES stamp_redo unless `pw.grant_redo` is set for the transaction,
--     and the only thing that sets it is grant_stamp_redo(), which is
--     granted to service_role and to nobody else. anon cannot reach it.
--
-- The backfill below runs with the trigger off for exactly that reason: the
-- migration is the first grant, and it is subject to the same rule it writes.
-- =============================================================================

-- ---------------------------------------------------------------- 1 · shape
alter table pilot_profiles drop constraint if exists pilot_code_shape;
alter table pilot_profiles
  add constraint pilot_code_shape check (code is null or code ~ '^[A-Z0-9]{1,3}$');

-- --------------------------------------------------------------- 2 · credit
alter table pilot_profiles add column if not exists stamp_redo integer not null default 0;
alter table pilot_profiles drop constraint if exists stamp_redo_sane;
alter table pilot_profiles add constraint stamp_redo_sane check (stamp_redo >= 0 and stamp_redo <= 3);

-- ------------------------------------------------------- 3 · what may change
create or replace function stamp_is_permanent() returns trigger
language plpgsql as $$
declare
  changed boolean;
  spends  boolean;
begin
  changed := old.stamp_issued_at is not null and (
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
    or new.code          is distinct from old.code);

  -- The one shape of change that is allowed: the same statement takes the
  -- credit down by one.
  spends := old.stamp_redo > 0 and new.stamp_redo = old.stamp_redo - 1;

  if changed and not spends then
    raise exception 'a stamp cannot be changed once it is issued';
  end if;

  -- And a credit cannot be handed to yourself.
  if new.stamp_redo > old.stamp_redo
     and coalesce(current_setting('pw.grant_redo', true), '') <> '1' then
    raise exception 'a change has to be granted';
  end if;

  return new;
end $$;

-- The only way a credit is given. service_role only: anon must not reach it.
create or replace function grant_stamp_redo(uid text, n integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare left_now integer;
begin
  perform set_config('pw.grant_redo', '1', true);
  update pilot_profiles p
     set stamp_redo = least(3, greatest(0, p.stamp_redo + greatest(0, n)))
   where p.user_id = uid
  returning p.stamp_redo into left_now;
  perform set_config('pw.grant_redo', '', true);
  return coalesce(left_now, 0);
end $$;

revoke all on function grant_stamp_redo(text, integer) from public, anon, authenticated;
grant execute on function grant_stamp_redo(text, integer) to service_role;

-- ------------------------------------------------------------ 4 · claim_code
create or replace function claim_code(uid text, want text)
returns text
language plpgsql
volatile
as $$
declare taken boolean;
begin
  if want is null or want !~ '^[A-Z0-9]{1,3}$' then
    return null;
  end if;

  -- An issued stamp carries its code. It moves only through issue_licence,
  -- and only by spending a change.
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

-- ------------------------------------------------------- 5 · issue_licence
-- 0036's ten-argument shape, which is the one the client calls. The seven
-- argument one from 0035 follows it, for a bundle deployed before this.
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
  had  pilot_profiles;
  out_row pilot_profiles;
begin
  if uid is null or uid = '' then raise exception 'no pilot'; end if;

  want := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if want !~ '^[A-Z0-9]{1,3}$' then
    raise exception 'a licence needs a code of one to three characters';
  end if;

  insert into pilot_profiles (user_id) values (uid)
  on conflict (user_id) do nothing;

  select * into had from pilot_profiles p where p.user_id = uid;

  -- Already issued? Then this is the one change, and only if it is owed.
  if had.stamp_issued_at is not null and coalesce(had.stamp_redo, 0) < 1 then
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
    stamp_pscope = coalesce(p_pscope, 'both'),
    stamp_ink = p_ink,
    stamp_pink = p_pink,
    stamp_cink = p_cink,
    stamp_seed = 1 + floor(random() * 999998)::int,
    stamp_issued_at = now(),
    -- The credit is spent in the SAME statement, which is what the trigger
    -- reads as permission. A first issue has none to spend and needs none.
    stamp_redo = case when had.stamp_issued_at is not null
                      then coalesce(p.stamp_redo, 0) - 1 else coalesce(p.stamp_redo, 0) end
  where p.user_id = uid
  returning p.* into out_row;

  return out_row;
exception
  when unique_violation then raise exception 'that code is taken';
end $$;

grant execute on function issue_licence(text, text, text, boolean, text, text, text, text, text, text) to anon, authenticated;

create or replace function issue_licence(
  uid text, p_code text, p_shape text, p_rim boolean,
  p_ring text, p_pattern text, p_ink text)
returns pilot_profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return issue_licence(uid, p_code, p_shape, p_rim, p_ring, p_pattern, p_ink, 'both', null, null);
end $$;

grant execute on function issue_licence(text, text, text, boolean, text, text, text) to anon, authenticated;

-- --------------------------------------------- 6 · the one change, to everyone
-- With the trigger off, because this statement is the first grant and the
-- rule it writes would refuse it. Two accounts have a stamp today; anybody
-- who issues one after this gets none, which is the rule going back on.
alter table pilot_profiles disable trigger pilot_stamp_permanent;
update pilot_profiles set stamp_redo = 1 where stamp_issued_at is not null and stamp_redo = 0;
alter table pilot_profiles enable trigger pilot_stamp_permanent;

-- ------------------------------------------------------------------ 7 · proof
do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
   where table_name = 'pilot_profiles' and column_name = 'stamp_redo';
  if n <> 1 then raise exception '0039: stamp_redo is missing'; end if;

  select count(*) into n from pg_constraint
   where conname = 'pilot_code_shape'
     and pg_get_constraintdef(oid) like '%{1,3}%';
  if n <> 1 then raise exception '0039: the code shape was not widened'; end if;
end $$;
