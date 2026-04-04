import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator,
  RefreshControl, Dimensions, Modal, ScrollView, TextInput, Linking,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, SlidersHorizontal, Heart, ChevronDown, ChevronLeft, Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { fetchNearby, fetchCuratedLists, radiusFromLatitudeDelta, type NearbyRestaurant, type CuratedList, calculateDistanceMeters } from '../lib/explore';
import { fetchRestaurant, fetchMenuEntries } from '../lib/restaurants';
import { toggleFavoriteCuratedList } from '../lib/userCuratedListFavorites';
import { getFavorites } from '../lib/favorites';
import RestaurantCard from '../components/RestaurantCard';
import { RestaurantSkeletonList } from '../components/RestaurantSkeleton';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import { fetchCountries, fetchCities, fetchAreas, type Country, type City, type Area } from '../lib/locations';
import { VENUE_CATEGORIES } from '../lib/venueCategories';
import { curatedListTitleField } from '../lib/languages';
import { fetchUnreadNotificationCount } from '../lib/userNotifications';
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
      onCalloutPress={() => onPress(r.id)}
      tracksViewChanges={false}
    />
  ),
  (prev, next) =>
    prev.r.id === next.r.id && prev.r.lat === next.r.lat && prev.r.lng === next.r.lng,
);

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlashListRef<NearbyRestaurant>>(null);
  const scrollToTopAfterRegionChangeRef = useRef(false);
  const queryClient = useQueryClient();
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + 8;
  const curatedTitleKey = curatedListTitleField(i18n.language);

  const [subTab, setSubTab] = useState<SubTab>('nearby');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>(5000);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const filterModalVisibleRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState<'country' | 'city' | 'district' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const regionFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mapRestaurants, setMapRestaurants] = useState<NearbyRestaurant[]>([]);
  const [listRestaurants, setListRestaurants] = useState<NearbyRestaurant[]>([]);
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [favoritedListIds, setFavoritedListIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [areasLoading, setAreasLoading] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const refreshUnreadNotif = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotifCount(0);
      return;
    }
    const n = await fetchUnreadNotificationCount(user.id);
    setUnreadNotifCount(n);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadNotif();
    }, [refreshUnreadNotif]),
  );

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }
    setPermissionDenied(false);
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo && geo.length > 0) {
        const g = geo[0];
        if (g.isoCountryCode) {
           setCountryCode(g.isoCountryCode); // Varsayılan ülkeyi offline JSON için hazırla
        }
      }
    } catch (e) {}
  }, []);

  const handleGrantLocationPress = useCallback(async () => {
    await requestLocation();
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      Linking.openSettings();
    }
  }, [requestLocation]);

  const closeFilterModal = useCallback(() => {
    setPickerOpen(null);
    setPickerSearch('');
    setFilterModalVisible(false);
    filterModalVisibleRef.current = false;
  }, []);

  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
    filterModalVisibleRef.current = true;
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Load location options from DB
  useEffect(() => {
    fetchCountries().then(setCountries).catch(() => {});
  }, []);

  useEffect(() => {
    if (!countryCode) {
      setCities([]);
      setCity(null);
      setArea(null);
      setAreas([]);
      setCitiesLoading(false);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    setCities([]);
    setCity(null);
    setArea(null);
    setAreas([]);
    fetchCities(countryCode)
      .then((data) => {
        if (!cancelled) setCities(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  useEffect(() => {
    if (!city?.id || !countryCode) {
      setAreas([]);
      setArea(null);
      setAreasLoading(false);
      return;
    }
    let cancelled = false;
    setAreasLoading(true);
    setAreas([]);
    setArea(null);
    fetchAreas(countryCode, city.id)
      .then((data) => {
        if (!cancelled) setAreas(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAreas([]);
      })
      .finally(() => {
        if (!cancelled) setAreasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, countryCode]);

  const loadNearby = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    scrollToTopAfterRegionChangeRef.current = true;
    const data = await fetchNearby(location.lat, location.lng, distanceFilter, {
      priceFilter,
      countryCode: countryCode ?? undefined,
      cityName: city?.name ?? undefined,
      areaName: area?.name ?? undefined,
      categorySlug: categorySlug ?? undefined,
    });
    setListRestaurants(data);
    setMapRestaurants((prev) => prev.length === 0 ? data : prev); // Harita boşsa pinleri bas
    setLoading(false);
  }, [location, priceFilter, distanceFilter, countryCode, city, area, categorySlug]);

  const clearAllFiltersAndReload = useCallback(async () => {
    setCountryCode(null);
    setCity(null);
    setArea(null);
    setCategorySlug(null);
    setDistanceFilter(5000);
    setPriceFilter('all');
    closeFilterModal();
    if (!location) return;
    setLoading(true);
    scrollToTopAfterRegionChangeRef.current = true;
    const data = await fetchNearby(location.lat, location.lng, 5000, {
      priceFilter: 'all',
      countryCode: undefined,
      cityName: undefined,
      areaName: undefined,
      categorySlug: undefined,
    });
    setListRestaurants(data);
    setMapRestaurants(data);
    setLoading(false);
  }, [closeFilterModal, location]);

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
      setMapRestaurants(data);
    } catch {
      // Sessizce devam et - harita flicker için setLoading kullanmıyoruz
    }
  }, [priceFilter, countryCode, city, area, categorySlug]);

  // Harita bölge değişince liste otomatik scroll yapmasın - haritayı görünür tut
  useEffect(() => {
    if (!scrollToTopAfterRegionChangeRef.current || !listRef.current) return;
    scrollToTopAfterRegionChangeRef.current = false;
    listRef.current.scrollToOffset({ offset: 0, animated: false });
  }, [listRestaurants]);

  useEffect(() => {
    if (subTab === 'nearby' && location && !filterModalVisibleRef.current) loadNearby();
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
      setListRestaurants(data);
      setMapRestaurants(data);
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
    () => mapRestaurants.filter((r) => r.lat != null && r.lng != null),
    [mapRestaurants],
  );

  // İlk 3 restoran detayını prefetch et - tıklanınca anında açılsın
  useEffect(() => {
    const ids = listRestaurants.slice(0, 3).map((r) => r.id);
    ids.forEach((id) => {
      queryClient.prefetchQuery({ queryKey: ['restaurant', id], queryFn: () => fetchRestaurant(id) });
      queryClient.prefetchQuery({ queryKey: ['menuEntries', id], queryFn: () => fetchMenuEntries(id) });
    });
  }, [listRestaurants, queryClient]);

  const renderItem = ({ item }: { item: NearbyRestaurant }) => {
    let exactDistance = item.distance_meters;
    if (location && item.lat && item.lng) {
      exactDistance = calculateDistanceMeters(location.lat, location.lng, item.lat, item.lng);
    }

    return (
      <RestaurantCard
        id={item.id}
        name={item.name}
        cityName={item.city_name}
        areaName={item.area_name}
        imageUrl={item.image_url}
        isVerified={item.is_verified}
        priceLevel={item.price_level}
        googleRating={item.google_rating}
        distance={exactDistance}
        onPress={goToRestaurant}
      />
    );
  };

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

  const mapHeader = useMemo(() => {
    if (!location || !initialMapRegion) return null;
    return (
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
    );
  }, [location, initialMapRegion, mapMarkers, styles.mapContainer, styles.map, handleRegionChangeComplete, goToRestaurant]);

  return (
    <View style={styles.container}>
      {/* Header bar with search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MenuBank</Text>
        {user ? (
          <TouchableOpacity
            style={styles.headerBellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel={t('settings.notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Bell size={24} color={colors.text} />
            {unreadNotifCount > 0 ? (
              <View style={[styles.headerBellBadge, { borderColor: colors.surface }]}>
                <Text style={styles.headerBellBadgeText}>
                  {unreadNotifCount > 99 ? '99+' : String(unreadNotifCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
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

      {/* Filtre + ülke/şehir/ilçe seçici tek Modal içinde (iç içe Modal dokunulmuyordu) */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (pickerOpen) {
            setPickerOpen(null);
            setPickerSearch('');
          } else {
            closeFilterModal();
          }
        }}
      >
        <View style={{ flex: 1 }}>
          {pickerOpen ? (
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={() => {
                  setPickerOpen(null);
                  setPickerSearch('');
                }}
              />
              <View
                style={[
                  styles.pickerModalContent,
                  { backgroundColor: colors.surface, maxHeight: '88%' },
                ]}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}
                  onPress={() => {
                    setPickerOpen(null);
                    setPickerSearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ChevronLeft size={22} color={colors.accent} />
                  <Text style={[styles.pickerModalTitle, { color: colors.text, marginBottom: 0 }]}>
                    {pickerOpen === 'country' && t('explore.filterCountry')}
                    {pickerOpen === 'city' && t('explore.filterCity')}
                    {pickerOpen === 'district' && t('explore.filterDistrict')}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.pickerSearch,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                  ]}
                  placeholder={t('common.search') || 'Search...'}
                  placeholderTextColor={colors.textSecondary}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <ScrollView
                  style={styles.pickerModalList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {pickerOpen === 'country' && (
                    <>
                      {!pickerSearch && (
                        <TouchableOpacity
                          style={[styles.pickerOption, { borderColor: colors.border }]}
                          onPress={() => {
                            setCountryCode(null);
                            setCity(null);
                            setArea(null);
                            setPickerOpen(null);
                            setPickerSearch('');
                          }}
                        >
                          <Text style={[styles.pickerOptionText, { color: colors.text }]}>{t('explore.filterAll')}</Text>
                        </TouchableOpacity>
                      )}
                      {countries
                        .filter((c) => !pickerSearch || c.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((c) => (
                          <TouchableOpacity
                            key={c.code}
                            style={[
                              styles.pickerOption,
                              { borderColor: colors.border },
                              countryCode === c.code && { backgroundColor: colors.accentMuted },
                            ]}
                            onPress={() => {
                              setCountryCode(c.code);
                              setCity(null);
                              setArea(null);
                              setPickerOpen(null);
                              setPickerSearch('');
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                {
                                  color: countryCode === c.code ? colors.accent : colors.text,
                                  fontWeight: countryCode === c.code ? '700' : '400',
                                },
                              ]}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </>
                  )}
                  {pickerOpen === 'city' && (
                    <>
                      {citiesLoading ? (
                        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                          <ActivityIndicator color={colors.accent} size="large" />
                        </View>
                      ) : null}
                      {!pickerSearch && !citiesLoading && (
                        <TouchableOpacity
                          style={[styles.pickerOption, { borderColor: colors.border }]}
                          onPress={() => {
                            setCity(null);
                            setArea(null);
                            setPickerOpen(null);
                            setPickerSearch('');
                          }}
                        >
                          <Text style={[styles.pickerOptionText, { color: colors.text }]}>{t('explore.filterAll')}</Text>
                        </TouchableOpacity>
                      )}
                      {!citiesLoading &&
                        cities
                        .filter((c) => !pickerSearch || c.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.pickerOption,
                              { borderColor: colors.border },
                              city?.id === c.id && { backgroundColor: colors.accentMuted },
                            ]}
                            onPress={() => {
                              setCity(c);
                              setArea(null);
                              setPickerOpen(null);
                              setPickerSearch('');
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                {
                                  color: city?.id === c.id ? colors.accent : colors.text,
                                  fontWeight: city?.id === c.id ? '700' : '400',
                                },
                              ]}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      {!citiesLoading && cities.length === 0 ? (
                        <Text style={[styles.pickerOptionText, { color: colors.textSecondary, paddingVertical: 16, textAlign: 'center' }]}>
                          {t('search.noResults')}
                        </Text>
                      ) : null}
                    </>
                  )}
                  {pickerOpen === 'district' && (
                    <>
                      {areasLoading ? (
                        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                          <ActivityIndicator color={colors.accent} size="large" />
                        </View>
                      ) : null}
                      {!pickerSearch && !areasLoading && (
                        <TouchableOpacity
                          style={[styles.pickerOption, { borderColor: colors.border }]}
                          onPress={() => {
                            setArea(null);
                            setPickerOpen(null);
                            setPickerSearch('');
                          }}
                        >
                          <Text style={[styles.pickerOptionText, { color: colors.text }]}>{t('explore.filterAll')}</Text>
                        </TouchableOpacity>
                      )}
                      {!areasLoading &&
                        areas
                        .filter((a) => !pickerSearch || a.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={[
                              styles.pickerOption,
                              { borderColor: colors.border },
                              area?.id === a.id && { backgroundColor: colors.accentMuted },
                            ]}
                            onPress={() => {
                              setArea(a);
                              setPickerOpen(null);
                              setPickerSearch('');
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                {
                                  color: area?.id === a.id ? colors.accent : colors.text,
                                  fontWeight: area?.id === a.id ? '700' : '400',
                                },
                              ]}
                            >
                              {a.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      {!areasLoading && areas.length === 0 ? (
                        <Text style={[styles.pickerOptionText, { color: colors.textSecondary, paddingVertical: 16, textAlign: 'center' }]}>
                          {t('explore.noAreas')}
                        </Text>
                      ) : null}
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          ) : (
            <View style={styles.modalBackdrop}>
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
                onPress={closeFilterModal}
              />
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>{t('explore.filterTitle')}</Text>
                  <TouchableOpacity
                    onPress={clearAllFiltersAndReload}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  >
                    <Text style={[styles.modalClearAllText, { color: colors.accent }]}>
                      {t('explore.filterClearAll')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  <Text style={styles.modalLabel}>{t('explore.filterCountry')}</Text>
                  <TouchableOpacity
                    style={[styles.selectRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setPickerOpen('country')}
                  >
                    <Text style={[styles.selectRowText, { color: colors.text }]}>
                      {countryCode
                        ? countries.find((c) => c.code === countryCode)?.name ?? countryCode
                        : t('explore.filterAll')}
                    </Text>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <Text style={styles.modalLabel}>{t('explore.filterCity')}</Text>
                  <TouchableOpacity
                    style={[
                      styles.selectRow,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      !countryCode && { opacity: 0.45 },
                    ]}
                    onPress={() => setPickerOpen('city')}
                    disabled={!countryCode}
                  >
                    <Text
                      style={[
                        styles.selectRowText,
                        { color: !countryCode ? colors.textSecondary : colors.text },
                      ]}
                    >
                      {!countryCode
                        ? t('explore.filterCityHint')
                        : citiesLoading && cities.length === 0
                          ? t('common.loading')
                          : city?.name ?? t('explore.filterAll')}
                    </Text>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {city && countryCode && (
                    <TouchableOpacity
                      style={[
                        styles.modalChip,
                        { marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.accentMuted },
                      ]}
                      onPress={() => {
                        closeFilterModal();
                        navigation.navigate('CityTrend', { country: countryCode, city: city.name });
                      }}
                    >
                      <Text style={[styles.modalChipText, { color: colors.accent, fontWeight: '600' }]}>
                        {t('explore.cityBest')} →
                      </Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.modalLabel}>{t('explore.filterDistrict')}</Text>
                  <TouchableOpacity
                    style={[
                      styles.selectRow,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      !city && { opacity: 0.45 },
                    ]}
                    onPress={() => setPickerOpen('district')}
                    disabled={!city}
                  >
                    <Text
                      style={[
                        styles.selectRowText,
                        { color: !city ? colors.textSecondary : colors.text },
                      ]}
                    >
                      {!city
                        ? t('explore.filterDistrictHint')
                        : areasLoading && areas.length === 0
                          ? t('common.loading')
                          : area?.name ?? t('explore.filterAll')}
                    </Text>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.modalLabel}>{t('explore.filterDistance')}</Text>
                  <View style={styles.modalRow}>
                    {([1000, 3000, 5000] as DistanceFilter[]).map((d) => {
                      const label =
                        d === 1000
                          ? t('explore.distance1km')
                          : d === 3000
                            ? t('explore.distance3km')
                            : t('explore.distance5km');
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
                        f === 'all'
                          ? t('explore.filterAll')
                          : f === 'cheap'
                            ? t('explore.filterCheap')
                            : f === 'medium'
                              ? t('explore.filterAverage')
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
                    <TouchableOpacity
                      style={[styles.modalChip, categorySlug === null && styles.modalChipActive]}
                      onPress={() => setCategorySlug(null)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          categorySlug === null && styles.modalChipTextActive,
                        ]}
                      >
                        {t('explore.filterAll')}
                      </Text>
                    </TouchableOpacity>
                    {VENUE_CATEGORIES.map((cat) => {
                      const venueCatLabel = i18n.language?.toLowerCase().startsWith('tr')
                        ? cat.labelTr
                        : cat.slug
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                            .join(' ');
                      return (
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
                            {venueCatLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={clearAllFiltersAndReload}>
                    <Text style={styles.modalReset}>{t('explore.filterReset')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalApplyBtn, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      closeFilterModal();
                      loadNearby();
                    }}
                  >
                    <Text style={styles.modalApplyText}>{t('explore.filterApply')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
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
          onPress={openFilterModal}
        >
          <SlidersHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {permissionDenied && subTab === 'nearby' ? (
        <View style={[styles.empty, { flex: 1 }]}>
          <Text style={styles.emptyText}>{t('explore.enableLocation')}</Text>
          <TouchableOpacity style={styles.permBtn} onPress={handleGrantLocationPress}>
            <Text style={styles.permBtnText}>{t('explore.grantPermission')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {subTab === 'nearby' ? (
            <FlashList
              ref={listRef}
              style={{ flex: 1 }}
              data={listRestaurants}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              estimatedItemSize={102}
              ListHeaderComponent={mapHeader}
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
              contentContainerStyle={{ paddingBottom: listPaddingBottom }}
            />
          ) : subTab === 'lists' ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: listPaddingBottom }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            >
              {/* Dynamic Category Cards - yakınımdaki kategoriler */}
              {location && (
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('explore.categories')}</Text>
                  {(
                    [
                      { slug: 'restaurant', labelKey: 'explore.catRestaurant' as const, color: '#4CAF50' },
                      { slug: 'cafe', labelKey: 'explore.catCafe' as const, color: '#FF9800' },
                      { slug: 'bar', labelKey: 'explore.catBar' as const, color: '#2196F3' },
                      { slug: 'meyhane', labelKey: 'explore.catMeyhane' as const, color: '#9C27B0' },
                      { slug: 'fastfood', labelKey: 'explore.catFastfood' as const, color: '#F44336' },
                      { slug: 'bistro', labelKey: 'explore.catBistro' as const, color: '#009688' },
                      { slug: 'coffee', labelKey: 'explore.catCoffee' as const, color: '#795548' },
                      { slug: 'bakery', labelKey: 'explore.catBakery' as const, color: '#E91E63' },
                    ] as const
                  ).map((cat) => {
                    const label = t(cat.labelKey);
                    return (
                    <TouchableOpacity
                      key={cat.slug}
                      style={[styles.categoryCard, { borderLeftColor: cat.color }]}
                      onPress={() =>
                        navigation.navigate('CategoryList', {
                          categorySlug: cat.slug,
                          categoryName: label,
                        })
                      }
                    >
                      <Text style={[styles.categoryCardLabel, { color: colors.text }]}>{label}</Text>
                      <Text style={[styles.categoryCardHint, { color: colors.textSecondary }]}>
                        {t('explore.searchNearMeInLists')}
                      </Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Curated Lists from DB */}
              {lists.length > 0 && (
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('explore.curatedLists')}</Text>
                  {lists.map((item) => {
                    const isFav = favoritedListIds.has(item.id);
                    const listTitle = item[curatedTitleKey] ?? item.title_en ?? item.title_tr;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listCard}
                        onPress={() => navigation.navigate('UserListDetail', { listId: item.id, title: listTitle })}
                      >
                        <Text style={styles.listTitle}>{listTitle}</Text>
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
                  })}
                </View>
              )}

              {loading && lists.length === 0 && (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </ScrollView>
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
                renderItem={renderFavItem}
                estimatedItemSize={102}
                ListEmptyComponent={<Text style={styles.emptyText}>{t('explore.noFavorites')}</Text>}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                contentContainerStyle={{ paddingBottom: listPaddingBottom }}
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
    headerTitle: { fontSize: 22, fontWeight: '700', color: colors.accent, flex: 1 },
    headerBellBtn: { position: 'relative', padding: 6, justifyContent: 'center', alignItems: 'center' },
    headerBellBadge: {
      position: 'absolute',
      top: -2,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
    },
    headerBellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
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
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
    modalClearAllText: { fontSize: 13, fontWeight: '600' },
    modalLabel: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 4, color: colors.text },
    selectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 4,
    },
    selectRowText: { fontSize: 15 },
    pickerModalContent: {
      alignSelf: 'stretch',
      marginHorizontal: 16,
      marginBottom: 40,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      maxHeight: '70%',
    },
    pickerModalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    pickerSearch: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      marginBottom: 8,
    },
    pickerModalList: { maxHeight: 360 },
    pickerOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
    },
    pickerOptionText: { fontSize: 15 },
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    categoryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryCardLabel: { fontSize: 15, fontWeight: '600' },
    categoryCardHint: { fontSize: 13 },
  });
}
