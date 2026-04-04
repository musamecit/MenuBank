import { handleCors, jsonResponse, err401, err500 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

/**
 * Call after a successful Store purchase flow (react-native-iap) when
 * user_profiles.claim_needs_store_reverify is true (e.g. previous claim rejected).
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  const { user } = await getAuthFromRequest(req);
  if (!user) return err401(req, 'Giriş yapmanız gerekiyor');

  const { error } = await admin
    .from('user_profiles')
    .update({ claim_needs_store_reverify: false })
    .eq('id', user.id);

  if (error) return err500(req, error.message);

  return jsonResponse({ ok: true });
});
