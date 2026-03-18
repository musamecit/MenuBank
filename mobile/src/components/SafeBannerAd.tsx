import React, { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

/** Sabit banner yüksekliği - liste paddingBottom için kullanılır */
export const BANNER_HEIGHT_TOTAL = 70;

const BANNER_UNIT_ID_PROD = 'ca-app-pub-6812424036943781/2680494724';
const BANNER_WIDTH = 320;
const BANNER_HEIGHT = 50;

interface AdModule {
  BannerAd: React.ComponentType<Record<string, unknown>>;
  BannerAdSize: { BANNER: string };
  TestIds: { BANNER: string };
}

let cachedModule: AdModule | null = null;

function loadAdModule(): AdModule | null {
  if (cachedModule) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-google-mobile-ads');
    cachedModule = {
      BannerAd: mod.BannerAd,
      BannerAdSize: mod.BannerAdSize,
      TestIds: mod.TestIds,
    };
    return cachedModule;
  } catch {
    return null;
  }
}

function BannerPlaceholder({ colors }: { colors: { background: string; border: string; textSecondary: string } }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8, backgroundColor: colors.background }}>
      <View
        style={{
          width: BANNER_WIDTH,
          height: BANNER_HEIGHT,
          backgroundColor: colors.border,
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Reklam alanı</Text>
      </View>
    </View>
  );
}

interface SafeBannerAdProps {
  /** true = ekranın altında sabit (varsayılan), false = inline (ListFooterComponent için) */
  fixed?: boolean;
}

export default function SafeBannerAd({ fixed = true }: SafeBannerAdProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [adModule, setAdModule] = useState<AdModule | null>(loadAdModule);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!adModule) {
      const mod = loadAdModule();
      if (mod) setAdModule(mod);
    }
  }, [adModule]);

  const onAdFailedToLoad = useCallback(() => setFailed(true), []);

  if (!adModule || failed) {
    const content = <BannerPlaceholder colors={colors} />;
    if (!fixed) return content;
    return (
      <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.background }}>
        {content}
      </View>
    );
  }

  const { BannerAd, BannerAdSize, TestIds } = adModule;
  const unitId = (__DEV__ ? TestIds?.BANNER : null) ?? BANNER_UNIT_ID_PROD;

  const content = (
    <View style={{ alignItems: 'center', paddingVertical: 8, backgroundColor: colors.background }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize?.BANNER ?? 'BANNER'}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={onAdFailedToLoad}
      />
    </View>
  );

  if (!fixed) return content;

  return (
    <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.background }}>
      {content}
    </View>
  );
}
