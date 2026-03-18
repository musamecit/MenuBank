import { admin, getUserIdFromRequest } from '../_shared/auth.ts';
import { jsonResponse, err400, err401, err500, handleCors } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return err401(req);

    const { token, platform } = await req.json();
    if (!token) return err400(req, 'token is required');

    const { data: existing } = await admin
      .from('user_push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      await admin
        .from('user_push_tokens')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await admin.from('user_push_tokens').insert({
        user_id: userId,
        token,
        platform: platform || 'ios',
      });
    }

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return err500(req, e.message);
  }
});
