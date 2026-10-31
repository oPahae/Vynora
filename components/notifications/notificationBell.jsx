import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import NotificationItem from '@/components/notifications/notificationItem';
import { useSocket } from '@/lib/socketContext';

import { t } from '@/lib/i18n/runtime';
export default function NotificationBell({ className = '' }) {
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=10');
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    function handleNewNotification(notification) {
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
    }

    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, [socket]);

  async function markAsRead(id) {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await fetch('/api/notifications/readAll', { method: 'POST' });
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            if (next && unreadCount > 0) markAllAsRead();
            return next;
          });
        }}
        className={`nx-icon-btn relative ${isOpen ? 'bg-slate-100 text-slate-900' : ''}`}
        aria-label={t("Notifications")}
        aria-expanded={isOpen}
      >
        <Bell key={unreadCount} size={19} className={unreadCount > 0 ? "origin-top animate-[bell-ring_1.2s_ease-in-out_1]" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 nx-badge !min-w-[18px] !h-[18px] !px-1 !text-[10px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] nx-pop overflow-hidden z-30"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-display font-semibold text-slate-900 text-sm">{t("Notifications")}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
                >
                  <CheckCheck size={13} />{' '}{t("Tout marquer comme lu")}</button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-brand-400" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">{t("Aucune notification pour le moment.")}</p>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onRead={markAsRead} />
                ))
              )}
            </div>

            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block text-center text-xs font-medium text-brand-600 hover:underline py-3 border-t border-slate-100"
            >{t("Voir toutes les notifications")}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
