import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Send, Camera } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { searchPlaces } from '../services/googlePlaces';
import { submitMenu } from '../lib/submitMenu';
import { submitRestaurantWithMenu } from '../lib/submitRestaurantWithMenu';
import { supabase } from '../lib/supabase';
import QRScannerModal from '../components/QRScannerModal';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PlaceResult {
  placeId: string;
  displayName: string;
  formattedAddress: string;
}

type Step = 'search' | 'url';

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'balikci', label: 'Balıkçı' },
  { slug: 'bar', label: 'Bar' },
  { slug: 'beach', label: 'Beach' },
  { slug: 'burger', label: 'Burger' },
  { slug: 'cafe', label: 'Cafe' },
  { slug: 'meyhane', label: 'Meyhane' },
  { slug: 'nargile', label: 'Nargile' },
  { slug: 'pizza', label: 'Pizza' },
  { slug: 'restaurant', label: 'Restaurant' },
  { slug: 'street_food', label: 'Sokak Lezzetleri' },
  { slug: 'dessert', label: 'Tatlı' },
  { slug: 'other', label: 'Diğer' },
];

export default function AddMenuScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const places = await searchPlaces(query);
      setResults(places);
    } finally {
      setSearching(false);
    }
  }, [query]);

  // Debounced live search: suggestions while typing (no need to press Ara)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSearch();
      debounceRef.current = null;
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, handleSearch]);

  const handleSelectPlace = useCallback(async (place: PlaceResult) => {
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .eq('place_id', place.placeId)
      .in('status', ['active', 'disabled'])
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      setSelectedRestaurantId((existing as { id: string }).id);
      setSelectedPlace(null);
    } else {
      setSelectedRestaurantId(null);
      setSelectedPlace(place);
    }
    setSelectedName(place.displayName);
    setStep('url');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!menuUrl.trim()) return;
    if (!selectedCategory) {
      Alert.alert(t('addMenu.selectCategory'));
      return;
    }
    const trimmed = menuUrl.trim();
    const isHttp = /^https?:\/\//i.test(trimmed);
    if (!isHttp) {
      Alert.alert(t('errors.generic'), t('addMenu.urlInvalidHint'));
      return;
    }
    if (!selectedRestaurantId && !selectedPlace) return;
    setSubmitting(true);
    try {
      let result: { status: string };
      if (selectedPlace && !selectedRestaurantId) {
        const parts = selectedPlace.formattedAddress.split(',').map((s) => s.trim());
        result = await submitRestaurantWithMenu({
          place_id: selectedPlace.placeId,
          name: selectedPlace.displayName,
          city_name: parts[parts.length - 2] ?? parts[0] ?? '',
          area_name: parts[0] ?? '',
          formatted_address: selectedPlace.formattedAddress,
          country_code: 'TR',
          url: trimmed,
          category_slug: selectedCategory,
        });
      } else if (selectedRestaurantId) {
        result = await submitMenu(selectedRestaurantId, trimmed, selectedCategory);
      } else {
        return;
      }
      Alert.alert(result.status === 'unchanged' ? t('addMenu.menuUnchanged') : t('addMenu.success'));
      setStep('search');
      setQuery('');
      setMenuUrl('');
      setSelectedRestaurantId(null);
      setSelectedPlace(null);
      setSelectedCategory(null);
    } catch (err) {
      const msg = (err as Error).message;
      const userMsg =
        msg === 'verified_restaurant_owner_only'
          ? t('restaurant.verifiedOwnerOnlyMessage')
          : msg;
      Alert.alert(t('errors.generic'), userMsg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedRestaurantId, selectedPlace, menuUrl, selectedCategory, t]);

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loginText}>{t('addMenu.loginRequired')}</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginBtnText}>{t('profile.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('addMenu.title')}</Text>
      </View>

      {step === 'search' ? (
        <View style={styles.content}>
          <Text style={styles.stepLabel}>{t('addMenu.searchRestaurant')}</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('addMenu.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Search size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.liveSearchHint}>{t('addMenu.liveSearchHint')}</Text>
          <FlashList
            data={results}
            keyExtractor={(item) => item.placeId}
            estimatedItemSize={72}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => handleSelectPlace(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{item.displayName}</Text>
                  <Text style={styles.resultAddress} numberOfLines={1}>{item.formattedAddress}</Text>
                </View>
                <Plus size={20} color={colors.accent} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !searching && query.length > 0 ? (
                <Text style={styles.emptyText}>{t('search.noResults')}</Text>
              ) : query.length === 0 ? (
                <Text style={styles.emptyText}>{t('addMenu.typeToSearch')}</Text>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.stepLabel}>{selectedName}</Text>
          <Text style={styles.urlLabel}>{t('addMenu.enterUrl')}</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={[styles.urlInput, { flex: 1 }]}
              placeholder={t('addMenu.urlPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={menuUrl}
              onChangeText={setMenuUrl}
              keyboardType="url"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.qrBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setQrScannerVisible(true)}
              accessibilityLabel={t('addMenu.scanQR')}
              accessibilityRole="button"
            >
              <Camera size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <QRScannerModal
            visible={qrScannerVisible}
            onClose={() => setQrScannerVisible(false)}
            onScan={(url) => { setMenuUrl(url); setQrScannerVisible(false); }}
          />
          <Text style={[styles.urlLabel, { marginTop: 8 }]}>{t('addMenu.selectCategory')}</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.slug;
              return (
                <TouchableOpacity
                  key={cat.slug}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.slug)}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!menuUrl.trim() || submitting || !selectedCategory || (!selectedRestaurantId && !selectedPlace)) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!menuUrl.trim() || submitting || !selectedCategory || (!selectedRestaurantId && !selectedPlace)}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text style={styles.submitText}>{t('addMenu.submit')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setStep('search');
              setSelectedRestaurantId(null);
              setSelectedPlace(null);
              setQrScannerVisible(false);
            }}
          >
            <Text style={styles.backText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
    header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: colors.surface },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    content: { flex: 1, padding: 16 },
    stepLabel: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    searchInput: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    searchBtn: { backgroundColor: colors.accent, borderRadius: 12, width: 48, justifyContent: 'center', alignItems: 'center' },
    resultItem: {
      flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card,
      borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
    resultAddress: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    liveSearchHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
    urlLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
    urlRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
    urlInput: {
      backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    qrBtn: {
      width: 52, height: 52, borderRadius: 12, borderWidth: 1,
      justifyContent: 'center', alignItems: 'center',
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    categoryChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    categoryText: {
      fontSize: 13,
      color: colors.text,
    },
    categoryTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    submitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16,
    },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    backBtn: { alignItems: 'center', marginTop: 16 },
    backText: { color: colors.textSecondary, fontSize: 14 },
    loginText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16 },
    loginBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
}
