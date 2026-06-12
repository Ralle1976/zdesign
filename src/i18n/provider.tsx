'use client';

import { useState, useCallback, useEffect } from 'react';
import { I18nContext, getTranslations } from './index';
import type { Locale } from './translations';
import { useZDesignStore } from '@/stores/zdesign-store';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const storeLocale = useZDesignStore((s) => s.locale);
  const setStoreLocale = useZDesignStore((s) => s.setLocale);
  const [locale, setLocaleState] = useState<Locale>(storeLocale);

  useEffect(() => {
    setLocaleState(storeLocale);
  }, [storeLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      setStoreLocale(newLocale);
    },
    [setStoreLocale]
  );

  const t = getTranslations(locale);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
