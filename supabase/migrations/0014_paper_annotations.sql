-- 0014 — the annotation layer on Library papers.
--
-- A layer OVER a paper. The paper is never edited by anyone but the author;
-- every highlight, note, question and correction is a separate record pointing
-- at a passage. Filtering by person, by type or by group is then just deciding
-- which records to draw, and nothing a reader does can damage the paper.
--
-- R1 — AN ANCHOR IS TEXT, NEVER COORDINATES. This is the rule the whole design
-- turns on, and it is enforced here rather than trusted: the CHECK below
-- refuses any anchor carrying page, rect, rects or bbox. Coordinates are a
-- drawing detail that changes with zoom, with rotation, with the renderer, and
-- with the paper becoming native content later. They go in `hint`, which is
-- explicitly disposable, and nothing may read `hint` for identity.
--
-- Written against the live schema, not assumed: the four rings all have real
-- tables already — wingmen, formation_members + formations, squadron_members
-- and enrollments — so ring visibility is a join, not a new concept.

create table if not exists paper_annotations (
  id             uuid primary key default gen_random_uuid(),
  paper_id       text        not null,
  module_code    text        not null,
  -- The version of the paper this mark was made against. Papers are a content
  -- fixture today, so every mark is made against version 1; when papers become
  -- native content that brief owns the bump, and a bump is what triggers the
  -- re-resolve that can orphan a mark.
  paper_version  int         not null default 1,
  -- Never null. There is no anonymous marking: every mark carries a licence, so
  -- there is always a name behind it.
  author_id      text        not null,
  kind           text        not null check (kind in ('highlight','note','question','correction')),
  ring           text        not null default 'module' check (ring in ('solo','wingman','formation','module')),
  -- Null for a bare highlight. R5: the cheapest mark is wordless, and density
  -- is built out of exactly these.
  body           text,
  -- Set for kind='question': the Ready Room thread this mirrors into (R10).
  thread_id      text,
  -- Corrections only: when the author accepted or dismissed it (R9).
  resolved_at    timestamptz,
  status         text        not null default 'ok' check (status in ('ok','orphaned')),
  anchor         jsonb       not null,
  -- Cached page and rects, for drawing only. Discarded on any version bump.
  hint           jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- R1, enforced rather than reviewed. A code path that tries to smuggle a
  -- position into the anchor fails at the database, where it cannot be argued
  -- with, instead of silently producing marks that cannot survive a reflow.
  constraint anchor_is_text_only check (
    not (anchor ? 'page' or anchor ? 'rect' or anchor ? 'rects' or anchor ? 'bbox')
  ),
  -- A question without its thread is a question nobody can answer.
  constraint question_has_thread check (kind <> 'question' or thread_id is not null)
);

create index if not exists paper_annotations_paper on paper_annotations (paper_id, status);
create index if not exists paper_annotations_author on paper_annotations (author_id);
create index if not exists paper_annotations_updated on paper_annotations (paper_id, updated_at desc);

alter table paper_annotations enable row level security;
-- Open, like every other table here: the client is anonymous from Postgres'
-- point of view and access control happens in the functions below and in the
-- app. See 0009's header before writing any policy that mentions auth.uid().
drop policy if exists paper_annotations_all on paper_annotations;
create policy paper_annotations_all on paper_annotations for all using (true) with check (true);

-- ---------------------------------------------------------------- the rings
--
-- Who can see a mark this person made. The rings nest: module contains
-- formation contains wingman contains solo. One function, so the paper view
-- cannot grow a second opinion about what "formation" means (R12).
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

-- ------------------------------------------------------------------- reading
--
-- R9 — corrections are invisible to other readers, and that is enforced HERE
-- rather than by hiding them in the client: a correction written by student A
-- is absent from student B's payload entirely, not merely undrawn.
--
-- R12 — Fly solo is symmetric and needs no second toggle on the paper. An
-- invisible reader sees only their own marks; an invisible author's marks
-- reach nobody.
-- `close` is R4's whole selector, decided here rather than in the client: true
-- for you, your wingman and your formation, false for everyone else on the
-- module. Individuals are drawn for the first group; the second becomes
-- density. Working it out in the browser would mean either a query per author
-- or a second opinion about what formation means.
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
     -- your own are always yours
     and (a.author_id = uid
          or (
            not me.solo
            -- an invisible author reaches nobody
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = a.author_id), false)
            -- blocks cut both ways
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

-- The author queue: every open correction on this module, for staff only.
-- Returns nothing at all for anybody else rather than raising — a queue you
-- cannot see should not tell you it exists.
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

-- R2 — a lost annotation is orphaned, never relocated and never deleted. The
-- re-resolve runs where the document text is (the reader), and this is the one
-- write it makes. Kept as a function so "mark orphaned" cannot drift into
-- "delete the row" at some call site.
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
