import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { ColorSet } from '../theme/colors';

interface NotificationRow {
  id: string;
  type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();

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
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
    // işaretle okundu
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const created = new Date(item.created_at);
    const title = item.type === 'menu_update'
      ? t('notifications.menuUpdateTitle')
      : item.type === 'price_change'
        ? t('notifications.priceChangeTitle')
        : t('notifications.genericTitle');
    const body = t('notifications.genericBody');

    return (
      <View style={[styles.row, !item.is_read && styles.unreadRow]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body} numberOfLines={2}>{body}</Text>
        <Text style={styles.date}>{created.toLocaleString()}</Text>
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
      estimatedItemSize={100}
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
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    unreadRow: {
      borderColor: colors.accent,
    },
    title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
    body: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    date: { fontSize: 11, color: colors.textSecondary },
    empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', padding: 24 },
  });
}

