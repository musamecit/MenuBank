// Referral sistemi backend'de devre dışı bırakıldı.
// Bu dosya yalnızca gelecekteki olası yeniden aktivasyon için placeholder olarak tutuluyor.

export async function getReferralCode(): Promise<string | null> {
  return null;
}

export async function redeemReferralCode(_code: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Referral disabled' };
}
