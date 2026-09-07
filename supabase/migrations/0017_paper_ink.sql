-- 0017 — ink, colour, and the two marks the reader was missing.
--
-- Three things, and they are one change: this is what turns the annotation
-- layer into a reader people recognise.
--
--   1. paper_annotations.colour — the highlighter has a palette now. The NAME
--      is stored, never the colour, so what "blue" looks like stays a CSS
--      decision and can be re-tinted for the night theme without a migration
--      and without changing what anybody's existing mark means.
--
--   2. kind gains 'underline' and 'strikethrough'. Same anchor, same rings,
--      same everything — a different way of drawing the passage you picked.
--      They are text marks in every sense, so they go here rather than in the
--      ink table, and a reader who underlines still gets a mark that survives
--      the paper being re-extracted.
--
--   3. paper_ink — freehand strokes, and the ONE place in this feature where
--      coordinates are stored.
--
-- ---------------------------------------------------------------------------
-- WHY INK DOES NOT BREAK R1
--
-- R1 says an anchor is text, never coordinates, and 0014's anchor_is_text_only
-- CHECK refuses any anchor carrying a page, rect or bbox. That constraint is
-- untouched here and stays exactly as strict, because ink never goes near an
-- anchor: a stroke is not a claim about a passage, it is a drawing, and there
-- is no sentence you could store instead that would let you draw it again.
--
-- The rule R1 exists to protect is "a mark about a passage must survive the
-- passage moving". A stroke makes no such claim, and this table says so in its
-- own shape: it has a page and it has points, it has no anchor at all, and it
-- carries the version it was drawn against so a bump can strand it honestly
-- rather than drawing it somewhere plausible.
--
-- Points are FRACTIONS of the unrotated page, 0..1, not pixels. A stroke drawn
-- at 80% on a phone is the same stroke at 250% on a laptop. Pixels would have
-- been the same class of silent bug as a positional anchor.

-- --------------------------------------------------------------- 1. colour
alter table paper_annotations add column if not exists colour text;

do $$ begin
  alter table paper_annotations add constraint colour_is_a_name check (
    colour is null or colour in
      ('yellow','green','blue','pink','orange','purple','red','graphite')
  );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------- 2. two more text marks
-- The kind CHECK is replaced rather than added to: a constraint cannot be
-- widened in place, and dropping it for the instant between is safe because
-- nothing can insert an invalid kind through the client in that window — the
-- kinds come from a constant list in paperMarks.js.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class t on t.oid = con.conrelid
     where t.relname = 'paper_annotations' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%highlight%'
  loop
    execute format('alter table paper_annotations drop constraint %I', c);
  end loop;
end $$;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question','correction'));

-- ------------------------------------------------------------------ 3. ink
create table if not exists paper_ink (
  id             uuid primary key default gen_random_uuid(),
  paper_id       text        not null,
  module_code    text        not null,
  paper_version  int         not null default 1,
  author_id      text        not null,
  page           int         not null check (page >= 1),
  -- 'pen' lays colour down solid; 'marker' lays it down translucent and
  -- multiplies, the way a highlighter does over words.
  tool           text        not null default 'pen' check (tool in ('pen','marker')),
  colour         text        not null default 'graphite' check (
    colour in ('yellow','green','blue','pink','orange','purple','red','graphite')),
  -- A fraction of the page WIDTH, so the nib is the same size at every zoom.
  width          real        not null default 0.0032 check (width > 0 and width < 0.2),
  ring           text        not null default 'solo' check (ring in ('solo','wingman','formation','module')),
  -- [[x,y], …] with every value 0..1 of the unrotated page.
  points         jsonb       not null,
  created_at     timestamptz not null default now(),

  -- A stroke with one point is a dot and is legitimate; a stroke with none is
  -- a bug that would otherwise sit in the table forever drawing nothing.
  constraint ink_has_points check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) >= 1)
  -- There is deliberately no anchor column and no CHECK pretending to guard
  -- one. Ink is coordinates and only coordinates; a stroke carrying a quote
  -- would be a mark claiming to survive a reflow it cannot survive, and the
  -- way to make that impossible is to give it nowhere to put one.
);

create index if not exists paper_ink_paper on paper_ink (paper_id, page);
create index if not exists paper_ink_author on paper_ink (author_id);

alter table paper_ink enable row level security;
drop policy if exists paper_ink_all on paper_ink;
create policy paper_ink_all on paper_ink for all using (true) with check (true);

-- Ink is read through a function for the same reason marks are: Fly solo is
-- symmetric, blocks cut both ways, and the ring decides. Doing that in the
-- client would mean a second opinion about what "formation" means, and 0014's
-- header says why there is exactly one.
create or replace function paper_ink_for(uid text, p_paper text)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, page int, tool text, colour text,
  width real, ring text, points jsonb, created_at timestamptz, mine boolean
)
language sql
stable
as $$
  with me as (
    select coalesce((select p.invisible from pilot_profiles p where p.user_id = uid), false) as solo
  )
  select k.id, k.paper_id, k.module_code, k.paper_version,
         k.author_id,
         case when k.author_id = uid then 'You'
              else coalesce(pp.callsign, pp.real_name, 'Someone') end,
         k.page, k.tool, k.colour, k.width, k.ring, k.points, k.created_at,
         (k.author_id = uid)
    from paper_ink k
    left join pilot_profiles pp on pp.user_id = k.author_id
   cross join me
   where k.paper_id = p_paper
     and (k.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = k.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = k.author_id)
            and not exists (select 1 from blocks b where b.user_id = k.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = k.author_id)
            and ring_covers(k.author_id, uid, k.ring, k.module_code)
          ))
   order by k.created_at;
$$;

-- ------------------------------------------------- marks, now with a colour
--
-- A NEW NAME RATHER THAN A REPLACEMENT, AND ON PURPOSE.
--
-- A function's return shape cannot be widened in place — Postgres refuses
-- CREATE OR REPLACE the moment the column list changes — so adding `colour`
-- to paper_annotations_for would mean dropping it first. This migration
-- expands instead of replacing: the new shape gets a new name, the old
-- function keeps answering for anything still calling it, and nothing is
-- dropped in the same breath as something is created.
--
-- That is the ordinary way to widen a live contract, and it costs one dead
-- function. `paper_marks_for` is also simply the right name: the screen calls
-- them marks, the rail tab says Marks, and the model lives in paperMarks.js.
-- `paper_annotations_for` was the only place in the feature still saying
-- annotations.
--
-- When it is convenient, and with nothing calling it:
--   drop function if exists paper_annotations_for(text, text, timestamptz);
create or replace function paper_marks_for(uid text, p_paper text, p_since timestamptz default null)
returns table (
  id uuid, paper_id text, module_code text, paper_version int,
  author_id text, author_name text, kind text, ring text, body text,
  colour text, thread_id text, resolved_at timestamptz, status text,
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
         a.kind, a.ring, a.body, a.colour, a.thread_id, a.resolved_at, a.status,
         a.anchor, a.hint, a.created_at, a.updated_at,
         (a.author_id = uid or ring_covers(a.author_id, uid, 'formation', a.module_code)) as close
    from paper_annotations a
    left join pilot_profiles pp on pp.user_id = a.author_id
   cross join me
   where a.paper_id = p_paper
     and (p_since is null or a.updated_at > p_since)
     and (a.author_id = uid
          or (
            not me.solo
            and not coalesce((select p.invisible from pilot_profiles p where p.user_id = a.author_id), false)
            and not exists (select 1 from blocks b where b.user_id = uid and b.blocked_id = a.author_id)
            and not exists (select 1 from blocks b where b.user_id = a.author_id and b.blocked_id = uid)
            and not exists (select 1 from mutes m where m.user_id = uid and m.muted_id = a.author_id)
            /* R9, unchanged from 0014 — the kind decides, not the ring. */
            and (case when a.kind = 'correction' then me.staff
                      else ring_covers(a.author_id, uid, a.ring, a.module_code) end)
          ))
   order by a.created_at;
$$;
