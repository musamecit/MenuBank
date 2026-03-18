import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

function toFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('submit failed') || lower === 'submit failed') return 'Menü gönderilemedi. Lütfen tekrar deneyin.';
  if (lower.includes('fetch failed') || lower.includes('network')) return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
  if (lower.includes('unauthorized') || lower.includes('giriş')) return 'Giriş yapmanız gerekiyor';
  return raw || 'Menü gönderilemedi. Lütfen tekrar deneyin.';
}

export interface SubmitRestaurantWithMenuParams {
  place_id: string;
  name: string;
  city_name: string;
  area_name: string;
  formatted_address?: string;
  country_code?: string;
  url: string;
  category_slug: string;
}

export async function submitRestaurantWithMenu(
  params: SubmitRestaurantWithMenuParams,
): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase.functions.invoke('submit-restaurant-with-menu', { body: params });

  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError && error.context) {
      try {
        const ctx = (await error.context.json()) as { error?: string };
        if (ctx?.error) msg = ctx.error;
      } catch {
        /* use error.message */
      }
    }
    throw new Error(toFriendlyError(msg));
  }

  const d = data as { error?: string; id?: string; status?: string } | null;
  if (d?.error) throw new Error(toFriendlyError(d.error));
  if (!d?.id) throw new Error('Menü gönderilemedi. Lütfen tekrar deneyin.');

  return { id: d.id, status: d.status ?? 'pending' };
}
