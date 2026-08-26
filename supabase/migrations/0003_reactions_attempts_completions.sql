-- Wingman — reaction chips, question attempts, completion timing
--
-- Run after 0002. Safe to re-run.
--
-- Unlocks the three phase-3 items that were blocked on missing data:
--   * quick-reaction chips on thread posts
--   * "N pilots also missed this one" on quiz questions
--   * the wingman fist-bump, which needs completion *timing* per user

-- ------------------------------------------------------------ reaction chips
-- One row per user per post per kind, so a chip toggles rather than accumulates.
create table if not exists post_reactions (
  post_id    uuid        not null references discussion_posts (id) on delete cascade,
  user_id    text        not null,
  kind       text        not null check (kind in ('same', 'good_catch', 'confused')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index if not exists post_reactions_post_idx on post_reactions (post_id);

-- --------------------------------------------------------- question attempts
-- Per-question outcomes, which nothing recorded before: pw-quiz-scores only
-- ever held a per-chapter percentage. Needed for any cross-user question stat.
create table if not exists question_attempts (
  id          uuid        primary key default gen_random_uuid(),
  question_id text        not null,
  chapter_id  text        not null,
  user_id     text        not null,
  correct     boolean     not null,
  created_at  timestamptz not null default now()
);
create index if not exists question_attempts_q_idx on question_attempts (question_id);
create index if not exists question_attempts_user_idx on question_attempts (user_id, question_id);

-- ------------------------------------------------------- completion timing
-- pw-completed is a client-side set with no timestamps, so "you and your
-- wingman finished this within the hour" was not answerable until now.
create table if not exists chapter_completions (
  user_id      text        not null,
  chapter_id   text        not null,
  module_code  text        not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index if not exists chapter_completions_chapter_idx on chapter_completions (chapter_id, completed_at desc);

-- ------------------------------------------------------------------------ RLS
do $$
declare t text;
begin
  foreach t in array array['post_reactions','question_attempts','chapter_completions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

-- --------------------------------------------------------------- aggregates
-- Returned as counts only. The client calls this rather than reading
-- question_attempts, so rendering "N pilots also missed this" never requires
-- pulling anyone's individual answers to the browser.
create or replace function question_miss_stats(q_id text)
returns table (attempts bigint, missers bigint)
language sql
stable
as $$
  select
    count(distinct user_id)                                            as attempts,
    count(distinct user_id) filter (where correct = false)             as missers
  from question_attempts
  where question_id = q_id;
$$;

-- Chapters a wingman finished within the window, for the shared-completion bump.
create or replace function shared_completions(me text, them text, window_hours int default 24)
returns table (chapter_id text, mine timestamptz, theirs timestamptz)
language sql
stable
as $$
  select a.chapter_id, a.completed_at as mine, b.completed_at as theirs
  from chapter_completions a
  join chapter_completions b
    on b.chapter_id = a.chapter_id
   and b.user_id = them
  where a.user_id = me
    and abs(extract(epoch from (a.completed_at - b.completed_at))) < window_hours * 3600;
$$;
