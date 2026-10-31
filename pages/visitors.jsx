import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Eye, Crown, Loader2, Lock } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EmptyState from '@/components/shared/emptyState';
import Avatar from '@/components/shared/avatar';
import { pageTitle } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

export default function VisitorsPage() {
  const [data, setData] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch('/api/visitors')
      .then((response) => response.json())
      .then((json) => {
        if (json.success) {
          setData(json);
          setVisitors(json.visitors);
        }
      });
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const response = await fetch(`/api/visitors?offset=${visitors.length}`);
    const json = await response.json();
    if (json.success) {
      setVisitors((prev) => [...prev, ...json.visitors]);
      setData((prev) => ({ ...prev, hasMore: json.hasMore }));
    }
    setLoadingMore(false);
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Visiteurs du profil"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={Eye} title={t("Visiteurs du profil")} subtitle={t("Qui a consulte votre profil")} />

          {!data ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="nx-card p-4">
                  <p className="text-3xl font-display font-semibold text-slate-900 tabular-nums">{data.total}</p>
                  <p className="text-xs text-slate-500 mt-1">{t("Visiteurs au total")}</p>
                </div>
                <div className="nx-card p-4">
                  <p className="text-3xl font-display font-semibold text-slate-900 tabular-nums">{data.last7Days}</p>
                  <p className="text-xs text-slate-500 mt-1">{t("Sur les 7 derniers jours")}</p>
                </div>
              </div>

              {!data.premium ? (
                <div className="nx-card !p-0 overflow-hidden">
                  <div className="relative">
                    <div className="divide-y divide-slate-100 blur-[6px] select-none pointer-events-none" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-4">
                          <div className="w-11 h-11 rounded-full bg-slate-200" />
                          <div className="flex-1 space-y-2"><div className="h-3 w-32 rounded bg-slate-200" /><div className="h-2.5 w-20 rounded bg-slate-100" /></div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-surface/55">
                      <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3"><Lock size={22} /></span>
                      <p className="font-semibold text-slate-900">
                        {data.total > 0 ? t("{count} personne(s) ont consulte votre profil", { count: data.total }) : t("Decouvrez qui consulte votre profil")}
                      </p>
                      <p className="text-sm text-slate-500 mt-1 mb-4">{t("Reserve aux comptes premium.")}</p>
                      <Link href="/premium" className="nx-btn-primary"><Crown size={16} /> {t("Passer Premium")}</Link>
                    </div>
                  </div>
                </div>
              ) : visitors.length === 0 ? (
                <EmptyState icon={Eye} tone="neutral" title={t("Aucun visiteur pour le moment.")} />
              ) : (
                <>
                  <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
                    {visitors.map((visitor) => (
                      <Link key={visitor.id} href={`/profile/${visitor.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                        <Avatar src={visitor.avatar} firstName={visitor.firstName} lastName={visitor.lastName} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{visitor.firstName} {visitor.lastName}{visitor.verified && <VerifiedBadge size={14} />}</p>
                          <p className="text-xs text-slate-500">{t("Derniere visite")} : {formatRelativeTime(visitor.lastVisitedAt)}</p>
                        </div>
                        {visitor.visitCount > 1 && <span className="text-xs text-slate-400">{t("{count} visites", { count: visitor.visitCount })}</span>}
                      </Link>
                    ))}
                  </div>
                  {data.hasMore && (
                    <button onClick={loadMore} disabled={loadingMore} className="nx-btn-secondary w-full h-11 mt-4">
                      {loadingMore ? <Loader2 size={16} className="animate-spin" /> : t("Charger plus")}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </AppLayout>
    </>
  );
}
