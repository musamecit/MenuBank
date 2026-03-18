/**
 * Entry point - Splash stratejisi:
 * 1. preventAutoHideAsync KALDIRILDI (Expo'da bilinen buglar var)
 * 2. Varsayılan auto-hide'a güveniyoruz
 * 3. Bootstrap ile önce minimal render, hemen hide, sonra tam App
 */
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

// App'i bu aşamada import etme - Bootstrap önce yüklenecek
registerRootComponent(require('./Bootstrap').default);
