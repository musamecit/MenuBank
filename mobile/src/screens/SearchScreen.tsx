import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { searchRestaurants, type SearchResult } from '../lib/search';
import RestaurantCard from '../components/RestaurantCard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const data = await searchRestaurants(text);
      setResults(data);
      setLoading(false);
    }, 400);
  }, []);

  const goToRestaurant = useCallback(
    (id: string) => navigation.navigate('RestaurantDetail', { restaurantId: id }),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleChange}
          autoFocus
          returnKeyType="search"
        />
      </View>
      {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />}
      <FlashList
        data={results}
        keyExtractor={(item) => item.id}
        estimatedItemSize={102}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <RestaurantCard
            id={item.id}
            name={item.name}
            cityName={item.city_name}
            areaName={item.area_name}
            imageUrl={item.image_url}
            isVerified={item.is_verified}
            priceLevel={item.price_level}
            onPress={goToRestaurant}
          />
        )}
        ListEmptyComponent={
          !loading && query.length > 0 ? (
            <Text style={styles.emptyText}>{t('search.noResults')}</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 12,
      paddingHorizontal: 12, backgroundColor: colors.surface, gap: 8,
    },
    backBtn: { padding: 4 },
    input: {
      flex: 1, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 14,
      paddingVertical: 10, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
