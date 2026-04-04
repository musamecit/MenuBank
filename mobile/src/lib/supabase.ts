import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

if (__DEV__ && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_ANON_KEY boş. .env / EAS secret kontrol edin.',
  );
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key).catch(error => {
      console.warn('SecureStore getItem error:', error);
      return null;
    });
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value).catch(error => {
      console.warn('SecureStore setItem error:', error);
    });
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key).catch(error => {
      console.warn('SecureStore removeItem error:', error);
    });
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
