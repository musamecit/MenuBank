import { Linking, Platform } from 'react-native';

const WEB_BASE = 'https://menubank.app';

/** Web URL for sharing */
export function buildShareUrl(type: 'restaurant' | 'city' | 'list', id: string, city?: string): string {
  switch (type) {
    case 'restaurant':
      return `${WEB_BASE}/r/${id}`;
    case 'city':
      return `${WEB_BASE}/c/${id}/${encodeURIComponent(city ?? id)}`;
    case 'list':
      return `${WEB_BASE}/l/${id}`;
    default:
      return WEB_BASE;
  }
}

/** Custom scheme for in-app opening */
export function buildDeepLink(type: 'restaurant' | 'city' | 'list', id: string, city?: string): string {
  const base = 'qrmenu://';
  switch (type) {
    case 'restaurant':
      return `${base}restaurant/${id}`;
    case 'city':
      return `${base}city/${id}/${encodeURIComponent(city ?? id)}`;
    case 'list':
      return `${base}list/${id}`;
    default:
      return base;
  }
}

export function openInMaps(lat: number, lng: number, name?: string) {
  const label = encodeURIComponent(name ?? '');
  const url = Platform.select({
    ios: `maps:0,0?q=${label}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
  });
  if (url) Linking.openURL(url);
}

export function openUrl(url: string) {
  if (!url) return;
  const trimmed = url.trim();
  const safeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  Linking.openURL(safeUrl).catch(() => {});
}

export function shareRestaurantUrl(restaurantId: string, name: string) {
  const url = `https://menubank.app/r/${restaurantId}`;
  return { url, message: `${name} - MenuBank\n${url}` };
}
