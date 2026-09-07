-- 0016 — the three-character code.
--
-- Every pilot has one, chosen at signup, shown on their licence, and stamped on
-- a chapter when they finish it. It is an identity people say out loud, so:
--
--   UNIQUE, because two pilots with the same code is two pilots with no code.
--   The index enforces it; nothing in the app is trusted to check first and
--   then insert, because between the check and the insert is where the
--   duplicate gets in.
--
--   UPPERCASE AND THREE CHARACTERS, from an alphabet with no 0/O and no 1/I/L.
--   A code that cannot be read back off a photograph is not an identifier, and
--   a photograph is exactly where this one will be read from. See src/lib/code.js
--   — the CHECK below is that alphabet, written where it cannot be bypassed.
--
-- Nullable on purpose: every account that exists today predates this, and a
-- NOT NULL would lock all of them out of a table the whole app reads. They get
-- one the next time they set foot in the licence.

alter table pilot_profiles add column if not exists code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pilot_code_shape') then
    alter table pilot_profiles
      add constraint pilot_code_shape
      check (code is null or code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$');
  end if;
end $$;

create unique index if not exists pilot_profiles_code_key on pilot_profiles (code)
  where code is not null;

-- Claiming one. Atomic: the insert either takes the code or it does not, and the
-- caller is told which. Doing this as "is it free? then take it" in the client
-- leaves a gap two people can walk through at once, and at signup — when
-- everybody arrives together — that gap is widest.
--
-- Returns the code on success and null when it is already somebody else's.
create or replace function claim_code(uid text, want text)
returns text
language plpgsql
volatile
as $$
declare taken boolean;
begin
  if want is null or want !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$' then
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
  -- Somebody claimed it between the check and the write. That is the race this
  -- function exists to lose safely: say no, and the caller offers another.
  when unique_violation then return null;
end $$;

-- A free one to suggest, so nobody has to invent a code under pressure while
-- signing up. Tries at random and gives up rather than looping forever — with
-- 29,791 codes and a cohort of students, a collision is rare and the caller
-- can simply ask again.
create or replace function suggest_code()
returns text
language plpgsql
stable
as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
begin
  for _try in 1..12 loop
    candidate := substr(alphabet, 1 + floor(random() * 31)::int, 1)
              || substr(alphabet, 1 + floor(random() * 31)::int, 1)
              || substr(alphabet, 1 + floor(random() * 31)::int, 1);
    if not exists (select 1 from pilot_profiles p where p.code = candidate) then
      return candidate;
    end if;
  end loop;
  return null;
end $$;
