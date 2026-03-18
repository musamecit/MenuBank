/**
 * Bootstrap: Splash'ı hemen kapatır, sonra tam App'i yükler.
 * Bu sayede splash donması önlenir - önce minimal render, hemen hide, sonra App.
 */
import React, { useLayoutEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

export default function Bootstrap() {
  const [App, setApp] = useState<React.ComponentType | null>(null);

  // useLayoutEffect: İlk commit'ten hemen sonra çalışır - splash'ı anında kapat
  useLayoutEffect(() => {
    SplashScreen.hide();
  }, []);

  // App'i lazy yükle - ilk render'da sadece minimal UI, splash hemen kapanır
  React.useEffect(() => {
    let cancelled = false;
    import('./App').then((mod) => {
      if (!cancelled) setApp(() => mod.default);
    });
    return () => { cancelled = true; };
  }, []);

  if (!App) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <App />;
}
