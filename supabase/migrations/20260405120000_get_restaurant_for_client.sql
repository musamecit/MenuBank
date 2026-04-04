-- PostgREST: RETURNS json bazen istemcide string/dizi olarak gelir; SETOF + tek satır = her zaman JSON dizi [ {...} ].
-- Mobil detay ve menü listesi RLS yüzünden boş kalmasın.

DROP FUNCTION IF EXISTS public.get_restaurant_for_client(uuid);

CREATE OR REPLACE FUNCTION public.get_restaurant_for_client(p_id uuid)
RETURNS SETOF public.restaurants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.restaurants t
  WHERE t.id = p_id
    AND t.deleted_at IS NULL
    AND lower(trim(COALESCE(t.status::text, ''))) IS DISTINCT FROM 'disabled'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_for_client(uuid) TO anon, authenticated, service_role;

-- Onaylı menü satırları (RLS anon göremezse bile)
CREATE OR REPLACE FUNCTION public.get_menu_entries_for_client(p_restaurant_id uuid)
RETURNS SETOF public.menu_entries
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.menu_entries m
  WHERE m.restaurant_id = p_restaurant_id
    AND m.deleted_at IS NULL
    AND COALESCE(m.is_hidden, false) = false
    AND lower(trim(COALESCE(m.verification_status::text, ''))) = 'approved'
  ORDER BY m.submitted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_menu_entries_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_menu_entries_for_client(uuid) TO anon, authenticated, service_role;
