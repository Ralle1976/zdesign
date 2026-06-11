'use client';

import { I18nProvider } from '@/i18n/provider';
import { ThemeProvider } from 'next-themes';
import { ZDesignApp } from '@/components/zdesign/ZDesignApp';

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <I18nProvider>
        <ZDesignApp />
      </I18nProvider>
    </ThemeProvider>
  );
}
