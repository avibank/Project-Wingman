-- Phase 4 — §9.3.4 question-as-atom · §9.4.2 squawk · §9.4.3 teams ·
-- §9.4.4 standing · §9.4.5 notifications · §11 verified tier
--
-- Idempotent, and safe to re-run. Requires 0005.

-- ------------------------------------------------- §9.3.4 the atom is a question
-- A chat log is worthless a week later: the answer to "why is B wrong" scrolls
-- away. Marking a message as a question, and a reply as answering it, is what
-- lets settled knowledge separate from chatter.
alter table comms_messages add column if not exists is_question  boolean not null default false;
alter table comms_messages add column if not exists answers_id   uuid references comms_messages (id) on delete set null;
alter table comms_messages add column if not exists resolved_at  timestamptz;
-- §11 — a visually distinct verified tier, from day one.
alter table comms_messages add column if not exists is_verified  boolean not null default false;
alter table comms_messages add column if not exists verified_by  text;

create index if not exists comms_questions_idx
  on comms_messages (chapter_id, created_at desc) where is_question;
create index if not exists comms_answers_idx
  on comms_messages (answers_id) where answers_id is not null;

-- ------------------------------------------------------------ §9.4.2 squawk
-- Real aviation semantics: 7600 is radio failure ("I've read this three times
-- and I don't get it"), 7700 is emergency ("checkride Thursday and I'm lost").
--
-- The code sits on the question itself. Putting it on a parallel `calls` row
-- would mean two places to look and one of them usually empty.
alter table comms_messages add column if not exists squawk text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comms_squawk_code') then
    alter table comms_messages add constraint comms_squawk_code
      check (squawk is null or squawk in ('7600', '7700')) not valid;
  end if;
end $$;

-- §9.4.3 — "either now or scheduled (tonight 20:00)". 0005 gave formations a
-- started_at; a scheduled one needs a start in the future.
alter table formations add column if not exists starts_at timestamptz;

-- ------------------------------------------------------------- §9.4.3 teams
-- Self-formed, 3-6 people, persistent, their own chat. The strongest retention
-- mechanic in the plan: people come back for their group, not for the app.
create table if not exists teams (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  module_code text,
  created_by  text        not null,
  created_at  timestamptz not null default now()
);

create table if not exists team_members (
  team_id   uuid        not null references teams (id) on delete cascade,
  user_id   text        not null,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on team_members (user_id);

-- Team chat reuses comms_messages, scoped by team.
alter table comms_messages add column if not exists team_id uuid references teams (id) on delete cascade;
create index if not exists comms_team_idx on comms_messages (team_id, created_at desc) where team_id is not null;

-- ------------------------------------------- §9.4.4 standing · §11 status ladder
-- Standing is earned by helping, never by grinding chapters. The ladder is the
-- moderation model, not a gamification nicety: CFI unlocks marking an
-- explanation verified.
alter table pilot_profiles add column if not exists status  text    not null default 'student';
alter table pilot_profiles add column if not exists helped  integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pilot_status_ladder') then
    alter table pilot_profiles add constraint pilot_status_ladder
      check (status in ('student', 'private', 'instrument', 'commercial', 'cfi')) not valid;
  end if;
end $$;

-- §9.4.5 — replies to you, your teams, and answers to your questions. Nothing
-- else, unless you opt in.
alter table pilot_profiles add column if not exists notify text not null default 'default';

-- ------------------------------------------------------ §10 per-module rollout
-- "Don't ship a social surface where it's empty. Turn it on per module once
-- there's content." A module with no social surface is fine; one with a visibly
-- abandoned surface is not.
create table if not exists module_social (
  module_code text primary key,
  enabled     boolean not null default false,
  enabled_at  timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'module_social'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

-- ------------------------------------------------------------- open squawks
-- §9.4 band 2: unanswered questions from every chapter, with context attached.
-- This is the room's purpose and the reason it is never empty.
create or replace view open_squawks as
select
  q.id,
  q.user_id,
  q.body,
  q.chapter_id,
  q.module_code,
  q.created_at,
  q.squawk,
  now() - q.created_at as waiting
from comms_messages q
where q.is_question
  and q.resolved_at is null
  and not exists (select 1 from comms_messages a where a.answers_id = q.id)
order by q.created_at;

-- Marking an answer bumps the helper's standing and resolves the question.
create or replace function mark_answer(answer_id uuid, question_id uuid, marker text)
returns boolean
language plpgsql
as $$
declare asker text; helper text;
begin
  select user_id into asker  from comms_messages where id = question_id and is_question;
  select user_id into helper from comms_messages where id = answer_id;
  if asker is null or helper is null then return false; end if;
  -- Only the person who asked decides what answered it.
  if marker is distinct from asker then return false; end if;

  update comms_messages set answers_id = question_id where id = answer_id;
  update comms_messages set resolved_at = now() where id = question_id;
  -- §9.4.4 — count helping, never grinding.
  if helper is distinct from asker then
    update pilot_profiles set helped = helped + 1 where user_id = helper;
  end if;
  return true;
end $$;
