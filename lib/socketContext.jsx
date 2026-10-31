import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return undefined;
    }

    const instance = io({ path: '/api/socket' });
    socketRef.current = instance;
    setSocket(instance);

    // L'administration vient de bannir ou supprimer ce compte : on ferme la
    // session tout de suite et on affiche le motif sur la page de connexion.
    instance.on('account:terminated', ({ kind, reason }) => {
      const params = new URLSearchParams({ terminated: kind || 'banned' });
      if (reason) params.set('reason', reason);
      fetch('/api/auth/logout', { method: 'POST' })
        .catch(() => {})
        .finally(() => {
          window.location.href = `/login?${params.toString()}`;
        });
    });

    instance.on('presence:list', (ids) => {
      setOnlineUserIds(new Set(ids));
    });

    instance.on('presence:update', ({ userId, online }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    return () => {
      instance.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUserIds }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error(t("useSocket doit etre utilise a l'interieur de SocketProvider"));
  }
  return context;
}
