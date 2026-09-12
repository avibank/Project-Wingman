-- 0024 — paper_mark_edit gets back the three fields 0023 dropped.
--
-- Run after 0023. Additive, safe to re-run, drops nothing.
--
-- WHAT HAPPENED. 0021 gave paper_mark_edit a whitelist of eight fields:
-- body, colour, ring, kind, style, hint, anonymous and resolved_at. 0023
-- rewrote the function to add optimistic-concurrency checking — given a
-- version, the write applies only if the row is still at it — and in doing so
-- rebuilt the SET list with five. `hint`, `anonymous` and `resolved_at` were
-- not removed on purpose; they were left out of a rewrite, and because the
-- function still returns a row for every other patch, nothing said so.
--
-- resolved_at is the one that matters. R9 of the annotation brief is that a
-- correction leaves the author's queue when the author resolves it, and
-- resolveCorrection() in src/lib/annotations.js is the call that does it. It
-- has no caller in the UI yet, which is exactly why this would have sat there:
-- the library function would have gone on returning a row and changing
-- nothing, and the first screen to wire it up would have been debugging the
-- client.
--
-- Caught by check:paper-db — "R9 · resolving it takes it off the queue" — which
-- drives the real function over the real REST path rather than reading it.
--
-- The version check 0023 added is kept exactly as it is.
--
-- AND ONE MORE, FOUND BY RUNNING IT: 0023's body does
-- `coalesce(p_patch->>'style', style)`, where style is jsonb and ->> is text.
-- That does not compile, and plpgsql does not check a body until it runs — so
-- 0023 installed cleanly and paper_mark_edit threw on every call, for every
-- patch, not only one naming style. Recolouring a mark, converting one,
-- writing a note on one and resolving a correction all went through it.

-- AND THERE WERE TWO OF THEM. 0021 created paper_mark_edit(text, uuid, jsonb).
-- 0023 created paper_mark_edit(text, uuid, jsonb, integer) with the fourth
-- argument defaulted, and did not drop the first — so both matched a
-- three-argument call and Postgres refused it as ambiguous:
--
--   function paper_mark_edit(unknown, uuid, jsonb) is not unique
--
-- Every edit the reader makes is a three-argument call. 0023 dropped the
-- superseded agree_with_mark(uuid) for exactly this reason and missed this
-- one. The old signature goes; the widened one below is the only one left.
drop function if exists paper_mark_edit(text, uuid, jsonb);

create or replace function paper_mark_edit(
  uid text, p_id uuid, p_patch jsonb, p_version integer default null
) returns paper_annotations language plpgsql security definer
set search_path = public, pg_temp as $$
declare r paper_annotations%rowtype; cur integer;
begin
  select version into cur from paper_annotations where id = p_id and author_id = uid;
  if cur is null then return null; end if;
  -- Given a version, the write applies only if the row is still at it. Given
  -- none, it behaves exactly as it did before, so an older client is not
  -- broken by this migration. Unchanged from 0023.
  if p_version is not null and p_version <> cur then return null; end if;
  update paper_annotations
     set colour     = coalesce(p_patch->>'colour', colour),
         kind       = coalesce(p_patch->>'kind', kind),
         ring       = coalesce(p_patch->>'ring', ring),
         body       = case when p_patch ? 'body' then p_patch->>'body' else body end,
         -- style is jsonb. 0023 read it with ->> , which is text, and
         -- `coalesce(text, jsonb)` does not compile — so this function threw
         -- "COALESCE types text and jsonb cannot be matched" on EVERY call,
         -- not only on a patch naming style. plpgsql does not check a body at
         -- creation time, so 0023 installed cleanly and failed at runtime.
         style      = case when p_patch ? 'style' then p_patch->'style' else style end,
         -- the three 0023 left out
         hint       = case when p_patch ? 'hint' then p_patch->'hint' else hint end,
         anonymous  = case when p_patch ? 'anonymous'
                           then (p_patch->>'anonymous')::boolean else anonymous end,
         resolved_at = case when p_patch ? 'resolved_at'
                            then nullif(p_patch->>'resolved_at', '')::timestamptz
                            else resolved_at end,
         version    = cur + 1,
         updated_at = now()
   where id = p_id and author_id = uid
  returning * into r;
  return r;
end $$;

grant execute on function paper_mark_edit(text, uuid, jsonb, integer) to anon, authenticated;

-- Proof, at migration time rather than trusted: a patch naming resolved_at has
-- to reach the column.
do $$
declare v_id uuid; v_out paper_annotations%rowtype;
begin
  insert into paper_annotations (paper_id, module_code, author_id, kind, ring, anchor)
  values ('mig0024_probe', 'M1', 'mig0024_probe', 'correction', 'module',
          '{"quote":"probe","prefix":"","suffix":""}'::jsonb)
  returning id into v_id;
  select * into v_out from paper_mark_edit('mig0024_probe', v_id,
    jsonb_build_object('resolved_at', now()::text));
  if v_out.resolved_at is null then
    delete from paper_annotations where id = v_id;
    raise exception '0024 did not take: resolved_at is still null after an edit that set it';
  end if;
  delete from paper_annotations where id = v_id;
end $$;
