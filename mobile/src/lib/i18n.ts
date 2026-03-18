import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

const LANG_KEY = '@menubank_lang';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: (cb: (lng: string) => void) => {
    AsyncStorage.getItem(LANG_KEY).then((lng) => cb(lng || 'tr'));
  },
  init: () => {},
  cacheUserLanguage: (lng: string) => {
    AsyncStorage.setItem(LANG_KEY, lng);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: { tr: { translation: tr }, en: { translation: en } },
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
  });

export default i18n;
