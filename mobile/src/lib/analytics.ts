import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export async function logEvent(
  eventType: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch(`${SUPABASE_URL}/functions/v1/app-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata ?? {},
      }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function logShareClicked(type: string, entityId: string, label?: string) {
  await logEvent('share_clicked', type, entityId, label ? { label } : undefined);
}

export async function logRestaurantView(restaurantId: string) {
  await logEvent('restaurant_view', 'restaurant', restaurantId);
}

export async function logSearch(query: string) {
  await logEvent('search', undefined, undefined, { query });
}

export async function logMenuClick(restaurantId: string, menuEntryId: string) {
  await logEvent('menu_click', 'menu_entry', menuEntryId, { restaurant_id: restaurantId });
}

export async function trackActiveDate() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('user_active_dates').upsert(
      { user_id: userId, active_date: today },
      { onConflict: 'user_id,active_date' },
    );
  } catch {
    // fire-and-forget
  }
}

export async function updateUserBehavior(field: 'total_searches' | 'total_views' | 'total_menu_clicks') {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const { data: existing } = await supabase
      .from('user_behavior_stats')
      .select('id, ' + field)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && typeof existing === 'object' && 'id' in existing) {
      const rec = existing as Record<string, number> & { id: string };
      await supabase
        .from('user_behavior_stats')
        .update({ [field]: (rec[field] ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', rec.id);
    } else {
      await supabase.from('user_behavior_stats').insert({
        user_id: userId,
        [field]: 1,
      });
    }
  } catch {
    // fire-and-forget
  }
}
