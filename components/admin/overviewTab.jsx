import { useEffect, useState } from 'react';
import { Users, FileText, MessageSquare, Clapperboard, UsersRound, Hash, Flag, Ban, ShieldCheck, Crown, MailQuestion } from 'lucide-react';
import { Spinner } from '@/components/admin/adminCommon';
import { formatNumber, t, formatDate } from '@/lib/i18n/runtime';

function Stat({ icon: Icon, label, value, hint, tone = 'brand', onClick }) {
  const tones = { brand: 'bg-brand-50 text-brand-600', ember: 'bg-ember-50 text-ember-600', emerald: 'bg-emerald-50 text-emerald-600', slate: 'bg-slate-100 text-slate-600' };
  return (
    <button onClick={onClick} disabled={!onClick} className="nx-card text-start p-4 flex items-center gap-3.5 disabled:cursor-default enabled:hover:shadow-card transition-shadow">
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block text-2xl font-display font-semibold text-slate-900 leading-none tabular-nums">{formatNumber(value)}</span>
        <span className="block text-xs text-slate-500 mt-1.5">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

function MiniBars({ title, series, color }) {
  const max = Math.max(1, ...series.map((point) => point.count));
  return (
    <div className="nx-card p-4">
      <p className="text-sm font-semibold text-slate-800 mb-3">{title}</p>
      <div className="flex items-end gap-1 h-24">
        {series.map((point) => (
          <div key={point.day} className="flex-1 flex flex-col justify-end h-full group relative">
            <div className="rounded-t-md min-h-[2px] transition-all" style={{ height: `${(point.count / max) * 100}%`, background: color }} />
            <span className="pointer-events-none absolute -top-6 start-1/2 -translate-x-1/2 text-[10px] bg-ink text-white rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
              {formatDate(point.day, { day: 'numeric', month: 'short' })} · {point.count}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
        <span>{formatDate(series[0].day, { day: 'numeric', month: 'short' })}</span>
        <span>{formatDate(series[series.length - 1].day, { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

export default function OverviewTab({ onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/stats').then((response) => response.json()).then((json) => json.success && setData(json));
  }, []);

  if (!data) return <Spinner />;
  const c = data.counts;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat icon={Flag} tone="ember" label={t("Signalements en attente")} value={c.pendingReports} onClick={() => onNavigate('reports')} />
        <Stat icon={Users} label={t("Utilisateurs")} value={c.users} hint={t("+{count} sur 7 jours", { count: c.newUsers7d })} onClick={() => onNavigate('users')} />
        <Stat icon={Ban} tone="slate" label={t("Comptes bannis")} value={c.bannedUsers} onClick={() => onNavigate('users')} />
        <Stat icon={FileText} label={t("Publications")} value={c.posts} hint={t("+{count} sur 7 jours", { count: c.posts7d })} onClick={() => onNavigate('posts')} />
        <Stat icon={MessageSquare} label={t("Commentaires")} value={c.comments} onClick={() => onNavigate('comments')} />
        <Stat icon={Clapperboard} label={t("Reels")} value={c.reels} onClick={() => onNavigate('reels')} />
        <Stat icon={UsersRound} label={t("Groupes")} value={c.groups} onClick={() => onNavigate('groups')} />
        <Stat icon={Hash} label={t("Serveurs")} value={c.servers} onClick={() => onNavigate('servers')} />
        <Stat icon={MailQuestion} tone="ember" label={t("Demandes de revision en attente")} value={c.pendingAppeals} onClick={() => onNavigate('appeals')} />
        <Stat icon={Crown} tone="emerald" label={t("Comptes premium")} value={c.premiumUsers} onClick={() => onNavigate('premium')} />
        <Stat icon={ShieldCheck} tone="emerald" label={t("Administrateurs")} value={c.admins} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <MiniBars title={t("Inscriptions (14 jours)")} series={data.signups} color="rgb(var(--spot))" />
        <MiniBars title={t("Publications (14 jours)")} series={data.postsPerDay} color="#10b981" />
      </div>
    </div>
  );
}
