import { handleCors, jsonResponse, err400, err401, err403, err404 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { resolveRestaurantClaimClaimantColumn } from '../_shared/claimantColumn.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get('restaurant_id');
    if (!restaurantId) return err400(req, 'restaurant_id is required');

    // Authorization: admin, restaurant_admin, or approved claim holder
    if (!isAdmin) {
      const { data: ra } = await admin
        .from('restaurant_admins')
        .select('user_id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!ra) {
        const cc = await resolveRestaurantClaimClaimantColumn(admin);
        const { data: claim } = await admin
          .from('restaurant_claims')
          .select(cc)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'approved')
          .eq(cc, user.id)
          .maybeSingle();
        if (!claim) return err403(req);
      }
    }

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, name, city_name, area_name, image_url, is_verified, verified_until, contact_phone, formatted_address, cuisine_primary, google_rating, google_user_ratings_total, price_level, popularity_score, trending_score, plan_type, status, created_at')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!restaurant) return err404(req);

    const { count: menuCount } = await admin
      .from('menu_entries')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('verification_status', 'approved');

    const { data: vc } = await admin
      .from('restaurant_view_count')
      .select('view_count')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    return jsonResponse({
      restaurant,
      menuCount: menuCount ?? 0,
      viewCount: (vc as { view_count: number } | null)?.view_count ?? 0,
    });
  }

  if (req.method === 'PATCH') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id is required');

    if (!isAdmin) {
      const { data: ra } = await admin
        .from('restaurant_admins')
        .select('user_id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!ra) {
        const cc = await resolveRestaurantClaimClaimantColumn(admin);
        const { data: claim } = await admin
          .from('restaurant_claims')
          .select(cc)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'approved')
          .eq(cc, user.id)
          .maybeSingle();
        if (!claim) return err403(req);
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.contact_phone != null) updates.contact_phone = body.contact_phone;
    if (body.cuisine_primary != null) updates.cuisine_primary = body.cuisine_primary;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length > 1) {
      await admin.from('restaurants').update(updates).eq('id', restaurantId);
    }

    return jsonResponse({ status: 'updated' });
  }

  return err400(req, 'Method not allowed');
});
