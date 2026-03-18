import { supabase } from './supabase';
import { SUPABASE_URL } from '../config/env';
import { getAuthHeaders } from './restaurants';

export interface SearchResult {
  id: string;
  name: string;
  city_name: string;
  area_name: string;
  is_verified: boolean;
  trending_score: number;
  price_level: string | null;
  image_url?: string | null;
  place_id?: string | null;
}

export async function searchRestaurants(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(`${SUPABASE_URL}/functions/v1/search?${params}`, { headers, signal });
    if (res.ok) {
      const data = await res.json();
      return (data.items ?? []) as SearchResult[];
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
  }
  return searchFallback(query, limit);
}

async function searchFallback(q: string, limit: number): Promise<SearchResult[]> {
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, city_name, area_name, is_verified, trending_score, price_level, image_url, place_id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .ilike('name', `%${q}%`)
    .order('trending_score', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    city_name: String(r.city_name ?? ''),
    area_name: String(r.area_name ?? ''),
    is_verified: Boolean(r.is_verified),
    trending_score: Number(r.trending_score ?? 0),
    price_level: (r.price_level as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    place_id: (r.place_id as string | null) ?? null,
  }));
}
