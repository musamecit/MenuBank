import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

const VERIFIED_OWNER_ONLY_CODE = 'verified_restaurant_owner_only';

Deno.serve(async (req) => {
  try {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req, 'Giriş yapmanız gerekiyor');

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId = (body.restaurant_id as string)?.trim();
  const url = (body.url as string)?.trim();
  const categorySlug = (body.category_slug as string | undefined)?.trim();

  if (!restaurantId || !url) return err400(req, 'restaurant_id ve url gerekli');

  // URL validation
  try {
    new URL(url);
  } catch {
    return err400(req, 'Geçersiz URL. http veya https ile başlamalı.');
  }

  // Rate limit (skip for admins)
  if (!isAdmin) {
    try {
      const { data: allowed } = await admin.rpc('check_restaurant_submit_menu_rate_limit', {
        p_user_id: user.id,
      });
      if (allowed === false) return err429(req, 'Günlük gönderim limitine ulaştınız');
    } catch {}
  }

  // Check restaurant exists (allow both active and disabled - disabled restaurants can receive menu submissions for review)
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, is_verified')
    .eq('id', restaurantId)
    .in('status', ['active', 'disabled'])
    .is('deleted_at', null)
    .maybeSingle();

  if (!restaurant) return err400(req, 'Restoran bulunamadı');

  // Verified restaurants: only owner or admin can add/update menu
  const isVerified = (restaurant as { is_verified?: boolean }).is_verified === true;
  if (isVerified && !isAdmin) {
    const { data: ra } = await admin
      .from('restaurant_admins')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!ra) {
      const { data: claim } = await admin
        .from('restaurant_claims')
        .select('claimed_by')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'approved')
        .eq('claimed_by', user.id)
        .maybeSingle();
      if (!claim) {
        return jsonResponse({ error: VERIFIED_OWNER_ONLY_CODE }, 403, req);
      }
    }
  }

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
    const hostname = new URL(url).hostname;
    const { data: blocked } = await admin
      .from('blocked_domains')
      .select('id')
      .eq('domain', hostname)
      .eq('is_active', true)
      .maybeSingle();
    if (blocked) return err400(req, 'Bu domain menü için kullanılamaz');
  } catch {}

  // URL reachability KALDIRILDI - çoğu menü sitesi (Akinsoft, Flipsnack vb.) sunucu isteklerini engelliyor.
  // Menüler admin onayından geçiyor, link kontrolü onay aşamasında yapılabilir.

  // One pending menu per restaurant: reject any existing pending entries so only the latest remains for approval
  await admin
    .from('menu_entries')
    .update({
      verification_status: 'rejected',
      verification_reason: 'Superseded by newer submission',
    })
    .eq('restaurant_id', restaurantId)
    .eq('verification_status', 'pending');

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

  if (error) {
    const msg = error.message || 'Veritabanı hatası';
    const friendly = msg.includes('duplicate') || msg.includes('unique')
      ? 'Bu menü linki zaten eklenmiş.'
      : msg;
    return jsonResponse({ error: friendly }, 500, req);
  }

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
  } catch (e) {
    const msg = String((e as Error).message || 'Beklenmeyen hata');
    const friendly = /submit failed|internal error|unknown error/i.test(msg) ? 'Beklenmeyen hata. Lütfen tekrar deneyin.' : msg;
    return jsonResponse({ error: friendly }, 500);
  }
});
