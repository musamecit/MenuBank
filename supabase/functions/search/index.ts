import { handleCors, jsonResponse, err400 } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);

  if (!q.trim()) return err400(req, 'q is required');

  try {
    const { data: rows, error } = await admin.rpc('search_restaurants', {
      p_query: q,
      p_limit: limit,
    });

    if (error) throw error;

    const rpcItems = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      city_name: r.city_name,
      area_name: r.area_name,
      is_verified: r.is_verified ?? false,
      trending_score: r.trending_score ?? 0,
      price_level: r.price_level ?? null,
    }));

    const rpcIds = rpcItems.map((i: { id: string }) => i.id);
    let imageMap = new Map<string, { image_url: string | null; place_id: string | null }>();
    if (rpcIds.length > 0) {
      const { data: extras } = await admin
        .from('restaurants')
        .select('id, image_url, place_id')
        .in('id', rpcIds);
      if (extras) {
        imageMap = new Map(
          (extras as { id: string; image_url: string | null; place_id: string | null }[]).map(
            (e) => [e.id, { image_url: e.image_url, place_id: e.place_id }],
          ),
        );
      }
    }

    const items = rpcItems.map((i: Record<string, unknown>) => {
      const extra = imageMap.get(i.id as string);
      return { ...i, image_url: extra?.image_url ?? null, place_id: extra?.place_id ?? null };
    });

    return jsonResponse({ items }, 200, req);
  } catch {
    // Fallback: direct ilike query
    const { data } = await admin
      .from('restaurants')
      .select('id, name, city_name, area_name, is_verified, trending_score, price_level, image_url, place_id')
      .eq('status', 'active')
      .is('deleted_at', null)
      .ilike('name', `%${q}%`)
      .order('trending_score', { ascending: false })
      .limit(limit);

    return jsonResponse({ items: data ?? [] }, 200, req);
  }
});
