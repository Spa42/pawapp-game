'use client';

import React, { useState, useEffect, useCallback } from 'react';
import localizationManager, { Language, languageChangeEvent } from '@/utils/LocalizationManager';

const LanguageToggle: React.FC = () => {
    const [currentLang, setCurrentLang] = useState<Language>(localizationManager.getCurrentLanguage());

    const handleLanguageChange = useCallback(() => {
        setCurrentLang(localizationManager.getCurrentLanguage());
    }, []);

    useEffect(() => {
        // Set initial state on mount
        setCurrentLang(localizationManager.getCurrentLanguage());
        
        // Listen for changes triggered elsewhere
        languageChangeEvent.addEventListener('languageChanged', handleLanguageChange);
        return () => {
            languageChangeEvent.removeEventListener('languageChanged', handleLanguageChange);
        };
    }, [handleLanguageChange]);

    const toggleLanguage = () => {
        const nextLang = currentLang === 'en' ? 'ar' : 'en';
        localizationManager.setLanguage(nextLang);
        // State update will happen via the event listener
    };

    // Determine button text (show the language to switch TO)
    const buttonText = currentLang === 'en' ? 'العربية' : 'English';

    return (
        <button
            onClick={toggleLanguage}
            className="absolute top-4 right-4 z-50 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded shadow"
            aria-label={`Switch to ${currentLang === 'en' ? 'Arabic' : 'English'}`}
        >
            {buttonText}
        </button>
    );
};

export default LanguageToggle; 