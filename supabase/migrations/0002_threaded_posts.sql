-- Wingman — threaded replies and post voting
--
-- Run after 0001_social_layer.sql. Safe to re-run.
--
-- 0001 gave each thread a flat list of posts. Native comment threads need two
-- more things: a parent so replies can nest, and a score so the upvote control
-- has something real behind it.

alter table discussion_posts add column if not exists parent_id uuid references discussion_posts (id) on delete cascade;
alter table discussion_posts add column if not exists score integer not null default 0;
alter table discussion_posts add column if not exists is_admin boolean not null default false;

create index if not exists discussion_posts_parent_idx on discussion_posts (parent_id);

create table if not exists post_votes (
  post_id    uuid        not null references discussion_posts (id) on delete cascade,
  user_id    text        not null,
  value      smallint    not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_votes enable row level security;
drop policy if exists post_votes_open on post_votes;
create policy post_votes_open on post_votes for all using (true) with check (true);

-- Same denormalisation as annotation scores: sorting by Top must not need an
-- aggregate at read time.
create or replace function sync_post_score() returns trigger language plpgsql as $$
declare target uuid;
begin
  target := coalesce(new.post_id, old.post_id);
  update discussion_posts
     set score = coalesce((select sum(value) from post_votes where post_id = target), 0)
   where id = target;
  return null;
end $$;

drop trigger if exists post_votes_sync on post_votes;
create trigger post_votes_sync
after insert or update or delete on post_votes
for each row execute function sync_post_score();
