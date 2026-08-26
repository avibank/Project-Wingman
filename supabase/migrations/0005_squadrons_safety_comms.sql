-- Wingman — squadrons, safety, calls, comms
-- Covers SPEC.md build steps 2, 4, 8 and 9. Run after 0004. Safe to re-run.

-- ---------------------------------------------------------------- profiles
-- Onboarding answers and identity. §7.1 collects study_time; §2 needs livery.
create table if not exists pilot_profiles (
  user_id       text primary key,
  callsign      text,
  livery        text        not null default 'dawn-patrol',
  variant_pin   text,                                   -- 'day' | 'night' | null = auto
  study_time    text,                                   -- 'early' | 'day' | 'evening' | 'late'
  invisible     boolean     not null default false,     -- §8.3, no penalty
  glow_enabled  boolean     not null default true,      -- §7.6 toggle
  is_staff      boolean     not null default false,     -- §7.1, badged real people only
  created_at    timestamptz not null default now()
);

-- --------------------------------------------------------------- squadrons
-- §7.1. Target 10-20 members. A squadron below 10 is 'forming' and says so.
create table if not exists squadrons (
  id           uuid        primary key default gen_random_uuid(),
  module_code  text        not null,
  livery       text        not null default 'dawn-patrol',   -- §2.12, group vote
  study_time   text,
  status       text        not null default 'forming',       -- 'forming' | 'active'
  created_at   timestamptz not null default now()
);

create table if not exists squadron_members (
  squadron_id uuid        not null references squadrons (id) on delete cascade,
  user_id     text        not null,
  marking     text        not null default 'solid',     -- §2.9 collision markings
  joined_at   timestamptz not null default now(),
  primary key (squadron_id, user_id)
);
create index if not exists squadron_members_user_idx on squadron_members (user_id);

-- ------------------------------------------------------------------ safety
-- §9. Must exist before any user-generated content ships.
create table if not exists blocks (
  user_id    text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

create table if not exists mutes (
  user_id   text not null,
  muted_id  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id)
);

create table if not exists reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter_id text        not null,
  target_type text        not null,          -- 'message' | 'image' | 'user'
  target_id   text        not null,
  reason      text,
  chapter_id  text,
  channel_id  text,
  status      text        not null default 'open',   -- 'open' | 'actioned' | 'dismissed'
  created_at  timestamptz not null default now()
);
create index if not exists reports_open_idx on reports (status, created_at) where status = 'open';

-- ------------------------------------------------------------------- calls
-- §7.7. A Call must never expire unanswered without telling the caller.
create table if not exists calls (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
  chapter_id   text        not null,
  question_id  text,
  body         text,
  status       text        not null default 'open',   -- 'open' | 'answered' | 'surfaced'
  stage        smallint    not null default 0,        -- 0 none, 1 squadron, 2 widened, 3 told caller
  created_at   timestamptz not null default now()
);
create index if not exists calls_open_idx on calls (status, created_at) where status = 'open';

create table if not exists call_responses (
  id         uuid        primary key default gen_random_uuid(),
  call_id    uuid        not null references calls (id) on delete cascade,
  user_id    text        not null,
  body       text        not null,
  created_at timestamptz not null default now()
);

create table if not exists call_nudges (
  call_id    uuid        not null references calls (id) on delete cascade,
  user_id    text        not null,
  created_at timestamptz not null default now(),
  primary key (call_id, user_id)          -- §7.7: at most one nudge per member per call
);

-- ------------------------------------------------------------------- comms
-- §7.8. A continuous channel per module. Not a forum: no threads, no votes.
create table if not exists comms_messages (
  id            uuid        primary key default gen_random_uuid(),
  module_code   text        not null,
  squadron_id   uuid        references squadrons (id) on delete cascade,
  user_id       text        not null,
  body          text,
  image_url     text,
  chapter_id    text,                                  -- the chapter chip
  pinned_to     text,                                  -- pinned to this chapter
  is_system     boolean     not null default false,    -- §8.1 Wingman opener
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);
create index if not exists comms_channel_idx on comms_messages (module_code, created_at desc);
create index if not exists comms_pinned_idx on comms_messages (pinned_to) where pinned_to is not null;

create table if not exists comms_reactions (
  message_id uuid not null references comms_messages (id) on delete cascade,
  user_id    text not null,
  emoji      text not null,
  primary key (message_id, user_id, emoji)
);

-- -------------------------------------------------------------- formations
-- §7.9. Temporary, 2-6 people, one chapter. Nobody loses a Formation.
create table if not exists formations (
  id          uuid        primary key default gen_random_uuid(),
  chapter_id  text        not null,
  module_code text        not null,
  squadron_id uuid        references squadrons (id) on delete set null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists formation_members (
  formation_id uuid not null references formations (id) on delete cascade,
  user_id      text not null,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  primary key (formation_id, user_id)
);

-- --------------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'pilot_profiles','squadrons','squadron_members','blocks','mutes','reports',
    'calls','call_responses','call_nudges','comms_messages','comms_reactions',
    'formations','formation_members'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

-- ------------------------------------------------------- the fill ladder
-- §7.1. Descends the four rungs and stops at the first that reaches 10.
-- Never invents a member: if rung 4 still falls short the squadron stays
-- 'forming' and the UI says so plainly.
create or replace function assign_squadron(uid text, mod text, stime text)
returns uuid
language plpgsql
as $$
declare target uuid;
begin
  -- already placed for this module?
  select s.id into target
    from squadron_members m join squadrons s on s.id = m.squadron_id
   where m.user_id = uid and s.module_code = mod
   limit 1;
  if target is not null then return target; end if;

  -- rung 1: same module, same study-time, with room
  select s.id into target from squadrons s
   where s.module_code = mod and s.study_time is not distinct from stime
     and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
   order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
   limit 1;

  -- rung 2: same module, any study-time
  if target is null then
    select s.id into target from squadrons s
     where s.module_code = mod
       and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

  -- rung 3: any module, same study-time
  if target is null then
    select s.id into target from squadrons s
     where s.study_time is not distinct from stime
       and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

  -- rung 4: any squadron with room
  if target is null then
    select s.id into target from squadrons s
     where (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

  -- none exists yet: open one. It will be 'forming' until it reaches 10.
  if target is null then
    insert into squadrons (module_code, study_time, livery)
    values (mod, stime, 'dawn-patrol')
    returning id into target;
  end if;

  insert into squadron_members (squadron_id, user_id)
  values (target, uid)
  on conflict do nothing;

  update squadrons
     set status = case
       when (select count(*) from squadron_members m where m.squadron_id = target) >= 10
       then 'active' else 'forming' end
   where id = target;

  return target;
end $$;

-- Squadron roster with everything the UI needs, minus anyone blocked either way.
create or replace function squadron_roster(uid text, sid uuid)
returns table (user_id text, callsign text, livery text, marking text, is_staff boolean, joined_at timestamptz)
language sql
stable
as $$
  select m.user_id, p.callsign, coalesce(p.livery, 'dawn-patrol'), m.marking,
         coalesce(p.is_staff, false), m.joined_at
    from squadron_members m
    left join pilot_profiles p on p.user_id = m.user_id
   where m.squadron_id = sid
     and m.user_id not in (select blocked_id from blocks where blocks.user_id = uid)
     and m.user_id not in (select b.user_id from blocks b where b.blocked_id = uid)
   order by m.joined_at;
$$;
