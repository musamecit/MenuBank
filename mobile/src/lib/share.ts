import { Share } from 'react-native';
import { shareRestaurantUrl } from './linking';

export async function shareRestaurant(restaurantId: string, name: string) {
  const { message } = shareRestaurantUrl(restaurantId, name);
  await Share.share({ message });
}

export async function share(message: string, url?: string) {
  await Share.share(url ? { message, url } : { message });
}
