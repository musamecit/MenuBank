import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { initializeAds } from '../lib/ads';

/** Sabit banner yüksekliği — liste/scroll padding ile aynı (AdMob BANNER ≈ 50pt) */
export const BANNER_HEIGHT_TOTAL = 50;

const BANNER_UNIT_ID_PROD = 'ca-app-pub-6812424036943781/2680494724';

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

interface SafeBannerAdProps {
  fixed?: boolean;
}

const BANNER_W = Math.min(320, Dimensions.get('window').width);

/**
 * Alt navigasyonun üstünde standart banner (≈320×50). Expo Go’da native modül yoktur — dev build gerekir.
 */
export default function SafeBannerAd({ fixed: _fixed = true }: SafeBannerAdProps) {
  const { colors } = useTheme();
  const [adModule, setAdModule] = useState<AdModule | null>(loadAdModule);
  const [sdkReady, setSdkReady] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const failCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initializeAds();
      if (!cancelled) {
        setSdkReady(true);
        const mod = loadAdModule();
        if (mod) setAdModule(mod);
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!adModule) {
      const mod = loadAdModule();
      if (mod) setAdModule(mod);
    }
  }, [adModule]);

  const onAdFailedToLoad = useCallback((err?: { code?: string; message?: string }) => {
    if (__DEV__) {
      console.warn('[SafeBannerAd] load failed', err?.code ?? err?.message ?? err);
    }
    failCountRef.current += 1;
    if (failCountRef.current >= 4) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRemountKey((k) => k + 1);
    }, 2500);
  }, []);

  const onAdLoaded = useCallback(() => {
    failCountRef.current = 0;
  }, []);

  const testBannerId = adModule?.TestIds?.BANNER;
  const unitId = __DEV__ ? (testBannerId ?? BANNER_UNIT_ID_PROD) : BANNER_UNIT_ID_PROD;
  /** Geliştirmede Google test birimi + tam istek; prod’da kişiselleştirilmemiş */
  const requestOptions = __DEV__
    ? undefined
    : { requestNonPersonalizedAdsOnly: true };

  let adInner: React.ReactNode = null;
  if (adModule && sdkReady) {
    const Ad = adModule.BannerAd;
    const bannerSize = adModule.BannerAdSize.BANNER;
    adInner = (
      <View style={[styles.bannerClip, { width: BANNER_W }]}>
        <Ad
          key={remountKey}
          unitId={unitId}
          size={bannerSize}
          {...(requestOptions ? { requestOptions } : {})}
          onAdLoaded={onAdLoaded}
          onAdFailedToLoad={onAdFailedToLoad}
        />
      </View>
    );
  } else if (__DEV__ && !adModule) {
    adInner = (
      <Text style={[styles.devHint, { color: colors.textSecondary }]} numberOfLines={2}>
        Ads need a dev build (not Expo Go)
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.slot,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
      accessibilityLabel="Advertisement"
    >
      {adInner}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: BANNER_HEIGHT_TOTAL,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bannerClip: {
    height: BANNER_HEIGHT_TOTAL,
    maxHeight: BANNER_HEIGHT_TOTAL,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  devHint: {
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
