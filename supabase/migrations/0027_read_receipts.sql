-- =============================================================================
-- 0027 · READ RECEIPTS THAT TELL THE TRUTH
-- -----------------------------------------------------------------------------
-- A tick in a group chat answers one question: has everybody this went to got
-- it, and has everybody opened it. squadron_members.last_read_at (0022) is one
-- watermark per member. It is enough for an unread badge, but it cannot say
-- WHEN somebody opened a particular message, and nothing recorded delivery at
-- all, so a sender's tick had nothing true to draw.
--
-- One row per message per recipient now: when it reached them, and when they
-- first opened it. Blue ticks need every recipient's read_at — the WhatsApp
-- rule, where one person opening a message does not turn it blue.
--
-- WHO A MESSAGE WENT TO is decided when it is read back, not stored: the
-- members who had joined by the moment it was sent, other than its author, and
-- not cut off from the author by a block in either direction or by having
-- muted them. Somebody joining next week does not turn last week's ticks grey.
--
-- ADDITIVE. One table, one column, two new functions, and mark_squadron_read
-- keeps its exact signature and return type, so the bundle already deployed
-- keeps working before and after this runs.
-- =============================================================================

create table if not exists comms_receipts (
  message_id   uuid        not null references comms_messages (id) on delete cascade,
  user_id      text        not null,
  delivered_at timestamptz not null default now(),
  read_at      timestamptz,
  primary key (message_id, user_id)
);
create index if not exists comms_receipts_user_idx on comms_receipts (user_id);

alter table comms_receipts enable row level security;
-- Open, like every other table in this project: the client is anonymous from
-- Postgres' point of view and access control happens in the app. See 0009's
-- header before writing a policy that mentions auth.uid() here.
do $$ begin
  create policy comms_receipts_open on comms_receipts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- How far delivery has been stamped for each member, so a fetch examines only
-- what arrived since the last one.
alter table squadron_members add column if not exists last_delivered_at timestamptz;

-- ============================================================ 1 · delivered
-- Called by a member's app once it has fetched the chat: everything it now
-- holds from other people is on that device. Only messages since the last
-- call are examined, with five minutes of overlap so a message committed late,
-- behind a newer one, is still caught. The primary key makes the overlap free.
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

-- ================================================================= 2 · read
-- The same signature and return as 0022, so nothing that calls it changes. It
-- still moves the watermark the unread badge counts from, and it now stamps
-- every message it covers. read_at is set once and never moved later, so the
-- time Message info shows is when they first opened it.
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

-- ======================================================= 3 · what a sender sees
-- One row per person each of MY messages went to, with whichever of the two
-- times exist. Only the caller's own messages: who opened a message is its
-- author's business and nobody else's.
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

-- ======================================================= 4 · what 0022 knew
-- A member whose watermark is past a message had opened it by then. That is
-- all the old column can say, so these rows carry the watermark as both times,
-- the closest true value there is. Anything after the watermark gets its
-- receipt the next time that member's app fetches the chat.
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

-- ================================================================= 5 · live
-- Live, like the messages themselves (0015), so a tick turns blue while the
-- sender is looking at it.
do $$ begin
  alter publication supabase_realtime add table comms_receipts;
exception when duplicate_object then null; when undefined_object then null; end $$;
