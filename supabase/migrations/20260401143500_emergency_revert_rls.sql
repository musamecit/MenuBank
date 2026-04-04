-- EMERGENCY REVERT: Disabling RLS to restore application data flow.
-- This reverts the hardening applied in 20260403180000.

ALTER TABLE public.menu_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocked_domains') THEN
    ALTER TABLE public.blocked_domains DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_menu_misuse_events') THEN
    ALTER TABLE public.user_menu_misuse_events DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_entries DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curated_lists') THEN
    ALTER TABLE public.curated_lists DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curated_list_restaurants') THEN
    ALTER TABLE public.curated_list_restaurants DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_favorites',
    'user_follows',
    'restaurant_price_votes',
    'restaurant_claims',
    'restaurant_view_count',
    'user_lists',
    'user_list_items',
    'user_active_dates',
    'user_behavior_stats',
    'user_push_tokens',
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
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
