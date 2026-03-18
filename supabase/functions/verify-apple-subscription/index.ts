import { handleCors, jsonResponse, err400, err401 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user } = await getAuthFromRequest(req);
  if (!user) return err401(req);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const receiptData = body.receipt_data as string;
  const restaurantId = body.restaurant_id as string;

  if (!receiptData || !restaurantId) {
    return err400(req, 'receipt_data and restaurant_id are required');
  }

  // In production, validate the receipt with Apple's verifyReceipt endpoint
  // For now, we trust the client-side receipt and mark the badge
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await admin
    .from('restaurant_verified_badges')
    .upsert({
      restaurant_id: restaurantId,
      verified_since: now.toISOString(),
      is_active: true,
      expires_at: expiresAt.toISOString(),
    });

  await admin
    .from('restaurants')
    .update({ is_verified: true, verified_until: expiresAt.toISOString() })
    .eq('id', restaurantId);

  return jsonResponse({ status: 'verified', expires_at: expiresAt.toISOString() });
});
