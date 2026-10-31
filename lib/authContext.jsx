import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

import { t } from '@/lib/i18n/runtime';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      } else {
        setUser(null);
        // Compte banni / supprime pendant la session : retour a la connexion avec le motif.
        if (data.terminated && typeof window !== 'undefined') {
          const params = new URLSearchParams({ terminated: data.terminated });
          if (data.reason) params.set('reason', data.reason);
          window.location.href = `/login?${params.toString()}`;
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Filet de securite si le temps reel est coupe : on reverifie la session au
  // retour sur l'onglet et toutes les 60 s tant que l'utilisateur est connecte.
  useEffect(() => {
    if (!user) return undefined;
    const check = () => {
      if (document.visibilityState === 'visible') fetchUser();
    };
    const timer = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [user, fetchUser]);

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser: fetchUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(t("useAuth doit etre utilise a l'interieur de AuthProvider"));
  }
  return context;
}
