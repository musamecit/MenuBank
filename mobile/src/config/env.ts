import Constants from 'expo-constants';

type PublicExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicExtra;

/** Build / runtime: EAS Secrets veya .env ile EXPO_PUBLIC_* tanımlayın; repoda anahtar tutulmaz. */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? extra.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
