import { handleCors, jsonResponse, err400, err401, err403, err404, err500 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { claimantIdFromRow, resolveRestaurantClaimClaimantColumn } from '../_shared/claimantColumn.ts';
import { notifyMenuFollowersMenuUpdated } from '../_shared/notifyMenuFollowers.ts';
import { hardDeleteRestaurant } from '../_shared/hardDeleteRestaurant.ts';
import { MENU_REPORT_THRESHOLD_REASON } from '../_shared/menuReportConstants.ts';

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

    const { data: menuData, error: menuDataErr } = await admin
      .from('menu_entries')
      .select('restaurant_id, verification_reason, verification_status, restaurants(name, status)')
      .eq('id', menuId)
      .single();
    if (menuDataErr || !menuData) return err404(req, 'Menu entry not found');

    const restaurantId = menuData.restaurant_id as string;
    const restaurantName = (menuData.restaurants as { name?: string })?.name || 'Restoran';
    const placeStatus = (menuData.restaurants as { status?: string })?.status;
    const wasReportThresholdPending =
      (menuData as { verification_reason?: string | null }).verification_reason === MENU_REPORT_THRESHOLD_REASON;

    if (placeStatus === 'pending_approval') {
      return err400(
        req,
        'Bu kayıt "Onay bekleyen işletmeler" bölümünden onaylanmalı (approve_establishment).',
      );
    }

    const { error: updMenuErr } = await admin
      .from('menu_entries')
      .update({
        verification_status: 'approved',
        verified_at: new Date().toISOString(),
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        verification_reason: null,
      })
      .eq('id', menuId);
    if (updMenuErr) return err500(req, updMenuErr.message);

    if (placeStatus === 'disabled' && wasReportThresholdPending) {
      await admin.from('restaurants').update({ status: 'active' }).eq('id', restaurantId);
    }

    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'approve_menu', entity_type: 'menu_entry', entity_id: menuId });

    await notifyMenuFollowersMenuUpdated(restaurantId, restaurantName, {
      menuEntryId: menuId,
      title: restaurantName,
      body: 'Menü onaylandı veya güncellendi. Uygulamada restoran detayından menüyü açabilirsiniz.',
    });

    return jsonResponse({ status: 'approved' });
  }

  /** Yeni işletme (status=pending_approval) + ilk menü birlikte onaylanır */
  if (action === 'approve_establishment') {
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id required');

    const { data: rest, error: rErr } = await admin
      .from('restaurants')
      .select('id, name, status')
      .eq('id', restaurantId)
      .maybeSingle();
    if (rErr) return err500(req, rErr.message);
    if (!rest) return err404(req, 'Restaurant not found');
    if ((rest as { status: string }).status !== 'pending_approval') {
      return err400(req, 'İşletme onay bekleyen durumda değil');
    }

    const restName = (rest as { name: string }).name || 'Restoran';
    const now = new Date().toISOString();

    const { data: activated, error: actErr } = await admin
      .from('restaurants')
      .update({ status: 'active' })
      .eq('id', restaurantId)
      .eq('status', 'pending_approval')
      .select('id');
    if (actErr) return err500(req, actErr.message);
    if (!activated?.length) {
      return err400(req, 'İşletme bulunamadı veya zaten onaylanmış');
    }

    const { data: pendingMenus } = await admin
      .from('menu_entries')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('verification_status', 'pending');

    const menuIds = (pendingMenus ?? []) as { id: string }[];
    for (const m of menuIds) {
      await admin
        .from('menu_entries')
        .update({
          verification_status: 'approved',
          verified_at: now,
          moderated_by: user.id,
          moderated_at: now,
        })
        .eq('id', m.id);
    }

    await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'approve_establishment',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    });

    const primaryMenuId = menuIds[0]?.id;
    if (primaryMenuId) {
      await notifyMenuFollowersMenuUpdated(restaurantId, restName, {
        menuEntryId: primaryMenuId,
        title: restName,
        body: 'İşletme ve menü onaylandı. Menüyü uygulamada görüntüleyebilirsiniz.',
      });
    }

    return jsonResponse({ status: 'approved' });
  }

  if (action === 'reject_establishment') {
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id required');

    const { data: rest } = await admin
      .from('restaurants')
      .select('status')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!rest) return err404(req, 'Restaurant not found');
    if ((rest as { status: string }).status !== 'pending_approval') {
      return err400(req, 'Yalnızca onay bekleyen işletmeler bu akışla reddedilebilir');
    }

    const { error: delErr } = await hardDeleteRestaurant(admin, restaurantId);
    if (delErr) return err500(req, delErr.message);

    await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'reject_establishment',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    });
    return jsonResponse({ status: 'rejected' });
  }

  if (action === 'reject_menu') {
    const menuId = body.menu_id as string;
    const reason = body.reason as string;
    if (!menuId) return err400(req, 'menu_id required');

    const { data: menuRow, error: menuFetchErr } = await admin
      .from('menu_entries')
      .select('id, restaurant_id')
      .eq('id', menuId)
      .maybeSingle();
    if (menuFetchErr) return err500(req, menuFetchErr.message);
    if (!menuRow) return err404(req, 'Menu entry not found');

    const restaurantId = (menuRow as { restaurant_id: string }).restaurant_id;

    const { data: restRow } = await admin
      .from('restaurants')
      .select('status')
      .eq('id', restaurantId)
      .maybeSingle();
    const rStatus = (restRow as { status?: string } | null)?.status;

    if (rStatus === 'pending_approval') {
      const { error: delErr } = await hardDeleteRestaurant(admin, restaurantId);
      if (delErr) return err500(req, delErr.message);
      await admin.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'reject_menu',
        entity_type: 'menu_entry',
        entity_id: menuId,
      });
      return jsonResponse({ status: 'rejected' });
    }

    const { error: updErr } = await admin
      .from('menu_entries')
      .update({
        verification_status: 'rejected',
        verification_reason: reason,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', menuId);
    if (updErr) return err500(req, updErr.message);

    const { count: approvedCount } = await admin
      .from('menu_entries')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('verification_status', 'approved');
    const { count: pendingCount } = await admin
      .from('menu_entries')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('verification_status', 'pending');

    if ((approvedCount ?? 0) === 0 && (pendingCount ?? 0) === 0) {
      const { error: delRestErr } = await hardDeleteRestaurant(admin, restaurantId);
      if (delRestErr) {
        console.error('reject_menu hard-delete restaurant:', delRestErr);
      }
    }

    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'reject_menu', entity_type: 'menu_entry', entity_id: menuId });
    return jsonResponse({ status: 'rejected' });
  }

  if (action === 'approve_claim') {
    const claimId = body.claim_id as string;
    if (!claimId) return err400(req, 'claim_id required');

    const cc = await resolveRestaurantClaimClaimantColumn(admin);

    const { data: claim, error: fetchErr } = await admin
      .from('restaurant_claims')
      .select(`id, restaurant_id, ${cc}, status`)
      .eq('id', claimId)
      .maybeSingle();

    if (fetchErr) return err500(req, fetchErr.message);
    if (!claim) return err404(req, 'Claim not found');

    const row = claim as Record<string, unknown>;
    const status = row.status as string;
    const restaurantIdRow = row.restaurant_id as string;
    const claimantId = claimantIdFromRow(row, cc);
    if (!claimantId) {
      return err500(req, 'Claim row missing claimant user id');
    }
    if (status !== 'pending') {
      return err400(req, 'Claim is not pending');
    }

    const { data: claimantProfile } = await admin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', claimantId)
      .maybeSingle();
    const claimantIsAdmin = (claimantProfile as { is_admin?: boolean } | null)?.is_admin === true;

    if (!claimantIsAdmin) {
      const { data: userOtherApproved } = await admin
        .from('restaurant_claims')
        .select('id')
        .eq(cc, claimantId)
        .eq('status', 'approved')
        .neq('id', claimId)
        .limit(1);
      if (userOtherApproved && userOtherApproved.length > 0) {
        return err400(
          req,
          'Bu kullanıcının zaten onaylı başka bir restoran talebi var. Önce eski onayı kaldırın veya reddedin.',
        );
      }
    }

    const { data: restaurantOtherApproved } = await admin
      .from('restaurant_claims')
      .select('id')
      .eq('restaurant_id', restaurantIdRow)
      .eq('status', 'approved')
      .neq('id', claimId)
      .limit(1);
    if (restaurantOtherApproved && restaurantOtherApproved.length > 0) {
      return err400(req, 'Bu restoranın zaten başka bir onaylı sahibi var.');
    }

    const reviewedAt = new Date().toISOString();
    const { data: updated, error: updErr } = await admin
      .from('restaurant_claims')
      .update({ status: 'approved', reviewed_by: user.id, reviewed_at: reviewedAt })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select('id');

    if (updErr) return err500(req, updErr.message);
    if (!updated?.length) {
      return err400(req, 'Talep güncellenemedi (başka bir işlem tarafından değişmiş veya veritabanı kısıtı).');
    }

    const { error: raErr } = await admin.from('restaurant_admins').insert({
      restaurant_id: restaurantIdRow,
      user_id: claimantId,
    });
    if (raErr && raErr.code !== '23505') {
      console.error('approve_claim restaurant_admins:', raErr);
    }

    const { error: restErr } = await admin
      .from('restaurants')
      .update({ is_verified: true })
      .eq('id', restaurantIdRow);
    if (restErr) console.error('approve_claim restaurants is_verified:', restErr);

    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'approve_claim',
      entity_type: 'restaurant_claim',
      entity_id: claimId,
    });
    if (auditErr) console.error('approve_claim audit:', auditErr);

    await admin
      .from('user_profiles')
      .update({ claim_needs_store_reverify: false })
      .eq('id', claimantId);

    return jsonResponse({ status: 'approved' });
  }

  if (action === 'reject_claim') {
    const claimId = body.claim_id as string;
    if (!claimId) return err400(req, 'claim_id required');

    const cc = await resolveRestaurantClaimClaimantColumn(admin);

    const { data: updated, error: updErr } = await admin
      .from('restaurant_claims')
      .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select(`id, ${cc}`);

    if (updErr) return err500(req, updErr.message);
    if (!updated?.length) {
      return err400(req, 'Talep bulunamadı veya zaten işlenmiş.');
    }

    const claimantId = claimantIdFromRow(updated[0] as Record<string, unknown>, cc);
    if (!claimantId) {
      return err500(req, 'Reject: claim row missing claimant user id');
    }
    await admin
      .from('user_profiles')
      .update({ claim_needs_store_reverify: true })
      .eq('id', claimantId);

    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'reject_claim',
      entity_type: 'restaurant_claim',
      entity_id: claimId,
    });
    if (auditErr) console.error('reject_claim audit:', auditErr);

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

  if (action === 'enable_restaurant') {
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id required');
    const { data: reenabled, error: enErr } = await admin
      .from('restaurants')
      .update({ status: 'pending_approval' })
      .eq('id', restaurantId)
      .eq('status', 'disabled')
      .select('id');
    if (enErr) return err500(req, enErr.message);
    if (!reenabled?.length) {
      return err400(req, 'Restoran devre dışı değil veya bulunamadı');
    }
    await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'enable_restaurant',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    });
    return jsonResponse({ status: 'pending_review' });
  }

  if (action === 'delete_restaurant') {
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) return err400(req, 'restaurant_id required');
    const { error: delErr } = await hardDeleteRestaurant(admin, restaurantId);
    if (delErr) return err500(req, delErr.message);
    await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'delete_restaurant',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    });
    return jsonResponse({ status: 'deleted' });
  }

  /** Mobil venue / Keşfet listeleri cuisine_primary ile uyumlu (keşif RPC süzümü) */
  if (action === 'set_restaurant_venue_category') {
    const restaurantId = body.restaurant_id as string;
    const categorySlug = typeof body.category_slug === 'string' ? body.category_slug.trim() : '';
    if (!restaurantId || !categorySlug) return err400(req, 'restaurant_id and category_slug required');

    const allowed = new Set([
      'balikci', 'bar', 'beach', 'burger', 'cafe', 'meyhane', 'nargile', 'pizza', 'restaurant', 'street_food', 'dessert',
      'other',
    ]);
    if (!allowed.has(categorySlug)) return err400(req, 'invalid category_slug');

    function appSlugToDbSlug(app: string): string {
      if (app === 'street_food') return 'sokak-lezzetleri';
      if (app === 'dessert') return 'tatli';
      if (app === 'other') return 'diger';
      return app;
    }

    const dbSlug = appSlugToDbSlug(categorySlug);
    const { data: cat } = await admin
      .from('restaurant_categories')
      .select('id')
      .eq('slug', dbSlug)
      .maybeSingle();

    const updates: Record<string, unknown> = { cuisine_primary: categorySlug };
    if (cat && typeof (cat as { id?: unknown }).id === 'number') {
      updates.category_id = (cat as { id: number }).id;
    }

    const { error: updErr } = await admin.from('restaurants').update(updates).eq('id', restaurantId);
    if (updErr) return err500(req, updErr.message);

    await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'set_restaurant_venue_category',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    });
    return jsonResponse({ ok: true });
  }

  return err400(req, 'Unknown action');
});
