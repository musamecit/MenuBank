import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFavorites } from '../lib/favorites';
import { getFavoriteCuratedLists } from '../lib/userCuratedListFavorites';
import RestaurantCard from '../components/RestaurantCard';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'Favorites'>;
type Tab = 'restaurants' | 'lists';

export default function FavoritesScreen() {
  const route = useRoute<RouteType>();
  const initialTab = route.params?.initialTab ?? 'restaurants';
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + 8;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [restaurants, setRestaurants] = useState<Record<string, unknown>[]>([]);
  const [lists, setLists] = useState<{ id: string; slug: string; title_tr: string; title_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const lang = i18n.language === 'tr' ? 'title_tr' : 'title_en';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [favRest, favLists] = await Promise.all([
        getFavorites(user.id),
        getFavoriteCuratedLists(user.id),
      ]);
      setRestaurants((favRest ?? []) as Record<string, unknown>[]);
      setLists(favLists);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('addMenu.loginRequired')}</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginBtnText}>{t('profile.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'restaurants' && styles.tabActive]}
          onPress={() => setTab('restaurants')}
        >
          <Text style={[styles.tabText, tab === 'restaurants' && styles.tabTextActive]}>
            {t('profile.favoriteRestaurants')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'lists' && styles.tabActive]}
          onPress={() => setTab('lists')}
        >
          <Text style={[styles.tabText, tab === 'lists' && styles.tabTextActive]}>
            {t('profile.favoriteLists')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
      {tab === 'restaurants' ? (
        <FlashList
          data={restaurants}
          keyExtractor={(item) => String(item.id)}
          estimatedItemSize={102}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <RestaurantCard
              id={String(item.id)}
              name={String(item.name ?? '')}
              cityName={String(item.city_name ?? '')}
              areaName={String(item.area_name ?? '')}
              imageUrl={item.image_url as string | null}
              isVerified={Boolean(item.is_verified)}
              priceLevel={item.price_level as string | null}
              onPress={(id) => navigation.navigate('RestaurantDetail', { restaurantId: id })}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('explore.noFavorites')}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
        />
      ) : (
        <FlashList
          data={lists}
          keyExtractor={(item) => item.id}
          estimatedItemSize={72}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => navigation.navigate('UserListDetail', { listId: item.id, title: item[lang] ?? item.title_tr })}
            >
              <Text style={styles.listTitle}>{item[lang] ?? item.title_tr}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('explore.noLists')}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
        />
      )}
      </View>
      <SafeBannerAd />
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    tabRow: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.accent },
    tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: colors.accent, fontWeight: '600' },
    listCard: {
      marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: colors.card,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    listTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    loginBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 16 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
