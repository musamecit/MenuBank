/**
 * Atomik: Yeni restoran + menü. Menü eklenemezse restoran oluşturulmaz.
 * Önce URL doğrulaması, sonra restoran, sonra menü.
 */
import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  try {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req, 'Giriş yapmanız gerekiyor');

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const placeId = (body.place_id as string)?.trim();
  const name = (body.name as string)?.trim();
  const cityName = (body.city_name as string)?.trim();
  const areaName = (body.area_name as string)?.trim();
  const url = (body.url as string)?.trim();
  const categorySlug = (body.category_slug as string | undefined)?.trim();

  if (!placeId || !name || !cityName || !areaName || !url) {
    return err400(req, 'place_id, name, city_name, area_name, url are required');
  }

  // 1. URL doğrulaması - RESTORAN OLUŞTURMADAN ÖNCE
  try {
    new URL(url);
  } catch {
    return err400(req, 'Geçersiz URL. http veya https ile başlamalı.');
  }

  // Rate limit
  if (!isAdmin) {
    try {
      const { data: allowed } = await admin.rpc('check_restaurant_submit_menu_rate_limit', {
        p_user_id: user.id,
      });
      if (allowed === false) return err429(req, 'Günlük gönderim limitine ulaştınız');
    } catch {}
  }

  // Domain blacklist
  try {
    const hostname = new URL(url).hostname;
    const { data: blocked } = await admin
      .from('blocked_domains')
      .select('id')
      .eq('domain', hostname)
      .eq('is_active', true)
      .maybeSingle();
    if (blocked) return err400(req, 'Bu domain menü için kullanılamaz');
  } catch {}

  // URL reachability KALDIRILDI - çoğu menü sitesi sunucu isteklerini engelliyor.

  // 2. Restoran zaten var mı?
  const { data: existing } = await admin
    .from('restaurants')
    .select('id')
    .eq('place_id', placeId)
    .in('status', ['active', 'disabled'])
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    const restaurantId = (existing as { id: string }).id;
    const { data: rest } = await admin.from('restaurants').select('is_verified').eq('id', restaurantId).single();
    const isVerified = (rest as { is_verified?: boolean })?.is_verified === true;
    if (isVerified && !isAdmin) {
      const { data: ra } = await admin.from('restaurant_admins').select('user_id').eq('restaurant_id', restaurantId).eq('user_id', user.id).maybeSingle();
      if (!ra) {
        const { data: claim } = await admin.from('restaurant_claims').select('claimed_by').eq('restaurant_id', restaurantId).eq('status', 'approved').eq('claimed_by', user.id).maybeSingle();
        if (!claim) {
          return jsonResponse({ error: 'verified_restaurant_owner_only' }, 403, req);
        }
      }
    }
    // Aynı URL zaten onaylı mı?
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
    // Pending'leri reject et
    await admin.from('menu_entries').update({
      verification_status: 'rejected',
      verification_reason: 'Superseded by newer submission',
    }).eq('restaurant_id', restaurantId).eq('verification_status', 'pending');
    // Kategori güncelle
    if (categorySlug) {
      await admin.from('restaurants').update({ cuisine_primary: categorySlug }).eq('id', restaurantId);
    }
    // Menü ekle
    const { data: entry, error: menuErr } = await admin.from('menu_entries').insert({
      restaurant_id: restaurantId,
      url,
      submitted_by: user.id,
      verification_status: 'pending',
    }).select('id, verification_status').single();
    if (menuErr) {
      const msg = menuErr.message || 'Veritabanı hatası';
      const friendly = msg.includes('duplicate') || msg.includes('unique') ? 'Bu menü linki zaten eklenmiş.' : msg;
      return jsonResponse({ error: friendly }, 500, req);
    }
    if (!isAdmin) {
      try {
        await admin.from('rate_limit_events').insert({ user_id: user.id, event_type: 'restaurant_submit_menu' });
      } catch {}
    }
    return jsonResponse({ id: (entry as { id: string }).id, status: (entry as { verification_status: string }).verification_status });
  }

  // 3. Restoran oluştur
  const insertData: Record<string, unknown> = {
    place_id: placeId,
    name,
    city_name: cityName,
    area_name: areaName,
    country_code: (body.country_code as string) ?? 'TR',
    formatted_address: (body.formatted_address as string) ?? null,
    lat: (body.lat as number) ?? null,
    lng: (body.lng as number) ?? null,
    cuisine_primary: categorySlug ?? null,
    status: 'active',
    created_by: user.id,
  };

  const { data: inserted, error: insertError } = await admin
    .from('restaurants')
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) return jsonResponse({ error: insertError.message }, 500, req);

  const restaurantId = (inserted as { id: string }).id;

  // 4. Menü ekle - başarısız olursa restoranı sil
  const { data: entry, error: menuError } = await admin
    .from('menu_entries')
    .insert({
      restaurant_id: restaurantId,
      url,
      submitted_by: user.id,
      verification_status: 'pending',
    })
    .select('id, verification_status')
    .single();

  if (menuError) {
    await admin.from('restaurants').update({ deleted_at: new Date().toISOString() }).eq('id', restaurantId);
    const msg = menuError.message || 'Veritabanı hatası';
    const friendly = msg.includes('duplicate') || msg.includes('unique') ? 'Bu menü linki zaten eklenmiş.' : msg;
    return jsonResponse({ error: friendly }, 500, req);
  }

  // Rate limit kaydı
  if (!isAdmin) {
    try {
      await admin.from('rate_limit_events').insert({
        user_id: user.id,
        event_type: 'restaurant_submit_menu',
      });
    } catch {}
  }

  // Google Places zenginleştirme (async, hata vermez)
  if (!placeId.startsWith('seed-')) {
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
          const data = await res.json() as Record<string, unknown>;
          const updates: Record<string, unknown> = {};
          const needCoords = insertData.lat == null || insertData.lng == null;
          const loc = data.location as { latitude?: number; longitude?: number } | undefined;
          if (needCoords && loc?.latitude != null && loc?.longitude != null) {
            updates.lat = loc.latitude;
            updates.lng = loc.longitude;
          }
          const photos = data.photos as { name: string }[] | undefined;
          if (Array.isArray(photos) && photos[0]?.name) {
            updates.image_url = `https://places.googleapis.com/v1/${photos[0].name}/media?maxHeightPx=800&maxWidthPx=800&key=${encodeURIComponent(apiKey)}`;
          }
          if (typeof data.rating === 'number') updates.google_rating = data.rating;
          if (typeof data.userRatingCount === 'number') updates.google_user_ratings_total = data.userRatingCount;
          if (updates.google_rating != null || updates.google_user_ratings_total != null) {
            updates.google_rating_updated_at = new Date().toISOString();
          }
          const phone = data.nationalPhoneNumber as string | undefined;
          if (phone && !insertData.contact_phone) updates.contact_phone = phone;
          if (Object.keys(updates).length > 0) {
            await admin.from('restaurants').update(updates).eq('id', restaurantId);
          }
        }
      }
    } catch {}
  }

  return jsonResponse({
    id: (entry as { id: string }).id,
    restaurant_id: restaurantId,
    status: (entry as { verification_status: string }).verification_status,
  });
  } catch (e) {
    const msg = String((e as Error).message || 'Beklenmeyen hata');
    const friendly = /submit failed|internal error|unknown error/i.test(msg) ? 'Beklenmeyen hata. Lütfen tekrar deneyin.' : msg;
    return jsonResponse({ error: friendly }, 500);
  }
});
