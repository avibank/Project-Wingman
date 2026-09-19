-- 0030 — the licence card: what is on it that nothing else already stores.
--
-- Run after 0029. Additive: five columns on pilot_profiles, four CHECKs and
-- one read function. Drops nothing. Safe to re-run.
--
-- ===========================================================================
-- WHY THESE FIVE AND NOT MORE
-- ===========================================================================
-- §5 lists the card as cover, photo, callsign, full name, bio, phrase, stats
-- and stamp. Most of that is already somewhere and must not be copied here:
--
--   callsign, real_name    pilot_profiles, since 0005 and 0012
--   the stamp              pilot_profiles, since 0029
--   the photo              CLERK. It is the account's picture, the same one
--                          the app bar draws, and a second copy in Postgres
--                          would be a second answer to "what do they look
--                          like". Fly solo hides it in one place as a result.
--   hours flown            pw-hobbs, through merge_progress
--   lessons signed off     chapter_completions / the account's own progress
--   days flown             derived from those; nothing new is stored for it
--
-- What is left is the four things the card invented — a cover, its ink, an
-- optional uploaded image for it, and a phrase — plus the bio, which existed
-- as `pw-bio` in the account's private progress and therefore could not be
-- read by the person looking at the card. That is the bug this migration
-- fixes as much as it is a new feature: a bio nobody else can see is not a
-- bio, it is a note to self.
--
-- ===========================================================================
-- THE CHECKS MIRROR src/lib/cover.js, FOR 0029's REASON
-- ===========================================================================
-- The browser holds the anon key, so a rule the client enforces is not a rule.
-- A cover id this app cannot draw, or an ink outside the palette, would render
-- as a hole in one person's card and nowhere else. npm run check:licence holds
-- the two lists together.
--
-- The phrase is one of exactly three (§5). It is a CHECK and not a lookup
-- table because three is not a table, and because the constraint is then
-- visible in the same place as the others.

alter table pilot_profiles add column if not exists bio         text;
alter table pilot_profiles add column if not exists phrase      text;
alter table pilot_profiles add column if not exists cover       text;
alter table pilot_profiles add column if not exists cover_ink   text;
alter table pilot_profiles add column if not exists cover_image text;

-- ===========================================================================
-- THE THREE STATS, AND WHY THEY ARE COLUMNS HERE
-- ===========================================================================
-- §5: "three that everyone fills just by using the app: Hours flown · Lessons
-- signed off · Days flown. They come from real data."
--
-- The real data is the ACCOUNT'S OWN PROGRESS — pw-hobbs, pw-lesson-done and
-- pw-days, in user_progress, which is private and has exactly one reader. The
-- card is opened by other people, so the numbers have to be readable by other
-- people, and there is no query that can reach another pilot's progress.
--
-- So these three are a PROJECTION, written by their owner, exactly as
-- callsign and real_name already are: "Clerk is not queryable from Postgres,
-- and the callsign is what the whole social layer reads" (Profile.jsx). The
-- truth stays in user_progress; this is the copy other people are allowed to
-- see. A projection that drifts shows a stale number on somebody else's
-- screen, which is the worst this can do — it cannot make the owner's own
-- Flight Deck wrong, because that reads the truth.
--
-- Seconds, not a formatted string: how "13h 54m" is spelled is a decision for
-- the screen, and a different screen may spell it differently.
alter table pilot_profiles add column if not exists hours_s       integer not null default 0;
alter table pilot_profiles add column if not exists lessons_signed integer not null default 0;
alter table pilot_profiles add column if not exists days_flown     integer not null default 0;

do $$
begin
  -- The five drawn sets, plus 'image' for an uploaded one.
  if not exists (select 1 from pg_constraint where conname = 'cover_known') then
    alter table pilot_profiles add constraint cover_known
      check (cover is null or cover in ('contour','panels','runway','flight','chart','image'));
  end if;
  -- The same thirty-six names 0029 holds the stamp's ink to, and for the same
  -- reason: a name survives a re-tuned palette, a colour does not.
  if not exists (select 1 from pg_constraint where conname = 'cover_ink_known') then
    alter table pilot_profiles add constraint cover_ink_known
      check (cover_ink is null or cover_ink in (
        'Midnight','Lapiz','Miami','Baby','Powder','Glacier','Teal','Seafoam','Emerald','Racing','Sage','Matcha',
        'Olive','Khaki','Sand','Butter','Honey','Papaya','Clementine','Coral','Ruby','Cherry','Peach','Latte',
        'Mocha','Espresso','Nardo','Gunmetal','Chalk','Mauve','Blush','Bubblegum','Barbie','Lilac','Lavender','Plum'));
  end if;
  -- §5: "one line, max 80 characters". Enforced where it cannot be argued with.
  if not exists (select 1 from pg_constraint where conname = 'bio_one_line') then
    alter table pilot_profiles add constraint bio_one_line
      check (bio is null or (length(bio) <= 80 and bio !~ '[\n\r]'));
  end if;
  -- Exactly three, and they are these three.
  if not exists (select 1 from pg_constraint where conname = 'phrase_is_one_of_three') then
    alter table pilot_profiles add constraint phrase_is_one_of_three
      check (phrase is null or phrase in (
        'Torqued to spec. Emotionally too.',
        'It''s not a leak, it''s a seep.',
        'Could not duplicate.'));
  end if;
  -- An uploaded cover is a URL in the app's own public bucket, and nothing
  -- else. Without this the column is a place to park any string a client
  -- likes, and the card renders it into a background-image.
  -- Nothing negative, and nothing a typo could make absurd. A projection is
  -- still a number somebody else reads off a card.
  if not exists (select 1 from pg_constraint where conname = 'stats_are_sane') then
    alter table pilot_profiles add constraint stats_are_sane
      check (hours_s >= 0 and hours_s <= 100000000
         and lessons_signed >= 0 and lessons_signed <= 100000
         and days_flown >= 0 and days_flown <= 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cover_image_is_ours') then
    alter table pilot_profiles add constraint cover_image_is_ours
      check (cover_image is null or cover_image ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/');
  end if;
end $$;

-- ===========================================================================
-- READING SOMEBODY ELSE'S CARD
-- ===========================================================================
-- §5: "tapping any face or stamp anywhere opens this card for that person".
-- So the card is read for a user who is NOT the viewer, and what comes back
-- has to be exactly what a card draws and nothing more — this table also
-- carries notify settings, discoverability, an exam window and a timezone,
-- none of which is anybody else's business. A function rather than a select,
-- so the column list is the boundary and is written down once.
--
-- IT RESPECTS FLY SOLO. `invisible` is that switch (0005), and a pilot who has
-- it on is not on any card anybody opens: the function returns no row, and the
-- viewer's screen says nothing was found rather than drawing a blank card.
create or replace function licence_card(p_viewer text, p_user text)
returns table (
  user_id text, callsign text, real_name text, code text,
  bio text, phrase text, cover text, cover_ink text, cover_image text,
  is_staff boolean, hours_s integer, lessons_signed integer, days_flown integer,
  stamp_shape text, stamp_code text, stamp_rim boolean, stamp_ring text,
  stamp_pattern text, stamp_ink text, stamp_seed integer, stamp_issued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.callsign, p.real_name, p.code,
         p.bio, p.phrase, p.cover, p.cover_ink, p.cover_image,
         p.is_staff, p.hours_s, p.lessons_signed, p.days_flown,
         p.stamp_shape, p.stamp_code, p.stamp_rim, p.stamp_ring,
         p.stamp_pattern, p.stamp_ink, p.stamp_seed, p.stamp_issued_at
    from pilot_profiles p
   where p.user_id = p_user
     -- Your own card is always yours to see, Fly solo or not.
     and (p.user_id = p_viewer or p.invisible = false)
     -- And a block cuts both ways, as it does everywhere else (0006).
     -- The columns are user_id/blocked_id (0005), not blocker_id.
     and not exists (
       select 1 from blocks b
        where (b.user_id = p_viewer and b.blocked_id = p_user)
           or (b.user_id = p_user   and b.blocked_id = p_viewer))
$$;

-- ================================================================ storage
-- §5: "Image upload needs size and type limits, storage, and a crop that
-- fills 640x128." The crop is the browser's (src/lib/coverImage.js); this is
-- the other two, stated where they cannot be argued with.
--
-- PUBLIC, LIKE THE OTHER THREE. A licence card is opened by other people; a
-- signed URL for a picture that every viewer is allowed to see is a round
-- trip per view and an expiry to get wrong. The bucket is public and, like
-- chat-attachments, has NO select policy — it can be read by path and not
-- listed, so one person's cover cannot be used to enumerate everybody's.
--
-- 1MB and four types. What is uploaded is a 640x128 WEBP the browser rendered
-- — about 40KB — so a megabyte is already ten times the room it needs, and
-- anything larger did not come from this app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 1048576,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ONE OBJECT PER PILOT, AT THEIR OWN ID. `{user}/cover.webp` and nothing
-- else, so an upload cannot land under somebody else's folder and a second
-- cover replaces the first rather than filling the bucket. Update is allowed
-- for exactly that reason — the path is stable and the contents change.
-- Delete is not: there is no screen that removes a cover, only ones that
-- replace it.
drop policy if exists covers_upload on storage.objects;
create policy covers_upload on storage.objects
  for insert to public
  with check (
    bucket_id = 'covers'
    and array_length(storage.foldername(name), 1) = 1
    and name = (storage.foldername(name))[1] || '/cover.webp'
  );

-- AND IT NEEDS A SELECT POLICY TO BE ABLE TO INSERT AT ALL, which is not
-- obvious and cost an afternoon. An upload with `x-upsert: true` makes
-- storage-api LOOK FIRST to see whether the object is already there; with no
-- select policy that look returns nothing it is allowed to see, and the API
-- reports the whole request as "new row violates row-level security policy" —
-- an insert error for a select that was refused. 0026 left it out of
-- chat-attachments on purpose ("nothing may list this bucket") and that is
-- why chat attachments have never uploaded either; 0031 fixes that one.
--
-- Listing covers gives away nothing the bucket does not already give away:
-- it is public, the path is <user>/cover.webp, and a user id is on screen
-- wherever a person is.
drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects
  for select to public
  using (bucket_id = 'covers');

drop policy if exists covers_replace on storage.objects;
create policy covers_replace on storage.objects
  for update to public
  using (bucket_id = 'covers')
  with check (
    bucket_id = 'covers'
    and name = (storage.foldername(name))[1] || '/cover.webp'
  );

do $$
declare n integer;
begin
  select count(*) into n from storage.buckets where id = 'covers' and public;
  if n <> 1 then raise exception '0030: the covers bucket is missing or not public'; end if;
  -- All three, and the select one especially: without it nothing uploads.
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('covers_upload', 'covers_read', 'covers_replace');
  if n <> 3 then raise exception '0030: the covers policies are incomplete (%)', n; end if;
end $$;
