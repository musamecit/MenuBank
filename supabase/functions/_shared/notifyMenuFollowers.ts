import { admin } from './auth.ts';
import { sendExpoPushMessages } from './expoPush.ts';

/**
 * Restoranı takip eden ve menü bildirimini açık bırakan kullanıcılara push (+ isteğe bağlı user_notifications).
 * user_follows → user_profiles → user_push_tokens zinciri ayrı sorgularla (PostgREST embed FK gerektirmez).
 */
export async function notifyMenuFollowersMenuUpdated(
  restaurantId: string,
  restaurantName: string,
  options?: {
    menuEntryId?: string;
    excludeUserIds?: string[];
    title?: string;
    body?: string;
  },
): Promise<void> {
  const safeName = (restaurantName || 'Restoran').trim().slice(0, 80);
  const title = options?.title ?? safeName;
  const body =
    options?.body ?? `${safeName}: Takip ettiğiniz restoranda menü güncellendi veya onaylandı.`;

  try {
    const { data: follows, error: fErr } = await admin
      .from('user_follows')
      .select('user_id')
      .eq('restaurant_id', restaurantId);
    if (fErr || !follows?.length) return;

    const exclude = new Set(options?.excludeUserIds ?? []);
    const followerIds = [...new Set(
      follows.map((r: { user_id: string }) => r.user_id).filter((id) => id && !exclude.has(id)),
    )];
    if (followerIds.length === 0) return;

    const { data: profiles, error: pErr } = await admin
      .from('user_profiles')
      .select('id, notifications_menu_enabled')
      .in('id', followerIds);
    if (pErr) {
      console.error('notifyMenuFollowers profiles:', pErr);
      return;
    }

    const allowedIds = (profiles ?? [])
      .filter((p: { id: string; notifications_menu_enabled?: boolean | null }) =>
        p.notifications_menu_enabled !== false
      )
      .map((p: { id: string }) => p.id);
    if (allowedIds.length === 0) return;

    const { data: tokenRows, error: tErr } = await admin
      .from('user_push_tokens')
      .select('user_id, token')
      .in('user_id', allowedIds);
    if (tErr) {
      console.error('notifyMenuFollowers tokens:', tErr);
      return;
    }

    const tokens = [...new Set(
      (tokenRows ?? [])
        .map((r: { token: string }) => r.token)
        .filter((t): t is string => Boolean(t)),
    )];

    const payload = {
      screen: 'RestaurantDetail',
      restaurantId,
      ...(options?.menuEntryId ? { menuEntryId: options.menuEntryId } : {}),
    };

    try {
      const rows = allowedIds.map((userId) => ({
        user_id: userId,
        type: 'menu_update',
        entity_type: 'restaurant',
        entity_id: restaurantId,
        payload: {
          restaurant_id: restaurantId,
          restaurant_name: restaurantName,
          menu_entry_id: options?.menuEntryId ?? null,
          display_title: title,
          display_body: body,
        },
        is_read: false,
      }));
      await admin.from('user_notifications').insert(rows);
    } catch (e) {
      console.error('user_notifications insert (non-fatal):', e);
    }

    if (tokens.length === 0) return;

    await sendExpoPushMessages(
      tokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data: payload,
        channelId: 'default',
        priority: 'high' as const,
      })),
    );
  } catch (e) {
    console.error('notifyMenuFollowersMenuUpdated:', e);
  }
}
