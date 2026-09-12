-- 0023 — the papers reader, made to work.
--
-- Run after 0022. Safe to re-run. Adds columns to two existing tables, creates
-- one table, replaces four functions and publishes two tables to realtime.
-- Alters no existing column's type and drops nothing.
--
-- ===========================================================================
-- WHY THIS FILE EXISTS
-- ===========================================================================
-- The reader has been writing around its own schema for months.
--
-- A STROKE COULD NOT BE DESCRIBED. paper_ink has a width and nothing else, so
-- opacity and cap were dropped on the way out and invented on the way back: a
-- marker drawn at 55% and a highlighter at 38% both came back fully opaque,
-- covering the words they were drawn over, and a chisel highlighter came back
-- round-capped. `tool` was `check (tool in ('pen','marker'))` while the tool
-- table has six, so the client folded six into two and a Shape was
-- indistinguishable from a pen stroke. `colour` was a CHECK over eight palette
-- names while the reader offers twenty-four free colours, so picking olive
-- stored "graphite" and the stroke turned grey the moment the save returned.
--
-- 0020_reader_tools.sql was written for some of this and its own header says
-- NOT RUN — `reader:setup` runs 0018 only. This supersedes it: every statement
-- here is `if not exists`, so running 0020 first, after, or never all end in
-- the same place.
--
-- AGREEING WAS A COUNTER WITH NO ROWS. agree_with_mark(p_id) took an id and
-- nothing else and bumped a number. It could not say whether YOU had agreed,
-- could not be taken back, and one student could press it a hundred times. It
-- was also called by nothing, which is the only reason none of that showed.
--
-- A MARK COULD BE OVERWRITTEN BY A SECOND DEVICE without either knowing. And
-- paper_annotation_status — the one paper function with no `uid` argument and
-- no ownership check — was an unauthenticated write on anybody's row, called
-- on every load for every orphan because the client's guard read a column name
-- that does not exist.
--
-- THE READER HAD NO REALTIME AT ALL. lesson_threads, lesson_replies and
-- comms_messages were published in 0015; paper_annotations and paper_ink were
-- not, so the only mechanism was a sixty-second poll that re-read every mark
-- on the paper each time.

-- ============================================================== 1 · the ink
-- What a stroke actually is. Each of these was being drawn and then thrown
-- away at the table's edge.
alter table paper_ink add column if not exists opacity real    not null default 1;
alter table paper_ink add column if not exists cap     text    not null default 'round';
alter table paper_ink add column if not exists variant smallint not null default 0;
do $$ begin
  alter table paper_ink add constraint paper_ink_opacity_range check (opacity > 0 and opacity <= 1);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_cap_known check (cap in ('round', 'butt', 'square'));
exception when duplicate_object then null; end $$;

-- SIX TOOLS, NOT TWO. The old CHECK named the two nibs 0017 knew about, and
-- the client has been mapping 'shp' and 'mkr' onto them to get a write through
-- — which means the table cannot tell a shape from a pen stroke, and an eraser
-- that wants to remove "the last shape" has nothing to go on.
do $$ begin
  alter table paper_ink drop constraint if exists paper_ink_tool_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_tool_known
    check (tool in ('pen', 'marker', 'mkr', 'hl', 'shp', 'msr', 'snap'));
exception when duplicate_object then null; end $$;

-- A NAME OR A COLOUR, and the difference matters. The palette's eight names
-- are a design decision the stylesheet owns — graphite becomes chalk under the
-- night light, because a pencil is defined by being darker than paper. A free
-- colour has no such reading and is stored as what it is.
do $$ begin
  alter table paper_ink drop constraint if exists paper_ink_colour_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_ink add constraint paper_ink_colour_known
    check (colour in ('graphite','chalk','yellow','blue','green','purple','red','pink','orange')
           or colour ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

-- The writer. Same name, same first arguments, three more with defaults — so a
-- client that has not been updated keeps working and simply stores the
-- defaults it was storing before.
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

-- ============================================================ 2 · agreeing
-- A row per person per mark, so it can be taken back, counted honestly, and
-- asked "did I".
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

-- Replaces the 0018 counter. Returns the new count, so the card shows a number
-- it did not have to guess at.
drop function if exists agree_with_mark(uuid);
create or replace function agree_with_mark(p_me text, p_id uuid, p_on boolean default true)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  if p_me is null or p_id is null then return 0; end if;
  -- You cannot agree with your own mark. It is not a vote, it is a second
  -- person saying the same passage mattered to them.
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

-- ======================================================== 3 · owning a mark
-- A VERSION, so two devices cannot silently clobber one note. paper_mark_edit
-- was last-write-wins with nothing to compare against.
alter table paper_annotations add column if not exists version integer not null default 1;

create or replace function paper_mark_edit(
  uid text, p_id uuid, p_patch jsonb, p_version integer default null
) returns paper_annotations language plpgsql security definer as $$
declare r paper_annotations%rowtype; cur integer;
begin
  select version into cur from paper_annotations where id = p_id and author_id = uid;
  if cur is null then return null; end if;
  -- Given a version, the write applies only if the row is still at it. Given
  -- none, it behaves exactly as it did before, so an older client is not
  -- broken by this migration.
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

-- THE ONE FUNCTION WITH NO OWNER CHECK. It is called on every load for every
-- mark that lost its place, so an unauthenticated write on anybody's row went
-- out routinely. The status of a mark is a fact about the paper rather than
-- about its author, so any signed-in student may set it — but they have to say
-- who they are, and it is only ever moved to or from 'orphaned'.
create or replace function paper_annotation_status(uid text, p_id uuid, p_status text)
returns boolean language plpgsql security definer as $$
begin
  if uid is null or p_id is null then return false; end if;
  if p_status not in ('ok', 'orphaned') then return false; end if;
  update paper_annotations set status = p_status, updated_at = now()
   where id = p_id and status is distinct from p_status;
  return found;
end $$;

-- ====================================================== 4 · the right seat
-- The locked design scopes LIVE annotation to the right seat rather than to
-- the module at large. The ring vocabulary tops out at 'module', so there has
-- been no value to write. This adds one; which marks are written with it is a
-- product decision and this migration deliberately does not make it — nothing
-- here changes what an existing mark is scoped to.
do $$ begin
  alter table paper_annotations drop constraint if exists paper_annotations_ring_check;
exception when others then null; end $$;
do $$ begin
  alter table paper_annotations add constraint paper_annotations_ring_known
    check (ring in ('solo', 'seat', 'wingman', 'formation', 'module'));
exception when duplicate_object then null; end $$;

-- ===================================================== 5 · what follows you
-- Bookmarks and where you were reading were localStorage, so a second device
-- saw neither and clearing site data lost both.
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

-- ============================================================ 6 · realtime
-- 0015 published the discussion and the squadron chat and stopped there, so
-- the reader's only mechanism was a sixty-second poll that re-read every mark
-- on the paper each time. The poll stays — the locked design is explicit that
-- the page never changes on its own and a dot is the whole notification — but
-- it now has something to be a safety net FOR.
do $$ begin alter publication supabase_realtime add table paper_annotations;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table paper_ink;          exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table paper_mark_agrees;  exception when others then null; end $$;

alter table paper_annotations  replica identity full;
alter table paper_ink          replica identity full;
alter table paper_mark_agrees  replica identity full;

-- ============================================================ 7 · backfill
-- Every agree_count that the 0018 counter left behind is recomputed from the
-- rows that now own it. There are none today — nothing ever called it — so
-- this is a statement of where the number comes from rather than a repair.
update paper_annotations a
   set agree_count = coalesce((select count(*) from paper_mark_agrees g where g.mark_id = a.id), 0)
 where a.agree_count is distinct from
       coalesce((select count(*) from paper_mark_agrees g where g.mark_id = a.id), 0);
