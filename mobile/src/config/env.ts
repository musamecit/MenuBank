import Constants from 'expo-constants';

type PublicExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicExtra;

/** .env / EAS’ten gelen sonda boşluk veya BOM → Supabase "Invalid API key". */
function trimEnv(v: string | undefined): string {
  if (v == null || v === '') return '';
  return v.trim().replace(/^\uFEFF/, '');
}

/** Build / runtime: EAS Secrets veya .env ile EXPO_PUBLIC_* tanımlayın; repoda anahtar tutulmaz. */
export const SUPABASE_URL = trimEnv(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.EXPO_PUBLIC_SUPABASE_URL,
);

/** Legacy JWT anon veya yeni `sb_publishable_...`; aynı Supabase projesinin URL’si ile eşleşmeli. */
export const SUPABASE_ANON_KEY = trimEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const GOOGLE_PLACES_API_KEY = trimEnv(
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? extra.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
);
