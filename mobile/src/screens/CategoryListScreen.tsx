import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { fetchNearby, type NearbyRestaurant } from '../lib/explore';
import RestaurantCard from '../components/RestaurantCard';
import { RestaurantSkeletonList } from '../components/RestaurantSkeleton';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type RouteType = RouteProp<RootStackParamList, 'CategoryList'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const RADIUS_OPTIONS = [3000, 5000, 10000] as const;

function sortByGoogleRating(items: NearbyRestaurant[]): NearbyRestaurant[] {
  return [...items].sort((a, b) => {
    const ga = a.google_rating != null ? Number(a.google_rating) : -1;
    const gb = b.google_rating != null ? Number(b.google_rating) : -1;
    if (gb !== ga) return gb - ga;
    return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
  });
}

async function loadCategoryRows(
  categorySlug: string,
  radiusMeters: number,
): Promise<{ denied: boolean; items: NearbyRestaurant[] }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { denied: true, items: [] };
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const data = await fetchNearby(loc.coords.latitude, loc.coords.longitude, radiusMeters, { categorySlug });
  return { denied: false, items: sortByGoogleRating(data) };
}

export default function CategoryListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<Nav>();
  const { categorySlug } = route.params;
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + 8;

  const [items, setItems] = useState<NearbyRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState<(typeof RADIUS_OPTIONS)[number]>(5000);
  const isFirstFetch = useRef(true);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    let cancelled = false;
    const fullSkeleton = isFirstFetch.current;
    (async () => {
      if (fullSkeleton) setLoading(true);
      else setRefreshing(true);
      try {
        const { denied, items: next } = await loadCategoryRows(categorySlug, radiusMeters);
        if (cancelled) return;
        setPermissionDenied(denied);
        setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
        isFirstFetch.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categorySlug, radiusMeters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { denied, items: next } = await loadCategoryRows(categorySlug, radiusMeters);
      setPermissionDenied(denied);
      setItems(next);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [categorySlug, radiusMeters]);

  const distanceLabel = useCallback(
    (m: number) => {
      if (m === 3000) return t('explore.distance3km');
      if (m === 5000) return t('explore.distance5km');
      return t('explore.distance10km');
    },
    [t],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <RestaurantSkeletonList count={6} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {permissionDenied ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('explore.enableLocation')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('explore.filterDistance')}</Text>
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map((m) => {
                const active = radiusMeters === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => setRadiusMeters(m)}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : { color: colors.text }]}>
                      {distanceLabel(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <FlashList
            style={{ flex: 1 }}
            data={items}
            keyExtractor={(item) => String(item.id)}
            estimatedItemSize={102}
            renderItem={({ item }) => (
              <RestaurantCard
                id={String(item.id)}
                name={String(item.name ?? '')}
                cityName={String(item.city_name ?? '')}
                areaName={String(item.area_name ?? '')}
                imageUrl={item.image_url as string | null}
                isVerified={Boolean(item.is_verified)}
                priceLevel={item.price_level as string | null}
                googleRating={item.google_rating}
                distance={item.distance_meters}
                onPress={(id) => navigation.navigate('RestaurantDetail', { restaurantId: id })}
              />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>{t('search.noResults') || 'Sonuç bulunamadı'}</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          />
        </>
      )}
      <SafeBannerAd />
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 20 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    filterSection: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    filterLabel: { fontSize: 13, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 13 },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  });
}
