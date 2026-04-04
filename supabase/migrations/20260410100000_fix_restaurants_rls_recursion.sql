-- user_profiles_select_restaurant_creator içindeki EXISTS (SELECT … restaurants)
-- restaurants_select_public ile birlikte sonsuz RLS özyinelemesine yol açıyordu (42P17).
-- Güvenli okuma: sadece varlık kontrolü, SECURITY DEFINER ile RLS atlanır.

CREATE OR REPLACE FUNCTION public.user_profile_has_visible_restaurant_as_creator(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.created_by = p_profile_id
      AND r.deleted_at IS NULL
      AND COALESCE(NULLIF(BTRIM(COALESCE(r.status::text, '')), ''), 'active') IN ('active', 'disabled')
  );
$$;

REVOKE ALL ON FUNCTION public.user_profile_has_visible_restaurant_as_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_profile_has_visible_restaurant_as_creator(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS user_profiles_select_restaurant_creator ON public.user_profiles;
CREATE POLICY user_profiles_select_restaurant_creator ON public.user_profiles
  FOR SELECT TO anon, authenticated
  USING (public.user_profile_has_visible_restaurant_as_creator(user_profiles.id));
