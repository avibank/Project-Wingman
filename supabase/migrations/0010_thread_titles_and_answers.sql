-- Wingman — thread titles, best answers, and answer votes
--
-- Run after 0009. Safe to re-run. Additive only: three columns and one table.
-- Nothing existing changes shape, so a client that has not been updated keeps
-- working against these tables exactly as before.
--
-- WHY THESE THREE AND NOT MORE. The Ready Room rebuild turns a module's
-- discussion into a question feed: a list of titled questions, each with
-- answers, one of which the asker can mark as the one that worked. Those are
-- the only three facts the schema could not already hold.
--
-- ------------------------------------------------------------------- title
-- A thread created IN the Ready Room is a question and needs a title, because
-- a feed of untitled paragraphs cannot be scanned.
--
-- A thread MIRRORED from a lesson comment has no title and must not be given
-- one: adding a title field to the lesson comment box would put a form in
-- front of a casual remark, and casual commenting on a lesson has to stay
-- frictionless. Those rows keep title NULL and the client shows the comment's
-- first line instead, with a FROM LESSON tag that both explains the shorter
-- title and links back.
--
-- So the column is NULLABLE on purpose, and null means "this came from a
-- lesson". That is the same asymmetry 0008 already encodes with lesson_id and
-- t, and it is why there is no CHECK forcing a title: half these rows must
-- never have one.
alter table lesson_threads add column if not exists title text;

-- ------------------------------------------------------------- best answer
-- The asker's mark, not a vote count. "Which answer actually worked" is a
-- judgement only the person who asked can make, and it is one per thread,
-- which is why it lives here as a single column rather than as a flag on the
-- replies where two rows could both claim it.
--
-- ON DELETE SET NULL: deleting the chosen answer must not delete the question.
alter table lesson_threads
  add column if not exists best_reply_id text
  references lesson_replies (id) on delete set null;

-- ------------------------------------------------------------------- votes
-- One row per person per answer, so the primary key IS the "one vote each"
-- rule. A count column would need a second write to stay true and would drift;
-- this cannot.
--
-- No value column. post_votes carries value +1/-1 for the older social layer,
-- and this deliberately does not: an answer can be endorsed, not buried. A
-- downvote on somebody's attempt to help is the thing that stops people
-- answering.
create table if not exists lesson_reply_votes (
  reply_id   text        not null references lesson_replies (id) on delete cascade,
  user_id    text        not null,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
create index if not exists lesson_reply_votes_reply_idx on lesson_reply_votes (reply_id);

alter table lesson_reply_votes enable row level security;
-- Open, like every other table in this project: the client is anonymous from
-- Postgres' point of view and access control happens in the app. See 0009's
-- header before writing a policy that mentions auth.uid() here.
create policy lesson_reply_votes_open on lesson_reply_votes
  for all using (true) with check (true);
