-- =============================================================================
-- WIPE THE DEMO MATERIAL. Run once, by hand, before the beta opens.
-- -----------------------------------------------------------------------------
-- WHAT THIS IS FOR
--   The app shipped with placeholder course content and the accounts that
--   walked it left real rows behind — threads called "Test", a squadron called
--   "tester 1", chat messages, notes, quiz attempts against questions that no
--   longer exist, and progress pointing at chapters that have been removed.
--   Turning the content flag off hides the source; it does not remove what
--   people already wrote against it. This does.
--
-- WHAT IT DELETES
--   Every row of student- and class-generated content: threads and replies,
--   discussion posts, squadron chat and its attachments and receipts,
--   right-seat and copilot sessions, formations, teams, wingman pairings and
--   streaks, notes, saves, presence, quiz attempts, chapter completions and
--   the whole progress blob.
--
-- WHAT IT KEEPS, DELIBERATELY
--   · ACCOUNTS. Nothing here touches Clerk. Everyone can still sign in.
--   · pilot_profiles — callsign, licence, and above all the STAMP, which
--     0029 issues exactly once per account and cannot reissue. Deleting a
--     profile row would take a student's stamp away permanently. There is an
--     optional block at the bottom for the two or three obviously-fake test
--     accounts; read it before you run it.
--   · blocks and mutes. These are safety decisions people made. A wipe is
--     not a reason to un-block anybody.
--   · reports. A moderation record outlives the content it was about.
--   · user_prefs — livery, bar, appearance. Nobody's settings are demo data.
--   · EVERY PAPER AND EVERY MARK ON ONE. The reader is paused, not cancelled,
--     and the pause was explicitly "nothing is deleted". The papers block at
--     the bottom is commented out and should stay that way unless you have
--     decided otherwise.
--   · The schema. No table is dropped, no function, no policy, no migration
--     is undone. The app runs against this exactly as it does now.
--
-- HOW TO RUN IT
--   1. Supabase → SQL Editor. Paste STEP 1 alone and run it. It deletes
--      nothing; it prints what is there. Keep the output.
--   2. Take a backup (Database → Backups) if you have not got one today.
--   3. Paste STEP 2 and run it. It is one transaction: it either all happens
--      or none of it does.
--   4. Run STEP 1 again. Every line should read 0.
--
--   Missing tables are skipped rather than failing the run, so this is safe
--   on a project that has not had every migration applied.
--
-- AFTER IT HAS RUN
--   Testers who were signed in keep a copy of their old progress in the
--   browser until they reload. Ask them to reload once. Signed-in progress is
--   read from the server, so a reload is enough — there is nothing to clear
--   by hand.
-- =============================================================================


-- =============================================================================
-- STEP 1 — WHAT IS THERE. Deletes nothing. Run it before and after.
-- =============================================================================
do $$
declare
  t text;
  n bigint;
  tables text[] := array[
    'lesson_threads','lesson_replies','lesson_reply_votes','thread_votes',
    'discussion_threads','discussion_posts','post_votes','post_reactions',
    'module_social','lesson_notes','notebook_annotations','notebook_hides',
    'comms_messages','comms_reactions','comms_receipts','message_attachments',
    'squadrons','squadron_members','squadron_invites','squadron_join_requests',
    'copilot_sessions','copilot_participants','seat_messages','seat_requests',
    'calls','call_responses','call_nudges',
    'teams','team_members','formations','formation_members',
    'wingmen','wingman_streaks',
    'user_progress','chapter_completions','question_attempts','saves','presence',
    'rate_events',
    -- kept, but worth seeing the size of
    'pilot_profiles','user_prefs','blocks','mutes','reports',
    'papers','paper_annotations','paper_ink','paper_mark_agrees','paper_reading',
    'annotation_votes','annotation_flags','annotation_dismissals'
  ];
begin
  raise notice '%', rpad('table', 28) || 'rows';
  raise notice '%', repeat('-', 36);
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice '%', rpad(t, 28) || '(no such table)';
    else
      execute format('select count(*) from public.%I', t) into n;
      raise notice '%', rpad(t, 28) || n;
    end if;
  end loop;
end $$;


-- =============================================================================
-- STEP 2 — THE WIPE. One transaction.
-- -----------------------------------------------------------------------------
-- Order matters only where a foreign key has no cascade, so children go
-- before parents throughout. `delete` rather than `truncate`: truncate needs
-- ownership of every table in the cascade and takes an ACCESS EXCLUSIVE lock,
-- and these tables are small enough that the difference is not worth the
-- privileges.
-- =============================================================================
begin;

do $$
declare
  t text;
  n bigint;
  total bigint := 0;
  -- CHILDREN FIRST, top to bottom.
  doomed text[] := array[
    -- votes and reactions, which point at posts
    'lesson_reply_votes','thread_votes','post_votes','post_reactions','comms_reactions',
    -- receipts and attachments, which point at messages
    'comms_receipts','message_attachments',
    -- the posts themselves
    'lesson_replies','lesson_threads','discussion_posts','discussion_threads',
    'comms_messages','module_social',
    -- notes
    'notebook_hides','notebook_annotations','lesson_notes',
    -- live sessions and the invitations into them
    'call_nudges','call_responses','calls',
    'seat_messages','seat_requests','copilot_participants','copilot_sessions',
    -- groups: members before the group
    'squadron_join_requests','squadron_invites','squadron_members','squadrons',
    'formation_members','formations','team_members','teams',
    'wingman_streaks','wingmen',
    -- what a student did
    'question_attempts','chapter_completions','saves','presence','user_progress',
    -- housekeeping
    'rate_events'
  ];
begin
  foreach t in array doomed loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipped % (no such table)', t;
    else
      execute format('delete from public.%I', t);
      get diagnostics n = row_count;
      total := total + n;
      raise notice 'cleared % from %', n, t;
    end if;
  end loop;
  raise notice '---- % rows deleted ----', total;
end $$;

commit;


-- =============================================================================
-- OPTIONAL — THE FAKE ACCOUNTS.
-- -----------------------------------------------------------------------------
-- Only the obviously-fake profiles, and only if you want the rosters clean.
-- READ THIS FIRST:
--   · A profile row carries the account's STAMP, and 0029 issues a stamp once
--     and refuses to issue a second. Delete a real student's row and their
--     stamp is gone for good.
--   · This does not delete the Clerk account. That is done in the Clerk
--     dashboard, and doing it there is the right way round: delete the sign-in
--     and the profile row is orphaned rather than the other way about.
--   · Check the list before you run it. Run the select on its own first.
--
-- select user_id, callsign, real_name, is_staff from public.pilot_profiles
--  order by callsign;
--
-- delete from public.pilot_profiles
--  where callsign in ('cabbage', 'tester 1', 'Someone')      -- EDIT THIS LIST
--    and is_staff is not true;


-- =============================================================================
-- OPTIONAL — PAPERS AND EVERY MARK ON THEM. Left commented ON PURPOSE.
-- -----------------------------------------------------------------------------
-- The reader is paused, not cancelled, and the whole point of pausing rather
-- than deleting was that the marks survive. Running this throws away work that
-- cannot be recreated, including other people's. Do not run it to "tidy up".
--
-- If you have decided the reader starts from nothing when it comes back,
-- uncomment and run this on its own, after taking a backup.
--
-- begin;
-- delete from public.annotation_dismissals;
-- delete from public.annotation_flags;
-- delete from public.annotation_votes;
-- delete from public.paper_mark_agrees;
-- delete from public.paper_ink;
-- delete from public.paper_annotations;
-- delete from public.paper_reading;
-- delete from public.papers;
-- commit;
