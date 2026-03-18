export default {
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
        NSCameraUsageDescription: 'Menü linkini almak için QR kodu taramanız gerekiyor.',
        NSUserTrackingUsageDescription:
          'We use this to aggregation-only analytics: anonymous counts for search and trends. No individual tracking.',
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
      'expo-image',
      ['expo-camera', { cameraPermission: 'Menü linkini almak için QR kodu taramanız gerekiyor.', barcodeScannerEnabled: true }],
      'expo-web-browser',
      ['expo-location', { locationWhenInUsePermission: 'Show nearby restaurants on the map' }],
      'expo-notifications',
    ],
    scheme: 'qrmenu',
    extra: {
      eas: { projectId: 'e881fb64-8569-4657-8629-e2be5caef69e' },
      EXPO_PUBLIC_SUPABASE_URL: 'https://byjcxrgcrcxeklhfmqxr.supabase.co',
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: '[REDACTED_GOOGLE_PLACES_API_KEY]',
    },
  },
};
