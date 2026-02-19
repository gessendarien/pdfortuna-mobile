import { I18n } from 'i18n-js';
import * as RNLocalize from 'react-native-localize';
import en from './locales/en.json';
import es from './locales/es.json';

const i18n = new I18n({ en, es });

// Find best available language: Spanish if device is Spanish, English otherwise
const locales = RNLocalize.getLocales();
const deviceLang = locales[0]?.languageCode ?? 'en';
i18n.locale = deviceLang.startsWith('es') ? 'es' : 'en';

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export const t = (key: string, options?: Record<string, any>) => i18n.t(key, options);
export default i18n;
