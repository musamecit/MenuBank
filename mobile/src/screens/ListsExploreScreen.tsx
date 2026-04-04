import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import { curatedListTitleField } from '../lib/languages';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import { List } from 'lucide-react-native';

interface CuratedList {
  id: string;
  slug: string;
  title_tr: string;
  title_en: string;
  restaurant_count: number;
}

export default function ListsExploreScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listPaddingBottom = BANNER_HEIGHT_TOTAL + 8;
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const listTitleKey = curatedListTitleField(i18n.language);

  const fetchLists = useCallback(async () => {
    const { data } = await supabase
      .from('curated_lists')
      .select('id, slug, title_tr, title_en, curated_list_restaurants(count)')
      .order('home_slot', { ascending: true });

    if (data) {
      setLists(
        data.map((l: any) => ({
          id: l.id,
          slug: l.slug,
          title_tr: l.title_tr,
          title_en: l.title_en,
          restaurant_count: l.curated_list_restaurants?.[0]?.count ?? 0,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLists();
    setRefreshing(false);
  }, [fetchLists]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlashList
        data={lists}
        keyExtractor={(item) => item.id}
        estimatedItemSize={88}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: listPaddingBottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() =>
            navigation.navigate('UserListDetail', {
              listId: item.id,
              title: item[listTitleKey],
            })
          }
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accent + '20' }]}>
            <List size={24} color={colors.accent} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.listTitle, { color: colors.text }]}>{item[listTitleKey]}</Text>
            <Text style={[styles.listSub, { color: colors.subtext }]}>
              {item.restaurant_count} {t('explore.nearby').toLowerCase()}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.subtext }]}>{t('explore.noLists')}</Text>
      }
      />
      <SafeBannerAd />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  textWrap: { marginLeft: 14, flex: 1 },
  listTitle: { fontSize: 16, fontWeight: '600' },
  listSub: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
