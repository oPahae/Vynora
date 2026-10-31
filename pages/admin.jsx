import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ShieldCheck, LayoutDashboard, Flag, Users, FileText, MessageSquare, Clapperboard, UsersRound, Hash, ScrollText, MessagesSquare, Crown, MailQuestion } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import OverviewTab from '@/components/admin/overviewTab';
import ReportsTab from '@/components/admin/reportsTab';
import UsersTab from '@/components/admin/usersTab';
import ContentTab from '@/components/admin/contentTab';
import AuditTab from '@/components/admin/auditTab';
import PremiumTab from '@/components/admin/premiumTab';
import AppealsTab from '@/components/admin/appealsTab';
import { getUserFromRequest } from '@/lib/auth';
import { pageTitle } from '@/lib/constants';
import { t } from '@/lib/i18n/runtime';

function getTabs() {
  return [
    { key: 'overview', label: t("Vue d'ensemble"), icon: LayoutDashboard },
    { key: 'reports', label: t("Signalements"), icon: Flag },
    { key: 'appeals', label: t("Revisions"), icon: MailQuestion },
    { key: 'users', label: t("Utilisateurs"), icon: Users },
    { key: 'premium', label: t("Premium"), icon: Crown },
    { key: 'posts', label: t("Publications"), icon: FileText },
    { key: 'comments', label: t("Commentaires"), icon: MessageSquare },
    { key: 'reels', label: t("Reels"), icon: Clapperboard },
    { key: 'reelComments', label: t("Com. reels"), icon: MessagesSquare },
    { key: 'groups', label: t("Groupes"), icon: UsersRound },
    { key: 'servers', label: t("Serveurs"), icon: Hash },
    { key: 'audit', label: t("Journal d'audit"), icon: ScrollText }
  ];
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [pending, setPending] = useState(0);
  const [pendingAppeals, setPendingAppeals] = useState(0);

  useEffect(() => {
    if (router.query.tab) setTab(router.query.tab);
  }, [router.query.tab]);

  function refreshPending() {
    fetch('/api/admin/stats').then((r) => r.json()).then((data) => {
      if (data.success) {
        setPending(data.counts.pendingReports);
        setPendingAppeals(data.counts.pendingAppeals);
      }
    });
  }

  useEffect(() => {
    refreshPending();
  }, [tab]);

  const tabs = getTabs();

  return (
    <>
      <Head>
        <title>{pageTitle(t("Administration"))}</title>
      </Head>
      <AppLayout>
        <PageHeader icon={ShieldCheck} title={t("Administration")} subtitle={t("Controle total du systeme : contenus, comptes et signalements")} />

        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
          <div className="flex gap-1.5 min-w-max bg-slate-100 rounded-xl2 p-1">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-all ${tab === item.key ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <item.icon size={15} />
                {item.label}
                {item.key === 'reports' && pending > 0 && <span className="nx-badge !min-w-[18px] !h-[18px] !text-[10px]">{pending}</span>}
                {item.key === 'appeals' && pendingAppeals > 0 && <span className="nx-badge !min-w-[18px] !h-[18px] !text-[10px]">{pendingAppeals}</span>}
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && <OverviewTab onNavigate={setTab} />}
        {tab === 'reports' && <ReportsTab onChanged={refreshPending} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'appeals' && <AppealsTab onChanged={refreshPending} />}
        {tab === 'premium' && <PremiumTab />}
        {['posts', 'comments', 'reels', 'reelComments', 'groups', 'servers'].includes(tab) && <ContentTab key={tab} type={tab} />}
        {tab === 'audit' && <AuditTab />}
      </AppLayout>
    </>
  );
}

// Acces reserve aux administrateurs, verifie cote serveur (les routes
// /api/admin/* sont elles aussi protegees independamment).
export async function getServerSideProps({ req }) {
  const payload = await getUserFromRequest(req);
  if (!payload) return { redirect: { destination: '/login?next=/admin', permanent: false } };
  if (!payload.isAdmin) return { redirect: { destination: '/', permanent: false } };
  return { props: {} };
}
