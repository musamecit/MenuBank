-- App + Edge functions expect restaurant_claims.claimed_by (uuid, claimant).
-- Some databases were created with user_id instead.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurant_claims' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurant_claims' AND column_name = 'claimed_by'
  ) THEN
    ALTER TABLE public.restaurant_claims RENAME COLUMN user_id TO claimed_by;
  END IF;
END $$;

-- If neither name existed but claimant was stored as submitted_by (legacy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurant_claims' AND column_name = 'submitted_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurant_claims' AND column_name = 'claimed_by'
  ) THEN
    ALTER TABLE public.restaurant_claims RENAME COLUMN submitted_by TO claimed_by;
  END IF;
END $$;
