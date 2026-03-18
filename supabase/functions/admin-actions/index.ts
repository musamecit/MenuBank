import { handleCors, jsonResponse, err400, err401, err403 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, isAdmin } = await getAuthFromRequest(req);
  if (!user) return err401(req);
  if (!isAdmin) return err403(req);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action as string;

  if (action === 'approve_menu') {
    const menuId = body.menu_id as string;
    if (!menuId) return err400(req, 'menu_id required');
    await admin
      .from('menu_entries')
      .update({ verification_status: 'approved', verified_at: new Date().toISOString(), moderated_by: user.id, moderated_at: new Date().toISOString() })
      .eq('id', menuId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'approve_menu', entity_type: 'menu_entry', entity_id: menuId });
    return jsonResponse({ status: 'approved' });
  }

  if (action === 'reject_menu') {
    const menuId = body.menu_id as string;
    const reason = body.reason as string;
    if (!menuId) return err400(req, 'menu_id required');
    await admin
      .from('menu_entries')
      .update({ verification_status: 'rejected', verification_reason: reason, moderated_by: user.id, moderated_at: new Date().toISOString() })
      .eq('id', menuId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'reject_menu', entity_type: 'menu_entry', entity_id: menuId });
    return jsonResponse({ status: 'rejected' });
  }

  if (action === 'approve_claim') {
    const claimId = body.claim_id as string;
    if (!claimId) return err400(req, 'claim_id required');
    await admin
      .from('restaurant_claims')
      .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', claimId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'approve_claim', entity_type: 'restaurant_claim', entity_id: claimId });
    return jsonResponse({ status: 'approved' });
  }

  if (action === 'reject_claim') {
    const claimId = body.claim_id as string;
    if (!claimId) return err400(req, 'claim_id required');
    await admin
      .from('restaurant_claims')
      .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', claimId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'reject_claim', entity_type: 'restaurant_claim', entity_id: claimId });
    return jsonResponse({ status: 'rejected' });
  }

  if (action === 'ban_user') {
    const targetUserId = body.user_id as string;
    const banReason = body.reason as string;
    if (!targetUserId) return err400(req, 'user_id required');
    await admin
      .from('user_profiles')
      .update({ is_banned: true, ban_reason: banReason, banned_at: new Date().toISOString() })
      .eq('id', targetUserId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'ban_user', entity_type: 'user', entity_id: targetUserId });
    return jsonResponse({ status: 'banned' });
  }

  if (action === 'disable_restaurant') {
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id required');
    await admin.from('restaurants').update({ status: 'disabled' }).eq('id', restaurantId);
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'disable_restaurant', entity_type: 'restaurant', entity_id: restaurantId });
    return jsonResponse({ status: 'disabled' });
  }

  return err400(req, 'Unknown action');
});
