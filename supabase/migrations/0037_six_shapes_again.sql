-- =============================================================================
-- 0037 — SIX SHAPES, AGAIN.
-- -----------------------------------------------------------------------------
-- 0036 let the database take all eight of the engine's shapes. The same day
-- the owner took the shield and the hex out of the creator ("no hex bolt no
-- shield" — the hex reads as a bolt head), so the server goes back to
-- refusing both, as 0029 did: §4 asks for the shape to be validated on the
-- server as well as in the UI, and a shape the UI does not offer is one only
-- a hand-written request could send.
--
-- Checked against the live database before writing this: no row carries
-- either shape, so the narrower check validates cleanly. The engine still
-- draws both (src/lib/stamp-engine.js is the reference byte for byte).
-- =============================================================================

alter table pilot_profiles drop constraint if exists stamp_shape_known;
alter table pilot_profiles add constraint stamp_shape_known
  check (stamp_shape is null or stamp_shape in
    ('seal','roundel','window','gauge','postage','tag'));
