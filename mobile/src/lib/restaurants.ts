import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export interface Restaurant {
  id: string;
  place_id: string;
  name: string;
  country_code: string;
  city_name: string;
  area_name: string;
  formatted_address?: string;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  status: string;
  is_verified: boolean;
  verified_until?: string | null;
  popularity_score: number;
  trending_score: number;
  trend_velocity: number;
  price_level?: string | null;
  cuisine_primary?: string | null;
  google_rating?: number | null;
  google_user_ratings_total?: number | null;
  google_rating_updated_at?: string | null;
  contact_phone?: string | null;
  reservation_url?: string | null;
  category_id?: number | null;
  plan_type?: string;
  created_at?: string;
}

export interface MenuEntry {
  id: string;
  url: string;
  verification_status: string;
  submitted_at: string;
  is_hidden: boolean;
  submitted_by?: string;
}

export interface RestaurantWithMenu extends Restaurant {
  current_menu_url?: string | null;
  current_menu_id?: string | null;
}

export async function fetchRestaurantsByCity(
  city?: string | null,
  area?: string | null,
  countryCode?: string | null,
): Promise<RestaurantWithMenu[]> {
  let baseQuery = supabase
    .from('restaurants')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null);
  if (countryCode) baseQuery = baseQuery.eq('country_code', countryCode);
  if (city) baseQuery = baseQuery.eq('city_name', city);

  let query = baseQuery;
  if (area) query = query.eq('area_name', area);

  let { data: restaurants, error } = await query.order('trending_score', { ascending: false }).limit(50);

  if ((!restaurants || restaurants.length === 0) && area) {
    const retry = await baseQuery.order('trending_score', { ascending: false }).limit(50);
    restaurants = retry.data ?? [];
    error = retry.error;
  }

  if (error || !restaurants?.length) return [];

  const ids = restaurants.map((r: { id: string }) => r.id);
  const { data: entries } = await supabase
    .from('menu_entries')
    .select('id, restaurant_id, url')
    .in('restaurant_id', ids)
    .eq('is_hidden', false)
    .eq('verification_status', 'approved')
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false });

  const latestByRestaurant: Record<string, { id: string; url: string }> = {};
  (entries ?? []).forEach((e: { restaurant_id: string; id: string; url: string }) => {
    if (!latestByRestaurant[e.restaurant_id]) {
      latestByRestaurant[e.restaurant_id] = { id: e.id, url: e.url };
    }
  });

  return restaurants.map((r: Record<string, unknown>) => ({
    ...r,
    current_menu_url: latestByRestaurant[r.id as string]?.url ?? null,
    current_menu_id: latestByRestaurant[r.id as string]?.id ?? null,
  })) as RestaurantWithMenu[];
}

function isRestaurantDetailVisible(status: unknown): boolean {
  return String(status ?? '').trim().toLowerCase() !== 'disabled';
}

/** PostgREST: SETOF → [satır]; json bazen string */
function rowFromRpcRestaurant(data: unknown): Restaurant | null {
  if (data == null) return null;
  let v: unknown = data;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) {
    v = v[0];
  }
  if (v == null || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.id == null) return null;
  return o as unknown as Restaurant;
}

function rowsFromRpcMenus(data: unknown): MenuEntry[] {
  if (data == null) return [];
  let v: unknown = data;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((x) => x != null && typeof x === 'object' && (x as Record<string, unknown>).id != null) as MenuEntry[];
}

async function fetchRestaurantViaInvoke(id: string): Promise<Restaurant | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase.functions.invoke('restaurant-public', {
    body: { id: trimmed },
  });
  if (error != null || data == null || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (row.error != null || row.id == null) return null;
  return data as unknown as Restaurant;
}

export async function fetchRestaurant(id: string): Promise<Restaurant | null> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_restaurant_for_client', {
    p_id: id.trim(),
  });
  if (!rpcErr) {
    const fromRpc = rowFromRpcRestaurant(rpcData);
    if (fromRpc) return fromRpc;
  }

  const fromInvoke = await fetchRestaurantViaInvoke(id);
  if (fromInvoke) return fromInvoke;

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/explore?action=restaurant&id=${encodeURIComponent(id.trim())}`,
      { headers },
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      if (json.error == null && json.id != null) {
        return json as unknown as Restaurant;
      }
    }
  } catch {
    /* ağ */
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id.trim())
    .is('deleted_at', null)
    .maybeSingle();
  if (!error && data && isRestaurantDetailVisible(data.status)) {
    return data as Restaurant;
  }
  return null;
}

async function fetchMenuEntriesViaInvoke(restaurantId: string): Promise<MenuEntry[] | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const { data, error } = await supabase.functions.invoke('menu-entries-public', {
    body: { restaurant_id: rid },
  });
  if (error != null || !Array.isArray(data)) return null;
  return data as MenuEntry[];
}

/** Onaylı menü yokken detayda "admin onayında" göstermek için (RLS bypass, SECURITY DEFINER RPC). */
export async function restaurantHasPendingMenuForClient(restaurantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('restaurant_has_pending_menu_for_client', {
    p_restaurant_id: restaurantId.trim(),
  });
  if (error) return false;
  return Boolean(data);
}

export async function fetchMenuEntries(restaurantId: string): Promise<MenuEntry[]> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_menu_entries_for_client', {
    p_restaurant_id: restaurantId.trim(),
  });
  if (!rpcErr && rpcData != null) {
    return rowsFromRpcMenus(rpcData);
  }

  const fromInvoke = await fetchMenuEntriesViaInvoke(restaurantId);
  if (fromInvoke != null) return fromInvoke;

  const { data } = await supabase
    .from('menu_entries')
    .select('id, url, verification_status, submitted_at, is_hidden, submitted_by')
    .eq('restaurant_id', restaurantId.trim())
    .eq('verification_status', 'approved')
    .or('is_hidden.eq.false,is_hidden.is.null')
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false });
  return (data ?? []) as MenuEntry[];
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const bearer = token ?? SUPABASE_ANON_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearer}`,
  };
}

export async function createRestaurant(body: {
  place_id: string;
  name: string;
  city_name: string;
  area_name: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
  country_code?: string;
}): Promise<{ id: string } | null> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-restaurant`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data as { id: string };
}
