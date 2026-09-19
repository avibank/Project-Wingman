-- 0031 — chat attachments have never uploaded, and this is why.
--
-- Run after 0030. Additive: one policy. Drops nothing. Safe to re-run.
--
-- ===========================================================================
-- AN UPLOAD NEEDS A SELECT POLICY, AND 0026 LEFT IT OUT ON PURPOSE
-- ===========================================================================
-- 0026 created the chat-attachments bucket with an INSERT policy and said, in
-- the margin: "No SELECT policy on purpose: nothing may list this bucket."
--
-- That reasoning is sound and the consequence was not foreseen. Supabase's
-- storage API uploads with `x-upsert: true`, which makes it LOOK FIRST to see
-- whether the object is already there. With no select policy that look is
-- refused, and the API reports the whole request as
--
--     403  new row violates row-level security policy
--
-- — an INSERT error for a SELECT that was denied. So every attachment upload
-- in the Ready Room has failed since 0026 shipped, with a message that points
-- at the wrong statement. Found on 2026-09-19 while building the licence
-- card's cover upload, which hit the identical wall on a brand new bucket.
--
-- ===========================================================================
-- WHAT THIS TRADES, STATED RATHER THAN GLOSSED
-- ===========================================================================
-- A select policy permits LISTING, and this one permits listing the bucket to
-- anybody holding the publishable key. It cannot be narrowed to the viewer:
-- `auth.uid()` is NULL on every request in this architecture (0009's header),
-- which is the same reason 0026's insert policy checks that the path names
-- SOMEBODY in that squadron rather than the person asking.
--
-- What it gives away is a list of paths in a bucket that is already public —
-- the objects themselves have always been readable by URL, and a squadron id
-- and a member id are both on screen wherever that squadron is. It is a real
-- reduction and it is the price of the feature working at all.
--
-- The narrower alternative is to stop using x-upsert for attachments, which
-- would need a client change and would make a retried upload fail instead.
-- Written down here so the choice is visible rather than inherited.

drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read on storage.objects
  for select to public
  using (bucket_id = 'chat-attachments');

do $$
declare n integer;
begin
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('chat_attachments_member_upload', 'chat_attachments_read');
  if n <> 2 then raise exception '0031: chat attachments still cannot upload (%)', n; end if;
end $$;
