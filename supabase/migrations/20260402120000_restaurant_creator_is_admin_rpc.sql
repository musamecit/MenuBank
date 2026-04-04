-- Mobil: admin tarafından oluşturulan işletmelerde "kullanıcıyı engelle" UI gizlensin (RLS ile profil okumadan).
CREATE OR REPLACE FUNCTION public.restaurant_creator_is_admin(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_admin
      FROM public.restaurants r
      LEFT JOIN public.user_profiles p ON p.id = r.created_by
      WHERE r.id = p_restaurant_id
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.restaurant_creator_is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_creator_is_admin(uuid) TO anon, authenticated;
