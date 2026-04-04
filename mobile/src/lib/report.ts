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
  const text = await res.text();
  let data = {} as { status?: string; error?: string; message?: string };
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(text.length > 160 ? `${text.slice(0, 160)}…` : text);
    }
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Bildirim gönderilemedi (${res.status})`);
  }
  if (data.status === 'already_reported') {
    return { status: 'already_reported' };
  }
  return { status: (data.status as 'received') ?? 'received' };
}
