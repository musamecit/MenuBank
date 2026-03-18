import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MapPin, ExternalLink, Share2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { fetchRestaurantsByCity, type RestaurantWithMenu } from '../lib/restaurants';
import { logShareClicked } from '../lib/analytics';
import { share } from '../lib/share';
import { buildShareUrl } from '../lib/linking';
import type { RootStackParamList } from '../navigation/RootNavigator';

type RouteType = RouteProp<RootStackParamList, 'CityTrend'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CityTrendScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const { country, city } = route.params;
  const [restaurants, setRestaurants] = useState<RestaurantWithMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: 20,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
    shareBtnText: { fontSize: 15, fontWeight: '600', color: colors.accent },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardContent: { flex: 1 },
    name: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    location: { fontSize: 14, color: colors.textSecondary },
    emptyContainer: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 16, color: colors.textSecondary },
  });

  const fetchData = async () => {
    try {
      const data = await fetchRestaurantsByCity(city, undefined, country);
      setRestaurants(data);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [country, city]);

  const handleShare = async () => {
    logShareClicked('city', city, city);
    const url = buildShareUrl('city', country, city);
    await share(`${city} — ${t('share.cityTrend')}\n${url}`, url);
  };

  const renderItem = ({ item }: { item: RestaurantWithMenu }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.meta}>
          <MapPin color={colors.textSecondary} size={14} />
          <Text style={styles.location}>{item.area_name}, {item.city_name}</Text>
        </View>
      </View>
      <ExternalLink color={colors.accent} size={18} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{city}</Text>
        <Text style={styles.subtitle}>{t('share.cityTrend')}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Share2 color={colors.accent} size={22} />
          <Text style={styles.shareBtnText}>{t('common.share')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlashList
          data={restaurants}
          keyExtractor={(item) => item.id}
          estimatedItemSize={88}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('explore.noNearby')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
