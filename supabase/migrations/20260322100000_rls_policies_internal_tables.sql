-- INFO: rls_enabled_no_policy — explicit policies (service_role still bypasses RLS for Edge Functions).
-- admin_audit_log: authenticated admins can SELECT (AdminScreen / web admin).

DROP POLICY IF EXISTS admin_audit_log_select_admins ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admins ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

-- Backend-only tables: block direct anon/authenticated API access (documents intent; service_role unchanged).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ai_budget',
    'ai_usage',
    'app_events',
    'blocked_devices',
    'feature_flags',
    'job_type_concurrency',
    'jobs_queue',
    'menu_entry_signals',
    'menu_price_snapshots',
    'menu_semantic_snapshots',
    'rate_limit_events',
    'restaurant_admins',
    'restaurant_anomalies',
    'restaurant_subscriptions',
    'semantic_item_search',
    'stripe_processed_events',
    'user_invite_codes',
    'user_referrals',
    'user_strikes'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS internal_no_direct_client ON public.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY internal_no_direct_client ON public.%I
       FOR ALL TO anon, authenticated
       USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
