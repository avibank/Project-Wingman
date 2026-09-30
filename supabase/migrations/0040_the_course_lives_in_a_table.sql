-- =============================================================================
-- 0040 — THE COURSE LIVES IN A TABLE, AND ONLY AN EDITOR CAN CHANGE IT.
-- -----------------------------------------------------------------------------
-- The Studio (2026-09-30) let an admin write a chapter and hand back a file to
-- commit. The owner: "build it" — publish it for real. So the course document
-- gets a home the app can read at runtime, and the write side gets the one
-- thing the rest of this schema does not have: a gate.
--
-- WHY THIS TABLE IS DIFFERENT FROM EVERY OTHER TABLE HERE. 0009's header says
-- it plainly: `auth.uid()` is NULL on every request, the publishable key is
-- the bearer, and access control happens in the app — so every table is open
-- and the cost is stated. For student data that cost is a student's own rows.
-- For the COURSE it would be the syllabus: one person with the key in their
-- browser's network tab could empty every quiz for everybody. So:
--
--   · reads are open, because every visitor needs the course;
--   · there is NO insert, update or delete policy at all, which means RLS
--     refuses all three to anon and authenticated — not by choice of policy
--     but by absence of one;
--   · the only way in is `publish_course`, SECURITY DEFINER, which demands a
--     publishing key it never returns and only ever compares as a digest.
--
-- A KEY, NOT AN IDENTITY, and that is a deliberate limitation rather than an
-- oversight. There is no trusted identity to check: a uid passed as an
-- argument is a claim anybody can make, and every user id in this database is
-- readable with the publishable key (`saves`, `quiz_runs`). A shared secret
-- held by the people who publish is the strongest gate available without a
-- server of our own; the day there is one, this becomes a token check and the
-- table does not move. `course_editors` records who used it, so a publish is
-- never anonymous even though the key is shared.
--
-- NOTHING IS OVERWRITTEN. A publish inserts a version; the app reads the
-- newest. Rolling back is publishing an older document again, which is one
-- statement, and the history is the audit trail.
-- =============================================================================

create table if not exists course_docs (
  id           bigserial primary key,
  doc          jsonb       not null,
  note         text,
  published_by text,
  published_at timestamptz not null default now()
);

create index if not exists course_docs_newest on course_docs (published_at desc, id desc);

alter table course_docs enable row level security;

-- Reads, for everybody. This is the course.
drop policy if exists course_docs_read on course_docs;
create policy course_docs_read on course_docs for select using (true);

-- And deliberately no policy for insert, update or delete. RLS denies what no
-- policy allows, so the publishable key cannot write here at all.

-- The publishing key, as a digest. The plaintext is never stored and never
-- returned by anything in this file.
create table if not exists course_keys (
  id         smallint primary key default 1,
  digest     text        not null,
  set_at     timestamptz not null default now(),
  constraint course_keys_one_row check (id = 1)
);
alter table course_keys enable row level security;
-- No policies at all: the digest is not readable with the publishable key
-- either. Only SECURITY DEFINER functions, which run as the owner, see it.

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

-- ------------------------------------------------------------------ proof
do $$
declare n integer;
begin
  select count(*) into n from pg_policies where tablename = 'course_docs' and cmd <> 'SELECT';
  if n <> 0 then raise exception '0040: course_docs has % write policies; it must have none', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('publish_course', 'current_course', 'set_course_key');
  if n <> 3 then raise exception '0040: expected three functions, found %', n; end if;
end $$;
