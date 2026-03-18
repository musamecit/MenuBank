import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface RestaurantResult {
  id: string;
  name: string;
  city_name?: string;
  area_name?: string;
}

export default function RestaurantSelectScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RestaurantResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, city_name, area_name')
        .ilike('name', `%${query.trim()}%`)
        .is('deleted_at', null)
        .limit(30);
      setResults((data ?? []) as RestaurantResult[]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search();
      debounceRef.current = null;
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.searchSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Building2 size={22} color={colors.accent} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.searchTitle, { color: colors.text }]}>{t('admin.restaurantSearch')}</Text>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder={t('admin.restaurantSearchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 8 }} />}
          {results.length === 0 && query.length > 0 && !searching && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>{t('admin.noRestaurantResults')}</Text>
          )}
          {results.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.resultRow, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('OwnerDashboard', { restaurantId: r.id })}
            >
              <Text style={[styles.resultName, { color: colors.text }]}>{r.name}</Text>
              {(r.area_name || r.city_name) && (
                <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                  {[r.area_name, r.city_name].filter(Boolean).join(', ')}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  searchInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  noResults: { fontSize: 13, marginTop: 8 },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 4,
  },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultSub: { fontSize: 13, marginTop: 2 },
});
