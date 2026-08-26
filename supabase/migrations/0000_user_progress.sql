-- Wingman — the progress table
--
-- Run before 0001. Safe to re-run.
--
-- This table predates the numbered migrations: it was created by hand, so the
-- live database has always had it and nothing here ever declared it. That left
-- the series unable to rebuild the database from scratch. 0004 defines
-- merge_progress as `language sql`, and Postgres parses a SQL-language body at
-- creation time, so a fresh run of 0001 → 0007 fails at 0004 with
--
--   relation "user_progress" does not exist
--
-- Numbered 0000 rather than renumbering the applied migrations, and guarded
-- throughout, so it is a no-op against the live database and correct against
-- an empty one. Deliberately excluded from ALL.sql and SETUP.sql: both bundles
-- take migrations 0005 and up, and both assume 0001-0004 are already applied.
--
-- user_id holds the Clerk id as text, never a Supabase auth uid. The primary
-- key on it is not decorative — merge_progress does `on conflict (user_id)`,
-- which requires a unique constraint on exactly that column.

create table if not exists user_progress (
  user_id    text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------ RLS
-- Enabled with an open policy, like every other table: the Supabase client is
-- anonymous from Postgres' point of view and access control happens in the app.
do $$
declare t text;
begin
  foreach t in array array['user_progress'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_open', t);
  end loop;
end $$;
