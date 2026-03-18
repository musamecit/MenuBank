import { admin, getUserIdFromRequest } from '../_shared/auth.ts';
import { jsonResponse, err400, err401, err429, err500, handleCors } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return err401(req);

    const { restaurant_id, url, reason, menu_entry_id } = await req.json();
    if (!url) return err400(req, 'url is required');

    const { error } = await admin.from('user_menu_misuse_events').insert({
      user_id: userId,
      restaurant_id: restaurant_id || null,
      url,
      reason: reason || null,
      menu_entry_id: menu_entry_id || null,
    });

    if (error) return err500(req, error.message);

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return err500(req, e.message);
  }
});
