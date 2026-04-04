import { admin } from './auth.ts';
import { sendExpoPushMessages } from './expoPush.ts';

export async function notifyAdmins(title: string, body: string, data?: Record<string, unknown>) {
  try {
    const { data: adminProfiles } = await admin
      .from('user_profiles')
      .select('id')
      .eq('is_admin', true);

    if (!adminProfiles || adminProfiles.length === 0) return;

    const adminIds = adminProfiles.map((p) => p.id);

    const { data: tokensData } = await admin
      .from('user_push_tokens')
      .select('token')
      .in('user_id', adminIds);

    if (!tokensData || tokensData.length === 0) return;

    const uniqueTokens = [...new Set(tokensData.map((t: { token: string }) => t.token).filter(Boolean))];
    const payload = data ?? { screen: 'Admin' };

    await sendExpoPushMessages(
      uniqueTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data: payload,
        channelId: 'default',
        priority: 'high' as const,
      })),
    );
  } catch (error) {
    console.error('notifyAdmins Error:', error);
  }
}
