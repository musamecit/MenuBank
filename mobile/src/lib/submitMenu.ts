import { SUPABASE_URL } from '../config/env';
import { getAuthHeaders } from './restaurants';

export async function submitMenu(
  restaurantId: string,
  url: string,
  categorySlug?: string,
): Promise<{ id: string; status: string }> {
  const headers = await getAuthHeaders();
  const body: Record<string, unknown> = { restaurant_id: restaurantId, url };
  if (categorySlug) body.category_slug = categorySlug;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-menu`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Submit failed');
  return data as { id: string; status: string };
}
