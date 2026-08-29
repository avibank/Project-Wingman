-- Wingman — the lesson surface: notes, threads and replies
--
-- Run after 0007. Safe to re-run. Additive only: it creates three tables and
-- two functions and touches nothing that exists.
--
-- NOT YET RUN against the live project. The lesson surface ships reading and
-- writing through user_progress, which works and needs no migration but is
-- per account — so a thread written today is visible only to the person who
-- wrote it, and the module cannot actually answer anyone. This file is what
-- makes it real, and running it is a decision rather than a step.
--
-- THE ONE RULE THIS SCHEMA ENFORCES, because it cannot be enforced by
-- remembering it: a thread with a lesson carries the moment it is anchored to,
-- and a thread without one carries neither. That asymmetry is the whole reason
-- a module post can never appear under a video — there is nothing to attach it
-- to — and it is a CHECK constraint here rather than a convention in a comment.

-- ------------------------------------------------------------------- notes
-- Private, and never returned to anyone else. RLS is open like every other
-- table in this project (the client is anonymous from Postgres' point of view
-- and access control happens in the app), so the app must always filter by
-- author_id. There is no second reader of this table.
--
-- body may be EMPTY. A bare pin is a valid note and is the point of the
-- feature: the real cost of taking notes during a lesson is not typing speed,
-- it is that writing makes you miss the next thing.
create table if not exists lesson_notes (
  id         text        primary key,
  user_id    text        not null,
  lesson_id  text        not null,
  t          integer     not null check (t >= 0),
  body       text        not null default '',
  created_at timestamptz not null default now()
);
create index if not exists lesson_notes_user_idx on lesson_notes (user_id, lesson_id, t);

alter table lesson_notes enable row level security;
create policy lesson_notes_open on lesson_notes for all using (true) with check (true);

-- ----------------------------------------------------------------- threads
-- ONE TABLE, TWO QUERIES. The comment under the video and the thread in People
-- are the same row: the lesson asks what is on this lesson, People asks what is
-- in this module. Nothing copies, nothing syncs, nothing can drift.
--
-- Do not add a second table and a job that keeps them matching. That is the
-- version that ends up showing different reply counts in two places, and it is
-- the obvious implementation, which is why it is said here as well as in the
-- source.
create table if not exists lesson_threads (
  id         text        primary key,
  module_id  text        not null,
  lesson_id  text,                      -- null = a module post, People only
  t          integer,                   -- null iff lesson_id is null
  body       text        not null check (length(btrim(body)) > 0),
  author_id  text        not null,
  created_at timestamptz not null default now(),
  -- Anchored or not, never half. A row with a lesson and no moment would
  -- appear under a video with nowhere to sit on the bar; a row with a moment
  -- and no lesson would be a mark on a bar that belongs to no video.
  constraint lesson_threads_anchor_whole
    check ((lesson_id is null and t is null) or (lesson_id is not null and t is not null and t >= 0))
);
create index if not exists lesson_threads_module_idx on lesson_threads (module_id, created_at desc);
create index if not exists lesson_threads_lesson_idx on lesson_threads (module_id, lesson_id, t);

alter table lesson_threads enable row level security;
create policy lesson_threads_open on lesson_threads for all using (true) with check (true);

-- ----------------------------------------------------------------- replies
-- A reply belongs to the thread, never to a moment. It gets no timestamp of
-- its own and no mark on the bar — a good discussion would otherwise put
-- twelve marks on one spot and the bar would stop meaning anything.
--
-- Flat, not nested. parent_id is deliberately absent: a tree earns its keep at
-- ten thousand comments, not at forty, and adding it later is a column rather
-- than a migration of the rows.
create table if not exists lesson_replies (
  id         text        primary key,
  thread_id  text        not null references lesson_threads (id) on delete cascade,
  body       text        not null check (length(btrim(body)) > 0),
  author_id  text        not null,
  created_at timestamptz not null default now()
);
create index if not exists lesson_replies_thread_idx on lesson_replies (thread_id, created_at);

alter table lesson_replies enable row level security;
create policy lesson_replies_open on lesson_replies for all using (true) with check (true);

-- ------------------------------------------------------------- the two reads
-- Under the video: anchored threads on this lesson, in MOMENT order. Not
-- newest-first — ordering by moment is what makes scrolling the comment list
-- the same gesture as scrubbing the video, and it matches the bar above it.
create or replace function lesson_comments(p_module text, p_lesson text)
returns table (
  id text, module_id text, lesson_id text, t integer,
  body text, author_id text, created_at timestamptz, reply_count bigint
)
language sql
stable
as $$
  select th.id, th.module_id, th.lesson_id, th.t, th.body, th.author_id, th.created_at,
         count(r.id) as reply_count
  from lesson_threads th
  left join lesson_replies r on r.thread_id = th.id
  where th.module_id = p_module
    and th.lesson_id = p_lesson
  group by th.id
  order by th.t asc;
$$;

-- People: every thread in the module, with what a badge has to be measured
-- against. last_activity_by is the last thing that happened here that WASN'T
-- you, and it is null when the only activity is your own.
--
-- That second half is the one that is easy to miss. Measured against plain
-- last activity, a question you asked and nobody has answered badges itself —
-- you get a dot for your own post, forever, on every thread you start. That is
-- how People turns permanently red, which is the failure the module chat room
-- was rejected for.
create or replace function module_threads(p_module text, p_me text)
returns table (
  id text, lesson_id text, t integer, body text, author_id text,
  created_at timestamptz, reply_count bigint,
  in_it boolean, waiting boolean, last_activity_by timestamptz
)
language sql
stable
as $$
  select th.id, th.lesson_id, th.t, th.body, th.author_id, th.created_at,
         count(r.id)                                                     as reply_count,
         -- coalesce, because bool_or over an all-NULL set is NULL: a thread
         -- with no replies yields `th.author_id = p_me or NULL`, which is NULL
         -- rather than false for everyone else's unanswered questions.
         coalesce(bool_or(th.author_id = p_me or r.author_id = p_me), false) as in_it,
         count(r.id) = 0                                                  as waiting,
         -- greatest() ignores NULLs and returns NULL only when every argument
         -- is NULL, which is exactly the "the only activity here is yours"
         -- case the badge rule needs.
         greatest(
           case when th.author_id <> p_me then th.created_at end,
           max(r.created_at) filter (where r.author_id <> p_me)
         )                                                                as last_activity_by
  from lesson_threads th
  left join lesson_replies r on r.thread_id = th.id
  where th.module_id = p_module
  group by th.id
  -- In it, then waiting for an answer, then the rest. Newest-first is the
  -- wrong default here: the middle band is what turns eleven people into
  -- eleven people helping each other rather than everyone posting into silence.
  order by
    case when coalesce(bool_or(th.author_id = p_me or r.author_id = p_me), false) then 0
         when count(r.id) = 0 then 1
         else 2 end,
    greatest(th.created_at, coalesce(max(r.created_at), th.created_at)) desc;
$$;
