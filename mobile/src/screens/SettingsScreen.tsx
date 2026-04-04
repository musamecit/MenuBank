import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Globe, ChevronRight } from 'lucide-react-native';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { openUrl } from '../lib/linking';
import {
  getDateFormat, setDateFormat, type DateFormat,
  getLocationEnabled, setLocationEnabled,
  getNotificationsEnabled, setNotificationsEnabled,
} from '../lib/settingsStorage';
import type { ColorSet } from '../theme/colors';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import LanguagePickerModal from '../components/LanguagePickerModal';
import { registerPushToken } from '../lib/notifications';
import { LANGUAGE_NATIVE_NAMES, normalizeAppLanguage } from '../lib/languages';

const PRIVACY_URL = 'https://musamecit.github.io/MenuBank/privacy.html';
const TERMS_URL = 'https://musamecit.github.io/MenuBank/terms.html';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, i18n } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [dateFormat, setDateFormatState] = useState<DateFormat>('DD.MM.YYYY');
  const [locationEnabled, setLocationEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [isMenuBlocked, setIsMenuBlocked] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('tracking_enabled, is_menu_blocked, notifications_menu_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const row = data as Record<string, unknown>;
        if (typeof row.tracking_enabled === 'boolean') {
          setTrackingEnabled(row.tracking_enabled as boolean);
        }
        if (typeof row.notifications_menu_enabled === 'boolean') {
          setNotificationsEnabledState(row.notifications_menu_enabled as boolean);
        }
        if (row.is_menu_blocked === true) {
          setIsMenuBlocked(true);
        }
      });
    getDateFormat().then(setDateFormatState);
    getLocationEnabled().then(setLocationEnabledState);
    getNotificationsEnabled().then(setNotificationsEnabledState);
  }, [user]);

  const toggleTracking = async (value: boolean) => {
    setTrackingEnabled(value);
    if (user) {
      await supabase
        .from('user_profiles')
        .update({ tracking_enabled: value, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  };

  const themes: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'light', label: t('settings.themeLight'), icon: <Sun size={18} color={colors.text} /> },
    { key: 'dark', label: t('settings.themeDark'), icon: <Moon size={18} color={colors.text} /> },
    { key: 'system', label: t('settings.themeSystem'), icon: <Monitor size={18} color={colors.text} /> },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {isMenuBlocked && (
        <View style={styles.section}>
          <View style={styles.blockWarning}>
            <Text style={styles.blockWarningText}>{t('settings.menuBlockedWarning') ?? 'Your account is temporarily blocked from adding menus.'}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.theme')}</Text>
        <View style={styles.optionRow}>
          {themes.map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              style={[styles.optionBtn, mode === key && styles.optionBtnActive]}
              onPress={() => setMode(key)}
            >
              {icon}
              <Text style={[styles.optionText, mode === key && styles.optionTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.dateFormat')}</Text>
        <View style={styles.optionRow}>
          {[
            { key: 'DD.MM.YYYY' as DateFormat, label: t('settings.dateFormatDDMM') },
            { key: 'MM.DD.YYYY' as DateFormat, label: t('settings.dateFormatMMDD') },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.optionBtn, dateFormat === key && styles.optionBtnActive]}
              onPress={async () => {
                setDateFormatState(key);
                await setDateFormat(key);
              }}
            >
              <Text style={[styles.optionText, dateFormat === key && styles.optionTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.locationServices')}</Text>
        <View style={styles.switchRowWithDesc}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('settings.locationServices')}</Text>
            <Text style={styles.switchDesc}>{t('settings.locationServicesDesc')}</Text>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={async (v) => {
              setLocationEnabledState(v);
              await setLocationEnabled(v);
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
        <View style={styles.switchRowWithDesc}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('settings.notifications')}</Text>
            <Text style={styles.switchDesc}>{t('settings.notificationsDesc')}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={async (v) => {
              setNotificationsEnabledState(v);
              await setNotificationsEnabled(v);
              if (user) {
                await supabase
                  .from('user_profiles')
                  .update({ notifications_menu_enabled: v, updated_at: new Date().toISOString() })
                  .eq('id', user.id);
                if (v) {
                  await registerPushToken(user.id);
                }
              }
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      </View>

      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <TouchableOpacity 
            style={styles.linkRow} 
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <Text style={[styles.linkText, { color: colors.text }]}>{t('settings.blockedUsers', 'Engellenen Kullanıcılar')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.privacy') ?? 'Privacy'}</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('settings.analyticsTracking') ?? 'Analytics & Tracking'}</Text>
            <Switch
              value={trackingEnabled}
              onValueChange={toggleTracking}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(PRIVACY_URL)}>
          <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(TERMS_URL)}>
          <Text style={styles.linkText}>{t('settings.termsOfService')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    section: { paddingHorizontal: 16, marginTop: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    optionRow: { flexDirection: 'row', gap: 10 },
    optionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    optionBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    optionText: { fontSize: 14, color: colors.text },
    optionTextActive: { color: '#fff', fontWeight: '600' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    switchRowWithDesc: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    switchLabel: { fontSize: 15, color: colors.text },
    switchDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    linkRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    linkText: { fontSize: 15, color: colors.accent },
    blockWarning: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: `${colors.error}15`,
    },
    blockWarningText: { fontSize: 13, color: colors.error },
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
  });
}
