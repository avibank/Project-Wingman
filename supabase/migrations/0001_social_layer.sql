-- Project Wingman — social layer schema
--
-- Run against the Supabase project (SQL editor, or `supabase db push`).
--
-- Conventions carried over from the existing schema:
--   * user_id is the Clerk user id (text), never a Supabase auth uid. Clerk is
--     the sole identity source; there is no parallel user table here.
--   * RLS is enabled with open policies. The Supabase client is anonymous from
--     Postgres' point of view, so access control happens in the app layer, the
--     same as `comments` and `enrollments`.
--   * Author identity is snapshotted onto each row (username, real name and the
--     author's display preference) so a reader can render the correct name
--     without a join, matching how `comments.author` / `comments.real_name`
--     already work.

-- ---------------------------------------------------------------- preferences
create table if not exists user_prefs (
  user_id           text primary key,
  accent_color      text        not null default 'blue',
  identity_display  text        not null default 'real',   -- 'real' | 'username'
  course            text,                                   -- optional, self-reported, unverified
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------------- notebook
create table if not exists notebook_annotations (
  id                   uuid        primary key default gen_random_uuid(),
  chapter_id           text        not null,
  module_code          text        not null,
  user_id              text        not null,
  author_username      text,
  author_real_name     text,
  author_display_pref  text        not null default 'real',
  body                 text        not null,
  -- 'ok' until flagged; an admin resolves review to 'confirmed' or 'corrected'
  status               text        not null default 'ok',
  correction_note      text,
  score                integer     not null default 0,      -- denormalised vote sum, for sorting
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists notebook_annotations_chapter_idx on notebook_annotations (chapter_id, score desc);
create index if not exists notebook_annotations_status_idx  on notebook_annotations (status) where status = 'under_review';

create table if not exists annotation_votes (
  annotation_id uuid        not null references notebook_annotations (id) on delete cascade,
  user_id       text        not null,
  value         smallint    not null check (value in (-1, 1)),
  created_at    timestamptz not null default now(),
  primary key (annotation_id, user_id)
);

-- Flags are deliberately separate from downvotes and are never exposed to the
-- annotation's author — only to an admin review queue.
create table if not exists annotation_flags (
  id            uuid        primary key default gen_random_uuid(),
  annotation_id uuid        not null references notebook_annotations (id) on delete cascade,
  user_id       text        not null,
  reason        text,
  resolved      boolean     not null default false,
  created_at    timestamptz not null default now(),
  unique (annotation_id, user_id)
);

-- Per-user reading preferences. scope 'session' rows are cleared by the client
-- on app open; 'permanent' rows persist.
create table if not exists notebook_hides (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  chapter_id  text,                                          -- null = every chapter
  scope       text        not null default 'permanent',      -- 'permanent' | 'session'
  created_at  timestamptz not null default now(),
  unique (user_id, chapter_id)
);

create table if not exists annotation_dismissals (
  annotation_id uuid        not null references notebook_annotations (id) on delete cascade,
  user_id       text        not null,
  scope         text        not null default 'permanent',
  created_at    timestamptz not null default now(),
  primary key (annotation_id, user_id)
);

-- ----------------------------------------------------------------- discussion
create table if not exists discussion_threads (
  id                   uuid        primary key default gen_random_uuid(),
  chapter_id           text,                                 -- null = module-wide
  module_code          text        not null,
  user_id              text        not null,
  author_username      text,
  author_real_name     text,
  author_display_pref  text        not null default 'real',
  title                text        not null,
  body                 text,
  reply_count          integer     not null default 0,
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create index if not exists discussion_threads_chapter_idx on discussion_threads (chapter_id, last_activity_at desc);
create index if not exists discussion_threads_module_idx  on discussion_threads (module_code, last_activity_at desc);

create table if not exists discussion_posts (
  id                   uuid        primary key default gen_random_uuid(),
  thread_id            uuid        not null references discussion_threads (id) on delete cascade,
  user_id              text        not null,
  author_username      text,
  author_real_name     text,
  author_display_pref  text        not null default 'real',
  body                 text        not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists discussion_posts_thread_idx on discussion_posts (thread_id, created_at);

-- ------------------------------------------------------------------- presence
-- Heartbeat table rather than Realtime channels: one upsert per interval, and
-- "who is here" is a query for recent rows. No project-level Realtime config
-- required, and it survives a dropped socket.
create table if not exists presence (
  user_id       text        primary key,
  display_name  text,
  module_code   text,
  chapter_id    text,
  last_seen     timestamptz not null default now()
);
create index if not exists presence_chapter_idx on presence (chapter_id, last_seen desc);
create index if not exists presence_module_idx  on presence (module_code, last_seen desc);

-- -------------------------------------------------------------- study partners
-- A wingman marker is lightweight and non-directional: one row per direction,
-- and the pair is considered mutual when both rows exist.
create table if not exists wingmen (
  user_id         text        not null,
  wingman_user_id text        not null,
  display_name    text,
  created_at      timestamptz not null default now(),
  primary key (user_id, wingman_user_id),
  check (user_id <> wingman_user_id)
);

-- Joint streak for a wingman pair. user_a/user_b are stored sorted so a pair
-- has exactly one row regardless of who writes it.
create table if not exists wingman_streaks (
  user_a       text        not null,
  user_b       text        not null,
  current      integer     not null default 0,
  longest      integer     not null default 0,
  last_day     date,
  a_studied_on date,
  b_studied_on date,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- Live co-pilot sessions; the flight log is derived from these, never logged by hand.
create table if not exists copilot_sessions (
  id          uuid        primary key default gen_random_uuid(),
  module_code text        not null,
  chapter_id  text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists copilot_participants (
  session_id   uuid        not null references copilot_sessions (id) on delete cascade,
  user_id      text        not null,
  display_name text,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  primary key (session_id, user_id)
);
create index if not exists copilot_participants_user_idx on copilot_participants (user_id);

-- ------------------------------------------------------------------------ RLS
-- Open policies, matching the existing tables. Access control is enforced in
-- the app because Clerk — not Supabase — owns identity.
do $$
declare t text;
begin
  foreach t in array array[
    'user_prefs','notebook_annotations','annotation_votes','annotation_flags',
    'notebook_hides','annotation_dismissals','discussion_threads','discussion_posts',
    'presence','wingmen','wingman_streaks','copilot_sessions','copilot_participants'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

-- ------------------------------------------------------- vote score maintenance
-- Keeps notebook_annotations.score in step with annotation_votes so sorting and
-- the auto-collapse threshold never need an aggregate at read time.
create or replace function sync_annotation_score() returns trigger language plpgsql as $$
declare target uuid;
begin
  target := coalesce(new.annotation_id, old.annotation_id);
  update notebook_annotations
     set score = coalesce((select sum(value) from annotation_votes where annotation_id = target), 0)
   where id = target;
  return null;
end $$;

drop trigger if exists annotation_votes_sync on annotation_votes;
create trigger annotation_votes_sync
after insert or update or delete on annotation_votes
for each row execute function sync_annotation_score();

-- ------------------------------------------------------- reply count maintenance
create or replace function sync_thread_activity() returns trigger language plpgsql as $$
declare target uuid;
begin
  target := coalesce(new.thread_id, old.thread_id);
  update discussion_threads
     set reply_count      = coalesce((select count(*) from discussion_posts where thread_id = target), 0),
         last_activity_at = greatest(last_activity_at, coalesce(new.created_at, now()))
   where id = target;
  return null;
end $$;

drop trigger if exists discussion_posts_sync on discussion_posts;
create trigger discussion_posts_sync
after insert or delete on discussion_posts
for each row execute function sync_thread_activity();
