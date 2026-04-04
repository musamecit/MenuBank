-- Production hardening: enable Row Level Security on public tables and attach explicit policies.
-- service_role (Edge Functions) bypasses RLS; anon/authenticated are restricted.
-- Run after deploy: supabase db push / migration apply.

-- ---------------------------------------------------------------------------
-- 1) menu_reports — previously had no RLS (critical)
-- ---------------------------------------------------------------------------
ALTER TABLE public.menu_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_reports_insert_own ON public.menu_reports;
CREATE POLICY menu_reports_insert_own ON public.menu_reports
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS menu_reports_select_own ON public.menu_reports;
CREATE POLICY menu_reports_select_own ON public.menu_reports
  FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

-- ---------------------------------------------------------------------------
-- 2) admin_audit_log — policy existed in older migration; ensure RLS on
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_select_admins ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admins ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Admin-only reference tables (client was doing head count with user JWT)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocked_domains') THEN
    ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS blocked_domains_admin_all ON public.blocked_domains;
    CREATE POLICY blocked_domains_admin_all ON public.blocked_domains
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_menu_misuse_events') THEN
    ALTER TABLE public.user_menu_misuse_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_menu_misuse_events_admin_select ON public.user_menu_misuse_events;
    CREATE POLICY user_menu_misuse_events_admin_select ON public.user_menu_misuse_events
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Core app tables — restaurants
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- NOT: status NULL veya sadece pending_approval ise eski politika tüm satırları gizliyordu (uygulama boş kalırdı).
DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
CREATE POLICY restaurants_select_public ON public.restaurants
  FOR SELECT TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
      )
      OR COALESCE(NULLIF(BTRIM(COALESCE(status::text, '')), ''), 'active') IN (
        'active',
        'disabled',
        'pending_approval'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) menu_entries — visibility + user block filter (replaces open policy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.menu_entries ENABLE ROW LEVEL SECURITY;

-- NOT: is_hidden / verification_status NULL iken eski = false eşlemesi satırları düşürürdü.
DROP POLICY IF EXISTS menu_entries_select_public ON public.menu_entries;
CREATE POLICY menu_entries_select_public ON public.menu_entries
  FOR SELECT TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND COALESCE(is_hidden, false) = false
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
      )
      OR COALESCE(NULLIF(BTRIM(COALESCE(verification_status::text, '')), ''), 'approved') IN (
        'approved',
        'pending'
      )
    )
    AND (
      auth.uid() IS NULL
      OR submitted_by IS NULL
      OR submitted_by NOT IN (
        SELECT ub.blocked_id FROM public.user_blocks ub WHERE ub.blocker_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Curated lists (public read)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curated_lists') THEN
    ALTER TABLE public.curated_lists ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS curated_lists_select_public ON public.curated_lists;
    CREATE POLICY curated_lists_select_public ON public.curated_lists
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curated_list_restaurants') THEN
    ALTER TABLE public.curated_list_restaurants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS curated_list_restaurants_select_public ON public.curated_list_restaurants;
    CREATE POLICY curated_list_restaurants_select_public ON public.curated_list_restaurants
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) user_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_self ON public.user_profiles;
CREATE POLICY user_profiles_select_self ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Restoran detayında created_by için is_admin okuması (sadece işletme sahibi satırı)
DROP POLICY IF EXISTS user_profiles_select_restaurant_creator ON public.user_profiles;
CREATE POLICY user_profiles_select_restaurant_creator ON public.user_profiles
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.created_by = user_profiles.id
        AND r.deleted_at IS NULL
        AND r.status IN ('active', 'disabled')
    )
  );

DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS user_profiles_insert_self ON public.user_profiles;
CREATE POLICY user_profiles_insert_self ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8) Favorites, follows, price votes
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
    ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_favorites_own ON public.user_favorites;
    CREATE POLICY user_favorites_own ON public.user_favorites
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_follows') THEN
    ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_follows_own ON public.user_follows;
    CREATE POLICY user_follows_own ON public.user_follows
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_price_votes') THEN
    ALTER TABLE public.restaurant_price_votes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS restaurant_price_votes_select_public ON public.restaurant_price_votes;
    CREATE POLICY restaurant_price_votes_select_public ON public.restaurant_price_votes
      FOR SELECT TO anon, authenticated
      USING (true);
    DROP POLICY IF EXISTS restaurant_price_votes_insert_own ON public.restaurant_price_votes;
    CREATE POLICY restaurant_price_votes_insert_own ON public.restaurant_price_votes
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS restaurant_price_votes_update_own ON public.restaurant_price_votes;
    CREATE POLICY restaurant_price_votes_update_own ON public.restaurant_price_votes
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9) restaurant_claims — kullanıcı kendi taleplerini görsün; admin hepsini
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_claims') THEN
    ALTER TABLE public.restaurant_claims ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS restaurant_claims_select ON public.restaurant_claims;
    CREATE POLICY restaurant_claims_select ON public.restaurant_claims
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
        )
        OR claimed_by = auth.uid()
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10) restaurant_view_count — okuma (sahiplik paneli); yazma yalnızca service_role / RPC
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_view_count') THEN
    ALTER TABLE public.restaurant_view_count ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS restaurant_view_count_select_public ON public.restaurant_view_count;
    CREATE POLICY restaurant_view_count_select_public ON public.restaurant_view_count
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11) user_lists / user_list_items
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_lists') THEN
    ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_lists_own ON public.user_lists;
    CREATE POLICY user_lists_own ON public.user_lists
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_list_items') THEN
    ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_list_items_by_list_owner ON public.user_list_items;
    CREATE POLICY user_list_items_by_list_owner ON public.user_list_items
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_lists ul
          WHERE ul.id = user_list_items.list_id AND ul.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_lists ul
          WHERE ul.id = user_list_items.list_id AND ul.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 12) Analytics / davranış (mobil analytics.ts doğrudan yazar)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_active_dates') THEN
    ALTER TABLE public.user_active_dates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_active_dates_own ON public.user_active_dates;
    CREATE POLICY user_active_dates_own ON public.user_active_dates
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_behavior_stats') THEN
    ALTER TABLE public.user_behavior_stats ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_behavior_stats_own ON public.user_behavior_stats;
    CREATE POLICY user_behavior_stats_own ON public.user_behavior_stats
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 13) user_push_tokens
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_push_tokens') THEN
    ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_push_tokens_own ON public.user_push_tokens;
    CREATE POLICY user_push_tokens_own ON public.user_push_tokens
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 14) Backend-only tables: RLS açık + doğrudan client erişimi kapalı
--    (Politikalar önceden yoksa veya RLS kapalıysa Supabase uyarısı oluşur.)
-- ---------------------------------------------------------------------------
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
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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
    END IF;
  END LOOP;
END $$;

-- Kalan "RLS disabled" uyarıları için: Supabase Dashboard → Database → Advisors
-- veya public şemada tablo listesini kontrol edip bu dosyaya benzer ENABLE + policy ekleyin.
