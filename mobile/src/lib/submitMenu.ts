import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { signOut } from './authUtils';

const SESSION_EXPIRED_MSG = 'Oturumunuz sona ermiş. Lütfen çıkış yapıp tekrar giriş yapın.';

function toFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  let baseMsg = raw || 'Bir hata oluştu. Lütfen tekrar deneyin.';
  
  if (lower.includes('invalid jwt') || (lower.includes('jwt') && lower.includes('invalid'))) baseMsg = SESSION_EXPIRED_MSG;
  else if (lower.includes('giriş yapmanız gerekiyor') || lower.includes('oturumunuz sona ermiş')) baseMsg = SESSION_EXPIRED_MSG;
  else if (lower.includes('verified_restaurant_owner_only')) baseMsg = 'Onaylanmış restoranlara sadece sahibi menü ekleyebilir.';
  else if (lower.includes('duplicate') || lower.includes('unique')) baseMsg = 'Bu menü linki zaten eklenmiş.';
  else if (lower.includes('günlük gönderim limitinize ulaştınız')) baseMsg = 'Günlük gönderim limitinize ulaştınız. Lütfen yarın tekrar deneyin.';
  else if (lower.includes('geçersiz url')) baseMsg = 'Geçersiz URL. Lütfen linkin "https://" ile başladığından emin olun.';
  else if (lower.includes('edge function returned a non-2xx') || lower.includes('functions_http_error')) {
    baseMsg = 'İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.';
  }

  // Preserve the DEBUG block I added earlier so we can finally see exactly what the server is returning
  if (raw.includes('DEBUG:')) {
    const debugPart = raw.substring(raw.indexOf('DEBUG:'));
    if (!baseMsg.includes(debugPart)) {
      baseMsg = `${baseMsg}\n\n${debugPart}`;
    }
  }
  
  return baseMsg;
}

/** 
 * Gets the current access token from the active session.
 * Returns null if no valid session could be established.
 */
async function getValidToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return data.session.access_token;
}

async function invokeEdgeFunction(functionName: string, body: any) {
  let token = await getValidToken();
  if (!token) {
    throw new Error(SESSION_EXPIRED_MSG); // Forcefully fail locally before network
  }

  const doFetch = async (accessToken: string) => {
    return fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Never fallback to ANON_KEY
        'apikey': SUPABASE_ANON_KEY, // Required by Supabase API Gateway
      },
      body: JSON.stringify(body)
    });
  };

  let response = await doFetch(token);

  // If 401, force exactly ONE retry with a new token refresh
  if (response.status === 401) {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session?.access_token) {
        // The refresh token is also dead/invalid. 
        // This means the ghost session in iOS Keychain is completely unrecoverable.
        // We MUST nuke the local storage to break the infinite loop.
        await signOut();
      } else {
        token = refreshData.session.access_token;
        response = await doFetch(token);
      }
    } catch {
      await signOut();
    }
  }

  let resultData: any = null;
  let errorMsg = '';
  let rawText = '';
  
  // Try to parse JSON body
  try {
    rawText = await response.text();
    const json = JSON.parse(rawText);
    if (!response.ok) {
      errorMsg = json.error || json.message || 'İşlem sırasında bir hata oluştu.';
    } else {
      resultData = json;
    }
  } catch {
    // If not JSON, use text
    if (!response.ok) {
      errorMsg = rawText.substring(0, 300) || 'İşlem sırasında bir hata oluştu.';
    }
  }

  if (!response.ok) {
    const debugInfo = `[HTTP ${response.status}] [Resp: ${rawText.substring(0, 50)}]`;
    if (response.status === 401) errorMsg = `${SESSION_EXPIRED_MSG} \n\nDEBUG: ${debugInfo}`;
    else if (response.status === 403) errorMsg = 'verified_restaurant_owner_only';
    else if (response.status === 429) errorMsg = 'Günlük gönderim limitinize ulaştınız. Lütfen yarın tekrar deneyin.';
    else if (response.status === 400 && !errorMsg) errorMsg = 'Geçersiz bilgiler gönderildi. Lütfen girdiğiniz linki kontrol edin.';
    // Fallback if still empty
    if (!errorMsg || errorMsg === 'İşlem sırasında bir hata oluştu.') {
      errorMsg = `Bir hata oluştu. \n\nDEBUG: ${debugInfo}`;
    }
    
    throw new Error(errorMsg);
  }

  return resultData;
}

export async function submitMenu(
  restaurantId: string,
  url: string,
  categorySlug?: string,
): Promise<{ id: string; status: string }> {
  const body: Record<string, unknown> = { restaurant_id: restaurantId, url };
  if (categorySlug) body.category_slug = categorySlug;

  try {
    const d = await invokeEdgeFunction('submit-menu', body);
    
    if (d?.error) throw new Error(d.error);
    if (!d?.id) throw new Error('Menü gönderilemedi. Lütfen tekrar deneyin.');

    return { id: d.id, status: d.status ?? 'pending' };
  } catch (err) {
    throw new Error(toFriendlyError((err as Error).message));
  }
}
