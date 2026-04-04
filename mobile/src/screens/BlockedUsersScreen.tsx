import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchBlockedUsers, unblockUser, type BlockedUser } from '../lib/userBlocks';
import { UserMinus } from 'lucide-react-native';
import type { ColorSet } from '../theme/colors';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(colors), [colors]);
  
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const users = await fetchBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUnblock = useCallback((blockedId: string, displayName: string) => {
    Alert.alert(
      t('settings.unblockConfirmTitle', 'Engeli Kaldır'),
      t('settings.unblockConfirmMessage', `${displayName} adlı kullanıcının engelini kaldırmak istediğinize emin misiniz?`),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        { 
          text: t('settings.unblock', 'Kaldır'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await unblockUser(blockedId);
              setBlockedUsers(prev => prev.filter(u => u.blocked_id !== blockedId));
            } catch (err) {
              Alert.alert(t('errors.generic', 'Bir hata oluştu'));
            }
          }
        }
      ]
    );
  }, [t]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <UserMinus size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('settings.noBlockedUsers', 'Engellenen kullanıcı bulunmuyor.')}</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.blocked_id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item.blocked_id, item.display_name)}
              >
                <Text style={styles.unblockText}>{t('settings.unblock', 'Engeli Kaldır')}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { marginTop: 16, fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    listContainer: { padding: 16 },
    row: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      paddingVertical: 14, 
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border
    },
    info: { flex: 1, marginRight: 12 },
    name: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
    date: { fontSize: 13, color: colors.textSecondary },
    unblockBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.error + '20',
      borderRadius: 8,
    },
    unblockText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.error
    }
  });
}
