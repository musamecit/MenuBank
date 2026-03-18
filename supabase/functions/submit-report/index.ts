import { handleCors, jsonResponse, err400, err401, err429 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

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

  return jsonResponse({ id: (report as { id: string }).id, status: 'received' });
});
