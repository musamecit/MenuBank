import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Clipboard, ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  Settings, Heart, Award, Share2, List, ChevronRight, LogOut, Trash2, Shield, Globe, ShieldCheck, Building2,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/authUtils';
import { supabase } from '../lib/supabase';
import { getFavoriteCount } from '../lib/favorites';
import { getFollowingCount } from '../lib/userFollows';
import { getUserLists, createUserList, type UserList } from '../lib/userLists';
import { getFavoriteCuratedLists } from '../lib/userCuratedListFavorites';
import { openUrl } from '../lib/linking';
import { getOwnerClaimStatuses } from '../lib/ownerDashboard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import LanguagePickerModal from '../components/LanguagePickerModal';
import { LANGUAGE_NATIVE_NAMES, normalizeAppLanguage } from '../lib/languages';
import type { ColorSet } from '../theme/colors';
import type { User } from '@supabase/supabase-js';
import type { TFunction } from 'i18next';

const PRIVACY_URL = 'https://musamecit.github.io/MenuBank/privacy.html';
const TERMS_URL = 'https://musamecit.github.io/MenuBank/terms.html';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserProfile {
  reputation_points: number;
  trust_score: number;
  invite_code?: string;
  is_admin?: boolean;
  display_name?: string | null;
}

function isApplePrivateRelayEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().includes('privaterelay.appleid.com');
}

function displayNameFromUser(user: User): string | null {
  const pick = (o: Record<string, unknown> | undefined): string | null => {
    if (!o) return null;
    const full = o.full_name;
    if (typeof full === 'string' && full.trim()) return full.trim();
    const name = o.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
    const g = typeof o.given_name === 'string' ? o.given_name.trim() : '';
    const f = typeof o.family_name === 'string' ? o.family_name.trim() : '';
    const combined = [g, f].filter(Boolean).join(' ').trim();
    return combined || null;
  };
  const fromMeta = pick(user.user_metadata as Record<string, unknown> | undefined);
  if (fromMeta) return fromMeta;
  const idData = user.identities?.[0]?.identity_data as Record<string, unknown> | undefined;
  return pick(idData);
}

function profileIdentityDisplay(
  user: User,
  t: TFunction,
  profileDisplayName?: string | null,
): { primary: string; secondary: string | null; initial: string } {
  const email = user.email?.trim() || null;
  const name = displayNameFromUser(user) ?? profileDisplayName?.trim() || null;
  const relay = isApplePrivateRelayEmail(email ?? undefined);

  let primary: string;
  let secondary: string | null = null;

  if (name && email && !relay) {
    primary = name;
    secondary = email;
  } else if (name && relay) {
    primary = name;
  } else if (name && !email) {
    primary = name;
  } else if (email && !relay) {
    primary = email;
  } else if (email && relay) {
    primary = name ?? t('profile.appleAccount');
  } else {
    primary = t('profile.appleAccount');
  }

  const initialSrc = name || email || primary;
  const initial = (initialSrc?.charAt(0) || 'U').toUpperCase();

  return { primary, secondary, initial };
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favCount, setFavCount] = useState(0);
  const [followCount, setFollowCount] = useState(0);
  const [lists, setLists] = useState<UserList[]>([]);
  const [ownerClaims, setOwnerClaims] = useState<{ restaurant_id: string; status: string }[]>([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setProfile(null);
        setFavCount(0);
        setFollowCount(0);
        setLists([]);
        setOwnerClaims([]);
        return;
      }
      let cancelled = false;
      supabase
        .from('user_profiles')
        .select('reputation_points, trust_score, invite_code, is_admin, display_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data) setProfile(data as UserProfile);
        });
      getFavoriteCount(user.id).then((c) => {
        if (!cancelled) setFavCount(c);
      });
      getFollowingCount(user.id).then((c) => {
        if (!cancelled) setFollowCount(c);
      });
      getUserLists(user.id).then((l) => {
        if (!cancelled) setLists(l);
      });
      getOwnerClaimStatuses().then((o) => {
        if (!cancelled) setOwnerClaims(o);
      });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const handleLogout = useCallback(async () => {
    await signOut();
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountConfirm'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.confirm'),
        style: 'destructive',
        onPress: async () => {
          setLoadingOut(true);
          try {
            const { error } = await supabase.functions.invoke('delete-user-account', {
              method: 'POST',
            });
            if (error) throw error;
            await signOut();
          } catch (e) {
            Alert.alert(t('errors.generic'), (e as Error).message);
          } finally {
            setLoadingOut(false);
          }
        },
      },
    ]);
  }, [user, t]);

  const copyUserId = useCallback(() => {
    if (user) {
      Clipboard.setString(user.id);
      Alert.alert(t('profile.copied'));
    }
  }, [user, t]);

  const handleCreateList = useCallback(async () => {
    if (!user) return;
    if (lists.length >= 10) {
      Alert.alert(t('lists.maxLists'));
      return;
    }
    const taken = new Set(lists.map((l) => l.title));
    let n = lists.length + 1;
    let title = t('lists.newListDefaultName', { n });
    while (taken.has(title)) {
      n += 1;
      title = t('lists.newListDefaultName', { n });
    }
    const created = await createUserList(user.id, title, false);
    if (created) {
      setLists((prev) => [created, ...prev]);
      navigation.navigate('UserListDetail', { listId: created.id, title: created.title, isUserList: true });
    }
  }, [user, lists.length, t, navigation]);

  const identity = user ? profileIdentityDisplay(user, t, profile?.display_name) : null;

  if (!user) {
    return (
      <View style={styles.loggedOut}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>?</Text>
        </View>
        <Text style={styles.loginPrompt}>{t('profile.loginDesc')}</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginBtnText}>{t('profile.login')}</Text>
        </TouchableOpacity>
        <View style={styles.linksSection}>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Settings')}>
            <Settings size={18} color={colors.textSecondary} />
            <Text style={styles.linkText}>{t('profile.settings')}</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(PRIVACY_URL)}>
            <Shield size={18} color={colors.textSecondary} />
            <Text style={styles.linkText}>{t('profile.privacyPolicy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(TERMS_URL)}>
            <Shield size={18} color={colors.textSecondary} />
            <Text style={styles.linkText}>{t('profile.termsOfService')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.pageTitle}>{t('tabs.profile')}</Text>
      <Text style={styles.pageSubtitle}>{t('profile.accountInfo')}</Text>

      {/* User account card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{identity?.initial ?? 'U'}</Text>
        </View>
        <Text style={styles.profilePrimary}>{identity?.primary}</Text>
        {identity?.secondary ? (
          <Text style={[styles.profileSecondary, { color: colors.textSecondary }]}>{identity.secondary}</Text>
        ) : null}
      </View>

      {/* User ID card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.cardTitle}>{t('profile.userId')}</Text>
        <TouchableOpacity onPress={copyUserId}>
          <Text style={styles.userIdValue}>{user.id}</Text>
          <Text style={styles.tapToCopy}>{t('profile.tapToCopy')}</Text>
        </TouchableOpacity>
      </View>

      {/* Güven Rozeti (Trust Badge) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.cardTitle}>{t('profile.trustBadge')}</Text>
        <Text style={styles.trustDesc}>{t('profile.trustBadgeDesc')}</Text>
        <View style={styles.starUserRow}>
          <Award size={20} color={colors.accent} />
          <Text style={styles.starUserText}>{t('profile.starUser')}</Text>
        </View>
      </View>

      {/* Favorilerim / Takip Ettiklerim rows */}
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Favorites', { initialTab: 'restaurants' })}
      >
        <Heart size={20} color={colors.accent} />
        <Text style={styles.actionRowText}>{t('profile.myFavorites')}</Text>
        <Text style={styles.actionRowCount}>{favCount}</Text>
      </TouchableOpacity>
      {/* Admin & Restoran Seç */}
      {profile?.is_admin && (
        <TouchableOpacity
          style={[styles.actionRow, styles.adminRow, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
          onPress={() => navigation.navigate('Admin')}
        >
          <ShieldCheck size={20} color={colors.accent} />
          <Text style={[styles.actionRowText, { color: colors.accent, fontWeight: '600' }]}>{t('admin.title')}</Text>
        </TouchableOpacity>
      )}
      {(ownerClaims.some((c) => c.status === 'approved') || profile?.is_admin) && (
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            const approved = ownerClaims.find((c) => c.status === 'approved');
            if (approved) {
              navigation.navigate('OwnerDashboard', { restaurantId: approved.restaurant_id });
            } else {
              navigation.navigate('RestaurantSelect');
            }
          }}
        >
          <Building2 size={20} color={colors.accent} />
          <Text style={styles.actionRowText}>{t('profile.selectManageRestaurant')}</Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Benim listelerim */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.myLists')}</Text>
        <Text style={styles.listDesc}>{t('profile.addRestaurantShareLink')}</Text>
        <TouchableOpacity
          style={[styles.newListBtn, { backgroundColor: colors.accent }]}
          onPress={handleCreateList}
          disabled={lists.length >= 10}
        >
          <Text style={styles.newListBtnText}>+ {t('lists.createList')}</Text>
        </TouchableOpacity>
        <Text style={styles.maxListsHint}>{t('lists.maxLists')}</Text>
        {lists.map((l) => (
          <TouchableOpacity
            key={l.id}
            style={styles.listRow}
            onPress={() => navigation.navigate('UserListDetail', { listId: l.id, title: l.title, isUserList: true })}
          >
            <List size={16} color={colors.accent} />
            <Text style={styles.listText}>{l.title}</Text>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.listRow} onPress={() => navigation.navigate('Favorites', { initialTab: 'lists' })}>
          <List size={16} color={colors.accent} />
          <Text style={styles.listText}>{t('profile.favoriteLists')}</Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Güven Paneli */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.trustPanelRow}>
          <Award size={24} color={colors.accent} />
          <View>
            <Text style={styles.cardTitle}>{t('profile.trustPanel')}</Text>
            <View style={[styles.starBadge, { backgroundColor: colors.accentMuted }]}>
              <Text style={[styles.starUserText, { color: colors.accent }]}>{t('profile.starUser')}</Text>
            </View>
            <Text style={styles.pointsText}>{t('profile.points', { count: profile?.reputation_points ?? 0 })}</Text>
          </View>
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.languageSelect')}</Text>
        <TouchableOpacity
          style={styles.languageRow}
          onPress={() => setLanguageModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.chooseLanguage')}
        >
          <Globe size={20} color={colors.textSecondary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.languageRowHint}>{t('settings.chooseLanguage')}</Text>
            <Text style={[styles.languageRowValue, { color: colors.text }]}>
              {LANGUAGE_NATIVE_NAMES[normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language)]}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <LanguagePickerModal visible={languageModalOpen} onClose={() => setLanguageModalOpen(false)} />

      {/* Links */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Settings')}>
          <Settings size={18} color={colors.textSecondary} />
          <Text style={styles.linkText}>{t('profile.settings')}</Text>
          <ChevronRight size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(PRIVACY_URL)}>
          <Shield size={18} color={colors.textSecondary} />
          <Text style={styles.linkText}>{t('profile.privacyPolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(TERMS_URL)}>
          <Shield size={18} color={colors.textSecondary} />
          <Text style={styles.linkText}>{t('profile.termsOfService')}</Text>
        </TouchableOpacity>
      </View>

      {/* Logout / Delete */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={colors.error} />
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={loadingOut}>
        {loadingOut ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <>
            <Trash2 size={18} color={colors.error} />
            <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loggedOut: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
    pageTitle: { fontSize: 24, fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingTop: 60 },
    pageSubtitle: { fontSize: 14, color: colors.textSecondary, paddingHorizontal: 16, marginTop: 4 },
    card: {
      marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8, alignSelf: 'flex-start' },
    avatarPlaceholder: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentMuted,
      justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    avatarText: { fontSize: 24, fontWeight: '700', color: colors.accent },
    profilePrimary: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
    profileSecondary: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 4 },
    userIdValue: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
    tapToCopy: { fontSize: 12, color: colors.accent, marginTop: 4 },
    trustDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, alignSelf: 'flex-start' },
    starUserRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
    starUserText: { fontSize: 15, fontWeight: '600', color: colors.text },
    actionRow: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, padding: 14,
      borderRadius: 12, borderWidth: 1, gap: 12,
    },
    actionRowText: { flex: 1, fontSize: 15, color: colors.text },
    actionRowCount: { fontSize: 16, fontWeight: '700', color: colors.text },
    adminRow: { borderWidth: 2 },
    listDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
    newListBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 4 },
    newListBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    maxListsHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },
    trustPanelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    starBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginTop: 4 },
    pointsText: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, backgroundColor: colors.surface },
    userId: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    loginPrompt: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    loginBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    statsRow: {
      flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20,
      backgroundColor: colors.surface, marginTop: 1,
    },
    stat: { alignItems: 'center', gap: 4 },
    statNum: { fontSize: 18, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    section: { marginTop: 16, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 10 },
    listRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    listText: { flex: 1, fontSize: 15, color: colors.text },
    referralRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14 },
    referralCode: { fontSize: 16, fontWeight: '600', color: colors.accent },
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    languageRowHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
    languageRowValue: { fontSize: 16, fontWeight: '600' },
    linksSection: { marginTop: 40, width: '100%' },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    linkText: { flex: 1, fontSize: 15, color: colors.text },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingHorizontal: 16, paddingVertical: 14 },
    logoutText: { fontSize: 15, color: colors.error },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
    deleteText: { fontSize: 15, color: colors.error },
  });
}
