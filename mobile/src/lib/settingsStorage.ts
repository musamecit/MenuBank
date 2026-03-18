import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  DATE_FORMAT: '@menubank_date_format',
  LOCATION_ENABLED: '@menubank_location_enabled',
  NOTIFICATIONS_ENABLED: '@menubank_notifications_enabled',
} as const;

export type DateFormat = 'DD.MM.YYYY' | 'MM.DD.YYYY';

export async function getDateFormat(): Promise<DateFormat> {
  const v = await AsyncStorage.getItem(KEYS.DATE_FORMAT);
  return (v === 'MM.DD.YYYY' ? 'MM.DD.YYYY' : 'DD.MM.YYYY') as DateFormat;
}

export async function setDateFormat(format: DateFormat): Promise<void> {
  await AsyncStorage.setItem(KEYS.DATE_FORMAT, format);
}

export async function getLocationEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.LOCATION_ENABLED);
  return v !== 'false';
}

export async function setLocationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOCATION_ENABLED, enabled ? 'true' : 'false');
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
  return v !== 'false';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
}
