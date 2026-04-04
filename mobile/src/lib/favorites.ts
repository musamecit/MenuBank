import { supabase } from './supabase';

export async function isFavorite(userId: string, restaurantId: string): Promise<boolean> {
  const { count } = await supabase
    .from('user_favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId);
  return (count ?? 0) > 0;
}

export async function toggleFavorite(userId: string, restaurantId: string): Promise<boolean> {
  const fav = await isFavorite(userId, restaurantId);
  if (fav) {
    await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId);
    return false;
  }
  await supabase.from('user_favorites').insert({ user_id: userId, restaurant_id: restaurantId });
  return true;
}

type RestaurantRow = Record<string, unknown> & { id?: string };

export async function getFavorites(userId: string) {
  const { data } = await supabase
    .from('user_favorites')
    .select('restaurant_id, restaurants(id, name, city_name, area_name, image_url, is_verified, price_level)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const seen = new Set<string>();
  const out: RestaurantRow[] = [];
  for (const row of data ?? []) {
    const rest = row.restaurants as RestaurantRow | null;
    if (!rest?.id) continue;
    const id = String(rest.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(rest);
  }
  return out;
}

/** Same cardinality as `getFavorites` (joins restaurants; excludes missing rows). */
export async function getFavoriteCount(userId: string): Promise<number> {
  const favs = await getFavorites(userId);
  return favs.length;
}
