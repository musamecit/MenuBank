import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token || token === ANON_KEY) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function getAuthFromRequest(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return { user: null, isAdmin: false };

  const { data: profile } = await admin
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  return {
    user: { id: userId },
    isAdmin: (profile as { is_admin?: boolean } | null)?.is_admin === true,
  };
}
