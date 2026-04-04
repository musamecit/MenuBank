-- After an ownership claim is rejected, user must go through the store purchase flow again
-- (client calls claim-store-ack) before a new claim can be submitted.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS claim_needs_store_reverify boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.claim_needs_store_reverify IS
  'When true, submit-restaurant-claim is blocked until claim-store-ack (after Store flow).';

UPDATE public.user_profiles up
SET claim_needs_store_reverify = true
WHERE EXISTS (
  SELECT 1
  FROM public.restaurant_claims rc
  WHERE rc.claimed_by = up.id
    AND rc.status = 'rejected'
);
