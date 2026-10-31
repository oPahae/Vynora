import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { useSocket } from '@/lib/socketContext';

export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      if (data.success) {
        // Nombre de DISCUSSIONS non lues (et non le total de messages non lus).
        const total = data.conversations.filter((conversation) => conversation.unreadCount > 0).length;
        setCount(total);
      }
    } catch (error) {}
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleUpdate() {
      refresh();
    }

    socket.on('message:new', handleUpdate);
    socket.on('conversation:updated', handleUpdate);

    return () => {
      socket.off('message:new', handleUpdate);
      socket.off('conversation:updated', handleUpdate);
    };
  }, [socket, refresh]);

  return { count, refresh };
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/notifications?limit=1');
      const data = await response.json();
      if (data.success) setCount(data.unreadCount);
    } catch (error) {}
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleNewNotification() {
      setCount((prev) => prev + 1);
    }

    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, [socket]);

  return { count, refresh };
}

export function useFriendRequestsCount() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/friends/requests');
      const data = await response.json();
      if (data.success) setCount(data.items.length);
    } catch (error) {}
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleNewNotification(notification) {
      if (notification.type === 'friendRequest') refresh();
    }

    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, [socket, refresh]);

  return { count, refresh };
}
