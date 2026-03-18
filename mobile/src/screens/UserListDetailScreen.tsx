import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { getListItems } from '../lib/userLists';
import { fetchCuratedListRestaurants } from '../lib/explore';
import RestaurantCard from '../components/RestaurantCard';
import { RestaurantSkeletonList } from '../components/RestaurantSkeleton';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type RouteType = RouteProp<RootStackParamList, 'UserListDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UserListDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<Nav>();
  const { listId, isUserList } = route.params;
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + 8;

  useEffect(() => {
    if (!isUserList) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddToListSearch', { listId })}
          style={{ marginRight: 12 }}
        >
          <Plus color={colors.accent} size={24} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, listId, isUserList, colors.accent]);

  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      const data = await getListItems(listId);
      setItems(data as Record<string, unknown>[]);
    } catch {
      try {
        const data = await fetchCuratedListRestaurants(listId);
        setItems(data as Record<string, unknown>[]);
      } catch {}
    }
    setLoading(false);
  }, [listId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.container}>
        <RestaurantSkeletonList count={6} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            onPress={(id) => navigation.navigate('RestaurantDetail', { restaurantId: id })}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('lists.empty')}</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: listPaddingBottom }}
      />
      <SafeBannerAd />
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
