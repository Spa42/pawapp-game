'use client'; // Required for hooks and event listeners

// import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import React, { useState, useEffect } from 'react';
import localizationManager, { languageChangeEvent, Language } from '@/utils/LocalizationManager';

const inter = Inter({ subsets: ["latin"] });

// Metadata cannot be dynamically generated in a client component root layout easily,
// handle title localization differently if needed.
// export const metadata: Metadata = {
//   title: "Paw App Game", 
//   description: "Endless runner for Paw App",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, setLang] = useState<Language>(localizationManager.getCurrentLanguage());
  const [dir, setDir] = useState<'ltr' | 'rtl'>(localizationManager.getDirection());

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lang: Language }>;
      if (customEvent.detail) {
          const newLang = customEvent.detail.lang;
          setLang(newLang);
          setDir(newLang === 'ar' ? 'rtl' : 'ltr');
          console.log('Layout detected language change:', newLang);
      }
    };

    languageChangeEvent.addEventListener('languageChanged', handleLanguageChange);

    // Set initial direction on client-side mount
    setDir(localizationManager.getDirection());

    return () => {
      languageChangeEvent.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <html lang={lang} dir={dir}> 
      <body className={inter.className}>{children}</body>
    </html>
  );
}
