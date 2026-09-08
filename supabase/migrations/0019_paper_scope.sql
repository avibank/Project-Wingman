-- 0019 — who a paper is for.
--
-- Adding a paper is open to everybody, and what differs is who else can see it:
--
--   solo       your own copy. Nobody else, ever.
--   formation  the people you fly with.
--   module     everybody studying this module — STAFF ONLY.
--
-- The last one is the whole reason this migration exists. A student adding
-- their own notes is a personal act and should need no permission; a student
-- putting a document in front of the entire cohort is a publishing act, and
-- one mislabelled or copyrighted file reaches everyone at once. So the first
-- two are open and the third is gated.
--
-- It is gated HERE, in the function, and not in the browser. A check in the UI
-- is a suggestion; `add_paper` refuses a module-wide paper from a non-staff
-- caller and returns the scope it actually used, so a client that asks for
-- more than it may have gets an honest answer rather than a silent success.

alter table papers add column if not exists visibility text not null default 'solo'
  check (visibility in ('solo','formation','module'));
alter table papers add column if not exists owner_id text;

-- Existing rows (there are none yet) belong to whoever uploaded them.
update papers set owner_id = uploaded_by where owner_id is null;

create index if not exists papers_visible on papers (module_code, visibility);

-- ---------------------------------------------------------------------------
-- Reading: the same ring rule the marks use, so there is one opinion in this
-- codebase about what "formation" means. 0014's ring_covers does the work.
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

-- ---------------------------------------------------------------------------
-- Writing: one statement that decides the scope rather than trusting the one
-- it was handed. Returns the row as stored, so the client can see what it got.
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
  -- Module-wide is a publishing act. Anybody may ASK for it; only staff get it.
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

-- Marking one ready, or failed, and only by the person who owns it.
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
