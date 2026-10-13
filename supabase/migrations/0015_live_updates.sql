-- 0015 — live updates.
--
-- The discussion was read once per module entry, then on a 20 second timer.
-- Twenty seconds is not "live" to anyone standing next to the person who just
-- typed: they look, nothing is there, and they refresh. So the client listens
-- now, and the timer becomes a safety net rather than the mechanism.
--
-- Supabase Realtime only sends changes for tables in this publication, and it
-- was empty. Three tables, and only three: the two halves of the discussion and
-- the squadron chat. Presence is deliberately NOT here — it is a heartbeat with
-- a three minute window, and streaming every beat to every reader would be a
-- lot of traffic to say nothing has changed.
--
-- REPLICA IDENTITY FULL is what makes a DELETE carry the row that was deleted.
-- Without it a delete arrives as a bare primary key, and a client that cannot
-- tell which module a deleted thread belonged to has to refetch all of them.

-- ADDING A TABLE TO A PUBLICATION TWICE IS AN ERROR, not a no-op, so each one
-- is guarded. This is the THIRD thing that stopped Supabase's preview CI from
-- replaying the series, found the same way as the other two — by fixing the
-- one in front of it and reading how much further the run got:
--
--   ERROR: relation "lesson_threads" is already member of publication
--          "supabase_realtime" (SQLSTATE 42710)
--
-- `duplicate_object` is the condition that covers it, which is the same idiom
-- 0022 and 0027 already use for a policy. `check:migrations` holds it.
do $$ begin
  alter publication supabase_realtime add table lesson_threads;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table lesson_replies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table comms_messages;
exception when duplicate_object then null; end $$;

alter table lesson_threads  replica identity full;
alter table lesson_replies  replica identity full;
alter table comms_messages  replica identity full;
