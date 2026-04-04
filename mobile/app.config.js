// Hassas değerler repoda yok: EXPO_PUBLIC_* ortam değişkenleri veya EAS Secrets (eas secret:push).
module.exports = {
  expo: {
    name: 'MenuBank',
    slug: 'QRMenu',
    owner: 'musamecit',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/QRMenu_AppIcon_1024x1024.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    // reactCompiler kapatıldı - Hermes crash riski nedeniyle
    // experiments: { reactCompiler: true },
    splash: {
      image: './assets/QRMenu_SplashScreen_iPhone.png',
      resizeMode: 'contain',
      backgroundColor: '#020617',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.musamecit.qrmenu',
      buildNumber: '4',
      associatedDomains: ['applinks:qrmenu.app'],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: 'Show nearby restaurants on the map',
        NSLocationAlwaysUsageDescription: 'Allow QRMenu to access your location',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Allow QRMenu to access your location',
        NSCameraUsageDescription: 'Scan QR codes to quickly add menu links.',
        GADApplicationIdentifier: 'ca-app-pub-6812424036943781~5306658061',
        SKAdNetworkItems: [
          { SKAdNetworkIdentifier: 'cstr6suwn9.skadnetwork' },
          { SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork' },
          { SKAdNetworkIdentifier: 'n38lu8286q.skadnetwork' },
          { SKAdNetworkIdentifier: '4fzdc2evr5.skadnetwork' },
          { SKAdNetworkIdentifier: '4pfyvq9l8r.skadnetwork' },
          { SKAdNetworkIdentifier: 'ydx93a7ass.skadnetwork' },
          { SKAdNetworkIdentifier: 'p78ahlhev4.skadnetwork' },
        ],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/QRMenu_AppIcon_1024x1024.png',
        backgroundColor: '#020617',
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
      ],
      package: 'com.musamecit.qrmenu',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    platforms: ['ios', 'android'],
    plugins: [
      'expo-splash-screen',
      'expo-localization',
      './plugins/withIosBuildScriptRobustness.cjs',
      './plugins/withIosPodfilePostInstallFixes.cjs',
      [
        'expo-build-properties',
        {
          // RN 0.83 ön-derlenmiş ReactNativeDependencies kullanırken RCT-Folly ayrı pod değildir;
          // react-native-iap (RNIap) New Arch için RCT-Folly spec'ine bağımlı → pod install çözümü için
          // iOS'ta üçüncü parti RN bağımlılıklarını kaynaktan derle (RCT-Folly grafiğe girer). Android değişmez.
          ios: {
            buildReactNativeFromSource: true,
          },
        },
      ],
      'expo-image',
      ['expo-camera', { cameraPermission: 'Scan QR codes to quickly add menu links.', barcodeScannerEnabled: true }],
      'expo-web-browser',
      ['expo-location', { locationWhenInUsePermission: 'Show nearby restaurants on the map' }],
      'expo-notifications',
      'react-native-iap',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-6812424036943781~5306658061',
          iosAppId: 'ca-app-pub-6812424036943781~5306658061',
        },
      ],
    ],
    scheme: 'qrmenu',
    extra: {
      eas: { projectId: 'e881fb64-8569-4657-8629-e2be5caef69e' },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '',
    },
  },
};
