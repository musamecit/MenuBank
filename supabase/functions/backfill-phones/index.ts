import { handleCors, jsonResponse } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // 1. Get restaurants missing phone number
    const { data: rests, error: fetchErr } = await admin
      .from('restaurants')
      .select('id, place_id, name')
      .is('contact_phone', null)
      .not('place_id', 'is', null)
      .limit(20); // Run in batches

    if (fetchErr) throw fetchErr;
    if (!rests || rests.length === 0) {
      return jsonResponse({ message: 'No restaurants found missing phone numbers.' });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
    if (!apiKey?.trim()) {
      return jsonResponse({ error: 'Missing Google Key in server context' }, 500);
    }

    const results = [];

    for (const rest of rests) {
      if (rest.place_id.startsWith('seed-')) continue;

      try {
        const path = rest.place_id.startsWith('places/') ? rest.place_id : `places/${rest.place_id}`;
        const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'nationalPhoneNumber',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const phone = data.nationalPhoneNumber as string | undefined;
          if (phone) {
            const { error: updErr } = await admin
              .from('restaurants')
              .update({ contact_phone: phone })
              .eq('id', rest.id);
            results.push({ name: rest.name, phone, success: !updErr, error: updErr?.message });
          } else {
            results.push({ name: rest.name, status: 'No phone number returned' });
          }
        } else {
            results.push({ name: rest.name, status: 'Google API Error', code: res.status });
        }
      } catch (e) {
         results.push({ name: rest.name, status: 'Fetch Exception', error: (e as Error).message });
      }
    }

    return jsonResponse({ results });

  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
