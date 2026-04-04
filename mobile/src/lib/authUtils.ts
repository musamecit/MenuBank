import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'menubank' });
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
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // Apple ad/soyad yalnızca ilk girişte credential ile gelir; JWT’de olmaz — user_metadata’ya yaz.
  if (credential.fullName) {
    const gn = credential.fullName.givenName?.trim() ?? '';
    const fn = credential.fullName.familyName?.trim() ?? '';
    const full = [gn, fn].filter(Boolean).join(' ').trim();
    if (full) {
      const data: Record<string, string> = { full_name: full };
      if (gn) data.given_name = gn;
      if (fn) data.family_name = fn;
      const { error: metaErr } = await supabase.auth.updateUser({ data });
      if (metaErr) console.warn('Apple fullName → user_metadata', metaErr);
    }
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
