import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { deleteUserNotification } from '../lib/userNotifications';
import type { ColorSet } from '../theme/colors';
import type { RootStackParamList } from '../navigation/RootNavigator';

interface NotificationRow {
  id: string;
  type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

function payloadRecord(p: unknown): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

export default function NotificationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('user_notifications')
      .select('id, type, entity_type, entity_id, payload, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = (data ?? []) as NotificationRow[];
    setItems(rows);
    setLoading(false);
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setItems(rows.map((x) => ({ ...x, is_read: true })));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resolveDisplay = useCallback(
    (item: NotificationRow) => {
      const p = payloadRecord(item.payload);
      const dt = typeof p.display_title === 'string' ? p.display_title.trim() : '';
      const db = typeof p.display_body === 'string' ? p.display_body.trim() : '';
      const rn = typeof p.restaurant_name === 'string' ? p.restaurant_name.trim() : '';

      const title =
        dt ||
        (item.type === 'menu_update' && rn
          ? rn
          : item.type === 'price_change'
            ? t('notifications.priceChangeTitle')
            : t('notifications.genericTitle'));

      const body =
        db ||
        (item.type === 'menu_update' && rn
          ? `${rn}: ${t('notifications.menuUpdateShort')}`
          : t('notifications.genericBody'));

      return { title, body };
    },
    [t],
  );

  const handleDelete = useCallback(
    (item: NotificationRow) => {
      if (!user) return;
      Alert.alert(t('notifications.deleteTitle'), t('notifications.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteUserNotification(item.id, user.id);
            if (ok) setItems((prev) => prev.filter((x) => x.id !== item.id));
          },
        },
      ]);
    },
    [user, t],
  );

  const openRelated = useCallback(
    (item: NotificationRow) => {
      if (item.type === 'menu_update' && item.entity_id) {
        navigation.navigate('RestaurantDetail', { restaurantId: item.entity_id });
      }
    },
    [navigation],
  );

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const created = new Date(item.created_at);
    const { title, body } = resolveDisplay(item);
    const canOpen = item.type === 'menu_update' && Boolean(item.entity_id);

    return (
      <View style={[styles.row, !item.is_read && styles.unreadRow]}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => canOpen && openRelated(item)}
          disabled={!canOpen}
          activeOpacity={canOpen ? 0.7 : 1}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body} numberOfLines={4}>
            {body}
          </Text>
          <Text style={styles.date}>{created.toLocaleString()}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          accessibilityLabel={t('notifications.deleteOne')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{t('addMenu.loginRequired')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlashList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      estimatedItemSize={108}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.empty}>{t('notifications.empty')}</Text>}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      )}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    />
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      paddingLeft: 14,
      paddingRight: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    unreadRow: {
      borderColor: colors.accent,
    },
    rowMain: { flex: 1, paddingRight: 8 },
    deleteBtn: { padding: 10, marginTop: 2 },
    title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
    body: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    date: { fontSize: 11, color: colors.textSecondary },
    empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', padding: 24 },
  });
}
