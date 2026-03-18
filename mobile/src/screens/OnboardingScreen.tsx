import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { markOnboardingSeen } from '../lib/onboarding';
import { Utensils, Upload, ListChecks } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface SlideData {
  key: string;
  titleKey: string;
  descKey: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const slides: SlideData[] = [
  { key: '1', titleKey: 'onboarding.slide1Title', descKey: 'onboarding.slide1Desc', Icon: Utensils },
  { key: '2', titleKey: 'onboarding.slide2Title', descKey: 'onboarding.slide2Desc', Icon: Upload },
  { key: '3', titleKey: 'onboarding.slide3Title', descKey: 'onboarding.slide3Desc', Icon: ListChecks },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlashList<SlideData>>(null);

  const handleDone = async () => {
    await markOnboardingSeen();
    onDone();
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleDone();
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item }: { item: SlideData }) => {
    const { Icon } = item;
    return (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
          <Icon size={64} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t(item.titleKey)}</Text>
        <Text style={[styles.desc, { color: colors.subtext }]}>{t(item.descKey)}</Text>
      </View>
    );
  };

  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
        <Text style={[styles.skipText, { color: colors.subtext }]}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <FlashList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        estimatedItemSize={width}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentIndex ? colors.accent : colors.border },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>
            {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  skipText: { fontSize: 16 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  footer: { paddingBottom: 50, paddingHorizontal: 24, alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 5 },
  nextBtn: { paddingVertical: 16, paddingHorizontal: 48, borderRadius: 30 },
  nextText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
