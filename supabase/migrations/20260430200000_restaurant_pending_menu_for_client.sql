-- Onay bekleyen menü var mı? (Detay ekranında "Henüz menü yok" yerine gösterim için)
CREATE OR REPLACE FUNCTION public.restaurant_has_pending_menu_for_client(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.menu_entries m
    WHERE m.restaurant_id = p_restaurant_id
      AND m.deleted_at IS NULL
      AND COALESCE(m.is_hidden, false) = false
      AND lower(trim(COALESCE(m.verification_status::text, ''))) = 'pending'
  );
$$;

REVOKE ALL ON FUNCTION public.restaurant_has_pending_menu_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_has_pending_menu_for_client(uuid) TO anon, authenticated, service_role;
