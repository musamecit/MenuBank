import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { notifyAdmins } from '../_shared/notifyAdmins.ts';
import { resolveRestaurantClaimClaimantColumn } from '../_shared/claimantColumn.ts';

Deno.serve(async (req) => {
  try {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req, 'Giriş yapmanız gerekiyor');

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId = body.restaurant_id as string;
  const receiptData = body.receipt_data as string | undefined;

  if (!restaurantId) return err400(req, 'restaurant_id is required');

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, status')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!restaurant) return err400(req, 'Restaurant not found');
  if ((restaurant as { status: string }).status === 'pending_approval') {
    return err400(req, 'Bu işletme henüz yayına alınmadı; sahiplik talebi oluşturulamaz.');
  }

  const cc = await resolveRestaurantClaimClaimantColumn(admin);

  const { data: myPendingHere } = await admin
    .from('restaurant_claims')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq(cc, user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!isAdmin) {
    const { data: prof } = await admin
      .from('user_profiles')
      .select('claim_needs_store_reverify')
      .eq('id', user.id)
      .maybeSingle();
    const needs = (prof as { claim_needs_store_reverify?: boolean } | null)?.claim_needs_store_reverify === true;
    if (needs && !myPendingHere) {
      return jsonResponse(
        {
          error: 'claim_requires_fresh_store',
          message:
            'Önceki talebiniz reddedildi. Yeni talep için App Store satın alma adımını tamamlayın (ardından tekrar deneyin).',
        },
        403,
        req,
      );
    }
  }

  // Check if anyone has claimed THIS restaurant
  const { data: existingForRestaurant } = await admin
    .from('restaurant_claims')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existingForRestaurant) {
    return jsonResponse({
      status: (existingForRestaurant as { status: string }).status,
      message: 'already_claimed',
    });
  }

  // Check if the current user has already claimed ANOTHER restaurant (Limit: 1 per user)
  if (!isAdmin) {
    const { data: existingForUser } = await admin
      .from('restaurant_claims')
      .select('id')
      .eq(cc, user.id)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingForUser) {
      return jsonResponse({
        error: 'user_limit_reached',
        message: 'You can only claim 1 restaurant per account.',
      }, 400, req);
    }

    // Bu ay (UTC) içinde başka bir işletme için reddedilmiş talep varsa yeni işletme talebi yok
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: rejectedThisMonth } = await admin
      .from('restaurant_claims')
      .select('restaurant_id')
      .eq(cc, user.id)
      .eq('status', 'rejected')
      .not('reviewed_at', 'is', null)
      .gte('reviewed_at', monthStart.toISOString());

    const rejectedOtherRestaurant = (rejectedThisMonth ?? []).filter(
      (r) => (r as { restaurant_id: string }).restaurant_id !== restaurantId,
    );
    if (rejectedOtherRestaurant.length > 0) {
      return jsonResponse(
        {
          error: 'claim_monthly_retry_blocked',
          message:
            'Bu ay içinde başka bir işletme için talebiniz reddedildi. Aynı ay içinde farklı bir işletme talebi oluşturamazsınız.',
        },
        403,
        req,
      );
    }
  }

  // Rate limit (skip for admins)
  if (!isAdmin) {
    try {
      const { data: allowed } = await admin.rpc('check_claim_rate_limit', { p_user_id: user.id });
      if (allowed === false) return err429(req, 'max 3 claims per day');
    } catch {}
  }

  try {
    await admin.from('rate_limit_events').insert({ user_id: user.id, event_type: 'restaurant_claim' });
  } catch {}

  // Delete previously rejected/cancelled claims
  await admin
    .from('restaurant_claims')
    .delete()
    .eq('restaurant_id', restaurantId)
    .in('status', ['rejected', 'cancelled']);

  const insertData: Record<string, unknown> = {
    restaurant_id: restaurantId,
    status: 'pending',
    submitted_at: new Date().toISOString(),
  };
  insertData[cc] = user.id;
  if (receiptData) insertData.receipt_data = receiptData;

  const { data: inserted, error } = await admin
    .from('restaurant_claims')
    .insert(insertData)
    .select('id, status, restaurant_id')
    .maybeSingle();

  if (error) {
    console.error('claim insert error:', error);
    if (error.code === '23505') {
      return jsonResponse({ status: 'pending', message: 'already_claimed' });
    }
    return jsonResponse({ error: 'server_error', detail: error.message }, 500, req);
  }

  await notifyAdmins(
    '🏢 Yeni Restoran Talebi',
    'Yeni bir restoran sahiplik talebi admin onayı bekliyor.',
    { screen: 'Admin' }
  );

  return jsonResponse({
    status: 'pending',
    id: (inserted as { id: string })?.id,
  });
  } catch (e) {
    console.error('submit-restaurant-claim:', e);
    return jsonResponse(
      { error: 'Beklenmeyen hata. Lütfen tekrar deneyin.', detail: String((e as Error).message) },
      500,
      req,
    );
  }
});
