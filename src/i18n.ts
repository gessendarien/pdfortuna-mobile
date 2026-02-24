import { I18n } from 'i18n-js';
import * as RNLocalize from 'react-native-localize';
import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';

const i18n = new I18n({ en, es, zh });

// Find best available language based on device locale
const locales = RNLocalize.getLocales();
const deviceLang = locales[0]?.languageCode ?? 'en';

const getLocale = (lang: string): string => {
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('es')) return 'es';
    return 'en';
};

i18n.locale = getLocale(deviceLang);

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export const t = (key: string, options?: Record<string, any>) => i18n.t(key, options);
export default i18n;
