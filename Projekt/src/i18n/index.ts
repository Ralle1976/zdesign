'use client';

import { createContext, useContext } from 'react';
import { translations, type Locale, type TranslationKey } from './translations';

interface I18nContextType {
  locale: Locale;
  t: TranslationKey;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  t: translations.en,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export function getTranslations(locale: Locale): TranslationKey {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (translations[locale] || translations.en) as any;
}

export { translations, type Locale, type TranslationKey };
