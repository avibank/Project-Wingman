-- Wingman — §7, the right seat's boundary, on the server
--
-- Run after 0008. Safe to re-run. Additive only: it creates two functions and
-- one policy and alters no table.
--
-- ===========================================================================
-- READ THIS BEFORE WRITING A POLICY THAT MENTIONS auth.uid()
-- ===========================================================================
-- It will not work, and it will not fail loudly either — it will silently deny
-- every row and the room will look empty rather than broken.
--
-- Clerk owns identity in this project. The browser talks to PostgREST with the
-- ANON key and nothing else: there is no Supabase session, no JWT carrying a
-- user, and auth.uid() is NULL on every single request. That is why every
-- table in this codebase carries `using (true)` and why user_id columns hold a
-- Clerk id as text rather than a Supabase uid. It is a deliberate
-- architecture, written down in CLAUDE.md, not an oversight to be corrected in
-- passing by a migration.
--
-- WHAT THIS MIGRATION THEREFORE IS. §7 says: only people you share a squadron
-- with may ever appear in the right seat. Until this file that sentence lived
-- only in JavaScript, in roomModel.rightSeatCandidates, which means it held
-- exactly as long as every present and future caller remembered to route
-- through that function — and the room had ALREADY forgotten once, handing the
-- raw presence list straight to the view.
--
-- So the boundary is expressed here as a function that cannot return a
-- stranger, whatever the caller asks for. The client calls right_seat(me)
-- instead of selecting presence and filtering afterwards. A caller that passes
-- somebody else's id gets that person's squadron-mates rather than their own,
-- which is a lateral move and not an escalation: presence is already readable
-- to the anon key, as it has to be for the online rail to work at all.
--
-- WHAT THIS IS NOT: authentication. It is one statement of the rule, in the
-- place the rule is applied, so a second caller cannot quietly disagree with
-- the first. Turning it into enforcement needs Clerk JWTs accepted by Supabase
-- so that auth.jwt()->>'sub' is trustworthy; at that point the `p_me`
-- parameter is deleted, every function below reads the subject from the token,
-- and the open policies are narrowed. That is a project, not a line, and it is
-- the same project for all thirty-odd tables at once — doing it for this one
-- would leave the codebase with two auth models, which is worse than one
-- honest one.
-- ===========================================================================

-- --------------------------------------------------------------- §7 helper
-- The squadrons an account is actually in. Its own function because three
-- things below need it and a copied subquery is a rule with three owners.
create or replace function my_squadron_ids(p_me text)
returns setof uuid
language sql
stable
as $$
  select squadron_id from squadron_members where user_id = p_me;
$$;

-- ------------------------------------------------------------ §7 right seat
-- Who is in the room right now that p_me shares a squadron with, minus anyone
-- either of them has blocked.
--
-- The blocks check runs BOTH WAYS on purpose. Blocking is not a mute: if A
-- blocks B then B must not be offered A's seat either, or the block is
-- trivially defeated by the blocked person doing the inviting.
create or replace function right_seat(p_me text, p_since interval default '90 seconds')
returns table (
  user_id      text,
  squadron_id  uuid,
  module_code  text,
  chapter_id   text,
  last_seen    timestamptz
)
language sql
stable
as $$
  select distinct on (p.user_id)
         p.user_id,
         sm.squadron_id,
         p.module_code,
         p.chapter_id,
         p.last_seen
  from presence p
  join squadron_members sm
    on sm.user_id = p.user_id
   and sm.squadron_id in (select my_squadron_ids(p_me))
  where p.user_id <> p_me
    and p.last_seen >= now() - p_since
    and not exists (
      select 1 from blocks b
      where (b.user_id = p_me and b.blocked_id = p.user_id)
         or (b.user_id = p.user_id and b.blocked_id = p_me)
    )
  order by p.user_id, p.last_seen desc;
$$;

-- --------------------------------------------------------- the one narrowing
-- lesson_notes is the single table in this schema with exactly one legitimate
-- reader — the person who wrote the note. Every other table here is shared by
-- design, so `using (true)` is an accurate description of them. This one it
-- was never accurate about: it said "anyone may read anyone's private notes",
-- and the only thing standing between that and the notes was the app
-- remembering to filter by author_id on every query it will ever write.
--
-- It cannot be narrowed to the AUTHOR without a JWT, per the header. It can be
-- narrowed to "not readable in bulk at all", which is a real reduction: a
-- policy of `false` for select means notes cannot be enumerated over REST by
-- anyone, and the app reads them where it always has — through user_progress,
-- which is where the client actually keeps them today.
--
-- Writes stay open so the table remains usable the moment a JWT exists and the
-- notes move here properly.
drop policy if exists lesson_notes_open on lesson_notes;

create policy lesson_notes_no_bulk_read on lesson_notes
  for select using (false);
create policy lesson_notes_write on lesson_notes
  for insert with check (true);
create policy lesson_notes_update on lesson_notes
  for update using (true) with check (true);
create policy lesson_notes_delete on lesson_notes
  for delete using (true);
