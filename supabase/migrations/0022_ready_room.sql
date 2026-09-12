-- 0022 — the Ready Room, made to work.
--
-- Run after 0021. Safe to re-run. Adds columns to four existing tables, creates
-- three tables and fourteen functions. Alters no existing column and drops
-- nothing.
--
-- ===========================================================================
-- WHY THIS FILE EXISTS
-- ===========================================================================
-- The room shipped with controls that had nothing behind them. "Create one" on
-- the discovery screen called a handler App never supplied, and there was no
-- create_squadron to supply it with. "Ask to fly" emitted an event nobody
-- handled, and there was no table for a request to live in. comms_reactions
-- has existed since 0005 with no writer, copilot_sessions since 0001 with no
-- writer. Read state lived in localStorage, so it never followed anyone to a
-- second device.
--
-- Every function here follows 0009 and 0011: the rule lives in SQL, not in the
-- client. auth.uid() is NULL on every request in this architecture and the
-- browser holds the anon key, so a boundary expressed as "the UI does not call
-- that endpoint" is not a boundary. Membership, capacity, blocks and the
-- shared-squadron rule for the right seat are all decided in here.
--
-- THE RIGHT SEAT'S RULE, restated once because it is the one with teeth: you
-- may only ask to fly with somebody you already share a squadron with. 0009
-- states it for presence; request_right_seat states it for the request. Both
-- read the same my_squadron_ids.

-- ============================================================ 1 · squadrons
-- A squadron made by a student, rather than assigned. The columns discovery
-- added in 0011 have been sitting unused because nothing wrote them: the
-- client built a display name out of the module code instead.
alter table squadrons add column if not exists created_by text;

-- Per member, not per squadron: muting is one person's decision and read state
-- is one person's place. Both were client-side and therefore per-device.
alter table squadron_members add column if not exists muted        boolean     not null default false;
alter table squadron_members add column if not exists last_read_at timestamptz not null default now();
alter table squadron_members add column if not exists role         text        not null default 'member';
do $$ begin
  alter table squadron_members add constraint squadron_members_role_known
    check (role in ('member', 'owner', 'staff'));
exception when duplicate_object then null; end $$;

-- ============================================================= 2 · messages
-- reply_to is the quoted message every chat app has and this one did not, so a
-- thirty-message morning had no way to say which line an answer belonged to.
-- deleted_at is a tombstone rather than a DELETE: a removed message that
-- vanishes from the middle of a transcript reads as a bug to everyone who saw
-- it, and realtime carries an UPDATE more cheaply than a DELETE.
alter table comms_messages add column if not exists reply_to   uuid references comms_messages (id) on delete set null;
alter table comms_messages add column if not exists deleted_at timestamptz;
alter table comms_messages add column if not exists pinned_at  timestamptz;
alter table comms_messages add column if not exists pinned_by  text;
create index if not exists comms_messages_sq_created_idx
  on comms_messages (squadron_id, created_at desc) where squadron_id is not null;

-- ============================================================== 3 · answers
-- One level, and one level only. nestAnswers has been deriving a hierarchy
-- from flat data since 0008 and honestly returning everything flat, because
-- there was no column to hang it on. There is one now, and it is deliberately
-- not recursive: a reply whose parent is itself a reply is re-pointed at the
-- top-level answer, in the function, so the schema cannot grow a thread that
-- breaks on a phone.
alter table lesson_replies add column if not exists parent_id text references lesson_replies (id) on delete cascade;
create index if not exists lesson_replies_parent_idx on lesson_replies (parent_id) where parent_id is not null;

-- A vote on the QUESTION, not only on the answers. lesson_reply_votes (0010)
-- covers answers; a feed where the question cannot be voted has no way to
-- surface the one everybody is stuck on.
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

-- ============================================================ 4 · right seat
-- A request is not a session. Nothing auto-pairs anybody: the person asked has
-- to answer, and an unanswered request expires rather than sitting open for a
-- week. One pending request per pair at a time — the UI says "asked, waiting"
-- and that has to be true rather than a fifth row.
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

-- The session itself. copilot_sessions has existed since 0001 and nothing ever
-- opened one. These three columns are what makes it a right seat rather than a
-- log line: where each person is, and when the pair last did anything.
alter table copilot_sessions add column if not exists last_active_at timestamptz not null default now();
alter table copilot_participants add column if not exists at_module  text;
alter table copilot_participants add column if not exists at_place   text;
alter table copilot_participants add column if not exists at_since   timestamptz not null default now();

-- Session-scoped chat. Deliberately its own table and not comms_messages: it
-- is deleted when the seat empties, and mixing it into the squadron transcript
-- would make a thing that vanishes live next to a thing that does not.
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

-- =========================================================== 5 · squadrons()
-- CREATE. The one door: it makes the room, puts the maker in it as owner, and
-- mints the invite token in the same statement. A client that made the row and
-- then added itself would leave an ownerless squadron behind every time the
-- second call failed.
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
  -- Not unlimited. A student who can mint rooms in a loop can fill discovery
  -- with them, and discovery is the screen a newcomer trusts most.
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

-- LEAVE. The last member out takes the room with them, because an empty
-- squadron in discovery is a door into nowhere. Ownership passes to the
-- longest-standing member instead of the room becoming unadministered.
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

-- A fresh link, and the old one stops working the moment it is called. This is
-- the control behind "someone shared it who shouldn't have".
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

-- READ STATE, and it lives on the server so it follows the student to their
-- phone. The client passed a localStorage map called pw-room-seen, which meant
-- every badge lit again on a second device.
create or replace function mark_squadron_read(p_me text, p_squadron uuid)
returns timestamptz language sql security definer as $$
  update squadron_members set last_read_at = now()
   where squadron_id = p_squadron and user_id = p_me
  returning last_read_at;
$$;

-- ============================================================ 6 · messages()
create or replace function toggle_message_reaction(p_me text, p_message uuid, p_emoji text)
returns boolean language plpgsql security definer as $$
begin
  if p_me is null or p_message is null or btrim(coalesce(p_emoji,'')) = '' then return false; end if;
  -- A member of the squadron the message is in, and nobody else.
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

-- ONE PIN PER SQUADRON. A list of pinned messages is a second inbox; a single
-- pin is a notice board, which is what a study group actually uses it for.
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

-- Your own, and within the window where an edit is a correction rather than a
-- rewrite of what somebody replied to.
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

-- ============================================================= 7 · answers()
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

-- ========================================================== 8 · right seat()
-- ASK. The shared-squadron rule is checked here, not in the component, and a
-- block in either direction refuses the request without saying which.
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
  -- Already flying with somebody. The right seat is one seat.
  if exists (
    select 1 from copilot_participants cp
      join copilot_sessions cs on cs.id = cp.session_id
     where cp.user_id = p_me and cp.left_at is null and cs.ended_at is null) then
    return 'already_flying';
  end if;
  -- They asked you first: answering rather than asking back is the honest
  -- resolution, so this accepts theirs instead of opening a second request.
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

-- ANSWER. Accepting is what opens the session, so there is exactly one place a
-- session can come into being and it needs two people to have agreed.
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
  -- Every other pending request either of them holds is now moot.
  update seat_requests set state = 'expired', answered_at = now()
   where state = 'pending' and (from_id in (r.from_id, r.to_id) or to_id in (r.from_id, r.to_id));
  return v_session;
end $$;

-- WHERE I AM, said by the client as it moves. This is what puts the partner's
-- place on the other half of the session card, and it doubles as the heartbeat
-- that keeps the seat from expiring.
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
  -- §right seat — the session chat is deleted, not archived. Only what someone
  -- deliberately kept survives, and the client has already turned those into
  -- lesson notes by the time this runs.
  delete from seat_messages where session_id = v_session and kept = false;
  return true;
end $$;

-- THE HOUR. A seat nobody has touched for an hour is not a study session, it
-- is two closed laptops. Called opportunistically by the room's own reads, so
-- it needs no scheduler to be correct — only to be timely.
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

-- Everything the right-seat screen needs, in one round trip: the live session
-- if there is one, who is in it and where they are, and the requests waiting on
-- an answer in both directions.
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

-- ============================================================= 9 · realtime
-- Same three reasons as 0015: a badge that arrives twenty seconds late is a
-- badge nobody believes. REPLICA IDENTITY FULL so an update carries enough of
-- the row to know which squadron it belongs to.
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

-- ========================================================= 10 · backfill
-- Existing rooms get the name their members have been reading off the module
-- code, so nothing loses an identity on the way in, and the owner row gets the
-- role the column now records.
update squadrons set name = module_code || ' squadron' where name is null or btrim(name) = '';
update squadron_members sm set role = 'owner'
  from squadrons s where s.id = sm.squadron_id and s.owner_id = sm.user_id and sm.role = 'member';
update squadrons set invite_token = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
 where invite_token is null;
