import { admin, getUserIdFromRequest, getAuthFromRequest } from '../_shared/auth.ts';
import { jsonResponse, err400, err401, err429, err500, handleCors } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return err401(req);

    const { action, code } = await req.json();

    if (action === 'get_code') {
      const { data: existing } = await admin
        .from('user_invite_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) return jsonResponse({ code: existing.code });

      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await admin.from('user_invite_codes').insert({ user_id: userId, code: newCode });
      return jsonResponse({ code: newCode });
    }

    if (action === 'redeem') {
      if (!code) return err400(req, 'code is required');

      const { data: inviteCode } = await admin
        .from('user_invite_codes')
        .select('user_id')
        .eq('code', code.toUpperCase())
        .maybeSingle();

      if (!inviteCode) return err400(req, 'Invalid referral code');
      if (inviteCode.user_id === userId) return err400(req, 'Cannot use your own code');

      const { data: alreadyReferred } = await admin
        .from('user_referrals')
        .select('id')
        .eq('referred_user_id', userId)
        .maybeSingle();

      if (alreadyReferred) return err400(req, 'Already redeemed a referral');

      const { data: auth } = await admin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();
      const isAdmin = auth?.is_admin === true;

      if (!isAdmin) {
        const { data: allowed } = await admin.rpc('check_public_api_rate_limit', {
          p_user_id: userId,
        });
      }

      await admin.from('user_referrals').insert({
        referrer_id: inviteCode.user_id,
        referred_user_id: userId,
      });

      await admin.rpc('increment_reputation', {
        p_user_id: inviteCode.user_id,
        p_points: 10,
      });

      return jsonResponse({ ok: true });
    }

    return err400(req, 'Invalid action');
  } catch (e: any) {
    return err500(req, e.message);
  }
});
