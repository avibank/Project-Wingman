-- 0028 — one list of what each student saved: questions, study cards, videos
-- and pages.
--
-- Run after 0027. Additive: one table, one index, four policies. Drops nothing.
-- Safe to re-run.
--
-- ===========================================================================
-- WHY THIS IS NOT THE MIGRATION THAT CAME WITH THE DESIGN
-- ===========================================================================
-- The drop's SQL defaulted user_id to `auth.jwt() ->> 'sub'` and wrote four
-- policies comparing user_id against the same claim. That is the shape for a
-- Supabase client signed in through a Clerk JWT template. This client is not
-- one: src/lib/supabaseClient.js is a bare PostgrestClient sending the anon key
-- as its own bearer, so there is no token, `auth.jwt()` is NULL on every
-- request, and the role Postgres sees is `anon`.
--
-- As written, every insert would have failed the NOT NULL on user_id and every
-- select would have returned nothing — and 0009's header is about exactly this:
-- a policy referencing a NULL claim denies every row rather than failing, so
-- nothing on screen would have said why.
--
-- Its own brief anticipated it: "Mirror the comments auth pattern if it differs
-- from auth.jwt()->>'sub'". That pattern is 0000's `user_progress`, 0008's
-- `lesson_threads` and 0014's `paper_annotations`: user_id is the CLERK id as
-- text, passed by the app, RLS is on with open policies, and the scoping is
-- `.eq('user_id', …)` in the client. So that is what this does.
--
-- WHAT THAT COSTS, STATED RATHER THAN BURIED. The brief's R1 check — "with B's
-- token, a direct select on A's rows returns nothing" — cannot be true here,
-- for saves or for any other table in this database. Anyone holding the
-- publishable key can read the `saves` table. That is the architecture's
-- standing trade, not a new hole opened by this migration, and a bookmark list
-- is the least sensitive thing already inside it (notes, threads and progress
-- are all there). Changing it means a Clerk JWT template and an authenticated
-- client for all 65 call sites, which is a project, not a line. It is in
-- claude/backlog-bookmarks.md as one.
--
-- ===========================================================================
-- THE SHAPE
-- ===========================================================================
-- ref_id is text and holds a different id per kind — a question id for
-- question/card, a lesson id for video, a paper id for page — because those
-- three id spaces are text here and none of them is a uuid (paper ids read
-- `M1-B2-13D-…`). One column with a kind beside it beats four nullable ones.
--
-- A question saved from the quiz and the same question saved from its card set
-- are TWO rows and that is deliberate: one is practised as a quiz and the other
-- is flipped as a card, so `kind` is part of what identifies a save.
--
-- The unique constraint is what stops a double tap making two of anything. It
-- carries `page` because two pages of one paper are two different saves, and it
-- is NULLS NOT DISTINCT (PG15+; the project runs 17.6) so that the three kinds
-- with no page still collide with themselves rather than slipping past a NULL.
-- A lesson saved twice is one row whose second MOVES — which is why at_seconds
-- is outside the constraint.

create table if not exists public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                -- the Clerk id, passed by the app
  module_id   text not null,
  kind        text not null check (kind in ('question', 'card', 'video', 'page')),
  ref_id      text not null,                -- question id (question/card), lesson id (video), paper id (page)
  chapter     int,
  at_seconds  int check (at_seconds is null or at_seconds >= 0),
  page        int check (page is null or page >= 1),
  created_at  timestamptz not null default now(),

  constraint saves_one_per_thing unique nulls not distinct (user_id, kind, ref_id, page),
  constraint saves_video_has_second check (kind <> 'video' or at_seconds is not null),
  constraint saves_page_has_page    check ((kind = 'page') = (page is not null))
);

-- The one query the app makes: this student's saves, newest first. module_id is
-- in the index because every screen is filtered to one module.
create index if not exists saves_user_module_recent on public.saves (user_id, module_id, created_at desc);

alter table public.saves enable row level security;

-- Open, like every other table here, and for the reason in the header: the
-- client is anonymous from Postgres' point of view, so a policy that named a
-- user would deny every row. Scoping is `.eq('user_id', …)` in savesStore.js,
-- which is the only file that reads or writes this table.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_read') then
    create policy saves_read   on public.saves for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_write') then
    create policy saves_write  on public.saves for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_change') then
    create policy saves_change on public.saves for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'saves' and policyname = 'saves_remove') then
    create policy saves_remove on public.saves for delete using (true);
  end if;
end $$;

grant select, insert, update, delete on public.saves to anon, authenticated;
