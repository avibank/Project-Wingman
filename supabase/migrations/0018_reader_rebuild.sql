-- 0018 — the reader rebuild.
--
-- NOT RUN BY THE REBUILD. The instruction for that run was explicit: do not run
-- migrations against production; I will run them myself after I have checked.
-- So this is written, reviewed and left. `npm run reader:setup` applies it.
--
-- Everything here is ADDITIVE except one function replacement, called out below.
-- No column is dropped, no row is touched, and every existing mark keeps
-- working: the new columns all have defaults, and the old eight colour names
-- stay legal alongside the five new ones.
--
-- ---------------------------------------------------------------------------
-- 1. COLOURS ARE VERBS (brief §6)
--
-- Five meanings join the eight ink names. They are NOT a replacement: the eight
-- are what a nib is loaded with and carry no claim, the five are what a text
-- mark MEANS and each one does something — revision deck, glossary, question
-- bank, a thread, Master Caution. Both sets live in one column because a mark
-- has one colour; which set applies is decided by its kind.

alter table paper_annotations drop constraint if exists colour_is_a_name;
alter table paper_annotations add constraint colour_is_a_name check (
  colour is null or colour in (
    -- ink, from 0017 — free colour, no meaning
    'yellow','green','blue','pink','orange','purple','red','graphite',
    -- meanings, and the set is closed for text marks
    'critical','definition','limit','unsure','wrong'
  )
);

-- ---------------------------------------------------------------------------
-- 2. WHAT A MARK NEEDS THAT IT DID NOT HAVE (brief §5.1)

-- §6.2 — questions are anonymous by default. The author is STORED, because
-- moderation needs it, and stripped on the way out. See the function below:
-- the id is absent from another student's payload, not hidden in their browser.
alter table paper_annotations add column if not exists anonymous boolean not null default false;

-- §10 — "Agree" on somebody else's mark, with its count on the card.
alter table paper_annotations add column if not exists agree_count int not null default 0;

-- §5.1 — a soft delete, because sync needs the tombstone. A mark deleted on one
-- device must be able to tell another device it is gone; a row that simply
-- vanishes cannot say anything.
alter table paper_annotations add column if not exists deleted_at timestamptz;
create index if not exists paper_annotations_tomb on paper_annotations (paper_id, updated_at)
  where deleted_at is not null;

-- §5.1 — width and opacity, so a mark can be restyled rather than remade.
alter table paper_annotations add column if not exists style jsonb;

-- §5.1 — the remaining kinds. `ink` is deliberately absent: strokes live in
-- paper_ink, which has no anchor column, for the reason 0017's header gives.
alter table paper_annotations drop constraint if exists paper_annotations_kind_check;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question',
                  'correction','shape','text','stamp'));

-- ---------------------------------------------------------------------------
-- 3. THE ROUND TRIP (brief §14)
--
-- A thread made from a passage could reach the Ready Room but could not point
-- back: `lesson_threads` had no idea which paper or page it came from, so the
-- passage knew about the thread and the thread knew nothing about the passage.
-- "Two features sharing a table", in the brief's words.

alter table lesson_threads add column if not exists paper_id text;
alter table lesson_threads add column if not exists page int;
alter table lesson_threads add column if not exists anchor jsonb;
create index if not exists lesson_threads_paper on lesson_threads (paper_id) where paper_id is not null;

-- ---------------------------------------------------------------------------
-- 4. PAPERS BECOME ROWS (brief §17b)
--
-- Papers are a JSON fixture today, which is why there is no way to add one. A
-- real file uploaded by hand needs somewhere to be recorded, and the sidecars
-- the reader actually reads — manifest, text layer, thumbnails — need somewhere
-- to live beside it.

create table if not exists papers (
  id             text primary key,
  module_code    text not null,
  chapter_id     text,
  title          text not null,
  file_path      text not null,          -- inside the `papers` storage bucket
  pages          int,
  bytes          bigint,
  version        int not null default 1,
  -- 'pending' while the browser is still producing the sidecars. A paper in
  -- this state shows "Preparing…" in the Library rather than a broken viewer.
  status         text not null default 'pending'
                 check (status in ('pending','ready','failed')),
  -- What ingest found, recorded rather than guessed at: whether the file is
  -- linearized (which decides how well range loading works) and whether it has
  -- a text layer at all (which decides whether text marks are possible).
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

-- The bucket the files go in. Public read, because a paper is course material
-- and the app is already gated by Clerk in front of it; writes are the app's.
insert into storage.buckets (id, name, public, file_size_limit)
values ('papers', 'papers', true, 268435456)     -- 256MB, above the 200MB case
on conflict (id) do update set public = true, file_size_limit = 268435456;

drop policy if exists papers_read on storage.objects;
create policy papers_read on storage.objects for select using (bucket_id = 'papers');
drop policy if exists papers_write on storage.objects;
create policy papers_write on storage.objects for insert with check (bucket_id = 'papers');
drop policy if exists papers_update on storage.objects;
create policy papers_update on storage.objects for update using (bucket_id = 'papers');

-- ---------------------------------------------------------------------------
-- 5. THE READER'S QUERY, WIDENED
--
-- THE ONE REPLACEMENT IN THIS FILE. A function's return columns cannot be
-- widened in place, so carrying the new fields means a new shape. 0017 solved
-- the same problem by taking a new name and leaving the old function standing;
-- doing that twice would leave three. This one drops and recreates within a
-- single migration, which is safe because nothing runs between the two
-- statements — and `paper_annotations_for`, already dead since 0017, is
-- dropped at the same time.

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

-- Agreeing is a counter, not a row: one statement, no read-modify-write, so two
-- people agreeing in the same second both count.
create or replace function agree_with_mark(p_id uuid)
returns int
language sql
volatile
as $$
  update paper_annotations set agree_count = agree_count + 1, updated_at = now()
   where id = p_id returning agree_count;
$$;
