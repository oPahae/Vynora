import { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
const ThemeContext = createContext(null);

// Dernier theme connu, garde localement : _document.jsx l'applique avant le
// premier affichage, ce qui supprime le flash clair au chargement en mode sombre.
const THEME_CACHE_KEY = 'nx-theme';

function readCachedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_CACHE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch (error) {
    return null;
  }
}

function writeCachedTheme(value) {
  try {
    window.localStorage.setItem(THEME_CACHE_KEY, value);
  } catch (error) {}
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [cachedTheme, setCachedTheme] = useState(null);
  const theme = user?.theme || cachedTheme || 'light';
  const lastPointer = useRef(null);

  useEffect(() => {
    setCachedTheme(readCachedTheme());
    // Position du dernier appui : origine de l'onde de changement de theme.
    function onDown(event) {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    }
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (user?.theme) writeCachedTheme(user.theme);
  }, [user?.theme]);

  const setTheme = useCallback(
    async (nextTheme) => {
      const root = document.documentElement;
      const apply = () => {
        root.classList.toggle('dark', nextTheme === 'dark');
        writeCachedTheme(nextTheme);
        updateUser({ theme: nextTheme });
      };

      const canReveal =
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        nextTheme !== theme;

      if (canReveal) {
        // L'onde part du point d'appui (ou du coin superieur droit au clavier)
        // et grandit jusqu'au coin le plus eloigne.
        const origin = lastPointer.current || { x: window.innerWidth - 48, y: 32 };
        const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
        root.style.setProperty('--vt-x', `${origin.x}px`);
        root.style.setProperty('--vt-y', `${origin.y}px`);
        root.style.setProperty('--vt-r', `${radius}px`);
        root.classList.add('nx-theme-vt');
        const transition = document.startViewTransition(() => {
          flushSync(apply);
        });
        transition.finished.finally(() => root.classList.remove('nx-theme-vt'));
      } else {
        apply();
      }

      try {
        await fetch('/api/users/me/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: nextTheme })
        });
      } catch (error) {}
    },
    [updateUser, theme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error(t("useTheme doit etre utilise a l'interieur de ThemeProvider"));
  }
  return context;
}
