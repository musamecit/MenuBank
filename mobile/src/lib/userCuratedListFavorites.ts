import { supabase } from './supabase';
import type { CuratedList } from './explore';

export async function getFavoriteCuratedLists(userId: string): Promise<CuratedList[]> {
  try {
    const { data } = await supabase
      .from('user_curated_list_favorites')
      .select('curated_list_id, curated_lists(id, slug, title_tr, title_en)')
      .eq('user_id', userId);
    if (!data?.length) return [];
    return (data as { curated_lists: CuratedList | CuratedList[] | null }[])
      .map((r) => (Array.isArray(r.curated_lists) ? r.curated_lists[0] : r.curated_lists))
      .filter((x): x is CuratedList => x != null && typeof x === 'object' && 'id' in x);
  } catch {
    return [];
  }
}

export async function isFavoriteCuratedList(userId: string, curatedListId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_curated_list_favorites')
      .select('user_id')
      .eq('user_id', userId)
      .eq('curated_list_id', curatedListId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function toggleFavoriteCuratedList(
  userId: string,
  curatedListId: string,
): Promise<boolean> {
  try {
    const fav = await isFavoriteCuratedList(userId, curatedListId);
    if (fav) {
      await supabase
        .from('user_curated_list_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('curated_list_id', curatedListId);
      return false;
    }
    await supabase.from('user_curated_list_favorites').insert({
      user_id: userId,
      curated_list_id: curatedListId,
    });
    return true;
  } catch {
    return false;
  }
}
