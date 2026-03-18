import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
        subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },
        button: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.accent,
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: 12,
        },
        buttonText: { fontSize: 16, fontWeight: '600', color: colors.surface },
      }),
    [colors],
  );

  const goToSearch = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Tabs', state: { routes: [{ name: 'Explore' }] } }],
      }),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>{t('notFound.title')}</Text>
      <Text style={styles.subtitle}>{t('notFound.subtitle')}</Text>
      <TouchableOpacity style={styles.button} onPress={goToSearch} activeOpacity={0.8}>
        <Search color={colors.surface} size={20} />
        <Text style={styles.buttonText}>{t('notFound.search')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
