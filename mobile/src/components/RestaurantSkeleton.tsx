import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function RestaurantSkeleton() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View style={[styles.imageSkeleton, { backgroundColor: colors.skeleton, opacity }]} />
      <View style={styles.content}>
        <Animated.View style={[styles.lineSkeleton, styles.titleLine, { backgroundColor: colors.skeleton, opacity }]} />
        <Animated.View style={[styles.lineSkeleton, styles.subtitleLine, { backgroundColor: colors.skeleton, opacity }]} />
        <Animated.View style={[styles.lineSkeleton, styles.metaLine, { backgroundColor: colors.skeleton, opacity }]} />
      </View>
    </View>
  );
}

export function RestaurantSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <RestaurantSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imageSkeleton: {
    width: 90,
    height: 90,
  },
  content: { flex: 1, padding: 10, justifyContent: 'center' },
  lineSkeleton: {
    height: 14,
    borderRadius: 4,
  },
  titleLine: { width: '70%', marginBottom: 6 },
  subtitleLine: { width: '50%', marginBottom: 6 },
  metaLine: { width: '40%' },
});
