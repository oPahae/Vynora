import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  getLocaleMeta,
  isSupportedLocale,
  normalizeLocale
} from './config';
import { setActiveLocale, t, td } from './runtime';

const I18nContext = createContext(null);
const STORAGE_KEY = 'lang';
const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(locale) {
  try {
    document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  } catch (error) {}
}

function applyDocumentLocale(locale) {
  const meta = getLocaleMeta(locale);
  const root = document.documentElement;
  root.lang = meta.htmlLang;
  root.dir = meta.dir;
}

// --- Traduction automatique des messages renvoyes par l'API ------------------
// Le serveur repond avec des messages francais ({ success:false, message }).
// On les traduit ici, au moment ou la reponse est lue, pour que TOUS les
// messages d'erreur/succes suivent la langue choisie sans modifier chaque route.
const MESSAGE_FIELDS = ['message', 'error', 'errors', 'warning'];

function translatePayload(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return value;
  if (typeof value === 'string') return td(value);
  if (Array.isArray(value)) return value.map((item) => translatePayload(item, depth + 1));
  if (typeof value === 'object') {
    const out = { ...value };
    Object.keys(out).forEach((key) => {
      out[key] = translatePayload(out[key], depth + 1);
    });
    return out;
  }
  return value;
}

function installFetchTranslator() {
  if (typeof window === 'undefined' || window.__i18nFetchPatched) return;
  window.__i18nFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const input = args[0];
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        const originalJson = response.json.bind(response);
        response.json = async () => {
          const data = await originalJson();
          if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
          const out = { ...data };
          MESSAGE_FIELDS.forEach((field) => {
            if (field in out) out[field] = translatePayload(out[field]);
          });
          return out;
        };
      }
    } catch (error) {}
    return response;
  };
}

installFetchTranslator();

export function I18nProvider({ initialLocale, children }) {
  const { user, updateUser } = useAuth();
  const [locale, setLocaleState] = useState(isSupportedLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE);
  const syncedRef = useRef(false);

  // Active la langue pour t() AVANT le rendu des enfants (SSR inclus).
  setActiveLocale(locale);

  // Sans cookie (premiere visite), on retombe sur la valeur memorisee localement.
  useEffect(() => {
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith(`${LANG_COOKIE}=`));
    if (hasCookie) return;
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (error) {}
    const candidate = normalizeLocale(stored);
    if (candidate && candidate !== locale) setLocaleState(candidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
    writeCookie(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {}
  }, [locale]);

  // Langue enregistree sur le compte : elle suit l'utilisateur d'un appareil
  // a l'autre. Si aucune n'est encore enregistree, on y memorise la langue
  // courante (utilisee pour les e-mails et notifications push).
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;
    if (isSupportedLocale(user.language)) {
      if (user.language !== locale) setLocaleState(user.language);
    } else {
      fetch('/api/users/me/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: locale })
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) syncedRef.current = false;
  }, [user]);

  const setLocale = useCallback(
    async (next) => {
      if (!isSupportedLocale(next)) return;
      setActiveLocale(next);
      setLocaleState(next);
      applyDocumentLocale(next);
      writeCookie(next);
      if (user) {
        updateUser({ language: next });
        try {
          await fetch('/api/users/me/language', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: next })
          });
        } catch (error) {}
      }
    },
    [user, updateUser]
  );

  const meta = getLocaleMeta(locale);
  const value = useMemo(
    () => ({ locale, setLocale, dir: meta.dir, isRtl: meta.dir === 'rtl', locales: LOCALES, t }),
    [locale, setLocale, meta.dir]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Les composants qui vivent hors des pages remontees (toasts, appels...) appellent
// useI18n() pour se re-rendre quand la langue change.
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n doit etre utilise a l'interieur de I18nProvider");
  }
  return context;
}

export { t } from './runtime';
