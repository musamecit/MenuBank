import { supabase } from './supabase';

export async function isFollowing(userId: string, restaurantId: string): Promise<boolean> {
  const { count } = await supabase
    .from('user_follows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId);
  return (count ?? 0) > 0;
}

export async function toggleFollow(userId: string, restaurantId: string): Promise<boolean> {
  const following = await isFollowing(userId, restaurantId);
  if (following) {
    await supabase
      .from('user_follows')
      .delete()
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId);
    return false;
  }
  await supabase.from('user_follows').insert({ user_id: userId, restaurant_id: restaurantId });
  return true;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('user_follows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}
