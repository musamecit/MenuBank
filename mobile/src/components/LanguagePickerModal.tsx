import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import {
  APP_LANGUAGE_CODES,
  LANGUAGE_NATIVE_NAMES,
  normalizeAppLanguage,
  type AppLanguageCode,
} from '../lib/languages';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function LanguagePickerModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const current = normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  const select = (code: AppLanguageCode) => {
    void i18n.changeLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.menu,
            {
              top: insets.top + 48,
              right: Math.max(insets.right, 12),
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
            {APP_LANGUAGE_CODES.map((code) => {
              const active = current === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.item, active && { backgroundColor: colors.border + '99' }]}
                  onPress={() => select(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.itemText,
                      { color: colors.text },
                      active && { fontWeight: '600' },
                    ]}
                  >
                    {LANGUAGE_NATIVE_NAMES[code]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  menu: {
    position: 'absolute',
    minWidth: 200,
    maxWidth: 280,
    maxHeight: 420,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  item: { paddingVertical: 14, paddingHorizontal: 18 },
  itemText: { fontSize: 16 },
});
