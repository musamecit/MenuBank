import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export async function adminSetRestaurantVenueCategory(restaurantId: string, categorySlug: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Oturum gerekli');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: 'set_restaurant_venue_category',
      restaurant_id: restaurantId,
      category_slug: categorySlug,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string; message?: string };
      msg = j.error ?? j.message ?? text;
    } catch {
      /* raw */
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
}
