import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

const REPORT_THRESHOLD = 3;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user } = await getAuthFromRequest(req);
  if (!user) return err401(req);

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
    return jsonResponse({ status: 'already_reported', message: 'You have already reported this menu' });
  }

  // Rate limit check
  try {
    const { data: allowed } = await admin.rpc('check_menu_report_rate_limit', {
      p_user_id: user.id,
    });
    if (allowed === false) return err429(req, 'Report limit reached');
  } catch {}

  const { data: report, error } = await admin
    .from('menu_reports')
    .insert({
      menu_entry_id: menuEntryId,
      reported_by: user.id,
      reason,
      details: details ?? null,
    })
    .select('id')
    .single();

  if (error) return jsonResponse({ error: error.message }, 500, req);

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

  if (restaurantId) {
    // Count distinct reporters for this menu
    const { data: reports } = await admin
      .from('menu_reports')
      .select('reported_by')
      .eq('menu_entry_id', menuEntryId);
    const uniqueReporters = new Set((reports ?? []).map((r: { reported_by: string }) => r.reported_by));

    if (uniqueReporters.size >= REPORT_THRESHOLD) {
      await admin.from('restaurants').update({ status: 'disabled' }).eq('id', restaurantId);
    }
  }

  return jsonResponse({ id: (report as { id: string }).id, status: 'received' });
});
