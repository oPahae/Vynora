import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Loader2, CheckCheck, BellOff } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import NotificationItem from '@/components/notifications/notificationItem';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import { useSocket } from '@/lib/socketContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const PAGE_SIZE = 20;

const CATEGORY_TABS = [
  { key: 'all', get label() { return t("Tout"); } },
  { key: 'like', get label() { return t("J'aime"); } },
  { key: 'comments', get label() { return t("Commentaires"); } },
  { key: 'friends', get label() { return t("Amis"); } },
  { key: 'mentions', get label() { return t("Mentions"); } },
  { key: 'shares', get label() { return t("Partages"); } },
  { key: 'groups', get label() { return t("Groupes"); } }
];

const TYPE_TO_CATEGORY = {
  like: 'like',
  comment: 'comments',
  reply: 'comments',
  friendRequest: 'friends',
  friendAccept: 'friends',
  mention: 'mentions',
  share: 'shares',
  groupInvite: 'groups',
  groupRemoved: 'groups',
  groupRoleChange: 'groups'
};

export default function NotificationsPage() {
  const { socket } = useSocket();
  const [category, setCategory] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (activeCategory) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications?category=${activeCategory}&offset=0&limit=${PAGE_SIZE}`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setHasMore(data.hasMore);
        if (data.unreadCount > 0) {
          fetch('/api/notifications/readAll', { method: 'POST' }).catch(() => {});
          setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
          setUnreadCount(0);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(category);
  }, [category, load]);

  useEffect(() => {
    if (!socket) return undefined;
    function handleNew(notification) {
      const matches = category === 'all' || TYPE_TO_CATEGORY[notification.type] === category;
      if (!matches) return;
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    }
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [socket, category]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/notifications?category=${category}&offset=${notifications.length}&limit=${PAGE_SIZE}`
      );
      const data = await response.json();
      if (data.success) {
        setNotifications((prev) => [...prev, ...data.notifications]);
        setHasMore(data.hasMore);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  const handleIntersect = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMore, hasMore, notifications.length]);

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
    <>
      <Head>
        <title>{pageTitle(t("Notifications"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto nx-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h1 className="font-display text-lg font-semibold text-slate-900 tracking-tight">{t("Notifications")}</h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium"
              >
                <CheckCheck size={14} />{' '}{t("Tout marquer comme lu")}</button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-3 border-b border-slate-100">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategory(tab.key)}
                className={`h-8 px-3.5 text-[0.8rem] font-medium whitespace-nowrap rounded-full transition-colors ${
                  category === tab.key ? 'bg-ink text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
              <BellOff size={28} />
              <p className="text-sm">{t("Aucune notification pour le moment.")}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onRead={markAsRead} />
              ))}
            </div>
          )}

          {hasMore && !isLoading && (
            <div className="py-4">
              <InfiniteScrollSentinel onIntersect={handleIntersect} enabled={hasMore && !isLoadingMore} />
              {isLoadingMore && (
                <div className="flex justify-center">
                  <Loader2 size={18} className="animate-spin text-brand-400" />
                </div>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
