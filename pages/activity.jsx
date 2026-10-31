import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { History, Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import Segmented from '@/components/shared/segmented';
import EmptyState from '@/components/shared/emptyState';
import ActivityItem from '@/components/activity/activityItem';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import { pageTitle } from '@/lib/constants';
import { t, formatDate } from '@/lib/i18n/runtime';

const FILTERS = [
  { key: 'all', get label() { return t("Tout"); } },
  { key: 'posts', get label() { return t("Publications"); } },
  { key: 'reactions', get label() { return t("Reactions"); } },
  { key: 'comments', get label() { return t("Commentaires"); } },
  { key: 'friends', get label() { return t("Amis"); } },
  { key: 'reels', get label() { return t("Reels"); } },
  { key: 'other', get label() { return t("Autres"); } }
];

function dayKey(createdAt) {
  return createdAt.slice(0, 10);
}

function dayLabel(key) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localKey(today) || key === fmt(today)) return t("Aujourd'hui");
  if (key === localKey(yesterday) || key === fmt(yesterday)) return t("Hier");
  return formatDate(`${key}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ActivityPage() {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setItems([]);
    fetch(`/api/activity?category=${category}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setItems(data.items);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/activity?category=${category}&before=${cursor}`);
      const data = await response.json();
      if (data.success) {
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [category, cursor, hasMore, isLoadingMore]);

  const groups = useMemo(() => {
    const result = [];
    items.forEach((item) => {
      const key = dayKey(item.createdAt);
      const last = result[result.length - 1];
      if (last && last.key === key) last.items.push(item);
      else result.push({ key, items: [item] });
    });
    return result;
  }, [items]);

  return (
    <>
      <Head>
        <title>{pageTitle(t("Journal d'activite"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={History} title={t("Journal d'activite")} subtitle={t("Tout ce que vous avez fait sur votre compte")} />

          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <Segmented value={category} onChange={setCategory} items={FILTERS.map((f) => ({ key: f.key, label: f.label }))} className="min-w-max" />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={History} title={t("Aucune activite pour le moment.")} description={t("Vos publications, reactions, commentaires et invitations apparaitront ici.")} />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.key}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 ms-1 capitalize">{dayLabel(group.key)}</h2>
                  <div className="nx-card !p-0 overflow-hidden divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <ActivityItem key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
              <InfiniteScrollSentinel onIntersect={loadMore} enabled={hasMore} />
              {isLoadingMore && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-400" /></div>}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
