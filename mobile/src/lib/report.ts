import { SUPABASE_URL } from '../config/env';
import { getAuthHeaders } from './restaurants';

export type ReportResult = { status: 'received' } | { status: 'already_reported' };

export async function submitReport(
  menuEntryId: string,
  reason: string,
  details?: string,
): Promise<ReportResult> {
  const headers = await getAuthHeaders();
  const body: Record<string, unknown> = { menu_entry_id: menuEntryId, reason };
  if (details) body.details = details;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Report failed');
  }
  return { status: (data.status as 'received' | 'already_reported') ?? 'received' };
}
