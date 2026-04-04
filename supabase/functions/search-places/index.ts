import { handleCors, jsonResponse, err400, err401, err500 } from '../_shared/response.ts';
import { getAuthFromRequest } from '../_shared/auth.ts';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
const BASE = 'https://places.googleapis.com/v1';

Deno.serve(async (req) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    // Optional: we can require auth
    const { user } = await getAuthFromRequest(req);
    if (!user) return err401(req, 'Giriş yapmanız gerekiyor');

    if (!GOOGLE_API_KEY) {
      return err500(req, 'Google API anahtarı sunucuda eksik.');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'search') {
      const query = (body.query as string)?.trim();
      if (!query) return err400(req, 'Sorgu gerekli (query)');

      const res = await fetch(`${BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: 'tr',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return err500(req, `Google API form searchText: ${errText}`);
      }

      const data = await res.json();
      return jsonResponse(data.places ?? []);

    } else if (action === 'details') {
      const placeId = (body.placeId as string)?.trim();
      if (!placeId) return err400(req, 'placeId gerekli');

      const path = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
      const res = await fetch(`${BASE}/${path}`, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos,rating,userRatingCount',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return err500(req, `Google API form details: ${errText}`);
      }

      const data = await res.json();
      return jsonResponse(data);
    }

    return err400(req, 'Bilinmeyen işlem türü (action)');
  } catch (e) {
    const msg = String((e as Error).message || 'Beklenmeyen hata');
    return err500(req, msg);
  }
});
