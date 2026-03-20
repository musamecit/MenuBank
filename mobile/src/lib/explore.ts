import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { getAuthHeaders } from './restaurants';

export interface NearbyRestaurant {
  id: string;
  name: string;
  city_name: string;
  area_name: string;
  distance_meters?: number;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_verified?: boolean;
  price_level?: string | null;
  google_rating?: number | null;
  cuisine_primary?: string | null;
  trending_score?: number;
}

interface NearbyOptions {
  priceFilter?: string;
  countryCode?: string;
  cityName?: string;
  areaName?: string;
  categorySlug?: string;
}

/** Haversine formula to strictly calculate distance between current GPS and target */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Radius from map latitudeDelta: 1° ≈ 111km */
export function radiusFromLatitudeDelta(delta: number): number {
  const meters = Math.abs(delta) * 111000;
  return Math.min(500000, Math.max(5000, Math.round(meters)));
}

export async function fetchNearby(
  lat: number,
  lng: number,
  radius = 20000,
  options: NearbyOptions = {},
): Promise<NearbyRestaurant[]> {
  const { priceFilter, countryCode, cityName, areaName, categorySlug } = options;
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      action: 'nearby',
      lat: String(lat),
      lng: String(lng),
      radius: String(radius),
    });
    if (priceFilter && priceFilter !== 'all') params.set('price_level', priceFilter);
    if (countryCode) params.set('country_code', countryCode);
    if (cityName) params.set('city_name', cityName);
    if (areaName) params.set('area_name', areaName);
    if (categorySlug) params.set('category_slug', categorySlug);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/explore?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      return (data.items ?? []) as NearbyRestaurant[];
    }
  } catch {}
  return fetchNearbyFallback(lat, lng, radius);
}

async function fetchNearbyFallback(lat: number, lng: number, radius: number): Promise<NearbyRestaurant[]> {
  const { data } = await supabase.rpc('get_nearby_restaurants', {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radius,
  });
  if (!data) return [];
  const ids = (data as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data: extra } = await supabase
    .from('restaurants')
    .select('id, name, city_name, area_name, lat, lng, image_url, is_verified, price_level, google_rating, cuisine_primary, trending_score')
    .in('id', ids);
  const map = new Map((extra ?? []).map((e: Record<string, unknown>) => [e.id as string, e]));
  return (data as { id: string; distance_meters?: number }[]).map((r) => {
    const e = map.get(r.id) ?? {};
    return { ...r, ...(e as object) } as NearbyRestaurant;
  });
}

export interface CuratedList {
  id: string;
  slug: string;
  title_tr: string;
  title_en: string;
  restaurant_count?: number;
}

export async function fetchCuratedLists(): Promise<CuratedList[]> {
  const { data } = await supabase
    .from('curated_lists')
    .select('id, slug, title_tr, title_en')
    .order('home_slot', { ascending: true });
  return (data ?? []) as CuratedList[];
}

export async function fetchCuratedListRestaurants(listId: string) {
  const { data } = await supabase
    .from('curated_list_restaurants')
    .select('restaurant_id, sort_order, restaurants(id, name, city_name, area_name, image_url, is_verified, price_level)')
    .eq('curated_list_id', listId)
    .order('sort_order', { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => r.restaurants).filter(Boolean);
}
