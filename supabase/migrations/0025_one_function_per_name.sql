-- 0025 — two superseded overloads that 0023 left standing.
--
-- Run after 0023 and 0024. Drops nothing but the two old signatures named
-- below, each of which has a wider replacement already in place. Safe to
-- re-run.
--
-- WHAT BROKE, AND HOW IT WAS FOUND. 0023 widened paper_ink_add with three new
-- arguments — opacity, cap and variant — all defaulted, on the stated grounds
-- that "a client that has not been updated keeps working against it". That is
-- true of a function whose old signature is gone, and false of one whose old
-- signature is still there: PostgREST matched the deployed client's call
-- against both and refused to choose.
--
--   300  Could not choose the best candidate function between
--        public.paper_ink_add(uid, p_paper, p_module, p_page, p_points, …)
--
-- Every pen and highlighter stroke on the live site goes through that call, so
-- drawing stopped working the moment 0023 ran, for everyone, with no error the
-- student could see — the stroke stays on the page and never lands, which is
-- precisely the failure the outbox exists to catch and report.
--
-- Caught by asking the database what the DEPLOYED client asks it, rather than
-- what the new branch does. 0024 fixed the same fault in paper_mark_edit; this
-- is the one that came before it in the same migration and was missed.
--
-- THE RULE: widening a function's arguments means dropping the old signature
-- in the same migration. 0023 did exactly that for agree_with_mark(uuid) and
-- not for these two.

-- ------------------------------------------------------------ 1 · the ink
-- 0021's ten-argument version. 0023's takes the same ten plus opacity, cap and
-- variant, all defaulted, so every existing call site still resolves — once
-- there is only one of them.
drop function if exists paper_ink_add(text, text, text, int, jsonb, text, text, real, text, uuid);

-- ---------------------------------------------------- 2 · orphan marking
-- 0014's two-argument version takes no uid and checks nothing: anybody holding
-- the anon key could mark anybody's mark orphaned. 0023 replaced it with
-- paper_annotation_status(uid, p_id, p_status), which writes only where
-- author_id = uid. The arities differ, so this one was not ambiguous — it was
-- simply an unauthenticated door left open beside the locked one.
drop function if exists paper_annotation_status(uuid, text);

-- ---------------------------------------------------------------- 3 · proof
-- Run at migration time rather than trusted. Both names must resolve to
-- exactly one function, and paper_ink_add must still accept the shorter call
-- the deployed client makes.
do $$
declare n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_ink_add';
  if n <> 1 then raise exception '0025: paper_ink_add still has % signatures', n; end if;

  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_annotation_status';
  if n <> 1 then raise exception '0025: paper_annotation_status still has % signatures', n; end if;

  select count(*) into n from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'paper_mark_edit';
  if n <> 1 then raise exception '0025: paper_mark_edit still has % signatures', n; end if;
end $$;

-- And the call the shipped bundle actually makes, end to end: ten arguments,
-- no opacity, no cap, no variant. It has to land.
do $$
declare r paper_ink%rowtype;
begin
  select * into r from paper_ink_add(
    'mig0025_probe', 'mig0025_probe_paper', 'M1', 1,
    '[[0.1,0.1],[0.2,0.2]]'::jsonb, 'pen', 'blue', 0.0032, 'solo', null);
  if r.id is null then
    raise exception '0025: the ten-argument paper_ink_add did not return a row';
  end if;
  delete from paper_ink where id = r.id;
end $$;

grant execute on function paper_ink_add(text, text, text, integer, jsonb, text, text, real, text, real, text, smallint, uuid) to anon, authenticated;
grant execute on function paper_annotation_status(text, uuid, text) to anon, authenticated;
