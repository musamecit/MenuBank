import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { signInWithGoogle, signInWithApple } from '../lib/authUtils';
import { openUrl } from '../lib/linking';
import type { ColorSet } from '../theme/colors';

const PRIVACY_URL = 'https://musamecit.github.io/MenuBank/privacy.html';
const TERMS_URL = 'https://musamecit.github.io/MenuBank/terms.html';

export default function AuthScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.generic'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.generic'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 20 }} />}

        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
          <Text style={styles.googleText}>{t('auth.google')}</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.appleBtn} onPress={handleApple} disabled={loading}>
            <Text style={styles.appleText}>{t('auth.apple')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.terms}>
          {t('auth.termsNotice', { terms: '', privacy: '' })}
          <Text style={styles.link} onPress={() => openUrl(TERMS_URL)}>{t('auth.terms')}</Text>
          {' & '}
          <Text style={styles.link} onPress={() => openUrl(PRIVACY_URL)}>{t('auth.privacy')}</Text>
        </Text>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>{t('common.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 },
    content: { alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    googleBtn: { backgroundColor: '#4285F4', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 12 },
    googleText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    appleBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 12 },
    appleText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    terms: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 20, lineHeight: 18 },
    link: { color: colors.accent, textDecorationLine: 'underline' },
    closeBtn: { position: 'absolute', top: 60, right: 20 },
    closeBtnText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  });
}
