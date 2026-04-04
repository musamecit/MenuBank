import { handleCors, jsonResponse, err400, err401 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { notifyAdmins } from '../_shared/notifyAdmins.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const placeId = body.place_id as string;
  const name = body.name as string;
  const cityName = body.city_name as string;
  const areaName = body.area_name as string;

  if (!placeId || !name || !cityName || !areaName) {
    return err400(req, 'place_id, name, city_name, area_name are required');
  }

  // Check if restaurant already exists (including disabled - avoid duplicate for same place)
  const { data: existing } = await admin
    .from('restaurants')
    .select('id')
    .eq('place_id', placeId)
    .in('status', ['active', 'disabled', 'pending_approval'])
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ id: (existing as { id: string }).id, existing: true });
  }

  const insertData: Record<string, unknown> = {
    place_id: placeId,
    name,
    city_name: cityName,
    area_name: areaName,
    country_code: (body.country_code as string) ?? 'TR',
    formatted_address: (body.formatted_address as string) ?? null,
    lat: (body.lat as number) ?? null,
    lng: (body.lng as number) ?? null,
    cuisine_primary: (body.cuisine_primary as string) ?? null,
    contact_phone: (body.contact_phone as string) ?? null,
    status: isAdmin ? 'active' : 'pending_approval',
    created_by: user.id,
  };

  const { data: inserted, error: insertError } = await admin
    .from('restaurants')
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) return jsonResponse({ error: insertError.message }, 500, req);

  if (!isAdmin && insertData.status === 'pending_approval') {
    await notifyAdmins(
      '🏪 Onay bekleyen işletme',
      `${name}: Yeni işletme kaydı (create-restaurant) admin onayı bekliyor.`,
      { screen: 'Admin' },
    );
  }

  // Enrich from Google Places
  if (inserted && !placeId.startsWith('seed-')) {
    try {
      const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
      if (apiKey?.trim()) {
        const path = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
        const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'location,photos,rating,userRatingCount,types,nationalPhoneNumber,websiteUri',
          },
        });
        if (res.ok) {
          const data = await res.json() as {
            location?: { latitude: number; longitude: number };
            photos?: { name: string }[];
            rating?: number;
            userRatingCount?: number;
            types?: string[];
            nationalPhoneNumber?: string;
            websiteUri?: string;
          };
          const updates: Record<string, unknown> = {};
          const needCoords = insertData.lat == null || insertData.lng == null ||
            (insertData.lat === 0 && insertData.lng === 0);
          if (needCoords && data.location?.latitude != null && data.location?.longitude != null) {
            updates.lat = data.location.latitude;
            updates.lng = data.location.longitude;
          }
          if (Array.isArray(data.photos) && data.photos.length > 0 && data.photos[0]?.name) {
            updates.image_url = `https://places.googleapis.com/v1/${data.photos[0].name}/media?maxHeightPx=800&maxWidthPx=800&key=${encodeURIComponent(apiKey)}`;
          }
          if (typeof data.rating === 'number') updates.google_rating = data.rating;
          if (typeof data.userRatingCount === 'number') updates.google_user_ratings_total = data.userRatingCount;
          if (updates.google_rating != null || updates.google_user_ratings_total != null) {
            updates.google_rating_updated_at = new Date().toISOString();
          }
          if (data.nationalPhoneNumber && !insertData.contact_phone) {
            updates.contact_phone = data.nationalPhoneNumber;
          }
          if (Object.keys(updates).length > 0) {
            await admin.from('restaurants').update(updates).eq('id', (inserted as { id: string }).id);
          }
        }
      }
    } catch {}
  }

  return jsonResponse({ id: (inserted as { id: string }).id, existing: false });
});
