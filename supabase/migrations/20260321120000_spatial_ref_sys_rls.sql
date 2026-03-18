-- spatial_ref_sys is owned by the PostGIS extension; ALTER TABLE fails for migration role (42501).
-- Apply RLS manually in Supabase Dashboard → SQL Editor (runs as postgres):
--   See docs/SUPABASE_SPATIAL_REF_SYS_RLS.md
--
-- This file is a no-op so db push succeeds; linter clears only after you run that SQL once.

SELECT 1;
