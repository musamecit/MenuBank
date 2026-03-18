import { admin, getUserIdFromRequest } from '../_shared/auth.ts';
import { jsonResponse, err400, err500, handleCors } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const userId = await getUserIdFromRequest(req);
    const { event_type, entity_type, entity_id, metadata } = await req.json();

    if (!event_type) return err400(req, 'event_type is required');

    await admin.from('app_events').insert({
      user_id: userId || null,
      event_type,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      metadata: metadata || {},
    });

    if (event_type === 'restaurant_view' && entity_id) {
      await admin.rpc('increment_view_count', { p_restaurant_id: entity_id });
    }

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return err500(req, e.message);
  }
});
