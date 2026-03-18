import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Eye, FileText, Phone, Link as LinkIcon, Save } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { fetchOwnerDashboard, updateOwnerRestaurant, type OwnerDashboardData } from '../lib/ownerDashboard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type RouteType = RouteProp<RootStackParamList, 'OwnerDashboard'>;

export default function OwnerDashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<RouteType>();
  const { restaurantId } = route.params;

  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [reservationUrl, setReservationUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  const styles = useMemo(() => getStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      const d = await fetchOwnerDashboard(restaurantId);
      setData(d);
      if (d?.restaurant.contact_phone) setPhone(d.restaurant.contact_phone);
      if (d?.restaurant.reservation_url) setReservationUrl(d.restaurant.reservation_url);
      if (d?.restaurant.image_url) setHeroImageUrl(d.restaurant.image_url);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateOwnerRestaurant(restaurantId, {
        contact_phone: phone || null,
        reservation_url: reservationUrl || null,
        image_url: heroImageUrl || null,
      });
      Alert.alert(t('common.done'));
      setEditing(false);
      load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  }, [restaurantId, phone, t, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('errors.generic')}</Text>
      </View>
    );
  }

  const { restaurant, menuCount, viewCount } = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {restaurant.image_url ? (
        <Image
          source={{ uri: restaurant.image_url }}
          style={styles.heroImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={200}
        />
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}>
          <Text style={styles.heroLetter}>{restaurant.name.charAt(0)}</Text>
        </View>
      )}

      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{restaurant.name}</Text>
          {restaurant.is_verified && <BadgeCheck size={20} color="#3B82F6" style={{ marginLeft: 6 }} />}
        </View>
        <Text style={styles.location}>{restaurant.area_name}, {restaurant.city_name}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <FileText size={20} color={colors.accent} />
          <Text style={styles.statNum}>{menuCount}</Text>
          <Text style={styles.statLabel}>Menü</Text>
        </View>
        <View style={styles.stat}>
          <Eye size={20} color={colors.accent} />
          <Text style={styles.statNum}>{viewCount}</Text>
          <Text style={styles.statLabel}>Görüntülenme</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>İletişim</Text>
        {editing ? (
          <View style={{ gap: 10 }}>
            <View style={styles.inputRow}>
              <Phone size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Telefon"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputRow}>
              <LinkIcon size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={reservationUrl}
                onChangeText={setReservationUrl}
                placeholder="Rezervasyon URL"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputRow}>
              <LinkIcon size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={heroImageUrl}
                onChangeText={setHeroImageUrl}
                placeholder="Kapak fotoğrafı URL"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Save size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {restaurant.contact_phone ? (
              <View style={styles.infoRow}>
                <Phone size={16} color={colors.textSecondary} />
                <Text style={styles.infoValue}>{restaurant.contact_phone}</Text>
              </View>
            ) : (
              <Text style={styles.noData}>Henüz telefon eklenmedi</Text>
            )}
            {restaurant.reservation_url ? (
              <View style={styles.infoRow}>
                <LinkIcon size={16} color={colors.textSecondary} />
                <Text style={styles.infoValue}>{restaurant.reservation_url}</Text>
              </View>
            ) : (
              <Text style={styles.noData}>Henüz rezervasyon linki eklenmedi</Text>
            )}
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    errorText: { color: colors.error, fontSize: 15 },
    heroImage: { width: '100%', height: 180 },
    heroPlaceholder: { backgroundColor: colors.skeleton, justifyContent: 'center', alignItems: 'center' },
    heroLetter: { fontSize: 48, fontWeight: '700', color: colors.textSecondary },
    infoSection: { padding: 16 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { fontSize: 20, fontWeight: '700', color: colors.text },
    location: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, backgroundColor: colors.surface, marginTop: 1 },
    stat: { alignItems: 'center', gap: 4 },
    statNum: { fontSize: 20, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    section: { padding: 16, marginTop: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
    input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14 },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    infoValue: { fontSize: 15, color: colors.text },
    noData: { fontSize: 14, color: colors.textSecondary },
    editBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.accent, alignSelf: 'flex-start' },
    editBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  });
}
