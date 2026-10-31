import { useState, useEffect } from 'react';
import Head from 'next/head';
import { BarChart3, FileText, Heart, MessageCircle, Share2, Eye, Users, Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EngagementChart from '@/components/stats/engagementChart';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const STAT_CARDS = [
  { key: 'postsCount', get label() { return t("Publications"); }, icon: FileText },
  { key: 'reactionsReceived', get label() { return t("Reactions recues"); }, icon: Heart },
  { key: 'commentsReceived', get label() { return t("Commentaires recus"); }, icon: MessageCircle },
  { key: 'sharesReceived', get label() { return t("Partages"); }, icon: Share2 },
  { key: 'viewsReceived', get label() { return t("Vues"); }, icon: Eye },
  { key: 'friendsCount', get label() { return t("Amis"); }, icon: Users }
];

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats);
          setTrend(data.engagementTrend);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>{pageTitle(t("Statistiques"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={BarChart3} title={t("Statistiques")} />

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STAT_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className="nx-card !rounded-xl2 p-4">
                      <div className="w-8 h-8 rounded-xl2 bg-brand-50 flex items-center justify-center text-brand-500 mb-2">
                        <Icon size={15} />
                      </div>
                      <p className="text-2xl font-display font-semibold text-slate-900">{stats?.[card.key] ?? 0}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{card.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="nx-card p-5">
                <h2 className="text-sm font-semibold text-slate-600 mb-4">{t("Evolution de l'engagement (8 dernieres semaines)")}</h2>
                {trend.every((point) => point.count === 0) ? (
                  <p className="text-sm text-slate-400 text-center py-10">{t("Pas encore assez de donnees pour afficher une tendance.")}</p>
                ) : (
                  <EngagementChart data={trend} />
                )}
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
