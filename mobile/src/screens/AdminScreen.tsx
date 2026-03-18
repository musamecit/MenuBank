import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import {
  ShieldCheck, X, Check, FileQuestion, EyeOff, Building2, FileText, Globe, RefreshCw,
} from 'lucide-react-native';
import type { ColorSet } from '../theme/colors';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface PendingMenu {
  id: string;
  url: string;
  restaurant_id: string;
  restaurant_name: string;
  submitted_at: string;
}

interface PendingClaim {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  claimed_by: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

interface RestaurantSearchResult {
  id: string;
  name: string;
}

interface DisabledRestaurant {
  id: string;
  name: string;
  city_name: string;
  area_name: string;
}

function AdminSection({
  icon: Icon,
  title,
  subtitle,
  count,
  colors,
  onPress,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  count: number;
  colors: ColorSet;
  onPress?: () => void;
}) {
  const content = (
    <View style={[sectionStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon size={22} color={colors.accent} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[sectionStyles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[sectionStyles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Text style={[sectionStyles.count, { color: colors.text }]}>{count}</Text>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }
  return content;
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  count: { fontSize: 18, fontWeight: '700' },
});

export default function AdminScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingMenus, setPendingMenus] = useState<PendingMenu[]>([]);
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [disabledRestaurantCount, setDisabledRestaurantCount] = useState(0);
  const [disabledRestaurants, setDisabledRestaurants] = useState<DisabledRestaurant[]>([]);
  const [blockedDomainCount, setBlockedDomainCount] = useState(0);
  const [misuseCount, setMisuseCount] = useState(0);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurantResults, setRestaurantResults] = useState<RestaurantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  async function checkAdmin() {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    setIsAdmin(data?.is_admin === true);
    setLoading(false);
    if (data?.is_admin) {
      loadData();
    }
  }

  async function loadData() {
    const [menuRes, claimRes, disabledRes, domainsRes, misuseRes, auditRes] = await Promise.all([
      supabase
        .from('menu_entries')
        .select('id, url, submitted_at, restaurant_id, restaurants(name)')
        .eq('verification_status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(50),
      supabase
        .from('restaurant_claims')
        .select('id, restaurant_id, claimed_by, created_at, restaurants(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('restaurants')
        .select('id, name, city_name, area_name', { count: 'exact' })
        .eq('status', 'disabled')
        .is('deleted_at', null),
      (async () => {
        try {
          const r = await supabase.from('blocked_domains').select('*', { count: 'exact', head: true });
          return r;
        } catch {
          return { count: 0 };
        }
      })(),
      (async () => {
        try {
          const r = await supabase.from('user_menu_misuse_events').select('*', { count: 'exact', head: true });
          return r;
        } catch {
          return { count: 0 };
        }
      })(),
      supabase
        .from('admin_audit_log')
        .select('id, action, entity_type, entity_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (menuRes?.data) {
      setPendingMenus(
        menuRes.data.map((m: Record<string, unknown>) => ({
          id: m.id as string,
          url: m.url as string,
          restaurant_id: m.restaurant_id as string,
          restaurant_name: (m.restaurants as { name?: string })?.name ?? '?',
          submitted_at: m.submitted_at as string,
        })),
      );
    }
    if (claimRes?.data) {
      setClaims(
        claimRes.data.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          restaurant_id: c.restaurant_id as string,
          restaurant_name: (c.restaurants as { name?: string })?.name ?? '?',
          claimed_by: c.claimed_by as string,
          created_at: c.created_at as string,
        })),
      );
    }
    if (disabledRes?.count != null) setDisabledRestaurantCount(disabledRes.count);
    if (disabledRes?.data) {
      setDisabledRestaurants(
        (disabledRes.data as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          city_name: r.city_name as string,
          area_name: r.area_name as string,
        })),
      );
    }
    if (domainsRes && typeof domainsRes === 'object' && domainsRes !== null && 'count' in domainsRes) setBlockedDomainCount((domainsRes as { count: number }).count ?? 0);
    if (misuseRes && typeof misuseRes === 'object' && misuseRes !== null && 'count' in misuseRes) setMisuseCount((misuseRes as { count: number }).count ?? 0);
    if (auditRes?.data) {
      setAuditLog(
        auditRes.data.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          action: a.action as string,
          entity_type: a.entity_type as string,
          entity_id: (a.entity_id as string)?.slice(0, 8) ?? '',
          created_at: a.created_at as string,
        })),
      );
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  async function callAdminAction(action: string, payload: Record<string, string>) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-actions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const text = await res.text();
      if (!res.ok) {
        let errMsg = text;
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          errMsg = parsed.message ?? parsed.error ?? text;
        } catch {}
        throw new Error(errMsg);
      }
      await loadData();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  const searchRestaurants = useCallback(async () => {
    if (!restaurantQuery.trim()) {
      setRestaurantResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .ilike('name', `%${restaurantQuery.trim()}%`)
        .is('deleted_at', null)
        .limit(20);
      setRestaurantResults((data ?? []) as RestaurantSearchResult[]);
    } catch {
      setRestaurantResults([]);
    } finally {
      setSearching(false);
    }
  }, [restaurantQuery]);

  useEffect(() => {
    if (!restaurantQuery.trim()) {
      setRestaurantResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchRestaurants();
      debounceRef.current = null;
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [restaurantQuery, searchRestaurants]);

  const hiddenCount = 0; // No hidden menus in schema by default

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ShieldCheck size={48} color={colors.textSecondary} />
        <Text style={[styles.noAccess, { color: colors.textSecondary }]}>{t('admin.noPermission')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={[styles.header, { color: colors.text }]}>{t('admin.title')}</Text>

      <AdminSection
        icon={FileQuestion}
        title={t('admin.pendingMenus')}
        subtitle={pendingMenus.length === 0 ? t('admin.pendingMenusSub') : `${pendingMenus.length} menü`}
        count={pendingMenus.length}
        colors={colors}
        onPress={() => setExpandedSection(expandedSection === 'menus' ? null : 'menus')}
      />
      <AdminSection
        icon={EyeOff}
        title={t('admin.hiddenMenus')}
        subtitle={t('admin.hiddenMenusSub')}
        count={hiddenCount}
        colors={colors}
      />
      <AdminSection
        icon={Building2}
        title={t('admin.restaurantsReview')}
        subtitle={disabledRestaurantCount === 0 ? t('admin.restaurantsReviewSub') : `${disabledRestaurantCount} restoran`}
        count={disabledRestaurantCount}
        colors={colors}
        onPress={() => setExpandedSection(expandedSection === 'disabled' ? null : 'disabled')}
      />

      {/* Restaurant search */}
      <View style={[styles.searchSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Building2 size={22} color={colors.accent} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.searchTitle, { color: colors.text }]}>{t('admin.restaurantSearch')}</Text>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder={t('admin.restaurantSearchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={restaurantQuery}
            onChangeText={setRestaurantQuery}
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.accent }]} onPress={searchRestaurants}>
            {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchBtnText}>{t('admin.search')}</Text>}
          </TouchableOpacity>
          {restaurantResults.length === 0 && restaurantQuery.length > 0 && !searching && (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>{t('admin.noRestaurantResults')}</Text>
          )}
          {restaurantResults.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.resultRow, { borderColor: colors.border }]}
              onPress={() => {
                Alert.alert(r.name, t('admin.disableRestaurant'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('admin.disableRestaurant'),
                    style: 'destructive',
                    onPress: () => callAdminAction('disable_restaurant', { restaurant_id: r.id }),
                  },
                ]);
              }}
            >
              <Text style={[styles.resultName, { color: colors.text }]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <AdminSection
        icon={FileText}
        title={t('admin.claims')}
        subtitle={claims.length === 0 ? t('admin.claimsSub') : `${claims.length} talep`}
        count={claims.length}
        colors={colors}
        onPress={() => setExpandedSection(expandedSection === 'claims' ? null : 'claims')}
      />
      <AdminSection
        icon={Globe}
        title={t('admin.blockedDomains')}
        subtitle={t('admin.blockedDomainsSub')}
        count={blockedDomainCount}
        colors={colors}
      />
      <AdminSection
        icon={FileText}
        title={t('admin.menuMisuse')}
        subtitle={t('admin.menuMisuseSub')}
        count={misuseCount}
        colors={colors}
      />
      <AdminSection
        icon={RefreshCw}
        title={t('admin.auditLog')}
        subtitle=""
        count={auditLog.length}
        colors={colors}
        onPress={() => setExpandedSection(expandedSection === 'audit' ? null : 'audit')}
      />

      {expandedSection === 'menus' && (
        <View style={styles.expanded}>
          {pendingMenus.map((m) => (
            <View key={m.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{m.restaurant_name}</Text>
              <Text style={[styles.cardUrl, { color: colors.accent }]} numberOfLines={1}>{m.url}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => callAdminAction('approve_menu', { menu_id: m.id })}
                >
                  <Check size={18} color="#fff" />
                  <Text style={styles.actionText}>{t('admin.approveMenu')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => callAdminAction('reject_menu', { menu_id: m.id })}
                >
                  <X size={18} color="#fff" />
                  <Text style={styles.actionText}>{t('admin.rejectMenu')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.actionsSecondary}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  onPress={() => Linking.openURL(m.url)}
                >
                  <Text style={[styles.secondaryText, { color: colors.accent }]}>{t('admin.openMenu')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.accent }]}
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: m.restaurant_id })}
                >
                  <Text style={[styles.secondaryText, { color: colors.accent }]}>{t('admin.viewRestaurant')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {expandedSection === 'disabled' && (
        <View style={styles.expanded}>
          {disabledRestaurants.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{r.name}</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{`${r.area_name}, ${r.city_name}`}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => callAdminAction('enable_restaurant', { restaurant_id: r.id })}
                >
                  <Check size={18} color="#fff" />
                  <Text style={styles.actionText}>{t('admin.enableRestaurant')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {expandedSection === 'claims' && (
        <View style={styles.expanded}>
          {claims.map((c) => (
            <View key={c.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{c.restaurant_name}</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{new Date(c.created_at).toLocaleDateString()}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => callAdminAction('approve_claim', { claim_id: c.id })}
                >
                  <Check size={18} color="#fff" />
                  <Text style={styles.actionText}>{t('admin.approveClaim')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => callAdminAction('reject_claim', { claim_id: c.id })}
                >
                  <X size={18} color="#fff" />
                  <Text style={styles.actionText}>{t('admin.rejectClaim')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {expandedSection === 'audit' && (
        <View style={styles.expanded}>
          {auditLog.map((a) => (
            <View key={a.id} style={[styles.auditRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.auditAction, { color: colors.text }]}>{a.action}</Text>
              <Text style={[styles.auditEntity, { color: colors.textSecondary }]}>{a.entity_type} {a.entity_id}</Text>
              <Text style={[styles.auditDate, { color: colors.textSecondary }]}>{new Date(a.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
    noAccess: { fontSize: 16, marginTop: 12 },
    searchSection: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
    },
    searchTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    searchInput: {
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 15, borderWidth: 1, marginBottom: 8,
    },
    searchBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
    searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    noResults: { fontSize: 13, marginBottom: 4 },
    resultRow: { paddingVertical: 10, borderBottomWidth: 1, marginBottom: 4 },
    resultName: { fontSize: 15, fontWeight: '500' },
    expanded: { paddingHorizontal: 16, marginTop: 8 },
    card: { marginBottom: 12, borderRadius: 12, padding: 16, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    cardUrl: { fontSize: 13, marginBottom: 12 },
    cardSub: { fontSize: 13, marginBottom: 12 },
    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
    actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    auditRow: { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
    auditAction: { fontSize: 14, fontWeight: '600' },
    auditEntity: { fontSize: 12, marginTop: 2 },
    auditDate: { fontSize: 11, marginTop: 2 },
    actionsSecondary: { flexDirection: 'row', gap: 10, marginTop: 8 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    secondaryText: { fontSize: 13, fontWeight: '600' },
  });
}
