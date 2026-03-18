import { handleCors, jsonResponse, err400, err429 } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Rate limit by IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = await hashIp(clientIp);

  try {
    const { data: allowed } = await admin.rpc('check_public_api_rate_limit', { p_ip_hash: ipHash });
    if (allowed === false) return err429(req, 'Rate limit exceeded');
  } catch {}

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'restaurant') {
    const id = url.searchParams.get('id');
    if (!id) return err400(req, 'id is required');
    const { data } = await admin
      .from('restaurants')
      .select('id, name, city_name, area_name, formatted_address, image_url, is_verified, google_rating')
      .eq('id', id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return jsonResponse({ error: 'not_found' }, 404, req);
    return jsonResponse(data, 200, req);
  }

  if (action === 'menus') {
    const restaurantId = url.searchParams.get('restaurant_id');
    if (!restaurantId) return err400(req, 'restaurant_id is required');
    const { data } = await admin
      .from('menu_entries')
      .select('id, url, submitted_at')
      .eq('restaurant_id', restaurantId)
      .eq('verification_status', 'approved')
      .eq('is_hidden', false)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false });
    return jsonResponse({ items: data ?? [] }, 200, req);
  }

  return err400(req, 'Unknown action');
});
