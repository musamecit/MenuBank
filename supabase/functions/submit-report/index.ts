import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';
import { notifyAdmins } from '../_shared/notifyAdmins.ts';
import { MENU_REPORT_THRESHOLD_REASON } from '../_shared/menuReportConstants.ts';

/** Bu eşik aşılınca menü tekrar admin onayına alınır, işletme geçici olarak devre dışı bırakılır. */
const REPORT_THRESHOLD = 3;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user } = await getAuthFromRequest(req);
  if (!user) return err401(req, 'Oturum açmanız gerekir');

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const menuEntryId = body.menu_entry_id as string;
  const reason = body.reason as string;
  const details = body.details as string | undefined;

  if (!menuEntryId || !reason) return err400(req, 'menu_entry_id and reason are required');

  // Prevent duplicate: same user can't report same menu twice
  const { data: existing } = await admin
    .from('menu_reports')
    .select('id')
    .eq('menu_entry_id', menuEntryId)
    .eq('reported_by', user.id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({ status: 'already_reported', message: 'Bu menüyü zaten bildirdiniz.' }, 200, req);
  }

  // Rate limit check
  try {
    const { data: allowed } = await admin.rpc('check_menu_report_rate_limit', {
      p_user_id: user.id,
    });
    if (allowed === false) return err429(req, 'Report limit reached');
  } catch {}

  const { data: insertedRows, error } = await admin
    .from('menu_reports')
    .insert({
      menu_entry_id: menuEntryId,
      reported_by: user.id,
      reason,
      details: details ?? null,
    })
    .select('id');

  if (error) {
    if (error.code === '23505') {
      return jsonResponse({ status: 'already_reported', message: 'Bu menüyü zaten bildirdiniz.' }, 200, req);
    }
    console.error('menu_reports insert:', error);
    return jsonResponse({ error: error.message }, 500, req);
  }

  const report = insertedRows?.[0] as { id: string } | undefined;
  if (!report?.id) {
    console.error('menu_reports insert returned no row');
    return jsonResponse({ error: 'insert_failed' }, 500, req);
  }

  try {
    await admin.from('rate_limit_events').insert({
      user_id: user.id,
      event_type: 'menu_report',
    });
  } catch {}

  // Get restaurant_id from menu_entry
  const { data: menuEntry } = await admin
    .from('menu_entries')
    .select('restaurant_id')
    .eq('id', menuEntryId)
    .maybeSingle();
  const restaurantId = (menuEntry as { restaurant_id: string } | null)?.restaurant_id;

  let crossedThreshold = false;
  if (restaurantId) {
    const { data: reports } = await admin
      .from('menu_reports')
      .select('reported_by')
      .eq('menu_entry_id', menuEntryId);
    const uniqueReporters = new Set((reports ?? []).map((r: { reported_by: string }) => r.reported_by));

    if (uniqueReporters.size >= REPORT_THRESHOLD) {
      crossedThreshold = true;
      await admin
        .from('menu_entries')
        .update({
          verification_status: 'pending',
          verification_reason: MENU_REPORT_THRESHOLD_REASON,
          verified_at: null,
          moderated_by: null,
          moderated_at: null,
        })
        .eq('id', menuEntryId)
        .eq('verification_status', 'approved');

      await admin.from('restaurants').update({ status: 'disabled' }).eq('id', restaurantId);

      await notifyAdmins(
        '⚠️ Menü rapor eşiği',
        `${REPORT_THRESHOLD} farklı kullanıcı bu menüyü bildirdi. İşletme geçici olarak devre dışı; menü yeniden onay bekliyor.`,
        { screen: 'Admin' },
      );
    }
  }

  if (!crossedThreshold) {
    await notifyAdmins(
      '🚩 Menü bildirimi',
      'Bir kullanıcı menüyü bildirdi; inceleyin.',
      { screen: 'Admin' },
    );
  }

  return jsonResponse({ id: report.id, status: 'received' });
});
