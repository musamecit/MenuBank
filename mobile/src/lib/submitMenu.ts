import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

function toFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('submit failed') || lower === 'submit failed') return 'Menü gönderilemedi. Lütfen tekrar deneyin.';
  if (lower.includes('fetch failed') || lower.includes('network')) return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
  if (lower.includes('unauthorized') || lower.includes('giriş')) return 'Giriş yapmanız gerekiyor';
  return raw || 'Menü gönderilemedi. Lütfen tekrar deneyin.';
}

export async function submitMenu(
  restaurantId: string,
  url: string,
  categorySlug?: string,
): Promise<{ id: string; status: string }> {
  const body: Record<string, unknown> = { restaurant_id: restaurantId, url };
  if (categorySlug) body.category_slug = categorySlug;

  const { data, error } = await supabase.functions.invoke('submit-menu', { body });

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
