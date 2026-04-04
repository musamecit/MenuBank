-- Edge function submit-report bu RPC'yi çağırır; yoksa try/catch ile yutulur, insert yine de çalışır.
-- Repoda tanımlı olsun diye no-op (her zaman izin ver) sürümü.
CREATE OR REPLACE FUNCTION public.check_menu_report_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true;
$$;

GRANT EXECUTE ON FUNCTION public.check_menu_report_rate_limit(uuid) TO service_role;
