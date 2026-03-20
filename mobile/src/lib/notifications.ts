import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Bazı ortamlarda başlangıçta hata verebilir
}

export async function registerPushToken(userId: string) {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;

    await fetch(`${SUPABASE_URL}/functions/v1/push-tokenable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    // fallback to direct insert
    await supabase
      .from('user_push_tokens')
      .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id' });
  }
}
