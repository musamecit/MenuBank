import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import type { NearbyRestaurant } from '../lib/explore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;

const RestaurantMarker = React.memo(
  ({ r, onPress }: { r: NearbyRestaurant; onPress: (id: string) => void }) => (
    <Marker
      coordinate={{ latitude: Number(r.lat), longitude: Number(r.lng) }}
      title={r.name}
      description={r.area_name ? `${r.area_name}, ${r.city_name}` : r.city_name}
      onPress={() => onPress(r.id)}
      onCalloutPress={() => onPress(r.id)}
      tracksViewChanges={false}
    />
  ),
  (prev, next) =>
    prev.r.id === next.r.id && prev.r.lat === next.r.lat && prev.r.lng === next.r.lng,
);

interface Props {
  initialRegion: Region;
  markers: NearbyRestaurant[];
  onRegionChangeComplete: (region: Region) => void;
  onMarkerPress: (id: string) => void;
}

export default function ExploreMapView({
  initialRegion,
  markers,
  onRegionChangeComplete,
  onMarkerPress,
}: Props) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        scrollEnabled
        zoomEnabled
        zoomTapEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        mapType="standard"
      >
        {markers.map((r) => (
          <RestaurantMarker key={r.id} r={r} onPress={onMarkerPress} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SCREEN_WIDTH, height: MAP_HEIGHT },
  map: { width: SCREEN_WIDTH, height: MAP_HEIGHT },
});
