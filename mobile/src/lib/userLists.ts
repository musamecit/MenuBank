import { supabase } from './supabase';

export interface UserList {
  id: string;
  title: string;
  is_public: boolean;
  is_system_list: boolean;
  created_at: string;
}

export async function getUserLists(userId: string): Promise<UserList[]> {
  const { data } = await supabase
    .from('user_lists')
    .select('id, title, is_public, is_system_list, created_at')
    .eq('user_id', userId)
    .or('is_system_list.eq.false,is_system_list.is.null')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return (data ?? []) as UserList[];
}

export async function createUserList(
  userId: string,
  title: string,
  isPublic = false,
): Promise<UserList | null> {
  const { data } = await supabase
    .from('user_lists')
    .insert({ user_id: userId, title, is_public: isPublic })
    .select('id, title, is_public, is_system_list, created_at')
    .single();
  return data as UserList | null;
}

export async function deleteUserList(listId: string) {
  await supabase.from('user_lists').update({ deleted_at: new Date().toISOString() }).eq('id', listId);
}

export async function getListItems(listId: string) {
  const { data } = await supabase
    .from('user_list_items')
    .select('restaurant_id, restaurants(id, name, city_name, area_name, image_url, is_verified, price_level)')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => r.restaurants).filter(Boolean);
}

export async function addToList(listId: string, restaurantId: string) {
  await supabase.from('user_list_items').insert({ list_id: listId, restaurant_id: restaurantId });
}

export async function removeFromList(listId: string, restaurantId: string) {
  await supabase
    .from('user_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('restaurant_id', restaurantId);
}
