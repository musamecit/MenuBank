-- Security Hardening: Fix Supabase Linter Warnings

-- 1. rls_disabled_in_public for spatial_ref_sys
-- Enable RLS and grant read access to prevent unauthorized writes, satisfying the linter.
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to spatial_ref_sys" ON public.spatial_ref_sys;
CREATE POLICY "Allow read access to spatial_ref_sys" ON public.spatial_ref_sys FOR SELECT USING (true);


-- 2. function_search_path_mutable for SECURITY DEFINER functions
-- Set search_path to 'public' to prevent search path hijacking attacks.

ALTER FUNCTION public.update_restaurant_price_level() SET search_path = public;

ALTER FUNCTION public.create_restaurant_with_menu(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, UUID, TEXT, UUID
) SET search_path = public;

-- Note on extension_in_public (postgis):
-- Moving PostGIS to a different schema after it is already in use is highly destructive 
-- and can break existing columns/data. It is recommended to leave it in 'public' for now 
-- and safely ignore the warning, rather than risk data loss.
