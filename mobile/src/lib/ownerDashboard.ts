import { supabase } from './supabase';
import { SUPABASE_URL } from '../config/env';
import { getAuthHeaders } from './restaurants';

export interface OwnerDashboardData {
  restaurant: {
    id: string;
    name: string;
    city_name: string;
    area_name: string;
    image_url?: string | null;
    is_verified: boolean;
    contact_phone?: string | null;
    reservation_url?: string | null;
    formatted_address?: string;
  };
  menuCount: number;
  viewCount: number;
}

export async function fetchOwnerDashboard(restaurantId: string): Promise<OwnerDashboardData | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/restaurant-dashboard?restaurant_id=${restaurantId}`,
      { headers },
    );
    if (res.ok) return (await res.json()) as OwnerDashboardData;
  } catch {}
  return fetchDashboardDirect(restaurantId);
}

async function fetchDashboardDirect(restaurantId: string): Promise<OwnerDashboardData | null> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, city_name, area_name, image_url, is_verified, contact_phone, reservation_url, formatted_address')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant) return null;

  const { count: menuCount } = await supabase
    .from('menu_entries')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('verification_status', 'approved');

  const { data: vc } = await supabase
    .from('restaurant_view_count')
    .select('view_count')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  return {
    restaurant: restaurant as OwnerDashboardData['restaurant'],
    menuCount: menuCount ?? 0,
    viewCount: (vc as { view_count: number } | null)?.view_count ?? 0,
  };
}

export async function updateOwnerRestaurant(
  restaurantId: string,
  updates: { contact_phone?: string; reservation_url?: string; image_url?: string | null },
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/restaurant-dashboard`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ restaurant_id: restaurantId, ...updates }),
  });
  if (!res.ok) throw new Error('Update failed');
}

export async function submitRestaurantClaim(
  restaurantId: string,
  receipt?: string,
): Promise<{ status: string; id?: string }> {
  const headers = await getAuthHeaders();
  const body: Record<string, unknown> = { restaurant_id: restaurantId };
  if (receipt) body.receipt_data = receipt;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-restaurant-claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Claim failed');
  return data as { status: string; id?: string };
}

export async function getOwnerClaimStatuses(): Promise<
  { restaurant_id: string; status: string }[]
> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return [];
  const { data } = await supabase
    .from('restaurant_claims')
    .select('restaurant_id, status')
    .eq('claimed_by', userId);
  return (data ?? []) as { restaurant_id: string; status: string }[];
}
