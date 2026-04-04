import { handleCors, jsonResponse, err400 } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

/** Mobil menü listesi: POST { restaurant_id } — service role. */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return err400(req, 'POST required');
  }

  const body = (await req.json().catch(() => ({}))) as { restaurant_id?: string };
  const rid = typeof body.restaurant_id === 'string' ? body.restaurant_id.trim() : '';
  if (!rid) return err400(req, 'restaurant_id required');

  const { data, error } = await admin
    .from('menu_entries')
    .select('id, url, verification_status, submitted_at, is_hidden, submitted_by')
    .eq('restaurant_id', rid)
    .eq('verification_status', 'approved')
    .or('is_hidden.eq.false,is_hidden.is.null')
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false });

  if (error) return jsonResponse({ error: error.message }, 500, req);
  return jsonResponse(data ?? [], 200, req);
});
