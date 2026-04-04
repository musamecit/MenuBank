import { handleCors, jsonResponse, err400, err401, err429, err500 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { validateMenuUrl } from '../_shared/validateMenuUrl.ts';
import { notifyAdmins } from '../_shared/notifyAdmins.ts';
import { notifyMenuFollowersMenuUpdated } from '../_shared/notifyMenuFollowers.ts';
import { resolveRestaurantClaimClaimantColumn } from '../_shared/claimantColumn.ts';

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

  // Advanced Menu URL Validation (Scoring & Safety checks)
  const validation = await validateMenuUrl(url);
  if (validation.action === 'reject') {
    return err400(req, validation.reason);
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
    .select('id, is_verified, name')
    .eq('id', restaurantId)
    .in('status', ['active', 'disabled'])
    .is('deleted_at', null)
    .maybeSingle();

  if (!restaurant) return err400(req, 'Restoran bulunamadı');

  const restaurantName = (restaurant as { name?: string }).name ?? 'Restoran';

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
      const cc = await resolveRestaurantClaimClaimantColumn(admin);
      const { data: claim } = await admin
        .from('restaurant_claims')
        .select(cc)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'approved')
        .eq(cc, user.id)
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

  // If same URL already exists (approved or pending), return success without inserting
  const { data: existingMenu } = await admin
    .from('menu_entries')
    .select('id, verification_status')
    .eq('restaurant_id', restaurantId)
    .eq('url', url)
    .in('verification_status', ['approved', 'pending'])
    .maybeSingle();

  if (existingMenu) {
    if (isAdmin && (existingMenu as { verification_status: string }).verification_status === 'pending') {
      const { data: approvedMenu } = await admin
        .from('menu_entries')
        .update({ verification_status: 'approved' })
        .eq('id', (existingMenu as { id: string }).id)
        .select('id, verification_status')
        .single();
      const mid = (approvedMenu as { id: string }).id;
      await notifyMenuFollowersMenuUpdated(restaurantId, restaurantName, {
        menuEntryId: mid,
        excludeUserIds: [user.id],
        title: restaurantName,
        body: 'Menü onaylandı. Restoran detayından menüyü açabilirsiniz.',
      });
      return jsonResponse({ id: mid, status: 'approved' });
    }
    return jsonResponse({ 
      id: (existingMenu as { id: string }).id, 
      status: (existingMenu as { verification_status: string }).verification_status === 'approved' ? 'unchanged' : 'pending_exists' 
    });
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
      verification_status: isAdmin ? 'approved' : 'pending',
      verification_reason: validation.reason,
    })
    .select('id, verification_status')
    .single();

  if (error) {
    console.error('Menu insert error:', error);
    const msg = error.message || 'Veritabanı hatası';
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return err400(req, 'Bu menü linki zaten eklenmiş.');
    }
    return err500(req, msg);
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
  const finalStatus = (entry as { verification_status: string }).verification_status;
  const newEntryId = (entry as { id: string }).id;
  if (finalStatus === 'pending') {
    await notifyAdmins('⏳ Menü Onayı Bekliyor', 'Yeni bir menü yöneticilerin onayını bekliyor.', { screen: 'Admin' });
  }
  if (finalStatus === 'approved') {
    await notifyMenuFollowersMenuUpdated(restaurantId, restaurantName, {
      menuEntryId: newEntryId,
      excludeUserIds: [user.id],
      title: restaurantName,
      body: 'Yeni menü yayında. Restoran detayından menüyü açın.',
    });
  }

  return jsonResponse({ id: newEntryId, status: finalStatus });
  } catch (e) {
    const msg = String((e as Error).message || 'Beklenmeyen hata');
    const friendly = /submit failed|internal error|unknown error/i.test(msg) ? 'Beklenmeyen hata. Lütfen tekrar deneyin.' : msg;
    return jsonResponse({ error: friendly }, 500);
  }
});
