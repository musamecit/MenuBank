/**
 * AdMob başlatma — Banner bileşeninden ve App kökünden çağrılır.
 */
export async function initializeAds(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-google-mobile-ads');
    if (!mod) return false;
    const mobileAds = mod.default;
    if (typeof mobileAds === 'function') {
      await mobileAds().initialize();
      return true;
    }
    return false;
  } catch (e) {
    console.warn('AdMob init failed', e);
    return false;
  }
}
