-- Wingman — non-destructive progress writes
--
-- Run after 0003. Safe to re-run.
--
-- user_progress.data was written with a whole-object upsert. Because several
-- components each hold their own copy of that object, a write from one could
-- delete keys another had saved — completing a chapter and then changing any
-- setting silently discarded the completion.
--
-- jsonb || jsonb is a shallow merge with the right side winning per key, so a
-- caller can only ever overwrite the keys it actually set.

create or replace function merge_progress(uid text, patch jsonb)
returns jsonb
language sql
as $$
  insert into user_progress (user_id, data, updated_at)
  values (uid, patch, now())
  on conflict (user_id) do update
    set data = coalesce(user_progress.data, '{}'::jsonb) || excluded.data,
        updated_at = now()
  returning data;
$$;
