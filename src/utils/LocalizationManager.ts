import enTranslations from '@/localization/en.json';
import arTranslations from '@/localization/ar.json';

export type Language = 'en' | 'ar';

type Translations = typeof enTranslations; // Assume structure matches English
const LANGUAGE_STORAGE_KEY = 'pawapp-game-language';

// Simple Event Emitter for language changes
export const languageChangeEvent = new EventTarget();

class LocalizationManager {
    private currentLanguage: Language = 'ar'; // Default to Arabic as per PRD
    private translations: Translations = arTranslations;

    constructor() {
        const storedLang = this.getStoredLanguage();
        const browserLang = this.getBrowserLanguage();
        // Priority: Stored > Browser > Default ('ar')
        const initialLang = storedLang || browserLang || 'ar';
        this.loadTranslations(initialLang);
    }

    private getStoredLanguage(): Language | null {
        if (typeof window !== 'undefined') { // Check if localStorage is available
            const lang = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (lang === 'en' || lang === 'ar') {
                return lang;
            }
        }
        return null;
    }

    private getBrowserLanguage(): Language | null {
        if (typeof navigator !== 'undefined') {
            const lang = navigator.language.split('-')[0]; // Get base language (e.g., 'en' from 'en-US')
            if (lang === 'ar') {
                return 'ar';
            }
            if (lang === 'en') {
                return 'en';
            }
        }
        return null;
    }

    private loadTranslations(lang: Language): void {
        if (lang === 'en') {
            this.translations = enTranslations;
        } else {
            this.translations = arTranslations;
        }
        this.currentLanguage = lang;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); // Store preference
        }
        console.log(`Loaded ${lang} translations.`);
        // Dispatch change event
        languageChangeEvent.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    // Basic getter, no variable replacement yet
    public getTranslation(key: keyof Translations): string {
        return this.translations[key] || key; // Return key if translation not found
    }

    // Getter with simple {variable} replacement
    public getFormattedTranslation(key: keyof Translations, replacements: Record<string, string | number>): string {
        let translatedString = this.translations[key] || key;
        
        Object.entries(replacements).forEach(([varName, value]) => {
            const regex = new RegExp(`\\{${varName}\\}`, 'g');
            translatedString = translatedString.replace(regex, String(value));
        });
        
        return translatedString;
    }

    public getCurrentLanguage(): Language {
        return this.currentLanguage;
    }

    public getDirection(): 'ltr' | 'rtl' {
        return this.currentLanguage === 'ar' ? 'rtl' : 'ltr';
    }

    public setLanguage(lang: Language): void {
        if (lang !== this.currentLanguage) {
            this.loadTranslations(lang);
        }
    }

    // Add more methods as needed (e.g., handling plurals)
}

// Export a singleton instance
const localizationManager = new LocalizationManager();
export default localizationManager; 