const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ExpoPushMessage = {
  to: string;
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Android 8+ — uygulamada oluşturulan kanal ile eşleşmeli */
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

const CHUNK = 99;

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  for (let i = 0; i < messages.length; i += CHUNK) {
    const batch = messages.slice(i, i + CHUNK).map((m) => ({
      ...m,
      channelId: m.channelId ?? 'default',
      priority: m.priority ?? 'high',
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error('Expo push batch failed:', res.status, await res.text());
      }
    } catch (e) {
      console.error('Expo push batch error:', e);
    }
  }
}
