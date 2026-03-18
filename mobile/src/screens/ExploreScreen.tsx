import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Dimensions, Modal, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Picker } from '@react-native-picker/picker';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, SlidersHorizontal, Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { fetchNearby, fetchCuratedLists, radiusFromLatitudeDelta, type NearbyRestaurant, type CuratedList } from '../lib/explore';
import { fetchRestaurant, fetchMenuEntries } from '../lib/restaurants';
import { toggleFavoriteCuratedList } from '../lib/userCuratedListFavorites';
import { getFavorites } from '../lib/favorites';
import RestaurantCard from '../components/RestaurantCard';
import { RestaurantSkeletonList } from '../components/RestaurantSkeleton';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import { fetchCountries, fetchCities, fetchAreas, type Country, type City, type Area } from '../lib/locations';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SubTab = 'nearby' | 'lists' | 'favorites';
type PriceFilter = 'all' | 'cheap' | 'medium' | 'expensive';
type DistanceFilter = 1000 | 3000 | 5000 | 20000;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;

const RestaurantMarker = React.memo(
  ({ r, onPress }: { r: NearbyRestaurant; onPress: (id: string) => void }) => (
    <Marker
      coordinate={{ latitude: Number(r.lat), longitude: Number(r.lng) }}
      title={r.name}
      description={r.area_name ? `${r.area_name}, ${r.city_name}` : r.city_name}
      onPress={() => onPress(r.id)}
      onCalloutPress={() => onPress(r.id)}
      tracksViewChanges={false}
    />
  ),
  (prev, next) =>
    prev.r.id === next.r.id && prev.r.lat === next.r.lat && prev.r.lng === next.r.lng,
);

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const mapRef = useRef<MapView>(null);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + insets.bottom;

  const [subTab, setSubTab] = useState<SubTab>('nearby');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>(5000);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const regionFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nearby, setNearby] = useState<NearbyRestaurant[]>([]);
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [favoritedListIds, setFavoritedListIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Load location options from DB
  useEffect(() => {
    fetchCountries().then(setCountries).catch(() => {});
  }, []);

  useEffect(() => {
    if (countryCode) {
      fetchCities(countryCode).then(setCities).catch(() => {});
      setCity(null);
      setArea(null);
      setAreas([]);
    }
  }, [countryCode]);

  useEffect(() => {
    if (city?.id) {
      fetchAreas(city.id).then(setAreas).catch(() => {});
      setArea(null);
    }
  }, [city]);

  const loadNearby = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    const data = await fetchNearby(location.lat, location.lng, distanceFilter, {
      priceFilter,
      countryCode: countryCode ?? undefined,
      cityName: city?.name ?? undefined,
      areaName: area?.name ?? undefined,
      categorySlug: categorySlug ?? undefined,
    });
    setNearby(data);
    setLoading(false);
  }, [location, priceFilter, distanceFilter, countryCode, city, area, categorySlug]);

  const loadForMapRegion = useCallback(async (region: Region) => {
    const radius = radiusFromLatitudeDelta(region.latitudeDelta);
    try {
      const data = await fetchNearby(region.latitude, region.longitude, radius, {
        priceFilter,
        countryCode: countryCode ?? undefined,
        cityName: city?.name ?? undefined,
        areaName: area?.name ?? undefined,
        categorySlug: categorySlug ?? undefined,
      });
      setNearby(data);
    } catch {
      // Sessizce devam et - harita flicker için setLoading kullanmıyoruz
    }
  }, [priceFilter, countryCode, city, area, categorySlug]);

  useEffect(() => {
    if (subTab === 'nearby' && location) loadNearby();
  }, [subTab, location, loadNearby]);

  useEffect(() => {
    if (subTab === 'lists') {
      setLoading(true);
      fetchCuratedLists().then(async (data) => {
        setLists(data);
        if (user) {
          const { getFavoriteCuratedLists } = await import('../lib/userCuratedListFavorites');
          const favs = await getFavoriteCuratedLists(user.id);
          setFavoritedListIds(new Set(favs.map((f) => f.id)));
        }
      }).finally(() => setLoading(false));
    }
  }, [subTab, user]);

  useEffect(() => {
    if (subTab === 'favorites' && user) {
      setLoading(true);
      getFavorites(user.id).then((d) => setFavorites((d ?? []) as Record<string, unknown>[])).finally(() => setLoading(false));
    }
  }, [subTab, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (subTab === 'nearby' && location) {
      const data = await fetchNearby(location.lat, location.lng, distanceFilter, {
        priceFilter,
        countryCode: countryCode ?? undefined,
        cityName: city?.name ?? undefined,
        areaName: area?.name ?? undefined,
        categorySlug: categorySlug ?? undefined,
      });
      setNearby(data);
    } else if (subTab === 'lists') {
      const data = await fetchCuratedLists();
      setLists(data);
    } else if (subTab === 'favorites' && user) {
      const data = await getFavorites(user.id);
      setFavorites((data ?? []) as Record<string, unknown>[]);
    }
    setRefreshing(false);
  }, [subTab, location, priceFilter, distanceFilter, countryCode, city, area, categorySlug, user]);

  const goToRestaurant = useCallback(
    (id: string) => navigation.navigate('RestaurantDetail', { restaurantId: id }),
    [navigation],
  );

  const initialMapRegion = useMemo(() => {
    if (!location) return null;
    return {
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [location?.lat, location?.lng]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (regionFetchRef.current) clearTimeout(regionFetchRef.current);
    regionFetchRef.current = setTimeout(() => {
      loadForMapRegion(region);
      regionFetchRef.current = null;
    }, 400);
  }, [loadForMapRegion]);

  const mapMarkers = useMemo(
    () => nearby.filter((r) => r.lat != null && r.lng != null),
    [nearby],
  );

  // İlk 3 restoran detayını prefetch et - tıklanınca anında açılsın
  useEffect(() => {
    const ids = nearby.slice(0, 3).map((r) => r.id);
    ids.forEach((id) => {
      queryClient.prefetchQuery({ queryKey: ['restaurant', id], queryFn: () => fetchRestaurant(id) });
      queryClient.prefetchQuery({ queryKey: ['menuEntries', id], queryFn: () => fetchMenuEntries(id) });
    });
  }, [nearby, queryClient]);

  const renderItem = ({ item }: { item: NearbyRestaurant }) => (
    <RestaurantCard
      id={item.id}
      name={item.name}
      cityName={item.city_name}
      areaName={item.area_name}
      imageUrl={item.image_url}
      isVerified={item.is_verified}
      priceLevel={item.price_level}
      googleRating={item.google_rating}
      distance={item.distance_meters}
      onPress={goToRestaurant}
    />
  );

  const renderFavItem = ({ item }: { item: Record<string, unknown> }) => (
    <RestaurantCard
      id={String(item.id)}
      name={String(item.name ?? '')}
      cityName={String(item.city_name ?? '')}
      areaName={String(item.area_name ?? '')}
      imageUrl={item.image_url as string | null}
      isVerified={Boolean(item.is_verified)}
      priceLevel={item.price_level as string | null}
      onPress={goToRestaurant}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header bar with search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MenuBank</Text>
      </View>
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Search')}
      >
        <Search size={20} color={colors.textSecondary} />
        <Text style={[styles.searchBarPlaceholder, { color: colors.textSecondary }]}>
          {t('explore.searchPlaceholder')}
        </Text>
      </TouchableOpacity>

      {/* Filter modal */}
      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={styles.modalTitle}>{t('explore.filterTitle')}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>{t('explore.filterCountry')}</Text>
              <View style={[styles.pickerWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Picker
                  selectedValue={countryCode ?? ''}
                  onValueChange={(v) => setCountryCode(v ? String(v) : null)}
                  style={[styles.picker, { color: colors.text }]}
                  prompt={t('explore.filterCountry')}
                  mode={Platform.OS === 'ios' ? 'dialog' : 'dropdown'}
                >
                  <Picker.Item label={t('explore.filterAll')} value="" />
                  {countries.map((c) => (
                    <Picker.Item key={c.code} label={c.name} value={c.code} />
                  ))}
                </Picker>
              </View>
              <Text style={styles.modalLabel}>{t('explore.filterCity')}</Text>
              <View style={[styles.pickerWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Picker
                  selectedValue={city?.id ?? ''}
                  onValueChange={(v) => {
                    const c = cities.find((x) => x.id === v);
                    setCity(c ?? null);
                  }}
                  style={[styles.picker, { color: colors.text }]}
                  prompt={t('explore.filterCity')}
                  mode={Platform.OS === 'ios' ? 'dialog' : 'dropdown'}
                  enabled={!!countryCode && cities.length > 0}
                >
                  <Picker.Item
                    label={!countryCode ? t('explore.filterCityHint') : cities.length === 0 ? t('common.loading') : t('explore.filterAll')}
                    value=""
                  />
                  {cities.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
              {city && countryCode && (
                <TouchableOpacity
                  style={[styles.modalChip, { marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.accentMuted }]}
                  onPress={() => {
                    setFilterModalVisible(false);
                    navigation.navigate('CityTrend', { country: countryCode, city: city.name });
                  }}
                >
                  <Text style={[styles.modalChipText, { color: colors.accent, fontWeight: '600' }]}>
                    {t('explore.cityBest')} →
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.modalLabel}>{t('explore.filterDistrict')}</Text>
              <View style={[styles.pickerWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Picker
                  selectedValue={area?.id ?? ''}
                  onValueChange={(v) => {
                    const a = areas.find((x) => x.id === v);
                    setArea(a ?? null);
                  }}
                  style={[styles.picker, { color: colors.text }]}
                  prompt={t('explore.filterDistrict')}
                  mode={Platform.OS === 'ios' ? 'dialog' : 'dropdown'}
                  enabled={!!city && areas.length > 0}
                >
                  <Picker.Item label={!city ? t('explore.filterDistrictHint') : areas.length === 0 ? t('explore.noAreas') : t('explore.filterAll')} value="" />
                  {areas.map((a) => (
                    <Picker.Item key={a.id} label={a.name} value={a.id} />
                  ))}
                </Picker>
              </View>
              <Text style={styles.modalLabel}>{t('explore.filterDistance')}</Text>
              <View style={styles.modalRow}>
                {([1000, 3000, 5000] as DistanceFilter[]).map((d) => {
                  const label = d === 1000 ? t('explore.distance1km') : d === 3000 ? t('explore.distance3km') : t('explore.distance5km');
                  const isActive = distanceFilter === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.modalChip, isActive && styles.modalChipActive]}
                      onPress={() => setDistanceFilter(d)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, isActive && styles.modalChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.modalLabel}>{t('explore.filterPrice')}</Text>
              <View style={styles.modalRow}>
                {(['all', 'cheap', 'medium', 'expensive'] as PriceFilter[]).map((f) => {
                  const label =
                    f === 'all' ? t('explore.filterAll')
                      : f === 'cheap' ? t('explore.filterCheap')
                        : f === 'medium' ? t('explore.filterAverage')
                          : t('explore.filterExpensive');
                  const isActive = priceFilter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.modalChip, isActive && styles.modalChipActive]}
                      onPress={() => setPriceFilter(f)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalChipText, isActive && styles.modalChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.modalLabel}>{t('explore.filterCategory')}</Text>
              <View style={styles.modalRow}>
                {[
                  { slug: 'restaurant', label: 'Restoran' },
                  { slug: 'bar', label: 'Bar' },
                  { slug: 'meyhane', label: 'Meyhane' },
                  { slug: 'cafe', label: 'Cafe' },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.slug}
                    style={[styles.modalChip, categorySlug === cat.slug && styles.modalChipActive]}
                    onPress={() => setCategorySlug(categorySlug === cat.slug ? null : cat.slug)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        categorySlug === cat.slug && styles.modalChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setCountryCode(null);
                  setCity(null);
                  setArea(null);
                  setCategorySlug(null);
                  setDistanceFilter(5000);
                  setPriceFilter('all');
                  setFilterModalVisible(false);
                  loadNearby();
                }}
              >
                <Text style={styles.modalReset}>{t('explore.filterReset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalApplyBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  setFilterModalVisible(false);
                  loadNearby();
                }}
              >
                <Text style={styles.modalApplyText}>{t('explore.filterApply')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sub-tabs + Filter icon */}
      <View style={styles.tabRow}>
        {(['nearby', 'lists', 'favorites'] as SubTab[]).map((tab) => {
          const label = tab === 'nearby' ? t('explore.nearby') : tab === 'lists' ? t('explore.lists') : t('explore.favorites');
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, subTab === tab && styles.tabActive]}
              onPress={() => { setSubTab(tab); setLoading(true); }}
            >
              <Text style={[styles.tabText, subTab === tab && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.filterIconBtn, { borderColor: colors.border }]}
          onPress={() => setFilterModalVisible(true)}
        >
          <SlidersHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {permissionDenied && subTab === 'nearby' ? (
        <View style={[styles.empty, { flex: 1 }]}>
          <Text style={styles.emptyText}>{t('explore.enableLocation')}</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestLocation}>
            <Text style={styles.permBtnText}>{t('explore.grantPermission')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {subTab === 'nearby' ? (
            <FlashList
              style={{ flex: 1 }}
              data={nearby}
              keyExtractor={(item) => item.id}
              estimatedItemSize={102}
              renderItem={renderItem}
              ListHeaderComponent={
                location && initialMapRegion ? (
                  <View style={styles.mapContainer} collapsable={false}>
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={initialMapRegion}
                      onRegionChangeComplete={handleRegionChangeComplete}
                      showsUserLocation
                      scrollEnabled
                      zoomEnabled
                      zoomTapEnabled
                      pitchEnabled={false}
                      rotateEnabled={false}
                      mapType="standard"
                    >
                      {mapMarkers.map((r) => (
                        <RestaurantMarker key={r.id} r={r} onPress={goToRestaurant} />
                      ))}
                    </MapView>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                loading ? (
                  <View style={{ paddingVertical: 12 }}>
                    <RestaurantSkeletonList count={5} />
                  </View>
                ) : (
                  <Text style={styles.emptyText}>{t('explore.noNearby')}</Text>
                )
              }
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
              contentContainerStyle={{ paddingBottom: listPaddingBottom + 12, flexGrow: 1 }}
            />
          ) : subTab === 'lists' ? (
            <FlashList
              data={lists}
              keyExtractor={(item) => item.id}
              estimatedItemSize={72}
              renderItem={({ item }) => {
                const isFav = favoritedListIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.listCard}
                    onPress={() => navigation.navigate('UserListDetail', { listId: item.id, title: item.title_tr })}
                  >
                    <Text style={styles.listTitle}>{item.title_tr}</Text>
                    {user && (
                      <TouchableOpacity
                        style={styles.listFavBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleFavoriteCuratedList(user.id, item.id).then((now) => {
                            setFavoritedListIds((prev) => {
                              const next = new Set(prev);
                              if (now) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          });
                        }}
                      >
                        <Heart size={20} color={isFav ? colors.error : colors.textSecondary} fill={isFav ? colors.error : 'transparent'} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('explore.noLists')}</Text>}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
              contentContainerStyle={{ paddingBottom: listPaddingBottom + 12 }}
            />
          ) : subTab === 'favorites' ? (
            !user ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('addMenu.loginRequired')}</Text>
                <TouchableOpacity style={styles.permBtn} onPress={() => navigation.navigate('Auth')}>
                  <Text style={styles.permBtnText}>{t('profile.login')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlashList
                data={favorites}
                keyExtractor={(item) => String(item.id)}
                estimatedItemSize={102}
                renderItem={renderFavItem}
                ListEmptyComponent={<Text style={styles.emptyText}>{t('explore.noFavorites')}</Text>}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                contentContainerStyle={{ paddingBottom: listPaddingBottom + 12 }}
              />
            )
          ) : null}
        </View>
      )}
      <SafeBannerAd />
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: colors.surface,
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: colors.accent },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 10,
    },
    searchBarPlaceholder: { fontSize: 15, flex: 1 },
    tabRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 16, gap: 4 },
    tab: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.accent },
    tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: colors.accent, fontWeight: '600' },
    map: { width: SCREEN_WIDTH, height: MAP_HEIGHT },
    mapContainer: { width: SCREEN_WIDTH, height: MAP_HEIGHT },
    locationFilterBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: colors.background,
      gap: 8,
    },
    locationChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    locationChipText: { fontSize: 13, color: colors.text },
    locationChipArrow: { fontSize: 13, color: colors.textSecondary },
    filterRow: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' },
    chip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    chipActive: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent,
    },
    chipCheap: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.accentDark, backgroundColor: colors.accentMuted,
    },
    chipCheapActive: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.accentDark, backgroundColor: colors.accentDark,
    },
    chipExpensive: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: `${colors.error}40`, backgroundColor: `${colors.error}18`,
    },
    chipExpensiveActive: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.error, backgroundColor: colors.error,
    },
    chipText: { fontSize: 13, color: colors.text },
    chipTextActive: { fontSize: 13, color: '#fff', fontWeight: '600' },
    chipCheapText: { fontSize: 13, color: colors.accentDark, fontWeight: '600' },
    chipExpensiveText: { fontSize: 13, color: colors.error, fontWeight: '600' },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginLeft: 'auto',
      gap: 6,
    },
    filterButtonText: { fontSize: 13, color: colors.text },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    permBtn: { marginTop: 16, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
    permBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    listCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, marginVertical: 6,
      padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    listTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    listFavBtn: { padding: 4 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      padding: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalScroll: { maxHeight: 400 },
    modalHint: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
    filterIconBtn: {
      marginLeft: 'auto',
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: colors.text },
    modalLabel: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 4, color: colors.text },
    pickerWrap: {
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 4,
      overflow: 'hidden',
    },
    picker: { height: Platform.OS === 'ios' ? 120 : 48 },
    modalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    modalChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modalChipText: { fontSize: 13, color: colors.text },
    modalChipTextActive: { color: '#fff', fontWeight: '600' },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
    },
    modalReset: { fontSize: 14, color: colors.textSecondary },
    modalApplyBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
    },
    modalApplyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });
}
