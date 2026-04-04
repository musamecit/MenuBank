/**
 * App statik import (release'te dynamic import takılmasın).
 * Splash: önce sync hide, sonra hideAsync — native katman farklı build'lerde farklı davranabiliyor.
 */
import React, { useLayoutEffect, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

function hideSplash() {
  try {
    SplashScreen.hide();
  } catch {
    /* ignore */
  }
  void SplashScreen.hideAsync().catch(() => {});
}

export default function Bootstrap() {
  useLayoutEffect(() => {
    hideSplash();
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => hideSplash());
    return () => cancelAnimationFrame(id);
  }, []);

  return <App />;
}
