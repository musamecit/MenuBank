import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Bazı projelerde talep sahibi claimed_by, bazılarında user_id kolonunda. */
let cached: 'claimed_by' | 'user_id' | null = null;

export async function resolveRestaurantClaimClaimantColumn(
  admin: SupabaseClient,
): Promise<'claimed_by' | 'user_id'> {
  if (cached) return cached;
  const a = await admin.from('restaurant_claims').select('claimed_by').limit(1);
  if (!a.error) {
    cached = 'claimed_by';
    return cached;
  }
  const b = await admin.from('restaurant_claims').select('user_id').limit(1);
  if (!b.error) {
    cached = 'user_id';
    return cached;
  }
  console.warn('restaurant_claims: neither claimed_by nor user_id readable; using claimed_by', a.error?.message, b.error?.message);
  cached = 'claimed_by';
  return cached;
}

export function claimantIdFromRow(row: Record<string, unknown>, col: 'claimed_by' | 'user_id'): string {
  const v = row[col];
  return typeof v === 'string' ? v : '';
}
