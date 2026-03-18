import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId = body.restaurant_id as string;
  const receiptData = body.receipt_data as string | undefined;

  if (!restaurantId) return err400(req, 'restaurant_id is required');

  // Check restaurant exists
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, claimed_by')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!restaurant) return err400(req, 'Restaurant not found');
  if ((restaurant as { claimed_by?: string }).claimed_by) {
    return err400(req, 'restaurant already claimed');
  }

  // Check existing pending/approved claim
  const { data: existing } = await admin
    .from('restaurant_claims')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      status: (existing as { status: string }).status,
      message: 'already_claimed',
    });
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
    claimed_by: user.id,
    status: 'pending',
    submitted_at: new Date().toISOString(),
  };
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

  return jsonResponse({
    status: 'pending',
    id: (inserted as { id: string })?.id,
  });
});
