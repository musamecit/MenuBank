import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Plus } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { searchRestaurants, type SearchResult } from '../lib/search';
import { addToList } from '../lib/userLists';
import type { RootStackParamList } from '../navigation/RootNavigator';

type RouteType = RouteProp<RootStackParamList, 'AddToListSearch'>;

const DEBOUNCE_MS = 350;

export default function AddToListSearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { listId } = route.params;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
    loadingRow: { padding: 16, alignItems: 'center' },
    list: { padding: 16, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowContent: { flex: 1 },
    name: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    location: { fontSize: 14, color: colors.textSecondary },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 16, color: colors.textSecondary },
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const items = await searchRestaurants(query, 25, abortRef.current.signal);
        setResults(items);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  const handleAdd = async (restaurantId: string) => {
    setAddingId(restaurantId);
    try {
      await addToList(listId, restaurantId);
      Keyboard.dismiss();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.generic'), (e as Error).message);
    } finally {
      setAddingId(null);
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => handleAdd(item.id)}
      disabled={addingId !== null}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.meta}>
          <MapPin color={colors.textSecondary} size={14} />
          <Text style={styles.location}>{item.area_name}, {item.city_name}</Text>
        </View>
      </View>
      {addingId === item.id ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Plus color={colors.accent} size={22} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchRow}>
        <Search color={colors.textSecondary} size={20} />
        <TextInput
          style={styles.input}
          placeholder={t('lists.searchRestaurant')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
        />
      </View>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
      <FlashList
        data={results}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length >= 2 && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('lists.noResults')}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
