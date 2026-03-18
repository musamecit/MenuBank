import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId = body.restaurant_id as string;
  const url = body.url as string;
  const categorySlug = (body.category_slug as string | undefined)?.trim();

  if (!restaurantId || !url) return err400(req, 'restaurant_id and url are required');

  // URL validation
  try {
    new URL(url);
  } catch {
    return err400(req, 'Invalid URL');
  }

  // Rate limit (skip for admins)
  if (!isAdmin) {
    try {
      const { data: allowed } = await admin.rpc('check_restaurant_submit_menu_rate_limit', {
        p_user_id: user.id,
      });
      if (allowed === false) return err429(req, 'Daily submission limit reached');
    } catch {}
  }

  // Check restaurant exists
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();

  if (!restaurant) return err400(req, 'Restaurant not found');

  // Optional: update cuisine/category on restaurant
  if (categorySlug) {
    try {
      await admin
        .from('restaurants')
        .update({ cuisine_primary: categorySlug })
        .eq('id', restaurantId);
    } catch {
      // non-fatal
    }
  }

  // If same URL already exists (approved), return success without inserting (no duplicate, "Menü Güncellendi" UX)
  const { data: existingApproved } = await admin
    .from('menu_entries')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('url', url)
    .eq('verification_status', 'approved')
    .maybeSingle();

  if (existingApproved) {
    return jsonResponse({ id: (existingApproved as { id: string }).id, status: 'unchanged' });
  }

  // Domain blacklist check
  try {
    const domain = new URL(url).hostname;
    const { data: blocked } = await admin
      .from('blocked_domains')
      .select('id')
      .eq('domain', domain)
      .eq('is_active', true)
      .maybeSingle();
    if (blocked) return err400(req, 'This domain is not allowed');
  } catch {}

  // URL reachability check
  try {
    const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!headRes.ok && headRes.status !== 405) {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!getRes.ok) return err400(req, 'URL is not reachable');
    }
  } catch {
    return err400(req, 'URL is not reachable');
  }

  // Insert menu entry
  const { data: entry, error } = await admin
    .from('menu_entries')
    .insert({
      restaurant_id: restaurantId,
      url,
      submitted_by: user.id,
      verification_status: 'pending',
    })
    .select('id, verification_status')
    .single();

  if (error) return jsonResponse({ error: error.message }, 500, req);

  // Record rate limit event
  if (!isAdmin) {
    try {
      await admin.from('rate_limit_events').insert({
        user_id: user.id,
        event_type: 'restaurant_submit_menu',
      });
    } catch {}
  }

  return jsonResponse({ id: (entry as { id: string }).id, status: (entry as { verification_status: string }).verification_status });
});
