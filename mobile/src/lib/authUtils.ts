import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** app.config.js `scheme` ile aynı olmalı (OAuth redirect); aksi halde Google dönüşü kırılır. */
const appScheme = (Constants.expoConfig?.scheme as string) || 'qrmenu';

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: appScheme });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const params = new URL(result.url);
      const accessToken = params.searchParams.get('access_token') ?? params.hash?.match(/access_token=([^&]+)/)?.[1];
      const refreshToken = params.searchParams.get('refresh_token') ?? params.hash?.match(/refresh_token=([^&]+)/)?.[1];
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  }
}

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('No identity token');

  const gn = credential.fullName?.givenName?.trim() ?? '';
  const fn = credential.fullName?.familyName?.trim() ?? '';
  const full = [gn, fn].filter(Boolean).join(' ').trim();
  const appleUserData: Record<string, string> = {};
  if (full) appleUserData.full_name = full;
  if (gn) appleUserData.given_name = gn;
  if (fn) appleUserData.family_name = fn;

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    ...(Object.keys(appleUserData).length ? { options: { data: appleUserData } } : {}),
  });
  if (error) throw error;

  // İlk girişte bazen yalnızca updateUser ile kalıcı yazılır; ikisini de dene.
  if (full) {
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name: full, ...(gn ? { given_name: gn } : {}), ...(fn ? { family_name: fn } : {}) },
    });
    if (metaErr) console.warn('Apple fullName → user_metadata', metaErr);
    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (uid) {
      const { error: profErr } = await supabase
        .from('user_profiles')
        .update({ display_name: full, updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (profErr) console.warn('Apple fullName → user_profiles.display_name', profErr);
    }
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
