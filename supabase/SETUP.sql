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

drop function if exists squadron_roster(text, uuid);
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
drop policy if exists lesson_notes_open on lesson_notes;
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
drop policy if exists lesson_threads_open on lesson_threads;
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
drop policy if exists lesson_replies_open on lesson_replies;
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


-- 0009_right_seat_boundary.sql

create or replace function my_squadron_ids(p_me text)
returns setof uuid
language sql
stable
as $$
  select squadron_id from squadron_members where user_id = p_me;
$$;

create or replace function right_seat(p_me text, p_since interval default '90 seconds')
returns table (
  user_id      text,
  squadron_id  uuid,
  module_code  text,
  chapter_id   text,
  last_seen    timestamptz
)
language sql
stable
as $$
  select distinct on (p.user_id)
         p.user_id,
         sm.squadron_id,
         p.module_code,
         p.chapter_id,
         p.last_seen
  from presence p
  join squadron_members sm
    on sm.user_id = p.user_id
   and sm.squadron_id in (select my_squadron_ids(p_me))
  where p.user_id <> p_me
    and p.last_seen >= now() - p_since
    and not exists (
      select 1 from blocks b
      where (b.user_id = p_me and b.blocked_id = p.user_id)
         or (b.user_id = p.user_id and b.blocked_id = p_me)
    )
  order by p.user_id, p.last_seen desc;
$$;

drop policy if exists lesson_notes_open         on lesson_notes;
drop policy if exists lesson_notes_no_bulk_read on lesson_notes;
drop policy if exists lesson_notes_write        on lesson_notes;
drop policy if exists lesson_notes_update       on lesson_notes;
drop policy if exists lesson_notes_delete       on lesson_notes;

create policy lesson_notes_no_bulk_read on lesson_notes
  for select using (false);
create policy lesson_notes_write on lesson_notes
  for insert with check (true);
create policy lesson_notes_update on lesson_notes
  for update using (true) with check (true);
create policy lesson_notes_delete on lesson_notes
  for delete using (true);


-- 0010_thread_titles_and_answers.sql

alter table lesson_threads add column if not exists title text;

alter table lesson_threads
  add column if not exists best_reply_id text
  references lesson_replies (id) on delete set null;

create table if not exists lesson_reply_votes (
  reply_id   text        not null references lesson_replies (id) on delete cascade,
  user_id    text        not null,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
create index if not exists lesson_reply_votes_reply_idx on lesson_reply_votes (reply_id);

alter table lesson_reply_votes enable row level security;
drop policy if exists lesson_reply_votes_open on lesson_reply_votes;
create policy lesson_reply_votes_open on lesson_reply_votes
  for all using (true) with check (true);


-- 0011_discovery.sql

alter table squadrons add column if not exists name         text;
alter table squadrons add column if not exists blurb        text;
alter table squadrons add column if not exists owner_id     text;
alter table squadrons add column if not exists exam_window  text;

alter table squadrons add column if not exists join_policy  text not null default 'invite_only';
do $$ begin
  alter table squadrons add constraint squadrons_join_policy_known
    check (join_policy in ('open', 'request', 'invite_only'));
exception when duplicate_object then null; end $$;

alter table squadrons add column if not exists member_cap   integer default 32;

alter table squadrons add column if not exists invite_token       text;
alter table squadrons add column if not exists invite_expires_at  timestamptz;
alter table squadrons add column if not exists invite_revoked_at  timestamptz;
create unique index if not exists squadrons_invite_token_idx
  on squadrons (lower(invite_token)) where invite_token is not null;

alter table pilot_profiles add column if not exists exam_window   text;
alter table pilot_profiles add column if not exists active_window text;   -- morning|afternoon|evening|night
alter table pilot_profiles add column if not exists timezone      text;
alter table pilot_profiles add column if not exists discoverable  boolean not null default true;

create table if not exists squadron_join_requests (
  squadron_id uuid        not null references squadrons (id) on delete cascade,
  user_id     text        not null,
  state       text        not null default 'pending' check (state in ('pending','accepted','declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  primary key (squadron_id, user_id)
);
create index if not exists squadron_join_requests_user_idx on squadron_join_requests (user_id, state);

create table if not exists squadron_invites (
  id           uuid        primary key default gen_random_uuid(),
  squadron_id  uuid        not null references squadrons (id) on delete cascade,
  inviter_id   text        not null,
  invitee_id   text        not null,
  state        text        not null default 'pending' check (state in ('pending','accepted','declined','revoked')),
  created_at   timestamptz not null default now(),
  unique (squadron_id, invitee_id)
);
create index if not exists squadron_invites_invitee_idx on squadron_invites (invitee_id, state);

do $$
declare t text;
begin
  foreach t in array array['squadron_join_requests', 'squadron_invites'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

create or replace function my_modules(p_me text)
returns setof text
language sql
stable
as $$
  select module_code from chapter_completions where user_id = p_me
  union
  select module_id   from lesson_threads      where author_id = p_me;
$$;

create or replace function in_my_orbit(p_me text, p_them text)
returns boolean
language sql
stable
as $$
  select p_me is not null and p_them is not null and p_me <> p_them and (
    exists (
      select 1 from squadron_members a
      join squadron_members b on b.squadron_id = a.squadron_id
      where a.user_id = p_me and b.user_id = p_them
    )
    or exists (
      select 1 from lesson_threads t
      where t.author_id = p_them and t.module_id in (select my_modules(p_me))
    )
    or exists (
      select 1 from lesson_replies r
      join lesson_threads t on t.id = r.thread_id
      where r.author_id = p_them and t.module_id in (select my_modules(p_me))
    )
  );
$$;

drop function if exists people_search(text, text);
create or replace function people_search(p_me text, p_q text)
returns table (user_id text, callsign text, module_code text, shares_squadron boolean)
language sql
stable
as $$
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
  where p.discoverable
    and in_my_orbit(p_me, p.user_id)
    and not exists (select 1 from blocks b
                    where (b.user_id = p_me and b.blocked_id = p.user_id)
                       or (b.user_id = p.user_id and b.blocked_id = p_me))
    and coalesce(btrim(p_q), '') <> ''
    and p.callsign ilike '%' || btrim(p_q) || '%'
  order by shares_squadron desc, p.callsign
  limit 20;
$$;

create or replace function squadron_headcount(p_squadron uuid)
returns integer
language sql
stable
as $$
  select count(*)::int from squadron_members where squadron_id = p_squadron;
$$;

create or replace function squadron_is_full(p_squadron uuid)
returns boolean
language sql
stable
as $$
  select s.member_cap is not null and squadron_headcount(s.id) >= s.member_cap
  from squadrons s where s.id = p_squadron;
$$;

create or replace function discover_squadrons(p_me text, p_filter text default 'all')
returns table (
  id uuid, name text, blurb text, module_code text, exam_window text,
  join_policy text, members integer, active_week integer, is_full boolean,
  known_ids text[], already_in boolean, requested boolean
)
language sql
stable
as $$
  with mine as (select squadron_id from squadron_members where user_id = p_me),
  active as (
    select m.squadron_id, count(distinct pr.user_id)::int as n
    from squadron_members m
    left join presence pr
      on pr.user_id = m.user_id and pr.last_seen > now() - interval '7 days'
    group by m.squadron_id
  )
  select
    s.id, s.name, s.blurb, s.module_code, s.exam_window, s.join_policy,
    squadron_headcount(s.id) as members,
    coalesce(a.n, 0) as active_week,
    coalesce(squadron_is_full(s.id), false) as is_full,
    coalesce((
      select array_agg(sm.user_id)
      from squadron_members sm
      where sm.squadron_id = s.id and in_my_orbit(p_me, sm.user_id)
    ), '{}') as known_ids,
    s.id in (select squadron_id from mine) as already_in,
    exists (select 1 from squadron_join_requests r
            where r.squadron_id = s.id and r.user_id = p_me and r.state = 'pending') as requested
  from squadrons s
  left join active a on a.squadron_id = s.id
  where s.join_policy in ('open', 'request')
    and (p_filter <> 'yours' or s.module_code in (select my_modules(p_me)))
    and (p_filter <> 'exam'  or s.exam_window is not distinct from
         (select pp.exam_window from pilot_profiles pp where pp.user_id = p_me))
  order by coalesce(a.n, 0) desc, squadron_headcount(s.id) desc
  limit 40;
$$;

create or replace function join_squadron(p_me text, p_squadron uuid)
returns text
language plpgsql
volatile
as $$
declare s squadrons%rowtype;
begin
  select * into s from squadrons where id = p_squadron;
  if not found then return 'missing'; end if;
  if exists (select 1 from squadron_members where squadron_id = s.id and user_id = p_me)
    then return 'already_in'; end if;
  if exists (
    select 1 from squadron_members m
    join blocks b on (b.user_id = p_me and b.blocked_id = m.user_id)
                  or (b.user_id = m.user_id and b.blocked_id = p_me)
    where m.squadron_id = s.id
  ) then return 'unavailable'; end if;
  if coalesce(squadron_is_full(s.id), false) then return 'full'; end if;

  if s.join_policy = 'open' then
    insert into squadron_members (squadron_id, user_id) values (s.id, p_me)
      on conflict do nothing;
    return 'joined';
  elsif s.join_policy = 'request' then
    insert into squadron_join_requests (squadron_id, user_id) values (s.id, p_me)
      on conflict (squadron_id, user_id) do update set state = 'pending', decided_at = null;
    return 'requested';
  else
    return 'invite_only';
  end if;
end $$;

create or replace function squadron_by_invite(p_me text, p_token text)
returns table (id uuid, name text, blurb text, members integer, state text)
language sql
stable
as $$
  select s.id, s.name, s.blurb, squadron_headcount(s.id) as members,
    case
      when s.invite_revoked_at is not null then 'missing'
      when s.invite_expires_at is not null and s.invite_expires_at < now() then 'missing'
      when exists (select 1 from squadron_members m where m.squadron_id = s.id and m.user_id = p_me)
        then 'already_in'
      when exists (
        select 1 from squadron_members m
        join blocks b on (b.user_id = p_me and b.blocked_id = m.user_id)
                      or (b.user_id = m.user_id and b.blocked_id = p_me)
        where m.squadron_id = s.id
      ) then 'unavailable'
      when coalesce(squadron_is_full(s.id), false) then 'full'
      else 'ok'
    end as state
  from squadrons s
  where lower(s.invite_token) = lower(btrim(p_token));
$$;


-- 0012_search_and_suggestions.sql

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


-- 0013_retire_pilot_livery.sql

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
    insert into squadrons (module_code, study_time)
    values (mod, stime)
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

drop function if exists squadron_roster(text, uuid);

create function squadron_roster(uid text, sid uuid)
returns table (user_id text, callsign text, marking text, is_staff boolean, joined_at timestamptz)
language sql
stable
as $$
  select m.user_id, p.callsign, m.marking,
         coalesce(p.is_staff, false), m.joined_at
    from squadron_members m
    left join pilot_profiles p on p.user_id = m.user_id
   where m.squadron_id = sid
     and m.user_id not in (select blocked_id from blocks where blocks.user_id = uid)
     and m.user_id not in (select b.user_id from blocks b where b.blocked_id = uid)
   order by m.joined_at;
$$;

alter table pilot_profiles drop column if exists livery;
alter table squadrons      drop column if exists livery;


-- 0014_paper_annotations.sql

create table if not exists paper_annotations (
  id             uuid primary key default gen_random_uuid(),
  paper_id       text        not null,
  module_code    text        not null,
  paper_version  int         not null default 1,
  author_id      text        not null,
  kind           text        not null check (kind in ('highlight','note','question','correction')),
  ring           text        not null default 'module' check (ring in ('solo','wingman','formation','module')),
  body           text,
  thread_id      text,
  resolved_at    timestamptz,
  status         text        not null default 'ok' check (status in ('ok','orphaned')),
  anchor         jsonb       not null,
  hint           jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint anchor_is_text_only check (
    not (anchor ? 'page' or anchor ? 'rect' or anchor ? 'rects' or anchor ? 'bbox')
  ),
  constraint question_has_thread check (kind <> 'question' or thread_id is not null)
);

create index if not exists paper_annotations_paper on paper_annotations (paper_id, status);
create index if not exists paper_annotations_author on paper_annotations (author_id);
create index if not exists paper_annotations_updated on paper_annotations (paper_id, updated_at desc);

alter table paper_annotations enable row level security;
drop policy if exists paper_annotations_all on paper_annotations;
create policy paper_annotations_all on paper_annotations for all using (true) with check (true);

create or replace function ring_covers(p_author text, p_viewer text, p_ring text, p_module text)
returns boolean
language sql
stable
as $$
  select case
    when p_author = p_viewer then true
    when p_ring = 'solo' then false
    when p_ring = 'wingman' then exists (
      select 1 from wingmen w
       where (w.user_id = p_author and w.wingman_user_id = p_viewer)
          or (w.user_id = p_viewer and w.wingman_user_id = p_author))
    when p_ring = 'formation' then exists (
      select 1 from wingmen w
       where (w.user_id = p_author and w.wingman_user_id = p_viewer)
          or (w.user_id = p_viewer and w.wingman_user_id = p_author))
      or exists (
      select 1 from formation_members a
        join formation_members b on b.formation_id = a.formation_id
       where a.user_id = p_author and b.user_id = p_viewer
         and a.left_at is null and b.left_at is null)
      or exists (
      select 1 from squadron_members a
        join squadron_members b on b.squadron_id = a.squadron_id
       where a.user_id = p_author and b.user_id = p_viewer)
    when p_ring = 'module' then coalesce(p_module, '') <> ''
    else false
  end;
$$;

drop function if exists paper_annotations_for(text, text, timestamptz);

create function paper_annotations_for(uid text, p_paper text, p_since timestamptz default null)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, kind text, ring text, body text,
  thread_id text, resolved_at timestamptz, status text,
  anchor jsonb, hint jsonb, created_at timestamptz, updated_at timestamptz,
  close boolean
)
language sql
stable
as $$
  with me as (
    select coalesce((select p.invisible from pilot_profiles p where p.user_id = uid), false) as solo,
           coalesce((select p.is_staff  from pilot_profiles p where p.user_id = uid), false) as staff
  )
  select a.id, a.paper_id, a.module_code, a.paper_version,
         a.author_id,
         case when a.author_id = uid then 'You'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end as author_name,
         a.kind, a.ring, a.body, a.thread_id, a.resolved_at, a.status,
         a.anchor, a.hint, a.created_at, a.updated_at,
         (a.author_id = uid or ring_covers(a.author_id, uid, 'formation', a.module_code)) as close
    from paper_annotations a
    left join pilot_profiles pp on pp.user_id = a.author_id
   cross join me
   where a.paper_id = p_paper
     and (p_since is null or a.updated_at > p_since)
     and (a.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = a.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = a.author_id)
            and not exists (select 1 from blocks b where b.user_id = a.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = a.author_id)
            /* R9 — a correction is for its author and the staff, and for
               nobody else. Deliberately NOT "the ring rule, plus a staff
               exception": whichever ring a correction was stored with is
               irrelevant to who may see it, and making staff visibility depend
               on the ring meant the author could not see a correction written
               to the writer's own ring — which is every correction, since that
               is what the composer sets. The kind decides. */
            and (case when a.kind = 'correction' then me.staff
                      else ring_covers(a.author_id, uid, a.ring, a.module_code) end)
          ))
   order by a.created_at;
$$;

create or replace function paper_corrections_for(uid text, p_module text)
returns table (
  id uuid, paper_id text, author_id text, author_name text,
  body text, anchor jsonb, status text, created_at timestamptz
)
language sql
stable
as $$
  select a.id, a.paper_id, a.author_id,
         coalesce(pp.callsign, pp.real_name, 'Someone'),
         a.body, a.anchor, a.status, a.created_at
    from paper_annotations a
    left join pilot_profiles pp on pp.user_id = a.author_id
   where a.kind = 'correction'
     and a.module_code = p_module
     and a.resolved_at is null
     and coalesce((select p.is_staff from pilot_profiles p where p.user_id = uid), false)
   order by a.created_at;
$$;

create or replace function paper_annotation_status(p_id uuid, p_status text)
returns void
language sql
volatile
as $$
  update paper_annotations
     set status = case when p_status = 'orphaned' then 'orphaned' else 'ok' end,
         updated_at = now()
   where id = p_id;
$$;


-- 0015_live_updates.sql

do $$ begin
  alter publication supabase_realtime add table lesson_threads;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table lesson_replies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table comms_messages;
exception when duplicate_object then null; end $$;

alter table lesson_threads  replica identity full;
alter table lesson_replies  replica identity full;
alter table comms_messages  replica identity full;


-- 0016_pilot_code.sql

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
  when unique_violation then return null;
end $$;

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


-- 0017_paper_ink.sql

alter table paper_annotations add column if not exists colour text;

do $$ begin
  alter table paper_annotations add constraint colour_is_a_name check (
    colour is null or colour in
      ('yellow','green','blue','pink','orange','purple','red','graphite')
  );
exception when duplicate_object then null; end $$;

do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class t on t.oid = con.conrelid
     where t.relname = 'paper_annotations' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%highlight%'
  loop
    execute format('alter table paper_annotations drop constraint %I', c);
  end loop;
end $$;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question','correction'));

create table if not exists paper_ink (
  id             uuid primary key default gen_random_uuid(),
  paper_id       text        not null,
  module_code    text        not null,
  paper_version  int         not null default 1,
  author_id      text        not null,
  page           int         not null check (page >= 1),
  tool           text        not null default 'pen' check (tool in ('pen','marker')),
  colour         text        not null default 'graphite' check (
    colour in ('yellow','green','blue','pink','orange','purple','red','graphite')),
  width          real        not null default 0.0032 check (width > 0 and width < 0.2),
  ring           text        not null default 'solo' check (ring in ('solo','wingman','formation','module')),
  points         jsonb       not null,
  created_at     timestamptz not null default now(),

  constraint ink_has_points check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) >= 1)
);

create index if not exists paper_ink_paper on paper_ink (paper_id, page);
create index if not exists paper_ink_author on paper_ink (author_id);

alter table paper_ink enable row level security;
drop policy if exists paper_ink_all on paper_ink;
create policy paper_ink_all on paper_ink for all using (true) with check (true);

create or replace function paper_ink_for(uid text, p_paper text)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, page int, tool text, colour text,
  width real, ring text, points jsonb, created_at timestamptz, mine boolean
)
language sql
stable
as $$
  with me as (
    select coalesce((select p.invisible from pilot_profiles p where p.user_id = uid), false) as solo
  )
  select k.id, k.paper_id, k.module_code, k.paper_version,
         k.author_id,
         case when k.author_id = uid then 'You'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end,
         k.page, k.tool, k.colour, k.width, k.ring, k.points, k.created_at,
         (k.author_id = uid)
    from paper_ink k
    left join pilot_profiles pp on pp.user_id = k.author_id
   cross join me
   where k.paper_id = p_paper
     and (k.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = k.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = k.author_id)
            and not exists (select 1 from blocks b where b.user_id = k.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = k.author_id)
            and ring_covers(k.author_id, uid, k.ring, k.module_code)
          ))
   order by k.created_at;
$$;

drop function if exists paper_marks_for(text, text, timestamptz);
create or replace function paper_marks_for(uid text, p_paper text, p_since timestamptz default null)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, kind text, ring text, body text,
  colour text, thread_id text, resolved_at timestamptz, status text,
  anchor jsonb, hint jsonb, created_at timestamptz, updated_at timestamptz,
  close boolean
)
language sql
stable
as $$
  with me as (
    select coalesce((select p.invisible from pilot_profiles p where p.user_id = uid), false) as solo,
           coalesce((select p.is_staff  from pilot_profiles p where p.user_id = uid), false) as staff
  )
  select a.id, a.paper_id, a.module_code, a.paper_version,
         a.author_id,
         case when a.author_id = uid then 'You'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end as author_name,
         a.kind, a.ring, a.body, a.colour, a.thread_id, a.resolved_at, a.status,
         a.anchor, a.hint, a.created_at, a.updated_at,
         (a.author_id = uid or ring_covers(a.author_id, uid, 'formation', a.module_code)) as close
    from paper_annotations a
    left join pilot_profiles pp on pp.user_id = a.author_id
   cross join me
   where a.paper_id = p_paper
     and (p_since is null or a.updated_at > p_since)
     and (a.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = a.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = a.author_id)
            and not exists (select 1 from blocks b where b.user_id = a.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = a.author_id)
            /* R9, unchanged from 0014 — the kind decides, not the ring. */
            and (case when a.kind = 'correction' then me.staff
                      else ring_covers(a.author_id, uid, a.ring, a.module_code) end)
          ))
   order by a.created_at;
$$;


-- 0018_reader_rebuild.sql

alter table paper_annotations drop constraint if exists colour_is_a_name;
alter table paper_annotations add constraint colour_is_a_name check (
  colour is null or colour in (
    'yellow','green','blue','pink','orange','purple','red','graphite',
    'critical','definition','limit','unsure','wrong'
  )
);

alter table paper_annotations add column if not exists anonymous boolean not null default false;

alter table paper_annotations add column if not exists agree_count int not null default 0;

alter table paper_annotations add column if not exists deleted_at timestamptz;
create index if not exists paper_annotations_tomb on paper_annotations (paper_id, updated_at)
  where deleted_at is not null;

alter table paper_annotations add column if not exists style jsonb;

alter table paper_annotations drop constraint if exists paper_annotations_kind_check;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question',
                  'correction','shape','text','stamp'));

alter table lesson_threads add column if not exists paper_id text;
alter table lesson_threads add column if not exists page int;
alter table lesson_threads add column if not exists anchor jsonb;
create index if not exists lesson_threads_paper on lesson_threads (paper_id) where paper_id is not null;

create table if not exists papers (
  id             text primary key,
  module_code    text not null,
  chapter_id     text,
  title          text not null,
  file_path      text not null,          -- inside the `papers` storage bucket
  pages          int,
  bytes          bigint,
  version        int not null default 1,
  status         text not null default 'pending'
                 check (status in ('pending','ready','failed')),
  linearized     boolean,
  has_text       boolean,
  manifest       jsonb,
  failure        text,
  uploaded_by    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists papers_module on papers (module_code, status);

alter table papers enable row level security;
drop policy if exists papers_all on papers;
create policy papers_all on papers for all using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('papers', 'papers', true, 268435456)     -- 256MB, above the 200MB case
on conflict (id) do update set public = true, file_size_limit = 268435456;

drop policy if exists papers_read on storage.objects;
create policy papers_read on storage.objects for select using (bucket_id = 'papers');
drop policy if exists papers_write on storage.objects;
create policy papers_write on storage.objects for insert with check (bucket_id = 'papers');
drop policy if exists papers_update on storage.objects;
create policy papers_update on storage.objects for update using (bucket_id = 'papers');

drop function if exists paper_annotations_for(text, text, timestamptz);
drop function if exists paper_marks_for(text, text, timestamptz);

create function paper_marks_for(uid text, p_paper text, p_since timestamptz default null)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, kind text, ring text, body text,
  colour text, style jsonb, anonymous boolean, agree_count int,
  thread_id text, resolved_at timestamptz, status text,
  anchor jsonb, hint jsonb, deleted_at timestamptz,
  created_at timestamptz, updated_at timestamptz, close boolean
)
language sql
stable
as $$
  with me as (
    select coalesce((select p.invisible from pilot_profiles p where p.user_id = uid), false) as solo,
           coalesce((select p.is_staff  from pilot_profiles p where p.user_id = uid), false) as staff
  )
  select a.id, a.paper_id, a.module_code, a.paper_version,
         /* §6.2 — ANONYMITY IS ENFORCED HERE, ON THE WAY OUT.
            The id is not hidden in the browser, it is absent from the payload.
            Instructors still receive it, because moderation needs it and the
            UI says so plainly rather than promising what it does not deliver.
            A student always sees their own. */
         case when a.anonymous and a.author_id <> uid and not me.staff then null
              else a.author_id end as author_id,
         case when a.author_id = uid then 'You'
              when a.anonymous and not me.staff then 'Anonymous'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end as author_name,
         a.kind, a.ring, a.body, a.colour, a.style, a.anonymous, a.agree_count,
         a.thread_id, a.resolved_at, a.status, a.anchor, a.hint, a.deleted_at,
         a.created_at, a.updated_at,
         (a.author_id = uid or ring_covers(a.author_id, uid, 'formation', a.module_code)) as close
    from paper_annotations a
    left join pilot_profiles pp on pp.user_id = a.author_id
   cross join me
   where a.paper_id = p_paper
     and (p_since is null or a.updated_at > p_since)
     /* Tombstones ARE returned on an incremental read — that is how a delete
        made on one device reaches another. A first read (p_since null) skips
        them, because a mark deleted last week is not news. */
     and (p_since is not null or a.deleted_at is null)
     and (a.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = a.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = a.author_id)
            and not exists (select 1 from blocks b where b.user_id = a.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = a.author_id)
            /* R9, unchanged since 0014 — the kind decides, not the ring. */
            and (case when a.kind = 'correction' then me.staff
                      else ring_covers(a.author_id, uid, a.ring, a.module_code) end)
          ))
   order by a.created_at;
$$;

create or replace function agree_with_mark(p_id uuid)
returns int
language sql
volatile
as $$
  update paper_annotations set agree_count = agree_count + 1, updated_at = now()
   where id = p_id returning agree_count;
$$;


-- 0019_paper_scope.sql

alter table papers add column if not exists visibility text not null default 'solo'
  check (visibility in ('solo','formation','module'));
alter table papers add column if not exists owner_id text;

update papers set owner_id = uploaded_by where owner_id is null;

create index if not exists papers_visible on papers (module_code, visibility);

drop function if exists papers_for(text, text);

create function papers_for(uid text, p_module text)
returns table (
  id text, module_code text, chapter_id text, title text, file_path text,
  pages int, bytes bigint, version int, status text, visibility text,
  linearized boolean, has_text boolean, manifest jsonb, failure text,
  owner_id text, owner_name text, mine boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql
stable
as $$
  select p.id, p.module_code, p.chapter_id, p.title, p.file_path,
         p.pages, p.bytes, p.version, p.status, p.visibility,
         p.linearized, p.has_text, p.manifest, p.failure,
         p.owner_id,
         case when p.owner_id = uid then 'You'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end,
         (p.owner_id = uid),
         p.created_at, p.updated_at
    from papers p
    left join pilot_profiles pp on pp.user_id = p.owner_id
   where p.module_code = p_module
     and (p.owner_id = uid
          or ring_covers(coalesce(p.owner_id, ''), uid, p.visibility, p.module_code))
   order by p.visibility desc, p.created_at;
$$;

/* Dropped and recreated rather than replaced: a function's OUT columns cannot
   be renamed in place, and these had to be — see the note below. */
drop function if exists add_paper(text, text, text, text, text, text, int, bigint, text, boolean, boolean, jsonb);

create function add_paper(
  uid text, p_id text, p_module text, p_chapter text, p_title text,
  p_file text, p_pages int, p_bytes bigint, p_visibility text,
  p_linearized boolean, p_has_text boolean, p_manifest jsonb
)
/* THE OUT COLUMNS ARE NOT CALLED `id` OR `visibility`.

   plpgsql puts a RETURNS TABLE column into the same namespace as the table's
   own columns, so `on conflict (id)` and `where papers.owner_id = uid` became
   "column reference id is ambiguous" the first time a real upload ran. Naming
   them for what they are — the paper that was made, the scope it was given —
   removes the collision rather than papering over it with aliases. */
returns table (made_id text, made_visibility text, made_status text, downgraded boolean)
language plpgsql
volatile
as $$
declare
  staff boolean;
  want  text;
  used  text;
begin
  select coalesce((select pr.is_staff from pilot_profiles pr where pr.user_id = uid), false) into staff;
  want := coalesce(p_visibility, 'solo');
  if want not in ('solo','formation','module') then want := 'solo'; end if;
  used := case when want = 'module' and not staff then 'formation' else want end;

  insert into papers (id, module_code, chapter_id, title, file_path, pages, bytes,
                      status, visibility, linearized, has_text, manifest,
                      uploaded_by, owner_id)
  values (p_id, p_module, nullif(p_chapter, ''), p_title, p_file, p_pages, p_bytes,
          'pending', used, p_linearized, p_has_text, p_manifest, uid, uid)
  on conflict (id) do update set
    title = excluded.title, chapter_id = excluded.chapter_id,
    file_path = excluded.file_path, pages = excluded.pages, bytes = excluded.bytes,
    visibility = excluded.visibility, linearized = excluded.linearized,
    has_text = excluded.has_text, manifest = excluded.manifest,
    status = 'pending', updated_at = now()
  where papers.owner_id = uid or papers.owner_id is null;

  return query
    select p_id, used, 'pending'::text, (used <> want);
end $$;

create or replace function paper_status(uid text, p_id text, p_status text, p_failure text default null)
returns void
language sql
volatile
as $$
  update papers set status = p_status, failure = p_failure, updated_at = now()
   where id = p_id and owner_id = uid
     and p_status in ('pending','ready','failed');
$$;

create or replace function delete_paper(uid text, p_id text)
returns boolean
language sql
volatile
as $$
  with gone as (delete from papers where id = p_id and owner_id = uid returning 1)
  select count(*) > 0 from gone;
$$;


-- 0020_reader_tools.sql

alter table paper_ink drop constraint if exists paper_ink_tool_check;
alter table paper_ink add constraint paper_ink_tool_check
  check (tool in ('pen','marker','shape','text','measure'));

alter table paper_ink add column if not exists variant text;

alter table paper_ink add column if not exists opacity real not null default 1
  check (opacity > 0 and opacity <= 1);

alter table paper_annotations drop constraint if exists paper_annotations_kind_check;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question',
                  'correction','shape','text','stamp','link'));


-- 0021_close_the_tables.sql

alter function ring_covers(text, text, text, text)              security definer;
alter function ring_covers(text, text, text, text)              set search_path = public, pg_temp;

alter function paper_marks_for(text, text, timestamptz)         security definer;
alter function paper_marks_for(text, text, timestamptz)         set search_path = public, pg_temp;

alter function paper_ink_for(text, text)                        security definer;
alter function paper_ink_for(text, text)                        set search_path = public, pg_temp;

alter function paper_corrections_for(text, text)                security definer;
alter function paper_corrections_for(text, text)                set search_path = public, pg_temp;

alter function paper_annotation_status(uuid, text)              security definer;
alter function paper_annotation_status(uuid, text)              set search_path = public, pg_temp;

alter function merge_progress(text, jsonb)                      security definer;
alter function merge_progress(text, jsonb)                      set search_path = public, pg_temp;

do $$ begin
  if exists (select 1 from pg_proc where proname = 'paper_annotations_for') then
    execute 'alter function paper_annotations_for(text, text, timestamptz) security definer';
    execute 'alter function paper_annotations_for(text, text, timestamptz) set search_path = public, pg_temp';
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_proc where proname = 'agree_with_mark') then
    execute 'alter function agree_with_mark(uuid) security definer';
    execute 'alter function agree_with_mark(uuid) set search_path = public, pg_temp';
  end if;
end $$;

create or replace function paper_mark_add(
  uid         text,
  p_paper     text,
  p_module    text,
  p_kind      text default 'highlight',
  p_ring      text default 'module',
  p_body      text default null,
  p_thread_id text default null,
  p_colour    text default null,
  p_anchor    jsonb default null,
  p_hint      jsonb default null,
  p_anonymous boolean default null,
  p_id        uuid default null
)
returns paper_annotations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row paper_annotations;
begin
  if uid is null or uid = '' or p_paper is null or p_anchor is null then
    return null;
  end if;
  insert into paper_annotations
    (id, paper_id, module_code, author_id, kind, ring, body, thread_id, colour, anchor, hint, anonymous)
  values
    (coalesce(p_id, gen_random_uuid()), p_paper, p_module,
     /* NOT from the client. This is the whole point of the function. */
     uid,
     p_kind, p_ring, p_body, p_thread_id, p_colour, p_anchor, p_hint,
     /* §6.2 of the brief: a question is anonymous unless told otherwise. The
        author is still stored — instructors can see who asked — it is simply
        not handed to classmates, which 0018's reader already enforces. */
     coalesce(p_anonymous, p_kind = 'question' or p_colour = 'unsure', false))
  returning * into row;
  return row;
end $$;

create or replace function paper_mark_edit(uid text, p_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  if uid is null or p_id is null or p_patch is null then return false; end if;
  update paper_annotations a set
    body        = case when p_patch ? 'body'        then nullif(p_patch->>'body', '')        else a.body end,
    colour      = case when p_patch ? 'colour'      then p_patch->>'colour'                  else a.colour end,
    ring        = case when p_patch ? 'ring'        then p_patch->>'ring'                    else a.ring end,
    kind        = case when p_patch ? 'kind'        then p_patch->>'kind'                    else a.kind end,
    style       = case when p_patch ? 'style'       then p_patch->'style'                    else a.style end,
    hint        = case when p_patch ? 'hint'        then p_patch->'hint'                     else a.hint end,
    anonymous   = case when p_patch ? 'anonymous'   then (p_patch->>'anonymous')::boolean    else a.anonymous end,
    resolved_at = case when p_patch ? 'resolved_at' then (p_patch->>'resolved_at')::timestamptz else a.resolved_at end,
    updated_at  = now()
   where a.id = p_id
     /* the sentence this migration exists to write */
     and a.author_id = uid;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function paper_mark_delete(uid text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  if uid is null or p_id is null then return false; end if;
  delete from paper_annotations where id = p_id and author_id = uid;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function paper_ink_add(
  uid      text,
  p_paper  text,
  p_module text,
  p_page   int,
  p_points jsonb,
  p_tool   text default 'pen',
  p_colour text default 'graphite',
  p_width  real default 0.0032,
  p_ring   text default 'solo',
  p_id     uuid default null
)
returns paper_ink
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row paper_ink;
begin
  if uid is null or uid = '' or p_paper is null or p_page is null or p_points is null then
    return null;
  end if;
  insert into paper_ink (id, paper_id, module_code, author_id, page, tool, colour, width, ring, points)
  values (coalesce(p_id, gen_random_uuid()), p_paper, p_module, uid,
          p_page, p_tool, p_colour, p_width, p_ring, p_points)
  returning * into row;
  return row;
end $$;

create or replace function paper_ink_delete(uid text, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  if uid is null or p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  delete from paper_ink where id = any(p_ids) and author_id = uid;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function progress_for(uid text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select p.data from user_progress p where p.user_id = uid), '{}'::jsonb);
$$;

create or replace function progress_clear(uid text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if uid is null or uid = '' then return false; end if;
  delete from user_progress where user_id = uid;
  return true;
end $$;

grant execute on function
  paper_mark_add(text, text, text, text, text, text, text, text, jsonb, jsonb, boolean, uuid),
  paper_mark_edit(text, uuid, jsonb),
  paper_mark_delete(text, uuid),
  paper_ink_add(text, text, text, int, jsonb, text, text, real, text, uuid),
  paper_ink_delete(text, uuid[]),
  progress_for(text),
  progress_clear(text)
to anon, authenticated;

drop policy if exists paper_annotations_all  on paper_annotations;
drop policy if exists paper_annotations_open on paper_annotations;
drop policy if exists paper_ink_all          on paper_ink;
drop policy if exists paper_ink_open         on paper_ink;
drop policy if exists user_progress_open     on user_progress;

alter table paper_annotations enable row level security;
alter table paper_ink         enable row level security;
alter table user_progress     enable row level security;

revoke all on table paper_annotations from anon, authenticated;
revoke all on table paper_ink         from anon, authenticated;
revoke all on table user_progress     from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['paper_annotations', 'paper_ink', 'user_progress'] loop
    if has_table_privilege('anon', t, 'SELECT') then
      raise exception '0021 did not close %: anon can still SELECT it', t;
    end if;
    if has_table_privilege('anon', t, 'INSERT')
    or has_table_privilege('anon', t, 'UPDATE')
    or has_table_privilege('anon', t, 'DELETE') then
      raise exception '0021 did not close %: anon can still write to it', t;
    end if;
  end loop;
end $$;


-- 0022_ready_room.sql

alter table squadrons add column if not exists created_by text;

alter table squadron_members add column if not exists muted        boolean     not null default false;
alter table squadron_members add column if not exists last_read_at timestamptz not null default now();
alter table squadron_members add column if not exists role         text        not null default 'member';
do $$ begin
  alter table squadron_members add constraint squadron_members_role_known
    check (role in ('member', 'owner', 'staff'));
exception when duplicate_object then null; end $$;

alter table comms_messages add column if not exists reply_to   uuid references comms_messages (id) on delete set null;
alter table comms_messages add column if not exists deleted_at timestamptz;
alter table comms_messages add column if not exists pinned_at  timestamptz;
alter table comms_messages add column if not exists pinned_by  text;
create index if not exists comms_messages_sq_created_idx
  on comms_messages (squadron_id, created_at desc) where squadron_id is not null;

alter table lesson_replies add column if not exists parent_id text references lesson_replies (id) on delete cascade;
create index if not exists lesson_replies_parent_idx on lesson_replies (parent_id) where parent_id is not null;

create table if not exists thread_votes (
  thread_id  text        not null references lesson_threads (id) on delete cascade,
  user_id    text        not null,
  dir        smallint    not null check (dir in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
alter table thread_votes enable row level security;
do $$ begin
  create policy thread_votes_all on thread_votes for all using (true) with check (true);
exception when duplicate_object then null; end $$;

create table if not exists seat_requests (
  id         uuid        primary key default gen_random_uuid(),
  from_id    text        not null,
  to_id      text        not null,
  state      text        not null default 'pending'
               check (state in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  session_id uuid        references copilot_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (from_id <> to_id)
);
create unique index if not exists seat_requests_one_pending
  on seat_requests (from_id, to_id) where state = 'pending';
create index if not exists seat_requests_to_idx on seat_requests (to_id, state);
alter table seat_requests enable row level security;
do $$ begin
  create policy seat_requests_all on seat_requests for all using (true) with check (true);
exception when duplicate_object then null; end $$;

alter table copilot_sessions add column if not exists last_active_at timestamptz not null default now();
alter table copilot_participants add column if not exists at_module  text;
alter table copilot_participants add column if not exists at_place   text;
alter table copilot_participants add column if not exists at_since   timestamptz not null default now();

create table if not exists seat_messages (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references copilot_sessions (id) on delete cascade,
  user_id    text        not null,
  body       text        not null check (length(btrim(body)) > 0),
  kept       boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists seat_messages_session_idx on seat_messages (session_id, created_at);
alter table seat_messages enable row level security;
do $$ begin
  create policy seat_messages_all on seat_messages for all using (true) with check (true);
exception when duplicate_object then null; end $$;

create or replace function create_squadron(
  p_me text, p_name text, p_module text,
  p_blurb text default null, p_policy text default 'invite_only'
) returns uuid language plpgsql security definer as $$
declare v_id uuid; v_token text;
begin
  if p_me is null or btrim(coalesce(p_name,'')) = '' or btrim(coalesce(p_module,'')) = '' then
    return null;
  end if;
  if coalesce(p_policy,'') not in ('open','request','invite_only') then
    p_policy := 'invite_only';
  end if;
  if (select count(*) from squadrons
        where created_by = p_me and created_at > now() - interval '1 day') >= 5 then
    return null;
  end if;
  v_token := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into squadrons (module_code, name, blurb, owner_id, created_by, join_policy, invite_token, status)
  values (upper(btrim(p_module)), btrim(p_name), nullif(btrim(coalesce(p_blurb,'')), ''),
          p_me, p_me, p_policy, v_token, 'forming')
  returning id into v_id;
  insert into squadron_members (squadron_id, user_id, role)
  values (v_id, p_me, 'owner')
  on conflict do nothing;
  return v_id;
end $$;

create or replace function leave_squadron(p_me text, p_squadron uuid)
returns text language plpgsql security definer as $$
declare v_left integer; v_next text; v_owner text;
begin
  if p_me is null or p_squadron is null then return 'missing'; end if;
  delete from squadron_members where squadron_id = p_squadron and user_id = p_me;
  if not found then return 'not_a_member'; end if;
  select count(*) into v_left from squadron_members where squadron_id = p_squadron;
  if v_left = 0 then
    delete from squadrons where id = p_squadron;
    return 'closed';
  end if;
  select owner_id into v_owner from squadrons where id = p_squadron;
  if v_owner = p_me then
    select user_id into v_next from squadron_members
      where squadron_id = p_squadron order by joined_at asc limit 1;
    update squadrons set owner_id = v_next where id = p_squadron;
    update squadron_members set role = 'owner'
      where squadron_id = p_squadron and user_id = v_next;
  end if;
  return 'left';
end $$;

create or replace function set_squadron_muted(p_me text, p_squadron uuid, p_muted boolean)
returns boolean language sql security definer as $$
  update squadron_members set muted = coalesce(p_muted, false)
   where squadron_id = p_squadron and user_id = p_me
  returning muted;
$$;

create or replace function rename_squadron(p_me text, p_squadron uuid, p_name text, p_blurb text default null)
returns boolean language plpgsql security definer as $$
begin
  if btrim(coalesce(p_name,'')) = '' then return false; end if;
  update squadrons
     set name = btrim(p_name),
         blurb = coalesce(nullif(btrim(coalesce(p_blurb,'')), ''), blurb)
   where id = p_squadron and owner_id = p_me;
  return found;
end $$;

create or replace function revoke_invite(p_me text, p_squadron uuid)
returns text language plpgsql security definer as $$
declare v_token text;
begin
  v_token := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update squadrons
     set invite_token = v_token, invite_revoked_at = null, invite_expires_at = null
   where id = p_squadron and owner_id = p_me;
  if not found then return null; end if;
  return v_token;
end $$;

create or replace function mark_squadron_read(p_me text, p_squadron uuid)
returns timestamptz language sql security definer as $$
  update squadron_members set last_read_at = now()
   where squadron_id = p_squadron and user_id = p_me
  returning last_read_at;
$$;

create or replace function toggle_message_reaction(p_me text, p_message uuid, p_emoji text)
returns boolean language plpgsql security definer as $$
begin
  if p_me is null or p_message is null or btrim(coalesce(p_emoji,'')) = '' then return false; end if;
  if not exists (
    select 1 from comms_messages m
      join squadron_members sm on sm.squadron_id = m.squadron_id and sm.user_id = p_me
     where m.id = p_message) then
    return false;
  end if;
  delete from comms_reactions where message_id = p_message and user_id = p_me and emoji = p_emoji;
  if found then return false; end if;
  insert into comms_reactions (message_id, user_id, emoji) values (p_message, p_me, p_emoji);
  return true;
end $$;

create or replace function pin_message(p_me text, p_message uuid, p_on boolean default true)
returns boolean language plpgsql security definer as $$
declare v_sq uuid;
begin
  select squadron_id into v_sq from comms_messages where id = p_message;
  if v_sq is null then return false; end if;
  if not exists (select 1 from squadron_members where squadron_id = v_sq and user_id = p_me) then
    return false;
  end if;
  update comms_messages set pinned_at = null, pinned_by = null
   where squadron_id = v_sq and pinned_at is not null;
  if coalesce(p_on, true) then
    update comms_messages set pinned_at = now(), pinned_by = p_me where id = p_message;
  end if;
  return true;
end $$;

create or replace function edit_message(p_me text, p_message uuid, p_body text)
returns boolean language plpgsql security definer as $$
begin
  if btrim(coalesce(p_body,'')) = '' then return false; end if;
  update comms_messages set body = btrim(p_body), edited_at = now()
   where id = p_message and user_id = p_me and deleted_at is null
     and created_at > now() - interval '15 minutes';
  return found;
end $$;

create or replace function delete_message(p_me text, p_message uuid)
returns boolean language plpgsql security definer as $$
begin
  update comms_messages set deleted_at = now(), body = null, pinned_at = null, pinned_by = null
   where id = p_message and user_id = p_me and deleted_at is null;
  return found;
end $$;

create or replace function toggle_thread_vote(p_me text, p_thread text, p_dir smallint)
returns smallint language plpgsql security definer as $$
declare v_now smallint;
begin
  if p_me is null or p_thread is null then return 0; end if;
  select dir into v_now from thread_votes where thread_id = p_thread and user_id = p_me;
  if v_now is not null and v_now = p_dir then
    delete from thread_votes where thread_id = p_thread and user_id = p_me;
    return 0;
  end if;
  if p_dir not in (-1, 1) then
    delete from thread_votes where thread_id = p_thread and user_id = p_me;
    return 0;
  end if;
  insert into thread_votes (thread_id, user_id, dir) values (p_thread, p_me, p_dir)
  on conflict (thread_id, user_id) do update set dir = excluded.dir;
  return p_dir;
end $$;

create or replace function thread_vote_counts(p_threads text[], p_me text)
returns table (thread_id text, score bigint, mine smallint)
language sql stable as $$
  select t.thread_id,
         coalesce(sum(t.dir), 0)::bigint,
         coalesce(max(case when t.user_id = p_me then t.dir end), 0)::smallint
    from thread_votes t
   where t.thread_id = any (p_threads)
   group by t.thread_id;
$$;

create or replace function request_right_seat(p_me text, p_them text)
returns text language plpgsql security definer as $$
declare v_id uuid;
begin
  if p_me is null or p_them is null or p_me = p_them then return 'missing'; end if;
  if exists (select 1 from blocks
              where (user_id = p_me and blocked_id = p_them)
                 or (user_id = p_them and blocked_id = p_me)) then
    return 'unavailable';
  end if;
  if not exists (
    select 1 from squadron_members a
      join squadron_members b on b.squadron_id = a.squadron_id
     where a.user_id = p_me and b.user_id = p_them) then
    return 'not_shared';
  end if;
  if exists (
    select 1 from copilot_participants cp
      join copilot_sessions cs on cs.id = cp.session_id
     where cp.user_id = p_me and cp.left_at is null and cs.ended_at is null) then
    return 'already_flying';
  end if;
  select id into v_id from seat_requests
   where from_id = p_them and to_id = p_me and state = 'pending' limit 1;
  if v_id is not null then
    perform answer_right_seat(p_me, v_id, true);
    return 'accepted';
  end if;
  insert into seat_requests (from_id, to_id) values (p_me, p_them)
  on conflict do nothing;
  return 'asked';
end $$;

create or replace function cancel_right_seat(p_me text, p_them text)
returns boolean language plpgsql security definer as $$
begin
  update seat_requests set state = 'cancelled', answered_at = now()
   where from_id = p_me and to_id = p_them and state = 'pending';
  return found;
end $$;

create or replace function answer_right_seat(p_me text, p_request uuid, p_accept boolean)
returns uuid language plpgsql security definer as $$
declare r seat_requests%rowtype; v_session uuid; v_mod text;
begin
  select * into r from seat_requests where id = p_request and to_id = p_me and state = 'pending';
  if r.id is null then return null; end if;
  if not coalesce(p_accept, false) then
    update seat_requests set state = 'declined', answered_at = now() where id = r.id;
    return null;
  end if;
  select module_code into v_mod from squadrons s
    join squadron_members a on a.squadron_id = s.id and a.user_id = r.from_id
    join squadron_members b on b.squadron_id = s.id and b.user_id = r.to_id
   limit 1;
  insert into copilot_sessions (module_code) values (coalesce(v_mod, ''))
  returning id into v_session;
  insert into copilot_participants (session_id, user_id) values (v_session, r.from_id), (v_session, r.to_id)
  on conflict do nothing;
  update seat_requests set state = 'accepted', answered_at = now(), session_id = v_session where id = r.id;
  update seat_requests set state = 'expired', answered_at = now()
   where state = 'pending' and (from_id in (r.from_id, r.to_id) or to_id in (r.from_id, r.to_id));
  return v_session;
end $$;

create or replace function seat_heartbeat(p_me text, p_module text default null, p_place text default null)
returns uuid language plpgsql security definer as $$
declare v_session uuid;
begin
  select cs.id into v_session from copilot_participants cp
    join copilot_sessions cs on cs.id = cp.session_id
   where cp.user_id = p_me and cp.left_at is null and cs.ended_at is null
   order by cs.started_at desc limit 1;
  if v_session is null then return null; end if;
  update copilot_participants
     set at_module = coalesce(p_module, at_module),
         at_place  = coalesce(p_place, at_place),
         at_since  = case when coalesce(p_place,'') is distinct from coalesce(at_place,'')
                          then now() else at_since end
   where session_id = v_session and user_id = p_me;
  update copilot_sessions set last_active_at = now() where id = v_session;
  return v_session;
end $$;

create or replace function end_right_seat(p_me text)
returns boolean language plpgsql security definer as $$
declare v_session uuid;
begin
  select cs.id into v_session from copilot_participants cp
    join copilot_sessions cs on cs.id = cp.session_id
   where cp.user_id = p_me and cp.left_at is null and cs.ended_at is null limit 1;
  if v_session is null then return false; end if;
  update copilot_sessions set ended_at = now() where id = v_session;
  update copilot_participants set left_at = now() where session_id = v_session and left_at is null;
  delete from seat_messages where session_id = v_session and kept = false;
  return true;
end $$;

create or replace function expire_right_seats()
returns integer language plpgsql security definer as $$
declare n integer;
begin
  with dead as (
    update copilot_sessions set ended_at = now()
     where ended_at is null and last_active_at < now() - interval '1 hour'
    returning id)
  select count(*) into n from dead;
  update copilot_participants set left_at = now()
   where left_at is null and session_id in (select id from copilot_sessions where ended_at is not null);
  update seat_requests set state = 'expired', answered_at = now()
   where state = 'pending' and created_at < now() - interval '2 hours';
  delete from seat_messages
   where kept = false and session_id in (select id from copilot_sessions where ended_at is not null);
  return coalesce(n, 0);
end $$;

create or replace function my_seat(p_me text)
returns table (
  session_id uuid, partner_id text, partner_module text, partner_place text,
  partner_since timestamptz, started_at timestamptz, last_active_at timestamptz)
language sql stable as $$
  select cs.id, other.user_id, other.at_module, other.at_place, other.at_since,
         cs.started_at, cs.last_active_at
    from copilot_participants me
    join copilot_sessions cs on cs.id = me.session_id and cs.ended_at is null
    join copilot_participants other
      on other.session_id = cs.id and other.user_id <> p_me and other.left_at is null
   where me.user_id = p_me and me.left_at is null
   order by cs.started_at desc
   limit 1;
$$;

create or replace function my_seat_requests(p_me text)
returns table (id uuid, from_id text, to_id text, created_at timestamptz, direction text)
language sql stable as $$
  select r.id, r.from_id, r.to_id, r.created_at,
         case when r.to_id = p_me then 'in' else 'out' end
    from seat_requests r
   where r.state = 'pending' and (r.to_id = p_me or r.from_id = p_me)
   order by r.created_at desc;
$$;

do $$ begin alter publication supabase_realtime add table comms_reactions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table seat_requests;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table copilot_sessions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table seat_messages;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table thread_votes;     exception when others then null; end $$;

alter table comms_reactions   replica identity full;
alter table seat_requests     replica identity full;
alter table copilot_sessions  replica identity full;
alter table seat_messages     replica identity full;
alter table thread_votes      replica identity full;

update squadrons set name = module_code || ' squadron' where name is null or btrim(name) = '';
update squadron_members sm set role = 'owner'
  from squadrons s where s.id = sm.squadron_id and s.owner_id = sm.user_id and sm.role = 'member';
update squadrons set invite_token = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
 where invite_token is null;


-- 0023_reader_works.sql

alter table paper_ink add column if not exists opacity real    not null default 1;
alter table paper_ink add column if not exists cap     text    not null default 'round';
alter table paper_ink add column if not exists variant smallint not null default 0;
do $$ begin
  alter table paper_ink add constraint paper_ink_opacity_range check (opacity > 0 and opacity <= 1);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_cap_known check (cap in ('round', 'butt', 'square'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table paper_ink drop constraint if exists paper_ink_tool_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_tool_known
    check (tool in ('pen', 'marker', 'mkr', 'hl', 'shp', 'msr', 'snap'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table paper_ink drop constraint if exists paper_ink_colour_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_colour_known
    check (colour in ('graphite','chalk','yellow','blue','green','purple','red','pink','orange')
           or colour ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

create or replace function paper_ink_add(
  uid text, p_paper text, p_module text, p_page integer,
  p_points jsonb, p_tool text default 'pen', p_colour text default 'graphite',
  p_width real default 0.0032, p_ring text default 'solo',
  p_opacity real default 1, p_cap text default 'round',
  p_variant smallint default 0, p_id uuid default null
) returns paper_ink language plpgsql security definer as $$
declare r paper_ink%rowtype;
begin
  if uid is null or p_paper is null or p_points is null then return null; end if;
  insert into paper_ink (id, paper_id, module_code, author_id, page, points,
                         tool, colour, width, ring, opacity, cap, variant)
  values (coalesce(p_id, gen_random_uuid()), p_paper, p_module, uid, p_page, p_points,
          coalesce(p_tool, 'pen'), coalesce(p_colour, 'graphite'),
          coalesce(p_width, 0.0032), coalesce(p_ring, 'solo'),
          least(greatest(coalesce(p_opacity, 1), 0.02), 1),
          coalesce(p_cap, 'round'), coalesce(p_variant, 0))
  on conflict (id) do nothing
  returning * into r;
  return r;
end $$;

create table if not exists paper_mark_agrees (
  mark_id    uuid        not null references paper_annotations (id) on delete cascade,
  user_id    text        not null,
  created_at timestamptz not null default now(),
  primary key (mark_id, user_id)
);
alter table paper_mark_agrees enable row level security;
do $$ begin
  create policy paper_mark_agrees_all on paper_mark_agrees for all using (true) with check (true);
exception when duplicate_object then null; end $$;

drop function if exists agree_with_mark(uuid);
create or replace function agree_with_mark(p_me text, p_id uuid, p_on boolean default true)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  if p_me is null or p_id is null then return 0; end if;
  if exists (select 1 from paper_annotations where id = p_id and author_id = p_me) then
    select count(*) into n from paper_mark_agrees where mark_id = p_id;
    return coalesce(n, 0);
  end if;
  if coalesce(p_on, true) then
    insert into paper_mark_agrees (mark_id, user_id) values (p_id, p_me)
    on conflict do nothing;
  else
    delete from paper_mark_agrees where mark_id = p_id and user_id = p_me;
  end if;
  select count(*) into n from paper_mark_agrees where mark_id = p_id;
  update paper_annotations set agree_count = coalesce(n, 0) where id = p_id;
  return coalesce(n, 0);
end $$;

alter table paper_annotations add column if not exists version integer not null default 1;

create or replace function paper_mark_edit(
  uid text, p_id uuid, p_patch jsonb, p_version integer default null
) returns paper_annotations language plpgsql security definer as $$
declare r paper_annotations%rowtype; cur integer;
begin
  select version into cur from paper_annotations where id = p_id and author_id = uid;
  if cur is null then return null; end if;
  if p_version is not null and p_version <> cur then return null; end if;
  update paper_annotations
     set colour     = coalesce(p_patch->>'colour', colour),
         kind       = coalesce(p_patch->>'kind', kind),
         ring       = coalesce(p_patch->>'ring', ring),
         body       = case when p_patch ? 'body' then p_patch->>'body' else body end,
         style      = coalesce(p_patch->>'style', style),
         version    = cur + 1,
         updated_at = now()
   where id = p_id and author_id = uid
  returning * into r;
  return r;
end $$;

create or replace function paper_annotation_status(uid text, p_id uuid, p_status text)
returns boolean language plpgsql security definer as $$
begin
  if uid is null or p_id is null then return false; end if;
  if p_status not in ('ok', 'orphaned') then return false; end if;
  update paper_annotations set status = p_status, updated_at = now()
   where id = p_id and status is distinct from p_status;
  return found;
end $$;

do $$ begin
  alter table paper_annotations drop constraint if exists paper_annotations_ring_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_annotations add constraint paper_annotations_ring_known
    check (ring in ('solo', 'seat', 'wingman', 'formation', 'module'));
exception when duplicate_object then null; end $$;

create table if not exists paper_reading (
  user_id    text        not null,
  paper_id   text        not null,
  page       integer     not null default 1,
  zoom       integer     not null default 100,
  rot        smallint    not null default 0,
  fit        boolean     not null default true,
  bookmarks  integer[]   not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
alter table paper_reading enable row level security;
do $$ begin
  create policy paper_reading_all on paper_reading for all using (true) with check (true);
exception when duplicate_object then null; end $$;

create or replace function paper_reading_set(
  uid text, p_paper text, p_page integer default null, p_zoom integer default null,
  p_rot smallint default null, p_fit boolean default null, p_bookmarks integer[] default null
) returns paper_reading language plpgsql security definer as $$
declare r paper_reading%rowtype;
begin
  if uid is null or p_paper is null then return null; end if;
  insert into paper_reading (user_id, paper_id, page, zoom, rot, fit, bookmarks)
  values (uid, p_paper, coalesce(p_page, 1), coalesce(p_zoom, 100),
          coalesce(p_rot, 0::smallint), coalesce(p_fit, true), coalesce(p_bookmarks, '{}'))
  on conflict (user_id, paper_id) do update
    set page      = coalesce(p_page, paper_reading.page),
        zoom      = coalesce(p_zoom, paper_reading.zoom),
        rot       = coalesce(p_rot, paper_reading.rot),
        fit       = coalesce(p_fit, paper_reading.fit),
        bookmarks = coalesce(p_bookmarks, paper_reading.bookmarks),
        updated_at = now()
  returning * into r;
  return r;
end $$;

create or replace function paper_reading_get(uid text, p_paper text)
returns paper_reading language sql stable as $$
  select * from paper_reading where user_id = uid and paper_id = p_paper;
$$;

do $$ begin alter publication supabase_realtime add table paper_annotations;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table paper_ink;          exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table paper_mark_agrees;  exception when others then null; end $$;

alter table paper_annotations  replica identity full;
alter table paper_ink          replica identity full;
alter table paper_mark_agrees  replica identity full;

update paper_annotations a
   set agree_count = coalesce((select count(*) from paper_mark_agrees g where g.mark_id = a.id), 0)
 where a.agree_count is distinct from
       coalesce((select count(*) from paper_mark_agrees g where g.mark_id = a.id), 0);


-- 0024_mark_edit_keeps_its_fields.sql

drop function if exists paper_mark_edit(text, uuid, jsonb);

create or replace function paper_mark_edit(
  uid text, p_id uuid, p_patch jsonb, p_version integer default null
) returns paper_annotations language plpgsql security definer
set search_path = public, pg_temp as $$
declare r paper_annotations%rowtype; cur integer;
begin
  select version into cur from paper_annotations where id = p_id and author_id = uid;
  if cur is null then return null; end if;
  if p_version is not null and p_version <> cur then return null; end if;
  update paper_annotations
     set colour     = coalesce(p_patch->>'colour', colour),
         kind       = coalesce(p_patch->>'kind', kind),
         ring       = coalesce(p_patch->>'ring', ring),
         body       = case when p_patch ? 'body' then p_patch->>'body' else body end,
         style      = case when p_patch ? 'style' then p_patch->'style' else style end,
         hint       = case when p_patch ? 'hint' then p_patch->'hint' else hint end,
         anonymous  = case when p_patch ? 'anonymous'
                           then (p_patch->>'anonymous')::boolean else anonymous end,
         resolved_at = case when p_patch ? 'resolved_at'
                            then nullif(p_patch->>'resolved_at', '')::timestamptz
                            else resolved_at end,
         version    = cur + 1,
         updated_at = now()
   where id = p_id and author_id = uid
  returning * into r;
  return r;
end $$;

grant execute on function paper_mark_edit(text, uuid, jsonb, integer) to anon, authenticated;

do $$
declare v_id uuid; v_out paper_annotations%rowtype;
begin
  insert into paper_annotations (paper_id, module_code, author_id, kind, ring, anchor)
  values ('mig0024_probe', 'M1', 'mig0024_probe', 'correction', 'module',
          '{"quote":"probe","prefix":"","suffix":""}'::jsonb)
  returning id into v_id;
  select * into v_out from paper_mark_edit('mig0024_probe', v_id,
    jsonb_build_object('resolved_at', now()::text));
  if v_out.resolved_at is null then
    delete from paper_annotations where id = v_id;
    raise exception '0024 did not take: resolved_at is still null after an edit that set it';
  end if;
  delete from paper_annotations where id = v_id;
end $$;


-- 0025_one_function_per_name.sql

drop function if exists paper_ink_add(text, text, text, int, jsonb, text, text, real, text, uuid);

drop function if exists paper_annotation_status(uuid, text);

do $$
declare n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_ink_add';
  if n <> 1 then raise exception '0025: paper_ink_add still has % signatures', n; end if;

  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_annotation_status';
  if n <> 1 then raise exception '0025: paper_annotation_status still has % signatures', n; end if;

  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_mark_edit';
  if n <> 1 then raise exception '0025: paper_mark_edit still has % signatures', n; end if;
end $$;

do $$
declare r paper_ink%rowtype;
begin
  select * into r from paper_ink_add(
    'mig0025_probe', 'mig0025_probe_paper', 'M1', 1,
    '[[0.1,0.1],[0.2,0.2]]'::jsonb, 'pen', 'blue', 0.0032, 'solo', null);
  if r.id is null then
    raise exception '0025: the ten-argument paper_ink_add did not return a row';
  end if;
  delete from paper_ink where id = r.id;
end $$;

grant execute on function paper_ink_add(text, text, text, integer, jsonb, text, text, real, text, real, text, smallint, uuid) to anon, authenticated;
grant execute on function paper_annotation_status(text, uuid, text) to anon, authenticated;


-- 0026_chat_attachments.sql

create table if not exists message_attachments (
  id            uuid        primary key default gen_random_uuid(),
  message_id    uuid        not null references comms_messages (id) on delete cascade,
  kind          text        not null check (kind in ('image', 'file', 'passage')),

  storage_path  text,
  file_name     text,
  mime_type     text,
  byte_size     bigint,
  width         integer,
  height        integer,

  paper_id      text,
  paper_title   text,
  page          integer,
  quote         text,
  anchor        jsonb,

  created_at    timestamptz not null default now(),

  constraint attachment_shape check (
    (kind in ('image', 'file') and storage_path is not null)
    or (kind = 'passage' and quote is not null and paper_id is not null)
  ),
  constraint attachment_anchor_is_text_only check (
    anchor is null
    or not (anchor ? 'page' or anchor ? 'rect' or anchor ? 'rects' or anchor ? 'bbox')
  )
);

create index if not exists message_attachments_message on message_attachments (message_id);

alter table message_attachments enable row level security;

drop policy if exists message_attachments_read on message_attachments;
create policy message_attachments_read on message_attachments for select using (true);

revoke insert, update, delete on message_attachments from anon, authenticated;
grant select on message_attachments to anon, authenticated;

create or replace function add_message_attachments(p_me text, p_message uuid, p_rows jsonb)
returns setof message_attachments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sq     uuid;
  v_author text;
begin
  if p_me is null or p_message is null or p_rows is null
     or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  if jsonb_array_length(p_rows) > 10 then
    raise exception 'add_message_attachments: at most ten attachments on one message';
  end if;

  select squadron_id, user_id into v_sq, v_author
    from comms_messages where id = p_message and deleted_at is null;
  if v_author is null or v_author <> p_me or v_sq is null then return; end if;
  if not exists (select 1 from squadron_members where squadron_id = v_sq and user_id = p_me) then
    return;
  end if;

  return query
  insert into message_attachments
    (message_id, kind, storage_path, file_name, mime_type, byte_size, width, height,
     paper_id, paper_title, page, quote, anchor)
  select p_message,
         r->>'kind',
         nullif(r->>'storage_path', ''),
         nullif(r->>'file_name', ''),
         nullif(r->>'mime_type', ''),
         nullif(r->>'byte_size', '')::bigint,
         nullif(r->>'width', '')::integer,
         nullif(r->>'height', '')::integer,
         nullif(r->>'paper_id', ''),
         nullif(r->>'paper_title', ''),
         nullif(r->>'page', '')::integer,
         nullif(r->>'quote', ''),
         case when jsonb_typeof(r->'anchor') = 'object' then r->'anchor' else null end
    from jsonb_array_elements(p_rows) as r
   where (r->>'kind') = 'passage'
      or ((r->>'kind') in ('image', 'file')
          and (r->>'storage_path') like (v_sq::text || '/' || p_me || '/%'))
  returning *;
end $$;

create or replace function my_marks_in_module(uid text, p_module text, p_limit integer default 60)
returns table (
  id uuid, paper_id text, paper_title text, quote text, anchor jsonb,
  colour text, kind text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.paper_id, coalesce(p.title, a.paper_id), a.anchor->>'quote', a.anchor,
         a.colour, a.kind, a.created_at
    from paper_annotations a
    left join papers p on p.id = a.paper_id
   where a.author_id = uid
     and a.module_code = p_module
     and a.deleted_at is null
     and coalesce(a.anchor->>'quote', '') <> ''
   order by a.created_at desc
   limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

grant execute on function add_message_attachments(text, uuid, jsonb) to anon, authenticated;
grant execute on function my_marks_in_module(text, text, integer) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', true, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_member_upload on storage.objects;
create policy chat_attachments_member_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'chat-attachments'
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1 from public.squadron_members m
       where m.squadron_id::text = (storage.foldername(name))[1]
         and m.user_id = (storage.foldername(name))[2]
    )
  );

do $$
declare n integer;
begin
  select count(*) into n from storage.buckets where id = 'chat-attachments' and public;
  if n <> 1 then raise exception '0026: the chat-attachments bucket is missing or not public'; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'chat_attachments_member_upload';
  if n <> 1 then raise exception '0026: the upload policy did not land'; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
     and qual ilike '%chat-attachments%'
     and policyname <> 'chat_attachments_read';
  if n <> 0 then
    raise exception '0026: something other than 0031''s reader can list chat-attachments';
  end if;

  if has_table_privilege('anon', 'message_attachments', 'INSERT') then
    raise exception '0026: anon can write message_attachments directly';
  end if;
end $$;


-- 0027_read_receipts.sql

create table if not exists comms_receipts (
  message_id   uuid        not null references comms_messages (id) on delete cascade,
  user_id      text        not null,
  delivered_at timestamptz not null default now(),
  read_at      timestamptz,
  primary key (message_id, user_id)
);
create index if not exists comms_receipts_user_idx on comms_receipts (user_id);

alter table comms_receipts enable row level security;
do $$ begin
  create policy comms_receipts_open on comms_receipts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

alter table squadron_members add column if not exists last_delivered_at timestamptz;

create or replace function mark_squadrons_delivered(p_me text, p_squadrons uuid[])
returns integer language plpgsql security definer as $$
declare v_n integer := 0;
begin
  if p_me is null or p_squadrons is null then return 0; end if;
  insert into comms_receipts (message_id, user_id, delivered_at)
  select m.id, p_me, now()
    from squadron_members sm
    join comms_messages m on m.squadron_id = sm.squadron_id
   where sm.user_id = p_me
     and sm.squadron_id = any (p_squadrons)
     and m.user_id <> p_me
     and m.deleted_at is null
     and m.created_at >= sm.joined_at
     and m.created_at > coalesce(sm.last_delivered_at, sm.joined_at) - interval '5 minutes'
  on conflict (message_id, user_id) do nothing;
  get diagnostics v_n = row_count;
  update squadron_members set last_delivered_at = now()
   where user_id = p_me and squadron_id = any (p_squadrons);
  return v_n;
end $$;

create or replace function mark_squadron_read(p_me text, p_squadron uuid)
returns timestamptz language plpgsql security definer as $$
declare
  v_prev timestamptz;
  v_at   timestamptz := now();
begin
  select last_read_at into v_prev from squadron_members
   where squadron_id = p_squadron and user_id = p_me;
  if not found then return null; end if;
  insert into comms_receipts (message_id, user_id, delivered_at, read_at)
  select m.id, p_me, v_at, v_at
    from comms_messages m
    join squadron_members sm on sm.squadron_id = m.squadron_id and sm.user_id = p_me
   where m.squadron_id = p_squadron
     and m.user_id <> p_me
     and m.deleted_at is null
     and m.created_at >= sm.joined_at
     and m.created_at <= v_at
     and m.created_at > v_prev - interval '5 minutes'
  on conflict (message_id, user_id)
    do update set read_at = coalesce(comms_receipts.read_at, excluded.read_at);
  update squadron_members set last_read_at = v_at
   where squadron_id = p_squadron and user_id = p_me;
  return v_at;
end $$;

create or replace function message_receipts(p_me text, p_messages uuid[])
returns table (message_id uuid, user_id text, delivered_at timestamptz, read_at timestamptz)
language sql stable security definer as $$
  select m.id, sm.user_id, r.delivered_at, r.read_at
    from comms_messages m
    join squadron_members sm
      on sm.squadron_id = m.squadron_id
     and sm.user_id <> m.user_id
     and sm.joined_at <= m.created_at
    left join comms_receipts r on r.message_id = m.id and r.user_id = sm.user_id
   where m.id = any (p_messages)
     and m.user_id = p_me
     and not exists (select 1 from blocks b
                      where (b.user_id = m.user_id and b.blocked_id = sm.user_id)
                         or (b.user_id = sm.user_id and b.blocked_id = m.user_id))
     and not exists (select 1 from mutes u
                      where u.user_id = sm.user_id and u.muted_id = m.user_id);
$$;

insert into comms_receipts (message_id, user_id, delivered_at, read_at)
select m.id, sm.user_id, sm.last_read_at, sm.last_read_at
  from comms_messages m
  join squadron_members sm on sm.squadron_id = m.squadron_id
 where m.squadron_id is not null
   and m.user_id <> sm.user_id
   and m.deleted_at is null
   and m.created_at >= sm.joined_at
   and m.created_at <= sm.last_read_at
on conflict (message_id, user_id) do nothing;

do $$ begin
  alter publication supabase_realtime add table comms_receipts;
exception when duplicate_object then null; when undefined_object then null; end $$;


-- 0028_saves.sql

create table if not exists public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                -- the Clerk id, passed by the app
  module_id   text not null,
  kind        text not null check (kind in ('question', 'card', 'video', 'page')),
  ref_id      text not null,                -- question id (question/card), lesson id (video), paper id (page)
  chapter     int,
  at_seconds  int check (at_seconds is null or at_seconds >= 0),
  page        int check (page is null or page >= 1),
  created_at  timestamptz not null default now(),

  constraint saves_one_per_thing unique nulls not distinct (user_id, kind, ref_id, page),
  constraint saves_video_has_second check (kind <> 'video' or at_seconds is not null),
  constraint saves_page_has_page    check ((kind = 'page') = (page is not null))
);

create index if not exists saves_user_module_recent on public.saves (user_id, module_id, created_at desc);

alter table public.saves enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_read') then
    create policy saves_read   on public.saves for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_write') then
    create policy saves_write  on public.saves for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_change') then
    create policy saves_change on public.saves for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_remove') then
    create policy saves_remove on public.saves for delete using (true);
  end if;
end $$;

grant select, insert, update, delete on public.saves to anon, authenticated;


-- 0029_stamp.sql

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
  if not exists (select 1 from pg_constraint where conname = 'stamp_shape_known') then
    alter table pilot_profiles add constraint stamp_shape_known
      check (stamp_shape is null or stamp_shape in ('seal','roundel','window','gauge','postage','tag'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_pattern_known') then
    alter table pilot_profiles add constraint stamp_pattern_known
      check (stamp_pattern is null or stamp_pattern in ('none','rays','waves','checks','swirl','guilloche'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_code_shape') then
    alter table pilot_profiles add constraint stamp_code_shape
      check (stamp_code is null or stamp_code ~ '^[A-Z0-9]{1,3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stamp_ring_shape') then
    alter table pilot_profiles add constraint stamp_ring_shape
      check (stamp_ring is null or stamp_ring ~ '^[A-Z0-9 .''-]{0,10}$');
  end if;
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

  if exists (select 1 from pilot_profiles p where p.user_id = uid and p.stamp_issued_at is not null) then
    raise exception 'that stamp is already issued';
  end if;

  update pilot_profiles p set
    stamp_shape = p_shape,
    stamp_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')),
    stamp_rim = coalesce(p_rim, true),
    stamp_ring = nullif(left(upper(regexp_replace(coalesce(p_ring, ''), '[^A-Za-z0-9 .''-]', '', 'g')), 10), ''),
    stamp_pattern = coalesce(p_pattern, 'none'),
    stamp_ink = p_ink,
    stamp_seed = 1 + floor(random() * 999998)::int,
    stamp_issued_at = now()
  where p.user_id = uid
  returning p.* into out_row;

  if out_row.stamp_code is null or out_row.stamp_code = '' then
    raise exception 'a stamp needs a code';
  end if;
  return out_row;
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


-- 0030_licence_card.sql

alter table pilot_profiles add column if not exists bio         text;
alter table pilot_profiles add column if not exists phrase      text;
alter table pilot_profiles add column if not exists cover       text;
alter table pilot_profiles add column if not exists cover_ink   text;
alter table pilot_profiles add column if not exists cover_image text;

alter table pilot_profiles add column if not exists hours_s       integer not null default 0;
alter table pilot_profiles add column if not exists lessons_signed integer not null default 0;
alter table pilot_profiles add column if not exists days_flown     integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cover_known') then
    alter table pilot_profiles add constraint cover_known
      check (cover is null or cover in ('contour','panels','runway','flight','chart','image'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cover_ink_known') then
    alter table pilot_profiles add constraint cover_ink_known
      check (cover_ink is null or cover_ink in (
        'Midnight','Lapiz','Miami','Baby','Powder','Glacier','Teal','Seafoam','Emerald','Racing','Sage','Matcha',
        'Olive','Khaki','Sand','Butter','Honey','Papaya','Clementine','Coral','Ruby','Cherry','Peach','Latte',
        'Mocha','Espresso','Nardo','Gunmetal','Chalk','Mauve','Blush','Bubblegum','Barbie','Lilac','Lavender','Plum'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_one_line') then
    alter table pilot_profiles add constraint bio_one_line
      check (bio is null or (length(bio) <= 80 and bio !~ '[\n\r]'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'phrase_is_one_of_three') then
    alter table pilot_profiles add constraint phrase_is_one_of_three
      check (phrase is null or phrase in (
        'Torqued to spec. Emotionally too.',
        'It''s not a leak, it''s a seep.',
        'Could not duplicate.'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stats_are_sane') then
    alter table pilot_profiles add constraint stats_are_sane
      check (hours_s >= 0 and hours_s <= 100000000
         and lessons_signed >= 0 and lessons_signed <= 100000
         and days_flown >= 0 and days_flown <= 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cover_image_is_ours') then
    alter table pilot_profiles add constraint cover_image_is_ours
      check (cover_image is null or cover_image ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/');
  end if;
end $$;

drop function if exists licence_card(text, text);
create or replace function licence_card(p_viewer text, p_user text)
returns table (
  user_id text, callsign text, real_name text, code text,
  bio text, phrase text, cover text, cover_ink text, cover_image text,
  is_staff boolean, hours_s integer, lessons_signed integer, days_flown integer,
  stamp_shape text, stamp_code text, stamp_rim boolean, stamp_ring text,
  stamp_pattern text, stamp_ink text, stamp_seed integer, stamp_issued_at timestamptz
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
         p.stamp_pattern, p.stamp_ink, p.stamp_seed, p.stamp_issued_at
    from pilot_profiles p
   where p.user_id = p_user
     and (p.user_id = p_viewer or p.invisible = false)
     and not exists (
       select 1 from blocks b
        where (b.user_id = p_viewer and b.blocked_id = p_user)
           or (b.user_id = p_user   and b.blocked_id = p_viewer))
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 1048576,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists covers_upload on storage.objects;
create policy covers_upload on storage.objects
  for insert to public
  with check (
    bucket_id = 'covers'
    and array_length(storage.foldername(name), 1) = 1
    and name = (storage.foldername(name))[1] || '/cover.webp'
  );

drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects
  for select to public
  using (bucket_id = 'covers');

drop policy if exists covers_replace on storage.objects;
create policy covers_replace on storage.objects
  for update to public
  using (bucket_id = 'covers')
  with check (
    bucket_id = 'covers'
    and name = (storage.foldername(name))[1] || '/cover.webp'
  );

do $$
declare n integer;
begin
  select count(*) into n from storage.buckets where id = 'covers' and public;
  if n <> 1 then raise exception '0030: the covers bucket is missing or not public'; end if;
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('covers_upload', 'covers_read', 'covers_replace');
  if n <> 3 then raise exception '0030: the covers policies are incomplete (%)', n; end if;
end $$;


-- 0031_chat_attachments_can_upload.sql

drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read on storage.objects
  for select to public
  using (bucket_id = 'chat-attachments');

do $$
declare n integer;
begin
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('chat_attachments_member_upload', 'chat_attachments_read');
  if n <> 2 then raise exception '0031: chat attachments still cannot upload (%)', n; end if;
end $$;


-- 0032_fly_solo_on_the_server.sql

drop function if exists people_search(text, text);
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


-- 0033_the_avatar_is_ours.sql

alter table pilot_profiles add column if not exists photo_url  text;
alter table pilot_profiles add column if not exists photo_zoom integer not null default 100;
alter table pilot_profiles add column if not exists photo_x    integer not null default 0;
alter table pilot_profiles add column if not exists photo_y    integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'photo_url_is_ours') then
    alter table pilot_profiles add constraint photo_url_is_ours
      check (photo_url is null or photo_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'photo_frame_sane') then
    alter table pilot_profiles add constraint photo_frame_sane
      check (photo_zoom between 100 and 400
         and photo_x between -100 and 100
         and photo_y between -100 and 100);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'photo_url_not_clerk') then
    alter table pilot_profiles add constraint photo_url_not_clerk
      check (photo_url is null or photo_url !~* 'clerk\.com');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_upload on storage.objects;
create policy avatars_upload on storage.objects
  for insert to public
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and name = (storage.foldername(name))[1] || '/avatar.webp'
  );

drop policy if exists avatars_replace on storage.objects;
create policy avatars_replace on storage.objects
  for update to public
  using (bucket_id = 'avatars')
  with check (
    bucket_id = 'avatars'
    and name = (storage.foldername(name))[1] || '/avatar.webp'
  );

drop function if exists licence_card(text, text);
create or replace function licence_card(p_viewer text, p_user text)
returns table (
  user_id text, callsign text, real_name text, code text,
  bio text, phrase text, cover text, cover_ink text, cover_image text,
  is_staff boolean, hours_s integer, lessons_signed integer, days_flown integer,
  stamp_shape text, stamp_code text, stamp_rim boolean, stamp_ring text,
  stamp_pattern text, stamp_ink text, stamp_seed integer, stamp_issued_at timestamptz,
  photo_url text, photo_zoom integer, photo_x integer, photo_y integer
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
         p.photo_url, p.photo_zoom, p.photo_x, p.photo_y
    from pilot_profiles p
   where p.user_id = p_user
     and (p.user_id = p_viewer or p.invisible = false)
     and not exists (
       select 1 from blocks b
        where (b.user_id = p_viewer and b.blocked_id = p_user)
           or (b.user_id = p_user   and b.blocked_id = p_viewer))
$$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
   where table_name = 'pilot_profiles'
     and column_name in ('photo_url', 'photo_zoom', 'photo_x', 'photo_y');
  if n <> 4 then raise exception '0033: the photo columns are missing (%)', n; end if;

  select count(*) into n from storage.buckets where id = 'avatars' and public;
  if n <> 1 then raise exception '0033: the avatars bucket is missing or not public'; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('avatars_upload', 'avatars_read', 'avatars_replace');
  if n <> 3 then raise exception '0033: the avatars policies are incomplete (%)', n; end if;
end $$;


-- 0034_quiz_runs_and_the_board.sql

create table if not exists quiz_runs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
  module_code  text        not null,
  chapter_id   text        not null,
  quiz_id      text        not null,
  total        integer     not null,
  score        integer,
  callsign     text,
  code         text,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  constraint quiz_runs_total_positive check (total > 0),
  constraint quiz_runs_score_in_range check (score is null or (score >= 0 and score <= total)),
  constraint quiz_runs_finished_together check (
    (submitted_at is null and score is null) or (submitted_at is not null and score is not null)),
  constraint quiz_runs_not_before_it_started check (
    submitted_at is null or submitted_at >= started_at)
);

create index if not exists quiz_runs_board_idx
  on quiz_runs (quiz_id, score desc, submitted_at)
  where submitted_at is not null;
create index if not exists quiz_runs_open_idx
  on quiz_runs (user_id, quiz_id) where submitted_at is null;

alter table quiz_runs enable row level security;
drop policy if exists quiz_runs_open on quiz_runs;
create policy quiz_runs_open on quiz_runs for all using (true) with check (true);

create or replace function start_quiz_run(
  uid text, p_module text, p_chapter text, p_quiz text, p_total integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if uid is null or p_quiz is null or coalesce(p_total, 0) <= 0 then return null; end if;

  select id into v_id from quiz_runs
   where user_id = uid and quiz_id = p_quiz and submitted_at is null
   order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into quiz_runs (user_id, module_code, chapter_id, quiz_id, total)
       values (uid, p_module, p_chapter, p_quiz, p_total)
    returning id into v_id;
  return v_id;
end $$;

create or replace function finish_quiz_run(uid text, p_run uuid, p_score integer)
returns quiz_runs
language plpgsql
security definer
set search_path = public
as $$
declare v_row quiz_runs;
begin
  update quiz_runs r
     set submitted_at = now(),
         score        = greatest(0, least(p_score, r.total)),
         callsign     = (select p.callsign from pilot_profiles p where p.user_id = uid),
         code         = (select p.code     from pilot_profiles p where p.user_id = uid)
   where r.id = p_run and r.user_id = uid and r.submitted_at is null
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from quiz_runs where id = p_run and user_id = uid;
  end if;
  return v_row;
end $$;

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
  stamp_issued_at timestamptz
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
      sp.stamp_pattern, sp.stamp_ink, sp.stamp_seed, sp.stamp_issued_at
    from visible v
    left join pilot_profiles sp on sp.user_id = v.user_id
  )
  select rank, run_id, user_id, callsign, code, score, total, seconds, is_you, runs_total,
         stamp_shape, stamp_code, stamp_rim, stamp_ring,
         stamp_pattern, stamp_ink, stamp_seed, stamp_issued_at
    from ranked
   order by rank
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public' and table_name = 'quiz_runs';
  if n <> 1 then raise exception '0034: quiz_runs is missing'; end if;

  select count(*) into n from pg_constraint
   where conname in ('quiz_runs_total_positive', 'quiz_runs_score_in_range',
                     'quiz_runs_finished_together', 'quiz_runs_not_before_it_started');
  if n <> 4 then raise exception '0034: the run constraints are incomplete (%)', n; end if;

  select count(*) into n from pg_proc
   where proname in ('start_quiz_run', 'finish_quiz_run', 'quiz_leaderboard');
  if n <> 3 then raise exception '0034: the run functions are incomplete (%)', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'quiz_runs';
  if n < 1 then raise exception '0034: quiz_runs has no policy'; end if;
end $$;


-- 0035_the_code_is_the_stamp.sql

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
  when unique_violation then raise exception 'that code is taken';
end $$;

grant execute on function issue_licence(text, text, text, boolean, text, text, text) to anon, authenticated;

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


-- 0036_the_stamp_engine_of_20_september.sql

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


-- 0037_six_shapes_again.sql

alter table pilot_profiles drop constraint if exists stamp_shape_known;
alter table pilot_profiles add constraint stamp_shape_known
  check (stamp_shape is null or stamp_shape in
    ('seal','roundel','window','gauge','postage','tag'));


-- 0038_who_has_finished_a_quiz.sql

drop function if exists quiz_finishers(text, text[], integer);
create or replace function quiz_finishers(uid text, p_quizzes text[], p_cap integer default 11)
returns table (
  quiz_id         text,
  user_id         text,
  callsign        text,
  code            text,
  finished_at     timestamptz,
  is_you          boolean,
  finishers       integer,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_pscope    text,
  stamp_ink       text,
  stamp_pink      text,
  stamp_cink      text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.quiz_id, r.user_id, r.submitted_at
      from quiz_runs r
      left join pilot_profiles p on p.user_id = r.user_id
     where r.quiz_id = any(coalesce(p_quizzes, array[]::text[]))
       and r.submitted_at is not null
       and (
         r.user_id = uid                                   -- always on your own
         or (
           not coalesce(p.invisible, false)                -- Fly solo means not here
           and not exists (select 1 from blocks b
                            where (b.user_id = uid       and b.blocked_id = r.user_id)
                               or (b.user_id = r.user_id and b.blocked_id = uid))
         )
       )
  ),
  people as (
    select v.quiz_id, v.user_id, max(v.submitted_at) as finished_at
      from visible v
     group by v.quiz_id, v.user_id
  ),
  ranked as (
    select
      pe.quiz_id, pe.user_id, pe.finished_at,
      count(*) over (partition by pe.quiz_id)                      as finishers,
      row_number() over (
        partition by pe.quiz_id
        order by (pe.user_id = uid) desc, pe.finished_at desc, pe.user_id) as rn
      from people pe
  )
  select
    r.quiz_id,
    r.user_id,
    coalesce(nullif(btrim(pp.callsign), ''), 'Someone') as callsign,
    coalesce(nullif(btrim(pp.code), ''), '---')         as code,
    r.finished_at,
    (r.user_id = uid)                                    as is_you,
    r.finishers::integer,
    pp.stamp_shape, pp.stamp_code, pp.stamp_rim, pp.stamp_ring,
    pp.stamp_pattern, pp.stamp_pscope, pp.stamp_ink, pp.stamp_pink, pp.stamp_cink,
    pp.stamp_seed, pp.stamp_issued_at
    from ranked r
    left join pilot_profiles pp on pp.user_id = r.user_id
   where r.rn <= greatest(1, least(coalesce(p_cap, 11), 24))
   order by r.quiz_id, r.rn
$$;

grant execute on function quiz_finishers(text, text[], integer) to anon, authenticated;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'quiz_finishers';
  if n <> 1 then raise exception '0038: quiz_finishers is missing (%)', n; end if;
end $$;


-- 0039_one_to_three_and_one_change.sql

alter table pilot_profiles drop constraint if exists pilot_code_shape;
alter table pilot_profiles
  add constraint pilot_code_shape check (code is null or code ~ '^[A-Z0-9]{1,3}$');

alter table pilot_profiles add column if not exists stamp_redo integer not null default 0;
alter table pilot_profiles drop constraint if exists stamp_redo_sane;
alter table pilot_profiles add constraint stamp_redo_sane check (stamp_redo >= 0 and stamp_redo <= 3);

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

  spends := old.stamp_redo > 0 and new.stamp_redo = old.stamp_redo - 1;

  if changed and not spends then
    raise exception 'a stamp cannot be changed once it is issued';
  end if;

  if new.stamp_redo > old.stamp_redo
     and coalesce(current_setting('pw.grant_redo', true), '') <> '1' then
    raise exception 'a change has to be granted';
  end if;

  return new;
end $$;

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

alter table pilot_profiles disable trigger pilot_stamp_permanent;
update pilot_profiles set stamp_redo = 1 where stamp_issued_at is not null and stamp_redo = 0;
alter table pilot_profiles enable trigger pilot_stamp_permanent;

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


-- 0040_the_course_lives_in_a_table.sql

create table if not exists course_docs (
  id           bigserial primary key,
  doc          jsonb       not null,
  note         text,
  published_by text,
  published_at timestamptz not null default now()
);

create index if not exists course_docs_newest on course_docs (published_at desc, id desc);

alter table course_docs enable row level security;

drop policy if exists course_docs_read on course_docs;
create policy course_docs_read on course_docs for select using (true);

create table if not exists course_keys (
  id         smallint primary key default 1,
  digest     text        not null,
  set_at     timestamptz not null default now(),
  constraint course_keys_one_row check (id = 1)
);
alter table course_keys enable row level security;

/* pgcrypto is already installed on this project, in the `extensions` schema
   where Supabase puts them — which is why every function below sets
   `search_path = public, extensions`. Without the second entry `digest()` is
   simply not found, and the first run of this migration said so. */

/* Set or rotate the key. service_role only — this is run from a migration or
   the SQL console, never from a browser. */
create or replace function set_course_key(p_key text)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare at timestamptz;
begin
  if p_key is null or length(p_key) < 16 then
    raise exception 'a publishing key is at least 16 characters';
  end if;
  insert into course_keys (id, digest, set_at)
       values (1, encode(digest(p_key, 'sha256'), 'hex'), now())
  on conflict (id) do update set digest = excluded.digest, set_at = now()
  returning course_keys.set_at into at;
  return at;
end $$;

revoke all on function set_course_key(text) from public, anon, authenticated;
grant execute on function set_course_key(text) to service_role;

/* THE COURSE, as the app reads it: the newest version, or nothing at all.
   Nothing is an answer — the app falls back to the document it shipped
   with, which is what keeps an empty table or a slow night from being a
   blank Library. */
create or replace function current_course()
returns table (id bigint, doc jsonb, note text, published_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.doc, c.note, c.published_at
    from course_docs c
   order by c.published_at desc, c.id desc
   limit 1
$$;

grant execute on function current_course() to anon, authenticated;

/* Publishing. The key is compared as a digest and never echoed; the document
   is checked for the shape the app cannot run without, so a typo cannot take
   the Library away from a class. */
create or replace function publish_course(p_doc jsonb, p_key text, p_note text default null, p_by text default null)
returns table (id bigint, published_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  want text;
  mods jsonb;
  n integer;
begin
  select k.digest into want from course_keys k where k.id = 1;
  if want is null then raise exception 'no publishing key is set'; end if;
  if p_key is null or encode(digest(p_key, 'sha256'), 'hex') <> want then
    raise exception 'that publishing key is not right';
  end if;

  if p_doc is null or jsonb_typeof(p_doc -> 'modules') <> 'array' then
    raise exception 'a course document has a modules array';
  end if;
  mods := p_doc -> 'modules';
  if jsonb_array_length(mods) = 0 then
    raise exception 'a course document has at least one module';
  end if;
  /* Every module needs an id and a name, and every chapter needs an id: the
     app keys progress, saves and stamps to those, so a document missing them
     is not a course, it is a way to lose somebody's work. */
  select count(*) into n from jsonb_array_elements(mods) m
   where coalesce(m ->> 'id', '') = '' or coalesce(m ->> 'name', '') = '';
  if n > 0 then raise exception '% module(s) without an id or a name', n; end if;
  select count(*) into n
    from jsonb_array_elements(mods) m,
         jsonb_array_elements(coalesce(m -> 'chapters', '[]'::jsonb)) c
   where coalesce(c ->> 'id', '') = '';
  if n > 0 then raise exception '% chapter(s) without an id', n; end if;

  return query
  insert into course_docs (doc, note, published_by)
       values (p_doc, nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_by, '')), ''))
    returning course_docs.id, course_docs.published_at;
end $$;

grant execute on function publish_course(jsonb, text, text, text) to anon, authenticated;

do $$
declare n integer;
begin
  select count(*) into n from pg_policies where tablename = 'course_docs' and cmd <> 'SELECT';
  if n <> 0 then raise exception '0040: course_docs has % write policies; it must have none', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('publish_course', 'current_course', 'set_course_key');
  if n <> 3 then raise exception '0040: expected three functions, found %', n; end if;
end $$;


-- 0041_search_finds_anybody.sql

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

drop function if exists people_browse(text, interval, integer);
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


-- 0042_a_paper_you_started.sql

alter table quiz_runs add column if not exists answered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_runs_answered_after_start') then
    alter table quiz_runs add constraint quiz_runs_answered_after_start
      check (answered_at is null or answered_at >= started_at);
  end if;
end $$;

create index if not exists quiz_runs_counted_idx
  on quiz_runs (quiz_id, user_id)
  where answered_at is not null or submitted_at is not null;

create or replace function mark_quiz_progress(p_me text, p_run uuid)
returns timestamptz
language sql
volatile
as $$
  update quiz_runs
     set answered_at = coalesce(answered_at, now())
   where id = p_run and user_id = p_me
  returning answered_at;
$$;

drop function if exists quiz_finishers(text, text[], integer);

create function quiz_finishers(uid text, p_quizzes text[], p_cap integer default 11)
returns table (
  quiz_id         text,
  run_id          uuid,
  user_id         text,
  callsign        text,
  code            text,
  finished_at     timestamptz,
  is_you          boolean,
  finishers       integer,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_pscope    text,
  stamp_ink       text,
  stamp_pink      text,
  stamp_cink      text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.id, r.quiz_id, r.user_id,
           /* The moment the attempt began to count. A finished paper is
              dated by its hand-in; one still open is dated by its first
              answer, so the order reads as "most recently active". */
           coalesce(r.submitted_at, r.answered_at) as at
      from quiz_runs r
      join pilot_profiles p on p.user_id = r.user_id
     where r.quiz_id = any(coalesce(p_quizzes, array[]::text[]))
       and (r.answered_at is not null or r.submitted_at is not null)
       /* 0034's visibility rules, unchanged: Fly solo, and a block cutting
          both ways. You always see your own. */
       and (r.user_id = uid
            or (not coalesce(p.invisible, false)
                and not exists (select 1 from blocks b
                                where (b.user_id = uid and b.blocked_id = r.user_id)
                                   or (b.user_id = r.user_id and b.blocked_id = uid))))
  ),
  ranked as (
    select v.*,
           count(*) over (partition by v.quiz_id) as n,
           row_number() over (
             partition by v.quiz_id
             /* You first, then most recent — 0038's order, kept. */
             order by (v.user_id = uid) desc, v.at desc, v.id
           ) as rn
      from visible v
  )
  select r.quiz_id, r.id, r.user_id, p.callsign, p.code, r.at, r.user_id = uid,
         r.n::integer,
         p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
         p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
         p.stamp_seed, p.stamp_issued_at
    from ranked r
    join pilot_profiles p on p.user_id = r.user_id
   where r.rn <= greatest(1, least(coalesce(p_cap, 11), 400))
   order by r.quiz_id, r.rn;
$$;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('quiz_finishers', 'mark_quiz_progress')
     and pronamespace = 'public'::regnamespace;
  if n < 2 then
    raise exception '0042 did not take: expected quiz_finishers and mark_quiz_progress, found %', n;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'quiz_runs' and column_name = 'answered_at') then
    raise exception '0042 did not take: quiz_runs.answered_at is missing';
  end if;
end $$;


-- 0043_a_face_and_a_mark.sql

drop function if exists people_search(text, text);
drop function if exists people_browse(text, interval, integer);

create function people_search(p_me text, p_q text)
returns table (
  user_id        text,
  callsign       text,
  real_name      text,       -- ONLY when the term matched it (0041)
  module_code    text,
  shares_squadron boolean,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_pscope    text,
  stamp_ink       text,
  stamp_pink      text,
  stamp_cink      text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
)
language sql
stable
as $$
  with q as (
    select t as term,
           replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') as esc
      from (select btrim(coalesce(p_q, '')) as t) r
  ),
  pool as (
    select
      p.user_id,
      p.callsign,
      case when coalesce(up.identity_display, 'real') = 'username'
           then null else p.real_name end as findable_name,
      (select c.module_code from chapter_completions c
        where c.user_id = p.user_id order by c.completed_at desc limit 1) as module_code,
      exists (
        select 1 from squadron_members a
        join squadron_members b on b.squadron_id = a.squadron_id
        where a.user_id = p_me and b.user_id = p.user_id
      ) as shares_squadron,
      p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
      p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
      p.stamp_seed, p.stamp_issued_at
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
    /* Disclosure is stricter than matching: three characters or more that
       START a word of the name. A plain substring reveal handed a real name
       back for two letters of somebody's CALLSIGN (0041). */
    case when length(q.term) >= 3 and pool.findable_name is not null
          and (lower(pool.findable_name) like lower(q.esc) || '%' escape '\'
            or lower(pool.findable_name) like '% ' || lower(q.esc) || '%' escape '\')
         then pool.findable_name else null end as real_name,
    pool.module_code,
    pool.shares_squadron,
    pool.stamp_shape, pool.stamp_code, pool.stamp_rim, pool.stamp_ring, pool.stamp_pattern,
    pool.stamp_pscope, pool.stamp_ink, pool.stamp_pink, pool.stamp_cink,
    pool.stamp_seed, pool.stamp_issued_at
    from pool cross join q
   where pool.callsign ilike '%' || q.term || '%'
      or pool.findable_name ilike '%' || q.term || '%'
   order by
     case
       when lower(pool.callsign) = lower(q.term)
         or lower(pool.findable_name) = lower(q.term) then 0
       when pool.callsign ilike q.term || '%'
         or pool.findable_name ilike q.term || '%' then 1
       else 2
     end,
     pool.shares_squadron desc,
     /* Same straggler rule as the browse list, so a search result and the
        list it came out of do not disagree about where `_vnx` sits. */
     case when upper(pool.callsign) ~ '^[A-Z]' then 0 else 1 end,
     upper(pool.callsign)
   limit 40;
$$;

create function people_browse(p_me text, p_since interval default null,
                              p_limit integer default 400)
returns table (
  user_id        text,
  callsign       text,
  module_code    text,
  shares_squadron boolean,
  stamp_shape     text,
  stamp_code      text,
  stamp_rim       boolean,
  stamp_ring      text,
  stamp_pattern   text,
  stamp_pscope    text,
  stamp_ink       text,
  stamp_pink      text,
  stamp_cink      text,
  stamp_seed      integer,
  stamp_issued_at timestamptz
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
    ) as shares_squadron,
    p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring, p.stamp_pattern,
    p.stamp_pscope, p.stamp_ink, p.stamp_pink, p.stamp_cink,
    p.stamp_seed, p.stamp_issued_at
  from pilot_profiles p
  left join acted on acted.user_id = p.user_id
  where p.user_id is distinct from p_me
    and coalesce(btrim(p.callsign), '') <> ''
    and p.discoverable
    and not coalesce(p.invisible, false)
    and not exists (select 1 from blocks b
                    where (b.user_id = p_me and b.blocked_id = p.user_id)
                       or (b.user_id = p.user_id and b.blocked_id = p_me))
    and (p_since is null or (acted.at is not null and acted.at >= now() - p_since))
  /* A TO Z, AND ANYTHING THAT IS NOT A LETTER LAST. The grouping that used to
     do this in the client is gone; the collation alone would put `_vnx`
     first. */
  order by case when upper(p.callsign) ~ '^[A-Z]' then 0 else 1 end,
           upper(p.callsign), p.user_id
  limit greatest(coalesce(p_limit, 400), 1);
$$;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc
   where proname in ('people_search', 'people_browse')
     and pronamespace = 'public'::regnamespace;
  if n <> 2 then
    raise exception '0043 did not take: expected 2 functions, found %', n;
  end if;
end $$;


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
