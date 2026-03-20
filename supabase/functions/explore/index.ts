import { handleCors, jsonResponse, err400 } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'nearby';

  if (action === 'nearby') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lng = parseFloat(url.searchParams.get('lng') ?? '');
    const radius = parseFloat(url.searchParams.get('radius') ?? '20000');
    const priceLevel = url.searchParams.get('price_level');
    const countryCode = url.searchParams.get('country_code');
    const cityName = url.searchParams.get('city_name');
    const areaName = url.searchParams.get('area_name');
    const categorySlug = url.searchParams.get('category_slug');

    if (isNaN(lat) || isNaN(lng)) return err400(req, 'lat and lng are required');

    const { data: rows, error } = await admin.rpc('get_nearby_restaurants', {
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radius,
    });

    if (error) return jsonResponse({ error: error.message }, 500, req);

    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    let extraMap = new Map<string, Record<string, unknown>>();
    if (ids.length > 0) {
      const { data: extra } = await admin
        .from('restaurants')
        .select('id, lat, lng, image_url, is_verified, price_level, google_rating, cuisine_primary, trending_score, contact_phone, country_code, city_name, area_name')
        .in('id', ids);
      if (extra) {
        extraMap = new Map((extra as Record<string, unknown>[]).map((e) => [e.id as string, e]));
      }
    }

    let items = (rows ?? []).map((r: Record<string, unknown>) => {
      const e = extraMap.get(r.id as string) ?? {};
      return { ...r, ...e };
    });

    if (priceLevel && priceLevel !== 'all') {
      items = items.filter((i: Record<string, unknown>) => i.price_level === priceLevel);
    }
    if (countryCode) {
      items = items.filter((i: Record<string, unknown>) => i.country_code === countryCode);
    }
    if (cityName) {
      items = items.filter((i: Record<string, unknown>) => i.city_name === cityName);
    }
    if (areaName) {
      items = items.filter((i: Record<string, unknown>) => i.area_name === areaName);
    }
    if (categorySlug) {
      items = items.filter((i: Record<string, unknown>) => i.cuisine_primary === categorySlug);
    }

    // En yakın 50 işletme (Kullanıcı 50 adet listelemek istedi)
    items = items
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.distance_meters as number ?? 0) - (b.distance_meters as number ?? 0),
      )
      .slice(0, 50);

    return jsonResponse({ items }, 200, req);
  }

  if (action === 'trending') {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, city_name, area_name, image_url, is_verified, trending_score, price_level, google_rating')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('trending_score', { ascending: false })
      .limit(20);
    return jsonResponse({ items: data ?? [] }, 200, req);
  }

  if (action === 'restaurant') {
    const id = url.searchParams.get('id');
    if (!id) return err400(req, 'id is required');
    const { data } = await admin
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return jsonResponse({ error: 'not_found' }, 404, req);
    return jsonResponse(data, 200, req);
  }

  return err400(req, 'Unknown action');
});
