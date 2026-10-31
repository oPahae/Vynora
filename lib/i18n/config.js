// Configuration commune des langues (utilisable cote client ET cote serveur,
// y compris depuis server.js qui est en CommonJS).
const DEFAULT_LOCALE = 'fr';
const LANG_COOKIE = 'lang';

// Ordre d'affichage dans le selecteur de langue des parametres.
const LOCALES = [
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl', htmlLang: 'ar', intl: 'ar-u-nu-latn' },
  { code: 'en', name: 'English', englishName: 'English', dir: 'ltr', htmlLang: 'en', intl: 'en-US' },
  { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr', htmlLang: 'fr', intl: 'fr-FR' },
  { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr', htmlLang: 'es', intl: 'es-ES' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', dir: 'ltr', htmlLang: 'it', intl: 'it-IT' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', dir: 'ltr', htmlLang: 'ja', intl: 'ja-JP' },
  { code: 'zh', name: '中文', englishName: 'Chinese', dir: 'ltr', htmlLang: 'zh-CN', intl: 'zh-CN' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', dir: 'ltr', htmlLang: 'ru', intl: 'ru-RU' }
];

const LOCALE_CODES = LOCALES.map((l) => l.code);

function isSupportedLocale(code) {
  return typeof code === 'string' && LOCALE_CODES.includes(code);
}

function getLocaleMeta(code) {
  return LOCALES.find((l) => l.code === code) || LOCALES.find((l) => l.code === DEFAULT_LOCALE);
}

// Normalise une valeur du type "fr-FR", "en_US", "zh-Hans" vers un code supporte.
function normalizeLocale(value) {
  if (!value || typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  return isSupportedLocale(base) ? base : null;
}

module.exports = {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  LOCALE_CODES,
  isSupportedLocale,
  getLocaleMeta,
  normalizeLocale
};
