import { handleCors, jsonResponse, err400 } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

/** Mobil detay: POST { id } — service role, RLS yok. */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return err400(req, 'POST required');
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return err400(req, 'id required');

  const { data, error } = await admin
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500, req);
  if (!data) return jsonResponse({ error: 'not_found' }, 404, req);

  const st = String((data as Record<string, unknown>).status ?? '').trim().toLowerCase();
  if (st === 'disabled') return jsonResponse({ error: 'not_found' }, 404, req);

  return jsonResponse(data, 200, req);
});
