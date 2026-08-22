-- §8.1 the app speaks first · §9 rate limits and the moderation queue
--
-- Everything here is idempotent and safe to re-run.

-- ---------------------------------------------------------------- openers
-- The quiet check and the insert have to happen together. Done in the client
-- they race: two people opening a quiet channel at the same moment both see it
-- as quiet and both post. This does it in one statement under one lock.
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

  -- Serialise per channel so concurrent callers queue rather than collide.
  perform pg_advisory_xact_lock(hashtext('opener:' || mod));

  select max(created_at) into newest
    from comms_messages where module_code = mod;

  -- Anything at all inside 48 hours means the channel is not quiet, including
  -- a previous opener -- which is what caps this at one per channel per 48h.
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

-- ------------------------------------------------------------ rate limits
-- §9: composer posts, Calls and Formation invites are limited per user per
-- hour. Enforced here because a client-side guard is decoration.
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

-- Housekeeping: nothing reads an event older than an hour.
create or replace function rate_events_prune()
returns void language sql as $$
  delete from rate_events where created_at < now() - interval '2 hours';
$$;

-- ------------------------------------------------------- moderation queue
-- §9: reports route to a human queue with the message, the chapter context and
-- the channel. Target first response within 24 hours, so the view carries the
-- age and the flag rather than making a person work it out.
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
