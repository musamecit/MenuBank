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

export async function fetchRestaurant(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  return data as Restaurant;
}

export async function fetchMenuEntries(restaurantId: string): Promise<MenuEntry[]> {
  const { data } = await supabase
    .from('menu_entries')
    .select('id, url, verification_status, submitted_at, is_hidden')
    .eq('restaurant_id', restaurantId)
    .eq('verification_status', 'approved')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false });
  return (data ?? []) as MenuEntry[];
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
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
