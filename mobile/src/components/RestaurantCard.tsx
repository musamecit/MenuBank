import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { BadgeCheck } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import type { ColorSet } from '../theme/colors';

interface Props {
  id: string;
  name: string;
  cityName: string;
  areaName: string;
  imageUrl?: string | null;
  isVerified?: boolean;
  priceLevel?: string | null;
  googleRating?: number | null;
  distance?: number | null;
  onPress: (id: string) => void;
}

const RestaurantCard = React.memo(function RestaurantCard({
  id, name, cityName, areaName, imageUrl, isVerified, priceLevel, googleRating, distance, onPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const priceLabel = priceLevel === 'cheap' ? '$' : priceLevel === 'expensive' ? '$$$' : priceLevel === 'medium' ? '$$' : null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(id)} activeOpacity={0.7}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={200}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>{name.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isVerified && <BadgeCheck size={16} color="#3B82F6" style={{ marginLeft: 4 }} />}
        </View>
        <Text style={styles.location} numberOfLines={1}>
          {areaName}, {cityName}
        </Text>
        <View style={styles.metaRow}>
          {googleRating != null && (
            <Text style={styles.rating}>⭐ {googleRating.toFixed(1)}</Text>
          )}
          {priceLabel && <Text style={styles.price}>{priceLabel}</Text>}
          {distance != null && (
            <Text style={styles.distance}>{(distance / 1000).toFixed(1)} km</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default RestaurantCard;

function getStyles(colors: ColorSet) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 6,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    image: {
      width: 90,
      height: 90,
    },
    placeholder: {
      backgroundColor: colors.skeleton,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    info: {
      flex: 1,
      padding: 10,
      justifyContent: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    location: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 8,
    },
    rating: {
      fontSize: 12,
      color: colors.text,
    },
    price: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: '600',
    },
    distance: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}
