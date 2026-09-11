-- 0021 — the anon key stops being a skeleton key.
--
-- WHAT WAS WRONG, measured rather than reasoned about. The key compiled into
-- the public bundle at wingman.institute is, by design, not a secret: anybody
-- can read it out of /assets/index-*.js in one devtools tab. Every table then
-- answered it directly, because every table carries an open `using (true)`
-- policy. So this, from anywhere, with no login and no session:
--
--   curl "$URL/rest/v1/paper_annotations?select=*" -H "apikey: $ANON_KEY"
--
-- returned every row: the author's Clerk id in the clear, the full anchor with
-- the exact words they marked, and the body of every private note. The same
-- for paper_ink and for user_progress, which is every student's whole progress
-- blob. See docs/audit-pdf.md, P0-1.
--
-- WHAT THIS DOES. The three tables stop answering REST at all, and everything
-- the app needs from them moves behind SECURITY DEFINER functions that run as
-- the owner. Reads keep the ring rules they already had — 0018's
-- paper_marks_for already nulls the author of an anonymous mark, and that was
-- never the hole. Writes gain something they did not have: the author_id is
-- set by the function from its own uid argument rather than accepted from the
-- client, and every update and delete is scoped to `author_id = uid`, so one
-- account can no longer edit or destroy another's marks by id.
--
-- WHAT THIS DOES NOT DO, said plainly because a half-fix described as a whole
-- one is worse than no fix. The uid is still a parameter the caller chooses.
-- After this migration an attacker must know a specific classmate's Clerk id
-- and ask for one paper at a time, instead of dumping the cohort in a single
-- request — and the place those Clerk ids were being handed out is precisely
-- what closes here. That is a large reduction and it is not airtight. Airtight
-- needs the request to carry an identity Postgres can verify, which means
-- Clerk as a Supabase third-party auth provider and policies on
-- `auth.jwt()->>'sub'`. That is a dashboard change plus a client change; see
-- the note at the foot of this file. Until then, treat uid as asserted.
--
-- ORDER OF OPERATIONS. Run this BEFORE deploying the client that calls the new
-- functions, or after — either is safe. The client tries the RPC first and
-- falls back to the direct table write, so it works on both sides of this
-- migration; once the revoke below lands, the fallback can no longer succeed
-- and is dead code to be removed.
--
-- 0020 is independent of this file and still unrun. Nothing here needs it.

-- ---------------------------------------------------------------------------
-- 1. The readers keep working once the tables are shut.
--
-- ALTER rather than CREATE OR REPLACE on purpose: re-stating a function body
-- here would be a second copy of 0014's and 0018's rules, free to drift from
-- them. Changing only the security mode cannot drift.
--
-- search_path is pinned on every one of them. A SECURITY DEFINER function that
-- resolves its own table names through the caller's search_path is how a
-- definer function becomes a privilege ladder.

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

-- Dead but still standing, per CLAUDE.md. Left reachable so that dropping it
-- stays a separate decision from this one.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'paper_annotations_for') then
    execute 'alter function paper_annotations_for(text, text, timestamptz) security definer';
    execute 'alter function paper_annotations_for(text, text, timestamptz) set search_path = public, pg_temp';
  end if;
end $$;

-- 0018's agree counter writes to a table that is about to be shut.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'agree_with_mark') then
    execute 'alter function agree_with_mark(uuid) security definer';
    execute 'alter function agree_with_mark(uuid) set search_path = public, pg_temp';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Writing moves behind functions that know whose row it is.
--
-- The shape mirrors what the client already sends, so the call sites change
-- from .from().insert() to .rpc() and nothing else. The difference that
-- matters is not visible in the signature: author_id comes from uid, and the
-- client cannot set it to somebody else.

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

-- A patch rather than a column per call, because that is the shape the reader
-- already uses for restyling and for answering. The whitelist is here so that
-- "edit your mark" can never widen into "edit your author_id".
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

-- Plural because the eraser hits whatever it touches, and one round trip beats
-- six. Scoped to the caller's own strokes, so an eraser cannot reach across
-- accounts however the ids were come by.
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

-- user_progress is read on every mount by the progress provider and cleared
-- from the account screen. Both moved behind the same door as the rest.
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

-- ---------------------------------------------------------------------------
-- 3. The doors.
--
-- EXECUTE to the roles PostgREST actually uses, then the tables themselves are
-- taken away from both. A revoke rather than a `using (false)` policy on
-- purpose: a policy that filters everything out returns `[]`, which reads like
-- "there is no data". A revoke returns "permission denied for table", which
-- reads like what it is.

grant execute on function
  paper_mark_add(text, text, text, text, text, text, text, text, jsonb, jsonb, boolean, uuid),
  paper_mark_edit(text, uuid, jsonb),
  paper_mark_delete(text, uuid),
  paper_ink_add(text, text, text, int, jsonb, text, text, real, text, uuid),
  paper_ink_delete(text, uuid[]),
  progress_for(text),
  progress_clear(text)
to anon, authenticated;

-- The open policies go. They are not what grants access — the table privilege
-- is — but leaving a policy saying `using (true)` next to a revoked grant is
-- an invitation for the next person to re-grant and wonder why it is fine.
drop policy if exists paper_annotations_all  on paper_annotations;
drop policy if exists paper_annotations_open on paper_annotations;
drop policy if exists paper_ink_all          on paper_ink;
drop policy if exists paper_ink_open         on paper_ink;
drop policy if exists user_progress_open     on user_progress;

alter table paper_annotations enable row level security;
alter table paper_ink         enable row level security;
alter table user_progress     enable row level security;

-- No policy at all, with RLS on, denies everything to anyone who is not the
-- owner or a definer function. That is exactly the shape we want.

revoke all on table paper_annotations from anon, authenticated;
revoke all on table paper_ink         from anon, authenticated;
revoke all on table user_progress     from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Proof, run at migration time rather than trusted.
--
-- If any of the three still answers the anon role, this migration fails rather
-- than reporting success on a hole it did not close.
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

-- ---------------------------------------------------------------------------
-- WHAT IS LEFT, and it is the next piece of work rather than a footnote.
--
-- Every other table in this database is still open to the anon key, including
-- pilot_profiles, lesson_threads, lesson_replies and chapter_completions. This
-- migration closes the three the papers reader owns, which is the surface that
-- was audited; closing the rest means moving roughly thirty call sites behind
-- functions and re-verifying every screen, and doing it blind in one pass is
-- how a working app stops working.
--
-- And the real end state, for whoever picks this up:
--
--   1. Supabase dashboard -> Authentication -> Third-Party Auth -> add Clerk.
--   2. Clerk dashboard -> the session token gains a `role: "authenticated"`
--      claim.
--   3. src/lib/supabaseClient.js sends the Clerk session token as the bearer
--      instead of the anon key.
--   4. Then, and only then, `auth.jwt()->>'sub'` is a Clerk user id Postgres
--      can trust, every `uid text` argument above becomes redundant, and these
--      functions can be rewritten as RLS policies that cannot be lied to.
--
-- Do not do 3 before 1 and 2, or every data call in the app fails at once.
