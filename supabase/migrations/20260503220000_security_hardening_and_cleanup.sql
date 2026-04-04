-- ==========================================================================
-- Security Hardening & Cleanup Migration
-- 2026-05-03 — Duplicate policy temizliği, yazma koruması, index iyileştirmeleri
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1) restaurants — duplicate SELECT policy temizliği
-- Üç farklı SELECT policy var (admin, active_only, select_public)
-- Tek tutarlı policy ile değiştir
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_restaurants_select ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_active_only ON public.restaurants;
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
        'active', 'disabled', 'pending_approval'
      )
    )
  );

-- Explicit write-deny: anon/authenticated doğrudan yazamaz (service_role Edge Functions kullanır)
DROP POLICY IF EXISTS restaurants_no_direct_write ON public.restaurants;
CREATE POLICY restaurants_no_direct_write ON public.restaurants
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS restaurants_no_direct_update ON public.restaurants;
CREATE POLICY restaurants_no_direct_update ON public.restaurants
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS restaurants_no_direct_delete ON public.restaurants;
CREATE POLICY restaurants_no_direct_delete ON public.restaurants
  FOR DELETE TO anon, authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 2) menu_entries — duplicate SELECT policy temizliği + yazma koruması
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_menu_entries_select ON public.menu_entries;
DROP POLICY IF EXISTS menu_entries_select_approved_only ON public.menu_entries;
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
        'approved', 'pending'
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

-- Explicit write-deny
DROP POLICY IF EXISTS menu_entries_no_direct_write ON public.menu_entries;
CREATE POLICY menu_entries_no_direct_write ON public.menu_entries
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS menu_entries_no_direct_update ON public.menu_entries;
CREATE POLICY menu_entries_no_direct_update ON public.menu_entries
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS menu_entries_no_direct_delete ON public.menu_entries;
CREATE POLICY menu_entries_no_direct_delete ON public.menu_entries
  FOR DELETE TO anon, authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 3) user_profiles — duplicate INSERT/UPDATE policy temizliği
-- Üç INSERT ve üç UPDATE policy var, birini bırak
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
-- user_profiles_insert_self kalacak (authenticated, WITH CHECK id = auth.uid())

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
-- user_profiles_update_self kalacak

-- Duplicate SELECT temizliği — user_profiles_select_own kaldır, select_self + creator kalacak
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

-- ---------------------------------------------------------------------------
-- 4) restaurant_claims — duplicate policy temizliği
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own claims" ON public.restaurant_claims;
DROP POLICY IF EXISTS "Users can view own claims" ON public.restaurant_claims;
DROP POLICY IF EXISTS restaurant_claims_user_insert ON public.restaurant_claims;
DROP POLICY IF EXISTS restaurant_claims_user_select ON public.restaurant_claims;
DROP POLICY IF EXISTS restaurant_claims_admin_select ON public.restaurant_claims;
DROP POLICY IF EXISTS restaurant_claims_admin_update ON public.restaurant_claims;
DROP POLICY IF EXISTS restaurant_claims_select ON public.restaurant_claims;

-- Tek tutarlı SELECT policy
CREATE POLICY restaurant_claims_select ON public.restaurant_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
    OR claimed_by = auth.uid()
  );

-- INSERT: sadece authenticated kendi adına
CREATE POLICY restaurant_claims_insert_own ON public.restaurant_claims
  FOR INSERT TO authenticated
  WITH CHECK (claimed_by = auth.uid());

-- UPDATE: sadece admin
CREATE POLICY restaurant_claims_update_admin ON public.restaurant_claims
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Tablolar "public" role — anon,authenticated ile değiştir
-- (RLS'de "public" kullanmak service_role'u da kapsar; anon,authenticated daha güvenli)
-- ---------------------------------------------------------------------------

-- admin_audit_log: sadece admin okusun
DROP POLICY IF EXISTS admin_audit_log_select_admins ON public.admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_admin_select ON public.admin_audit_log;
DO $$
BEGIN
  -- Varolan politikayı temizle ve yeniden oluştur
  EXECUTE 'CREATE POLICY admin_audit_log_select_admins ON public.admin_audit_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
      )
    )';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- blocked_domains: sadece admin okusun
DROP POLICY IF EXISTS blocked_domains_admin_all ON public.blocked_domains;
DROP POLICY IF EXISTS blocked_domains_admin_select ON public.blocked_domains;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='blocked_domains') THEN
    EXECUTE 'CREATE POLICY blocked_domains_admin_select ON public.blocked_domains
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
        )
      )';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Tablolar henüz korunmamış olanlar — RLS + policy ekle
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  deny_tables text[] := ARRAY[
    'country_currency',
    'price_config',
    'public_api_rate_limit',
    'restaurant_price_display',
    'restaurant_verified_badges',
    'schema_migrations',
    'user_activity_streak',
    'user_badges',
    'user_list_favorites'
  ];
BEGIN
  FOREACH t IN ARRAY deny_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Eğer daha önce policy yoksa ekle (SELECT izni)
      -- Bu tablolar genelde read-only referans tablolarıdır
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
          t || '_select_public', t
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Performance indexes (eksik olanlar)
-- ---------------------------------------------------------------------------

-- menu_entries: composite index for restaurant + status + hidden (admin paneli sorguları)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_entries_rest_status_visible
  ON public.menu_entries (restaurant_id, verification_status)
  WHERE deleted_at IS NULL AND COALESCE(is_hidden, false) = false;

-- restaurant_claims: claimed_by + status (kullanıcı kendi taleplerini hızla bulsun)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurant_claims_claimant_status
  ON public.restaurant_claims (claimed_by, status);

-- user_notifications: unread count hızlandırma
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_unread
  ON public.user_notifications (user_id)
  WHERE is_read = false;

-- user_profiles: admin lookup (tüm RLS policy'lerde kullanılıyor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_admin
  ON public.user_profiles (id)
  WHERE COALESCE(is_admin, false) = true;

-- restaurants: country_code filtresi
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_country_code
  ON public.restaurants (country_code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8) Partitioned app_events parent — RLS alignment
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='app_events_parent' AND rowsecurity=false) THEN
    ALTER TABLE public.app_events_parent ENABLE ROW LEVEL SECURITY;
    BEGIN
      CREATE POLICY internal_no_direct_client ON public.app_events_parent
        FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
