import { SUPABASE_URL } from '../config/env';
import { getAuthHeaders } from './restaurants';

export async function submitReport(
  menuEntryId: string,
  reason: string,
  details?: string,
) {
  const headers = await getAuthHeaders();
  const body: Record<string, unknown> = { menu_entry_id: menuEntryId, reason };
  if (details) body.details = details;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Report failed');
  }
}
