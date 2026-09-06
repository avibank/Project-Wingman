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

alter publication supabase_realtime add table lesson_threads;
alter publication supabase_realtime add table lesson_replies;
alter publication supabase_realtime add table comms_messages;

alter table lesson_threads  replica identity full;
alter table lesson_replies  replica identity full;
alter table comms_messages  replica identity full;
