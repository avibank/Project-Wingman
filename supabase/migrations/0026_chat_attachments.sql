-- 0026 — attachments in squadron chat: a photo, a file, or a passage from a
-- paper.
--
-- Run after 0025. Additive: one table, two functions, one storage bucket and
-- one storage policy. Drops nothing but its own policy, before recreating it.
-- Safe to re-run.
--
-- ===========================================================================
-- WHY THIS IS NOT THE MIGRATION THAT CAME WITH THE DESIGN
-- ===========================================================================
-- The drop's SQL was written for a Supabase client signed in through a Clerk
-- JWT template: its row policies read `requesting_user_id()` from the token's
-- `sub` claim, and its storage policies are granted `to authenticated`. This
-- client is neither. It sends the anon key as its bearer, `auth.uid()` is NULL
-- on every request (0009's header), and the role Postgres sees is `anon`. As
-- written, every upload and every attachment insert would have been refused,
-- and nothing on screen would have said why.
--
-- Its own brief anticipated that: "if they use a different pattern, match it
-- rather than introducing a second one". The pattern here is 0009, 0011, 0021
-- and 0022 — the rule lives in a SECURITY DEFINER function that takes the
-- caller's id as an argument and checks it against the data. So that is what
-- this does.
--
-- Two further corrections to the drop, found by reading the schema rather
-- than the page: paper ids are text (`M1-B2-13D-…`), not uuid; and the message
-- table is `comms_messages`, keyed by `squadron_id`, with a `module_code` that
-- may not be null.
--
-- ===========================================================================
-- THE STORAGE DECISION, stated rather than buried
-- ===========================================================================
-- The drop wanted a PRIVATE bucket read through one-hour signed URLs, with each
-- upload checked against the uploader's own folder. Signed URLs are minted with
-- a server-side key, and "the uploader's own folder" needs an identity Storage
-- can verify. This project has neither: no Clerk-to-Supabase JWT and no
-- server. Of the two designs that can work without one:
--
--   * private + an anon SELECT policy, so the browser can mint signed URLs —
--     which also lets anyone holding the public key LIST the bucket and read
--     every attachment in every squadron;
--   * public + NO select policy — objects are served only by their exact URL,
--     the path carries a random uuid, and nothing can list the bucket.
--
-- The second is strictly better, so it is the one here. Under it an attachment
-- is readable exactly where its message is readable, because the path lives on
-- a row beside the message. What it gives up against the drop's intent: a
-- link copied out of the app does not expire. The airtight version is the same
-- end state 0021 describes — Clerk as a Supabase third-party auth provider, or
-- a small server function holding the service key.
--
-- What IS enforced, in the policy below, without identity: an upload must land
-- at `{squadron}/{member}/{file}`, and that member must really be in that
-- squadron. The bucket refuses anything over 25 MB and any type not listed.

-- ===================================================================== table
create table if not exists message_attachments (
  id            uuid        primary key default gen_random_uuid(),
  message_id    uuid        not null references comms_messages (id) on delete cascade,
  kind          text        not null check (kind in ('image', 'file', 'passage')),

  -- image and file
  storage_path  text,
  file_name     text,
  mime_type     text,
  byte_size     bigint,
  -- An image's pixel size, so the bubble reserves its space before the image
  -- arrives and the transcript does not jump as photos land.
  width         integer,
  height        integer,

  -- a passage lifted out of a Library paper
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
  -- R1 of the annotation layer holds here too. A passage is copied from a mark,
  -- and a mark's anchor is text. A position smuggled in would be a passage
  -- that cannot survive the paper being reflowed.
  constraint attachment_anchor_is_text_only check (
    anchor is null
    or not (anchor ? 'page' or anchor ? 'rect' or anchor ? 'rects' or anchor ? 'bbox')
  )
);

create index if not exists message_attachments_message on message_attachments (message_id);

alter table message_attachments enable row level security;

-- Read: as open as comms_messages, which is what the bubble is read from. The
-- room fetches attachments embedded in the message query, one round trip, and
-- that embed needs SELECT here.
drop policy if exists message_attachments_read on message_attachments;
create policy message_attachments_read on message_attachments for select using (true);

-- Write: never directly. Only add_message_attachments below.
revoke insert, update, delete on message_attachments from anon, authenticated;
grant select on message_attachments to anon, authenticated;

-- ================================================================ writing
-- Attach files and passages to a message you just sent. The rules, all of them
-- checked here rather than trusted from the page:
--   * the message exists, is not deleted, and was written by p_me;
--   * p_me is a member of the message's squadron;
--   * every file row points inside that squadron's folder under p_me's id, so a
--     message cannot claim an object somebody else uploaded;
--   * no more than ten at once.
-- A row that fails the folder check is skipped rather than failing the whole
-- call, so one bad path cannot cost the student the rest of what they sent.
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

-- ============================================================ the picker
-- "Your marks in this module", for the passage picker behind the attach button.
-- Only the caller's own marks, newest first, with the paper's title so a card
-- can say where the words came from. There is no page to return: a mark's
-- anchor is text by rule and its drawing hint is not stored, so the card names
-- the paper and quotes the words, and the reader finds them.
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

-- ================================================================ storage
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

-- Upload only into `{squadron}/{member}/{file}`, where that member is in that
-- squadron. No SELECT policy on purpose: nothing may list this bucket. No
-- UPDATE or DELETE policy either, so an object cannot be swapped or removed
-- from the browser once it has been sent.
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

-- ================================================================== proof
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
     and qual ilike '%chat-attachments%';
  if n <> 0 then raise exception '0026: something can list chat-attachments, and nothing should'; end if;

  if has_table_privilege('anon', 'message_attachments', 'INSERT') then
    raise exception '0026: anon can write message_attachments directly';
  end if;
end $$;
