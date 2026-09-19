-- 0033 — the photo on a licence is this app's, not Clerk's.
--
-- Run after 0032. Additive: four columns and one bucket. Drops nothing.
-- Safe to re-run.
--
-- ===========================================================================
-- THE BUG THIS EXISTS FOR
-- ===========================================================================
-- The licence card read Clerk's `user.imageUrl`:
--
--     const photo = !flySolo && user?.imageUrl ? user.imageUrl : null;
--
-- `user.imageUrl` is NEVER null. With no photo set, Clerk serves a generated
-- default from img.clerk.com — a grey glyph with the account's initials baked
-- into it. So the falsy branch was unreachable, the app's own initials
-- component never rendered, and the colour somebody picked had nothing to
-- paint.
--
-- "Use your initials" made it worse: it called
-- `user.setProfileImage({ file: null })`, which throws — that is the error the
-- owner sees — and on the versions where it does not, Clerk simply goes back
-- to serving its default.
--
-- So the photo moves here. Clerk is the sign-in provider; it is not the avatar
-- store. `photo_url` null means initials, and that is a state this app can
-- actually reach.
--
-- ===========================================================================
-- WHY THE POSITION IS STORED AND THE CROP IS NOT
-- ===========================================================================
-- The cover is cropped on the way in (0030): what is uploaded is a 640x128
-- canvas, because a cover is a band and a photo is not that shape. An avatar
-- is a circle over a square, and keeping the square lets somebody re-centre it
-- later without re-uploading — which is what the reference's crop does, with a
-- zoom and a drag that it stores as three numbers rather than baking in.
--
-- photo_zoom is a percentage (100 = fit), photo_x/photo_y are percentages of
-- the frame, both clamped to the slack the zoom creates. The reference's own
-- limits: `lim = (z - 1) * 50`.

alter table pilot_profiles add column if not exists photo_url  text;
alter table pilot_profiles add column if not exists photo_zoom integer not null default 100;
alter table pilot_profiles add column if not exists photo_x    integer not null default 0;
alter table pilot_profiles add column if not exists photo_y    integer not null default 0;

do $$
begin
  -- The same rule 0030 puts on cover_image: a URL in this project's own public
  -- storage and nothing else. Without it the column is a place to park any
  -- string, and the card renders it into an <img src>.
  if not exists (select 1 from pg_constraint where conname = 'photo_url_is_ours') then
    alter table pilot_profiles add constraint photo_url_is_ours
      check (photo_url is null or photo_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/');
  end if;
  -- The reference's slider is 100 to 300 and its pan is +/- (z-1)*50, which at
  -- the maximum is +/- 100. Stored wider than the UI allows on purpose: a
  -- value the server refuses is a save that fails for a reason nobody can see.
  if not exists (select 1 from pg_constraint where conname = 'photo_frame_sane') then
    alter table pilot_profiles add constraint photo_frame_sane
      check (photo_zoom between 100 and 400
         and photo_x between -100 and 100
         and photo_y between -100 and 100);
  end if;
end $$;

-- ===========================================================================
-- AND NOTHING FROM img.clerk.com MAY BE STORED
-- ===========================================================================
-- Belt and braces for the guard in src/lib/avatar.js. If a Clerk URL ever
-- reached this column the bug would be back, silently, and it would look like
-- the app's own photo.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'photo_url_not_clerk') then
    alter table pilot_profiles add constraint photo_url_not_clerk
      check (photo_url is null or photo_url !~* 'clerk\.com');
  end if;
end $$;

-- ================================================================ storage
-- Its own bucket rather than a corner of `covers`: an avatar is square and a
-- cover is a 5:1 band, they are replaced independently, and a bucket named
-- `covers` holding avatars is the kind of thing that is true for a year and
-- then confusing for ever.
--
-- AND IT NEEDS A SELECT POLICY TO BE ABLE TO INSERT AT ALL — see 0031. An
-- upload with x-upsert makes storage-api look first; with no select policy
-- that look is refused and the API reports the whole request as an insert
-- violation. That cost an afternoon once already.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_upload on storage.objects;
create policy avatars_upload on storage.objects
  for insert to public
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and name = (storage.foldername(name))[1] || '/avatar.webp'
  );

drop policy if exists avatars_replace on storage.objects;
create policy avatars_replace on storage.objects
  for update to public
  using (bucket_id = 'avatars')
  with check (
    bucket_id = 'avatars'
    and name = (storage.foldername(name))[1] || '/avatar.webp'
  );

-- ===========================================================================
-- THE VIEWER'S READ CARRIES THE FACE
-- ===========================================================================
-- 0030's licence_card returns a fixed column list. A card without the photo is
-- a card that draws the wrong face for everybody but its owner, so the four
-- go on the end. Everything else about that function is unchanged, including
-- the Fly solo and block rules.
--
-- DROPPED AND RECREATED, because a function's return columns cannot be
-- widened in place — 0017 hit the same wall and took a new name for it. This
-- one is three days old and this repo owns its only caller, so it can simply
-- be replaced; the drop and the create are in one script and therefore one
-- transaction, so there is no moment when it is missing.
drop function if exists licence_card(text, text);
create or replace function licence_card(p_viewer text, p_user text)
returns table (
  user_id text, callsign text, real_name text, code text,
  bio text, phrase text, cover text, cover_ink text, cover_image text,
  is_staff boolean, hours_s integer, lessons_signed integer, days_flown integer,
  stamp_shape text, stamp_code text, stamp_rim boolean, stamp_ring text,
  stamp_pattern text, stamp_ink text, stamp_seed integer, stamp_issued_at timestamptz,
  photo_url text, photo_zoom integer, photo_x integer, photo_y integer
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
         p.stamp_pattern, p.stamp_ink, p.stamp_seed, p.stamp_issued_at,
         p.photo_url, p.photo_zoom, p.photo_x, p.photo_y
    from pilot_profiles p
   where p.user_id = p_user
     and (p.user_id = p_viewer or p.invisible = false)
     and not exists (
       select 1 from blocks b
        where (b.user_id = p_viewer and b.blocked_id = p_user)
           or (b.user_id = p_user   and b.blocked_id = p_viewer))
$$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
   where table_name = 'pilot_profiles'
     and column_name in ('photo_url', 'photo_zoom', 'photo_x', 'photo_y');
  if n <> 4 then raise exception '0033: the photo columns are missing (%)', n; end if;

  select count(*) into n from storage.buckets where id = 'avatars' and public;
  if n <> 1 then raise exception '0033: the avatars bucket is missing or not public'; end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('avatars_upload', 'avatars_read', 'avatars_replace');
  if n <> 3 then raise exception '0033: the avatars policies are incomplete (%)', n; end if;
end $$;
