-- 0020 — the last of the tool table.
--
-- NOT RUN. 0018's header states the standing instruction and it still holds:
-- migrations are written, reviewed and left, and run by hand after checking.
-- `npm run sql -- supabase/migrations/0020_reader_tools.sql --yes` applies it.
--
-- Everything here is ADDITIVE. No column is dropped, no row is touched, every
-- existing stroke and mark keeps working, and the reader works without it —
-- three tools are simply less than they could be until it runs. Each section
-- says which tool and what it gains.
--
-- ---------------------------------------------------------------------------
-- 1. A TAPE MEASURE YOU CAN KEEP
--
-- paper_ink says what a stroke LOOKS like and cannot say what it IS: its tool
-- CHECK is ('pen','marker'), which is the two ways a nib lays colour down.
-- That is right for a nib and wrong for everything else the tool table has.
--
-- Today the reader works round it honestly rather than lying: a Shape is
-- stored as its own points, so a box comes back a box with nothing having to
-- say so, and Measure keeps nothing at all — it reads the page while you drag
-- and lets go, because a kept measurement would come back as a plain line with
-- its number gone, which is worse than a tape measure that does not pretend.
--
-- With this, a measurement is a stroke that knows it is one and can draw its
-- own length again; a shape can be re-edited rather than only redrawn; and a
-- text box could live here instead of as an anchored mark, if that ever turns
-- out to be the better home for it.

alter table paper_ink drop constraint if exists paper_ink_tool_check;
alter table paper_ink add constraint paper_ink_tool_check
  check (tool in ('pen','marker','shape','text','measure'));

-- Which figure a shape is, and which reading a measurement took. Null for a
-- freehand stroke, which has no variant and never will.
alter table paper_ink add column if not exists variant text;

-- ---------------------------------------------------------------------------
-- 2. THE OPACITY A STUDENT CHOSE
--
-- Every drawing tool has an opacity slider and none of them keeps it: the
-- value is applied to the live stroke and dropped on the way to the database,
-- so a marker drawn at 55% comes back at whatever the stylesheet says. The
-- slider has been a live-preview control since the tool bar was wired.
--
-- A fraction rather than a percentage, to match `width`, which is already a
-- fraction of the page.

alter table paper_ink add column if not exists opacity real not null default 1
  check (opacity > 0 and opacity <= 1);

-- ---------------------------------------------------------------------------
-- 3. LINK
--
-- The one tool in the table with no behaviour at all, and the only one whose
-- gap is a schema gap rather than a missing afternoon. A link is a passage
-- plus a target, the passage is an anchor like any other, and the target is
-- either a page in this paper or a URL — so it needs a kind and nothing else.
-- `body` already holds the target, the way a question's body holds the
-- question.
--
-- The kind CHECK is replaced rather than added to, because a constraint
-- cannot be widened in place. Dropping it for the instant between is safe for
-- the reason 0017's header gives: the kinds come from a constant list in the
-- client, so nothing can insert an invalid one in that window.

alter table paper_annotations drop constraint if exists paper_annotations_kind_check;
alter table paper_annotations add constraint paper_annotations_kind_check
  check (kind in ('highlight','underline','strikethrough','note','question',
                  'correction','shape','text','stamp','link'));

-- ---------------------------------------------------------------------------
-- WHAT DOES NOT CHANGE
--
-- R1 is untouched. `anchor_is_text_only` still refuses any anchor carrying a
-- page, a rect or a bbox, and paper_ink still has no anchor column to smuggle
-- a position into an annotation through. A link anchors to words like every
-- other mark; a measurement is coordinates like every other stroke; and the
-- line between the two tables is exactly where it was.
