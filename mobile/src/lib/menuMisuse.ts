import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export async function reportMenuMisuse(params: {
  restaurant_id?: string;
  url: string;
  reason?: string;
  menu_entry_id?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'Not authenticated' };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-menu-misuse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json();
      return { ok: false, error: err.error };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
