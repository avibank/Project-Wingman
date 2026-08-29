-- ============================================================================
-- Wingman — full setup. Run as one paste, top to bottom.
--
-- Safe to run on a fresh database or one that already has some of this: every
-- statement is guarded, including the two check constraints that were not in
-- the first version of this file.
--
-- Assumes migrations 0001-0004 are already applied.
-- ============================================================================


-- 0005_squadrons_safety_comms.sql

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

create or replace function assign_squadron(uid text, mod text, stime text)
returns uuid
language plpgsql
as $$
declare target uuid;
begin
  select s.id into target
    from squadron_members m join squadrons s on s.id = m.squadron_id
   where m.user_id = uid and s.module_code = mod
   limit 1;
  if target is not null then return target; end if;

  select s.id into target from squadrons s
   where s.module_code = mod and s.study_time is not distinct from stime
     and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
   order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
   limit 1;

  if target is null then
    select s.id into target from squadrons s
     where s.module_code = mod
       and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

  if target is null then
    select s.id into target from squadrons s
     where s.study_time is not distinct from stime
       and (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

  if target is null then
    select s.id into target from squadrons s
     where (select count(*) from squadron_members m where m.squadron_id = s.id) < 20
     order by (select count(*) from squadron_members m where m.squadron_id = s.id) desc
     limit 1;
  end if;

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


-- 0006_openers_rate_limits_moderation.sql

create or replace function post_opener_if_quiet(mod text, chap text, opener text)
returns uuid
language plpgsql
as $$
declare
  newest    timestamptz;
  human_wk  integer;
  new_id    uuid;
begin
  if opener is null or length(btrim(opener)) = 0 then return null; end if;

  perform pg_advisory_xact_lock(hashtext('opener:' || mod));

  select max(created_at) into newest
    from comms_messages where module_code = mod;

  if newest is not null and newest > now() - interval '48 hours' then
    return null;
  end if;

  select count(*) into human_wk
    from comms_messages
   where module_code = mod
     and is_system = false
     and created_at > now() - interval '7 days';

  if human_wk >= 20 then return null; end if;

  insert into comms_messages (module_code, user_id, body, chapter_id, is_system)
  values (mod, 'wingman', opener, chap, true)
  returning id into new_id;

  return new_id;
end $$;

create table if not exists rate_events (
  id         bigserial   primary key,
  user_id    text        not null,
  kind       text        not null,          -- 'message' | 'call' | 'formation'
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup
  on rate_events (user_id, kind, created_at desc);

create or replace function rate_limit_take(uid text, k text, per_hour integer)
returns boolean
language plpgsql
as $$
declare used integer;
begin
  if uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('rate:' || uid || ':' || k));
  select count(*) into used
    from rate_events
   where user_id = uid and kind = k and created_at > now() - interval '1 hour';
  if used >= per_hour then return false; end if;
  insert into rate_events (user_id, kind) values (uid, k);
  return true;
end $$;

create or replace function rate_events_prune()
returns void language sql as $$
  delete from rate_events where created_at < now() - interval '2 hours';
$$;

create or replace view moderation_queue as
select
  r.id,
  r.created_at,
  r.reporter_id,
  r.target_type,
  r.target_id,
  r.reason,
  r.chapter_id,
  r.channel_id,
  r.status,
  now() - r.created_at                              as waiting,
  (now() - r.created_at) > interval '24 hours'      as past_target,
  m.body                                            as message_body,
  m.user_id                                         as message_author,
  m.module_code                                     as message_channel
from reports r
left join comms_messages m
  on r.target_type = 'message' and m.id::text = r.target_id
where r.status = 'open'
order by r.created_at;

do $$
begin
  execute 'alter table rate_events enable row level security';
  execute 'drop policy if exists rate_events_open on rate_events';
  execute 'create policy rate_events_open on rate_events for all using (true) with check (true)';
end $$;


-- 0007_questions_squawks_teams.sql

alter table comms_messages add column if not exists is_question  boolean not null default false;
alter table comms_messages add column if not exists answers_id   uuid references comms_messages (id) on delete set null;
alter table comms_messages add column if not exists resolved_at  timestamptz;
alter table comms_messages add column if not exists is_verified  boolean not null default false;
alter table comms_messages add column if not exists verified_by  text;

create index if not exists comms_questions_idx
  on comms_messages (chapter_id, created_at desc) where is_question;
create index if not exists comms_answers_idx
  on comms_messages (answers_id) where answers_id is not null;

alter table comms_messages add column if not exists squawk text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comms_squawk_code') then
    alter table comms_messages add constraint comms_squawk_code
      check (squawk is null or squawk in ('7600', '7700')) not valid;
  end if;
end $$;

alter table formations add column if not exists starts_at timestamptz;

create table if not exists teams (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  module_code text,
  created_by  text        not null,
  created_at  timestamptz not null default now()
);

create table if not exists team_members (
  team_id   uuid        not null references teams (id) on delete cascade,
  user_id   text        not null,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on team_members (user_id);

alter table comms_messages add column if not exists team_id uuid references teams (id) on delete cascade;
create index if not exists comms_team_idx on comms_messages (team_id, created_at desc) where team_id is not null;

alter table pilot_profiles add column if not exists status  text    not null default 'student';
alter table pilot_profiles add column if not exists helped  integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pilot_status_ladder') then
    alter table pilot_profiles add constraint pilot_status_ladder
      check (status in ('student', 'private', 'instrument', 'commercial', 'cfi')) not valid;
  end if;
end $$;

alter table pilot_profiles add column if not exists notify text not null default 'default';

create table if not exists module_social (
  module_code text primary key,
  enabled     boolean not null default false,
  enabled_at  timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'module_social'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

create or replace view open_squawks as
select
  q.id,
  q.user_id,
  q.body,
  q.chapter_id,
  q.module_code,
  q.created_at,
  q.squawk,
  now() - q.created_at as waiting
from comms_messages q
where q.is_question
  and q.resolved_at is null
  and not exists (select 1 from comms_messages a where a.answers_id = q.id)
order by q.created_at;

create or replace function mark_answer(answer_id uuid, question_id uuid, marker text)
returns boolean
language plpgsql
as $$
declare asker text; helper text;
begin
  select user_id into asker  from comms_messages where id = question_id and is_question;
  select user_id into helper from comms_messages where id = answer_id;
  if asker is null or helper is null then return false; end if;
  if marker is distinct from asker then return false; end if;

  update comms_messages set answers_id = question_id where id = answer_id;
  update comms_messages set resolved_at = now() where id = question_id;
  if helper is distinct from asker then
    update pilot_profiles set helped = helped + 1 where user_id = helper;
  end if;
  return true;
end $$;


-- 0008_lesson_surface.sql

create table if not exists lesson_notes (
  id         text        primary key,
  user_id    text        not null,
  lesson_id  text        not null,
  t          integer     not null check (t >= 0),
  body       text        not null default '',
  created_at timestamptz not null default now()
);
create index if not exists lesson_notes_user_idx on lesson_notes (user_id, lesson_id, t);

alter table lesson_notes enable row level security;
create policy lesson_notes_open on lesson_notes for all using (true) with check (true);

create table if not exists lesson_threads (
  id         text        primary key,
  module_id  text        not null,
  lesson_id  text,                      -- null = a module post, People only
  t          integer,                   -- null iff lesson_id is null
  body       text        not null check (length(btrim(body)) > 0),
  author_id  text        not null,
  created_at timestamptz not null default now(),
  constraint lesson_threads_anchor_whole
    check ((lesson_id is null and t is null) or (lesson_id is not null and t is not null and t >= 0))
);
create index if not exists lesson_threads_module_idx on lesson_threads (module_id, created_at desc);
create index if not exists lesson_threads_lesson_idx on lesson_threads (module_id, lesson_id, t);

alter table lesson_threads enable row level security;
create policy lesson_threads_open on lesson_threads for all using (true) with check (true);

create table if not exists lesson_replies (
  id         text        primary key,
  thread_id  text        not null references lesson_threads (id) on delete cascade,
  body       text        not null check (length(btrim(body)) > 0),
  author_id  text        not null,
  created_at timestamptz not null default now()
);
create index if not exists lesson_replies_thread_idx on lesson_replies (thread_id, created_at);

alter table lesson_replies enable row level security;
create policy lesson_replies_open on lesson_replies for all using (true) with check (true);

create or replace function lesson_comments(p_module text, p_lesson text)
returns table (
  id text, module_id text, lesson_id text, t integer,
  body text, author_id text, created_at timestamptz, reply_count bigint
)
language sql
stable
as $$
  select th.id, th.module_id, th.lesson_id, th.t, th.body, th.author_id, th.created_at,
         count(r.id) as reply_count
  from lesson_threads th
  left join lesson_replies r on r.thread_id = th.id
  where th.module_id = p_module
    and th.lesson_id = p_lesson
  group by th.id
  order by th.t asc;
$$;

create or replace function module_threads(p_module text, p_me text)
returns table (
  id text, lesson_id text, t integer, body text, author_id text,
  created_at timestamptz, reply_count bigint,
  in_it boolean, waiting boolean, last_activity_by timestamptz
)
language sql
stable
as $$
  select th.id, th.lesson_id, th.t, th.body, th.author_id, th.created_at,
         count(r.id)                                                     as reply_count,
         coalesce(bool_or(th.author_id = p_me or r.author_id = p_me), false) as in_it,
         count(r.id) = 0                                                  as waiting,
         greatest(
           case when th.author_id <> p_me then th.created_at end,
           max(r.created_at) filter (where r.author_id <> p_me)
         )                                                                as last_activity_by
  from lesson_threads th
  left join lesson_replies r on r.thread_id = th.id
  where th.module_id = p_module
  group by th.id
  order by
    case when coalesce(bool_or(th.author_id = p_me or r.author_id = p_me), false) then 0
         when count(r.id) = 0 then 1
         else 2 end,
    greatest(th.created_at, coalesce(max(r.created_at), th.created_at)) desc;
$$;


-- ============================================================================
-- Setup. Neither of these is schema, and neither default is what you want.

-- §10 — one cohort, one module. Until a module has a row here, no channel is
-- gated and every one shows. Change 'JT' if your first cohort is elsewhere.
insert into module_social (module_code, enabled, enabled_at) values ('JT', true, now())
  on conflict (module_code) do update set enabled = true, enabled_at = now();

-- §11 — everyone starts at 'student', and only CFI standing can mark an
-- explanation verified. Replace the id with yours from the Clerk dashboard.
-- A wrong id updates zero rows and harms nothing, so check it took:
--   select user_id, status from pilot_profiles where status = 'cfi';
update pilot_profiles set status = 'cfi' where user_id = 'YOUR_CLERK_USER_ID';
