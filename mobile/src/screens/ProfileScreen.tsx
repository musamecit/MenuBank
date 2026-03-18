import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  Settings, Heart, Users, Award, Share2, List, ChevronRight, LogOut, Trash2, Shield, Globe, ShieldCheck, Building2, Bell,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/authUtils';
import { supabase } from '../lib/supabase';
import { getFavoriteCount, getFavorites } from '../lib/favorites';
import { getFollowingCount } from '../lib/userFollows';
import { getUserLists, createUserList, type UserList } from '../lib/userLists';
import { getFavoriteCuratedLists } from '../lib/userCuratedListFavorites';
import { openUrl } from '../lib/linking';
import { getOwnerClaimStatuses } from '../lib/ownerDashboard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

const PRIVACY_URL = 'https://musamecit.github.io/MenuBank/privacy.html';
const TERMS_URL = 'https://musamecit.github.io/MenuBank/terms.html';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserProfile {
  reputation_points: number;
  trust_score: number;
  invite_code?: string;
  is_admin?: boolean;
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

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('reputation_points, trust_score, invite_code, is_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as UserProfile);
      });
    getFavoriteCount(user.id).then(setFavCount);
    getFollowingCount(user.id).then(setFollowCount);
    getUserLists(user.id).then(setLists);
    getOwnerClaimStatuses().then(setOwnerClaims);
  }, [user]);

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
          await supabase.from('user_profiles').update({ deleted_at: new Date().toISOString() }).eq('id', user!.id);
          await signOut();
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
    const title = t('lists.createList');
    const created = await createUserList(user.id, title, false);
    if (created) {
      setLists((prev) => [created, ...prev]);
      navigation.navigate('UserListDetail', { listId: created.id, title: created.title, isUserList: true });
    }
  }, [user, lists.length, t, navigation]);

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
          <Text style={styles.avatarText}>{user.email?.charAt(0).toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.email}>{user.email}</Text>
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
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Notifications')}
      >
        <Bell size={20} color={colors.accent} />
        <Text style={styles.actionRowText}>{t('settings.notifications')}</Text>
        <Text style={styles.actionRowCount}>{followCount}</Text>
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

      {/* Favori Restoranlarım & Favori Listelerim */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.listRow} onPress={() => navigation.navigate('Favorites', { initialTab: 'restaurants' })}>
          <Heart size={16} color={colors.accent} />
          <Text style={styles.listText}>{t('profile.favoriteRestaurants')}</Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
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
        <View style={styles.langRow}>
          {['tr', 'en'].map((lng) => (
            <TouchableOpacity
              key={lng}
              style={[styles.langBtn, i18n.language === lng && styles.langBtnActive]}
              onPress={() => i18n.changeLanguage(lng)}
            >
              <Globe size={14} color={i18n.language === lng ? '#fff' : colors.text} />
              <Text style={[styles.langText, i18n.language === lng && { color: '#fff' }]}>
                {lng === 'tr' ? 'Türkçe' : 'English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
        <Trash2 size={18} color={colors.error} />
        <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
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
    email: { fontSize: 15, fontWeight: '600', color: colors.text },
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
    langRow: { flexDirection: 'row', gap: 10 },
    langBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    langBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    langText: { fontSize: 14, color: colors.text },
    linksSection: { marginTop: 40, width: '100%' },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    linkText: { flex: 1, fontSize: 15, color: colors.text },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingHorizontal: 16, paddingVertical: 14 },
    logoutText: { fontSize: 15, color: colors.error },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
    deleteText: { fontSize: 15, color: colors.error },
  });
}
