import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Heart, Share2, MapPin, BadgeCheck, ExternalLink, Flag, Star, UserPlus, UserMinus,
  Phone, Utensils, RefreshCw, Camera,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchRestaurant, fetchMenuEntries, type Restaurant, type MenuEntry } from '../lib/restaurants';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import { isFollowing, toggleFollow } from '../lib/userFollows';
import { shareRestaurant } from '../lib/share';
import { openInMaps, openUrl } from '../lib/linking';
import { submitPriceVote, getUserVote, type PriceVoteValue } from '../lib/priceVote';
import { submitMenu } from '../lib/submitMenu';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/authUtils';
import { submitReport } from '../lib/report';
import { logRestaurantView } from '../lib/analytics';
import { submitRestaurantClaim } from '../lib/ownerDashboard';
import { Image } from 'expo-image';
import SafeBannerAd, { BANNER_HEIGHT_TOTAL } from '../components/SafeBannerAd';
import QRScannerModal from '../components/QRScannerModal';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { ColorSet } from '../theme/colors';

type RouteType = RouteProp<RootStackParamList, 'RestaurantDetail'>;

export default function RestaurantDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const route = useRoute<RouteType>();
  const queryClient = useQueryClient();
  const { restaurantId } = route.params;
  const scrollPaddingBottom = BANNER_HEIGHT_TOTAL + 12;

  const { data: restaurant, isLoading: loading } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
  });
  const { data: menus = [] } = useQuery({
    queryKey: ['menuEntries', restaurantId],
    queryFn: () => fetchMenuEntries(restaurantId),
  });
  const [fav, setFav] = useState(false);
  const [following, setFollowing] = useState(false);
  const [myVote, setMyVote] = useState<PriceVoteValue | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimInfoVisible, setClaimInfoVisible] = useState(false);
  const [updateMenuUrl, setUpdateMenuUrl] = useState('');
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateMenuInputVisible, setUpdateMenuInputVisible] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const updateSectionY = useRef(0);
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    logRestaurantView(restaurantId);
  }, [restaurantId]);

  useEffect(() => {
    if (!user) return;
    isFavorite(user.id, restaurantId).then(setFav);
    isFollowing(user.id, restaurantId).then(setFollowing);
    getUserVote(user.id, restaurantId).then(setMyVote);
  }, [user, restaurantId]);

  const handleFav = useCallback(async () => {
    if (!user) return;
    const now = await toggleFavorite(user.id, restaurantId);
    setFav(now);
  }, [user, restaurantId]);

  const handleFollow = useCallback(async () => {
    if (!user) return;
    const now = await toggleFollow(user.id, restaurantId);
    setFollowing(now);
  }, [user, restaurantId]);

  const handleShare = useCallback(() => {
    if (restaurant) shareRestaurant(restaurant.id, restaurant.name);
  }, [restaurant]);

  const handleVote = useCallback(async (vote: PriceVoteValue) => {
    if (!user) return;
    await submitPriceVote(user.id, restaurantId, vote);
    setMyVote(vote);
    Alert.alert(t('restaurant.priceVoted'));
  }, [user, restaurantId, t]);

  const handleUpdateMenuPress = useCallback(() => {
    if (!user) {
      Alert.alert(t('addMenu.loginRequired'));
      return;
    }
    setUpdateMenuInputVisible(true);
  }, [user, t]);

  const handleOwnerClaimPress = useCallback(() => {
    if (!user) {
      Alert.alert(t('claim.loginRequired'));
      return;
    }
    setClaimInfoVisible(true);
  }, [user, t]);

  const handleMenuInputFocus = useCallback(() => {
    setTimeout(() => {
      const y = Math.max(0, updateSectionY.current - 120);
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }, 300);
  }, []);

  const handleUpdateMenu = useCallback(async () => {
    if (!user || !updateMenuUrl.trim()) return;
    const trimmed = updateMenuUrl.trim();
    const isHttp = /^https?:\/\//i.test(trimmed);
    
    // Better URL check: Must have at least a dot and some chars after scheme
    const hasDomain = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed);
    
    if (!isHttp || !hasDomain) {
      Alert.alert(t('errors.generic'), t('addMenu.urlInvalidHint'));
      return;
    }
    setUpdateSubmitting(true);
    try {
      const result = await submitMenu(restaurantId, trimmed);
      let alertMsg = t('addMenu.success');
      if (result.status === 'unchanged') alertMsg = t('addMenu.menuUnchanged');
      else if (result.status === 'pending_exists') alertMsg = t('addMenu.alreadyPending');
      
      Alert.alert(alertMsg);
      setUpdateMenuUrl('');
      setUpdateMenuInputVisible(false);
      queryClient.invalidateQueries({ queryKey: ['menuEntries', restaurantId] });
    } catch (err) {
      const msg = (err as Error).message;
      const isSessionExpired = msg.includes('Oturumunuz sona ermiş') || msg.includes('session has expired');
      if (isSessionExpired) {
        // Try one more time: refresh session and retry
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session) {
            const retryResult = await submitMenu(restaurantId, trimmed);
            let alertMsg = t('addMenu.success');
            if (retryResult.status === 'unchanged') alertMsg = t('addMenu.menuUnchanged');
            else if (retryResult.status === 'pending_exists') alertMsg = t('addMenu.alreadyPending');
            Alert.alert(alertMsg);
            setUpdateMenuUrl('');
            setUpdateMenuInputVisible(false);
            queryClient.invalidateQueries({ queryKey: ['menuEntries', restaurantId] });
            return; // success on retry
          }
        } catch {
          // retry also failed, fall through to show session expired dialog
        }
        Alert.alert(
          t('errors.generic'),
          msg, // SHOW THE RAW ERROR SO WE CAN SEE DEBUG INFO
          [
            { text: t('common.ok'), style: 'cancel' },
            { text: t('common.signOut'), onPress: () => signOut() },
          ],
        );
      } else {
        Alert.alert(
          t('errors.generic'),
          msg === 'verified_restaurant_owner_only' ? t('restaurant.verifiedOwnerOnlyMessage') : msg,
        );
      }
    } finally {
      setUpdateSubmitting(false);
    }
  }, [user, restaurantId, updateMenuUrl, t, queryClient]);

  const handleReportMenu = useCallback(() => {
    if (!user) {
      Alert.alert(t('report.loginRequired'));
      return;
    }
    const menuId = menus[0]?.id;
    if (!menuId) return;
    Alert.alert(
      t('report.confirmTitle'),
      t('report.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('report.submit'),
          onPress: async () => {
            setReportLoading(true);
            try {
              const result = await submitReport(menuId, 'other');
              if (result.status === 'already_reported') {
                Alert.alert(t('report.alreadyReported'));
              } else {
                Alert.alert(t('report.success'));
              }
            } catch (err) {
              Alert.alert(t('errors.generic'), (err as Error).message);
            } finally {
              setReportLoading(false);
            }
          },
        },
      ],
    );
  }, [user, menus, t]);

  const handleClaimConfirm = async () => {
    setClaimInfoVisible(false);
    if (!user) return;
    setClaimLoading(true);
    try {
      const result = await submitRestaurantClaim(restaurantId);
      if (result.status === 'pending') {
        Alert.alert(t('claim.submitted'), t('claim.submittedMessage'));
      } else {
        Alert.alert(t('claim.alreadyClaimed'), t('claim.alreadyClaimedMessage'));
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg === 'restaurant already claimed') {
        Alert.alert(t('claim.alreadyClaimed'), t('claim.alreadyClaimedMessage'));
      } else {
        Alert.alert(t('errors.generic'), msg || t('errors.generic'));
      }
    } finally {
      setClaimLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('errors.generic')}</Text>
      </View>
    );
  }

  const currentMenu = menus[0];
  const olderMenus = menus.slice(1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Hero image */}
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

      {/* Info */}
      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{restaurant.name}</Text>
          {restaurant.is_verified && <BadgeCheck size={20} color="#3B82F6" style={{ marginLeft: 6 }} />}
        </View>
        <Text style={styles.address}>{restaurant.area_name}, {restaurant.city_name}</Text>
        {restaurant.formatted_address && (
          <Text style={styles.addressFull}>{restaurant.formatted_address}</Text>
        )}
        {restaurant.google_rating != null && (
          <View style={styles.ratingRow}>
            <Star size={16} color="#FBBF24" fill="#FBBF24" />
            <Text style={styles.ratingText}>
              {restaurant.google_rating.toFixed(1)}
              {restaurant.google_user_ratings_total ? ` (${restaurant.google_user_ratings_total})` : ''}
            </Text>
          </View>
        )}
        {restaurant.cuisine_primary && (
          <View style={styles.cuisineRow}>
            <Utensils size={14} color={colors.textSecondary} />
            <Text style={styles.cuisineText}>{restaurant.cuisine_primary}</Text>
          </View>
        )}
        {restaurant.contact_phone && (
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => Linking.openURL(`tel:${restaurant.contact_phone}`)}
          >
            <Phone size={14} color={colors.accent} />
            <Text style={styles.phoneText}>{restaurant.contact_phone}</Text>
          </TouchableOpacity>
        )}
        {restaurant.reservation_url && (
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => openUrl(restaurant.reservation_url!)}
          >
            <ExternalLink size={14} color={colors.accent} />
            <Text style={styles.phoneText}>{t('restaurant.reservation')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {restaurant.lat != null && restaurant.lng != null && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => openInMaps(Number(restaurant.lat), Number(restaurant.lng), restaurant.name)}>
            <MapPin size={18} color={colors.accent} />
            <Text style={styles.actionText}>{t('restaurant.openInMaps')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Share2 size={18} color={colors.accent} />
          <Text style={styles.actionText}>{t('restaurant.share')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleFav}>
          <Heart size={18} color={fav ? colors.error : colors.accent} fill={fav ? colors.error : 'transparent'} />
          <Text style={styles.actionText}>{fav ? t('restaurant.removeFromFavorites') : t('restaurant.addToFavorites')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleFollow}>
          {following ? <UserMinus size={18} color={colors.accent} /> : <UserPlus size={18} color={colors.accent} />}
          <Text style={styles.actionText}>{following ? t('restaurant.unfollow') : t('restaurant.follow')}</Text>
        </TouchableOpacity>
      </View>

      {/* Current menu */}
      {currentMenu ? (
        <TouchableOpacity style={styles.menuBtn} onPress={() => openUrl(currentMenu.url)}>
          <ExternalLink size={20} color="#fff" />
          <Text style={styles.menuBtnText}>{t('restaurant.openMenu')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.noMenu}>
          <Text style={styles.noMenuText}>{t('restaurant.noMenu')}</Text>
          <Text style={styles.noMenuSub}>{t('restaurant.addFirstMenu')}</Text>
        </View>
      )}

      {/* Older menus */}
      {olderMenus.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.olderMenus')}</Text>
          {olderMenus.map((m) => (
            <TouchableOpacity key={m.id} style={styles.oldMenuRow} onPress={() => openUrl(m.url)}>
              <ExternalLink size={14} color={colors.accent} />
              <Text style={styles.oldMenuText} numberOfLines={1}>{m.url}</Text>
              <Text style={styles.oldMenuDate}>{new Date(m.submitted_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Price vote */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('restaurant.priceVote')}</Text>
        <View style={styles.voteRow}>
          {(['cheap', 'average', 'expensive'] as PriceVoteValue[]).map((v) => {
            const label = v === 'cheap' ? t('restaurant.priceCheap') : v === 'average' ? t('restaurant.priceAverage') : t('restaurant.priceExpensive');
            const isActive = myVote === v;
            return (
              <TouchableOpacity
                key={v}
                style={[styles.voteBtn, isActive && styles.voteBtnActive]}
                onPress={() => handleVote(v)}
              >
                <Text style={[styles.voteBtnText, isActive && styles.voteBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Update menu + Report */}
      {restaurant && (
        <View
          style={styles.section}
          onLayout={(e) => { updateSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>{t('addMenu.title')}</Text>
          {!updateMenuInputVisible ? (
            <TouchableOpacity style={styles.updateMenuBtn} onPress={handleUpdateMenuPress}>
              <RefreshCw size={18} color="#fff" />
              <Text style={styles.updateMenuBtnText}>{t('restaurant.updateMenu')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.updateRow}>
              <TextInput
                style={[styles.updateInput, { flex: 1 }]}
                placeholder={t('addMenu.urlPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={updateMenuUrl}
                onChangeText={setUpdateMenuUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                onFocus={handleMenuInputFocus}
              />
              <TouchableOpacity
                style={[styles.qrBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setQrScannerVisible(true)}
                accessibilityLabel={t('addMenu.scanQR')}
                accessibilityRole="button"
              >
                <Camera size={20} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.updateBtn,
                  (!updateMenuUrl.trim() || updateSubmitting) && { opacity: 0.5 },
                ]}
                onPress={handleUpdateMenu}
                disabled={!updateMenuUrl.trim() || updateSubmitting}
              >
                {updateSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <RefreshCw size={14} color="#fff" />
                    <Text style={styles.updateBtnText}>{t('addMenu.submit')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {currentMenu && (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={handleReportMenu}
              disabled={reportLoading}
            >
              {reportLoading ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Flag size={14} color={colors.error} />
                  <Text style={styles.reportText}>{t('restaurant.reportMenu')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.claimBtn, { borderColor: colors.border }]}
            onPress={handleOwnerClaimPress}
          >
            <Text style={[styles.claimText, { color: colors.accent }]}>{t('restaurant.ownerCta')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={(url) => { setUpdateMenuUrl(url); setQrScannerVisible(false); }}
      />
    </ScrollView>

    <SafeBannerAd />

    {/* Claim modal - sahiplik talebi */}
    <Modal visible={claimInfoVisible} animationType="slide" transparent>
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={() => setClaimInfoVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.claimModalContent, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.claimModalTitle, { color: colors.text }]}>{t('claim.infoTitle')}</Text>
          <ScrollView style={{ maxHeight: 280, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.claimModalBody, { color: colors.textSecondary }]}>
              {t('restaurant.updateMenuWarning')}
              {'\n\n'}
              {t('claim.infoBody')}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.claimProceedBtn, { backgroundColor: colors.accent }]}
            onPress={handleClaimConfirm}
            disabled={claimLoading}
          >
            {claimLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.claimProceedText}>{t('claim.infoProceed')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.claimCancelBtn} onPress={() => setClaimInfoVisible(false)}>
            <Text style={[styles.claimCancelText, { color: colors.textSecondary }]}>{t('claim.infoCancel')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
    heroImage: { width: '100%', height: 220 },
    heroPlaceholder: { backgroundColor: colors.skeleton, justifyContent: 'center', alignItems: 'center' },
    heroLetter: { fontSize: 64, fontWeight: '700', color: colors.textSecondary },
    infoSection: { padding: 16 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { fontSize: 22, fontWeight: '700', color: colors.text, flexShrink: 1 },
    address: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    addressFull: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
    ratingText: { fontSize: 14, color: colors.text, fontWeight: '500' },
    cuisineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    cuisineText: { fontSize: 13, color: colors.textSecondary },
    phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    phoneText: { fontSize: 14, color: colors.accent },
    actionRow: {
      flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 16,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    actionText: { fontSize: 13, color: colors.text },
    menuBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.accent, marginHorizontal: 16, borderRadius: 14, paddingVertical: 16,
    },
    menuBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    noMenu: { alignItems: 'center', paddingVertical: 24 },
    noMenuText: { fontSize: 15, color: colors.textSecondary },
    noMenuSub: { fontSize: 13, color: colors.accent, marginTop: 4 },
    section: { paddingHorizontal: 16, marginTop: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    oldMenuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    oldMenuText: { flex: 1, fontSize: 13, color: colors.accent },
    oldMenuDate: { fontSize: 12, color: colors.textSecondary },
    voteRow: { flexDirection: 'row', gap: 10 },
    voteBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
    voteBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    voteBtnText: { fontSize: 14, color: colors.text },
    voteBtnTextActive: { color: colors.accent, fontWeight: '600' },
    reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, paddingHorizontal: 16 },
    reportText: { fontSize: 13, color: colors.error },
    claimBtn: { marginTop: 16, marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    claimText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    claimModalContent: { marginHorizontal: 16, marginBottom: 40, padding: 20, borderRadius: 16, maxHeight: '80%' },
    claimModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    claimModalBody: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
    claimCancelBtn: { marginTop: 8, alignItems: 'center' },
    claimInfo: { marginHorizontal: 16, marginTop: 12, padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    claimInfoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
    claimInfoBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
    claimInfoBtns: { marginTop: 16, gap: 12 },
    claimProceedBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    claimProceedText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    claimCancelText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
    updateMenuBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
    },
    updateMenuBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    updateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    qrBtn: {
      width: 44, height: 44, borderRadius: 10, borderWidth: 1,
      justifyContent: 'center', alignItems: 'center',
    },
    updateInput: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    updateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14,
      backgroundColor: colors.accent, borderRadius: 10,
    },
    updateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });
}
