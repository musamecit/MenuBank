import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ru from '../locales/ru.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import hi from '../locales/hi.json';
import ar from '../locales/ar.json';
import { deviceLanguageToAppCode, isAppLanguageCode, normalizeAppLanguage } from './languages';

const LANG_KEY = '@menubank_lang';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: (cb: (lng: string) => void) => {
    AsyncStorage.getItem(LANG_KEY)
      .then((stored) => {
        if (stored && isAppLanguageCode(stored)) {
          cb(stored);
          return;
        }
        try {
          cb(deviceLanguageToAppCode());
        } catch {
          cb('en');
        }
      })
      .catch(() => cb('en'));
  },
  init: () => {},
  cacheUserLanguage: () => {},
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      en: { translation: en },
      tr: { translation: tr },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ru: { translation: ru },
      ja: { translation: ja },
      zh: { translation: zh },
      hi: { translation: hi },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'tr', 'es', 'fr', 'de', 'ru', 'ja', 'zh', 'hi', 'ar'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

i18n.on('languageChanged', (lng) => {
  void AsyncStorage.setItem(LANG_KEY, normalizeAppLanguage(lng));
});

export default i18n;
