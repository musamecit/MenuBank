import { admin, getUserIdFromRequest } from '../_shared/auth.ts';
import { jsonResponse, err400, err401, err500, handleCors } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return err401(req);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method === 'GET' && action === 'list') {
      const { data } = await admin
        .from('user_follows')
        .select('restaurant_id, restaurants(id, name, city_name, area_name, image_url, is_verified)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return jsonResponse({ follows: data || [] });
    }

    if (req.method === 'POST') {
      const { restaurant_id } = await req.json();
      if (!restaurant_id) return err400(req, 'restaurant_id is required');

      const { data: existing } = await admin
        .from('user_follows')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();

      if (existing) {
        await admin.from('user_follows').delete().eq('id', existing.id);
        return jsonResponse({ following: false });
      }

      await admin.from('user_follows').insert({
        user_id: userId,
        restaurant_id,
      });
      return jsonResponse({ following: true });
    }

    return err400(req, 'Invalid request');
  } catch (e: any) {
    return err500(req, e.message);
  }
});
