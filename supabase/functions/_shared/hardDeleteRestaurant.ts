import { admin } from './auth.ts';

/**
 * Admin kalıcı kaldırma: menu_entries append-only (DELETE yasak).
 * Menüler ve restoran deleted_at ile kapatılır; FK/CASCADE DELETE tetiklenmez.
 * Diğer restoran bağlı tablolar fiziksel silinir (FK sırası).
 */
export async function hardDeleteRestaurant(
  client: typeof admin,
  restaurantId: string,
): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();

  const { error: menuErr } = await client
    .from('menu_entries')
    .update({ deleted_at: now })
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null);
  if (menuErr && !/does not exist|relation/i.test(menuErr.message)) {
    console.error('hardDeleteRestaurant menu_entries:', menuErr.message);
    return { error: menuErr };
  }

  const tables: [string, string][] = [
    ['user_favorites', 'restaurant_id'],
    ['restaurant_price_votes', 'restaurant_id'],
    ['user_follows', 'restaurant_id'],
    ['restaurant_admins', 'restaurant_id'],
    ['curated_list_restaurants', 'restaurant_id'],
    ['user_list_items', 'restaurant_id'],
    ['restaurant_claims', 'restaurant_id'],
    ['restaurant_view_count', 'restaurant_id'],
  ];
  for (const [table, col] of tables) {
    const { error } = await client.from(table).delete().eq(col, restaurantId);
    if (error && !/does not exist|relation/i.test(error.message)) {
      console.error(`hardDeleteRestaurant ${table}:`, error.message);
    }
  }

  const { error: restErr } = await client
    .from('restaurants')
    .update({ deleted_at: now })
    .eq('id', restaurantId)
    .is('deleted_at', null);
  return { error: restErr };
}

/** Varsayılan service client ile sil */
export async function hardDeleteRestaurantDefault(restaurantId: string) {
  return hardDeleteRestaurant(admin, restaurantId);
}
