import * as Localization from 'expo-localization';

export const APP_LANGUAGE_CODES = ['en', 'tr', 'es', 'fr', 'de', 'ru', 'ja', 'zh', 'hi', 'ar'] as const;
export type AppLanguageCode = (typeof APP_LANGUAGE_CODES)[number];

/** Native names for the language picker (always shown in that language). */
export const LANGUAGE_NATIVE_NAMES: Record<AppLanguageCode, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  hi: 'हिन्दी',
  ar: 'العربية',
};

export function isAppLanguageCode(code: string | undefined | null): code is AppLanguageCode {
  return Boolean(code && (APP_LANGUAGE_CODES as readonly string[]).includes(code));
}

/** Normalize i18next tag (e.g. en-US) to a supported app code. */
export function normalizeAppLanguage(lng: string | undefined): AppLanguageCode {
  if (!lng) return 'en';
  const base = lng.split('-')[0].toLowerCase();
  return isAppLanguageCode(base) ? base : 'en';
}

/** Map device languageTag / languageCode to our app code; default English. */
export function deviceLanguageToAppCode(): AppLanguageCode {
  let locales: ReturnType<typeof Localization.getLocales>;
  try {
    locales = Localization.getLocales();
  } catch {
    return 'en';
  }
  const primary = locales[0];
  const tag = (primary?.languageTag ?? 'en').toLowerCase();
  const code = (primary?.languageCode ?? tag.split('-')[0] ?? 'en').toLowerCase();

  if (tag.startsWith('zh') || code === 'zh') return 'zh';
  if (code === 'tr' || tag.startsWith('tr')) return 'tr';
  if (code === 'es' || tag.startsWith('es')) return 'es';
  if (code === 'fr' || tag.startsWith('fr')) return 'fr';
  if (code === 'de' || tag.startsWith('de')) return 'de';
  if (code === 'ru' || tag.startsWith('ru')) return 'ru';
  if (code === 'ja' || tag.startsWith('ja')) return 'ja';
  if (code === 'hi' || tag.startsWith('hi')) return 'hi';
  if (code === 'ar' || tag.startsWith('ar')) return 'ar';
  if (code === 'en' || tag.startsWith('en')) return 'en';
  return 'en';
}

/** Curated list titles in DB are only title_tr / title_en. */
export function curatedListTitleField(lang: string): 'title_tr' | 'title_en' {
  return lang === 'tr' ? 'title_tr' : 'title_en';
}
