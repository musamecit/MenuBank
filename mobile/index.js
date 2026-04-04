/**
 * Splash: preventAutoHideAsync global scope'ta olmalı (Expo SDK 55), yoksa release'te
 * native splash bazen hiç kapanmıyor. Bootstrap içinde hide çağrılır.
 */
const { registerRootComponent } = require('expo');
const SplashScreen = require('expo-splash-screen');

SplashScreen.preventAutoHideAsync().catch(() => {});

/** require(Bootstrap) patlasa bile zamanlayıcı kurulsun */
setTimeout(() => {
  try {
    SplashScreen.hide();
  } catch (_) {}
  const p = SplashScreen.hideAsync?.();
  if (p && typeof p.then === 'function') p.catch(() => {});
}, 8000);

registerRootComponent(require('./Bootstrap').default);
