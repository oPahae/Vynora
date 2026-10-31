import { useState, useEffect } from 'react';
import { Crown, Loader2, Save, CircleDollarSign, Users, TrendingUp, Repeat, Percent, CalendarDays } from 'lucide-react';
import { useSocket } from '@/lib/socketContext';
import { PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import { useToast } from '@/lib/toastContext';
import { formatDate, formatNumber, t, td } from '@/lib/i18n/runtime';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-400 mt-1 block">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full h-11 rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

function SalesChart({ series }) {
  const max = Math.max(1, ...series.map((point) => point.amount));
  return (
    <div className="nx-card p-4">
      <p className="text-sm font-semibold text-slate-800 mb-3">{t("Ventes (14 jours)")}</p>
      <div className="flex items-end gap-1 h-24">
        {series.map((point) => (
          <div key={point.day} className="flex-1 flex flex-col justify-end h-full group relative">
            <div className="rounded-t-md min-h-[2px] transition-all" style={{ height: `${(point.amount / max) * 100}%`, background: '#f59e0b' }} />
            <span className="pointer-events-none absolute -top-6 start-1/2 -translate-x-1/2 text-[10px] bg-ink text-white rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
              {formatDate(point.day, { day: 'numeric', month: 'short' })} · {formatNumber(point.amount)} MAD
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

function MiniStat({ icon: Icon, tone, label, value, hint }) {
  const tones = { amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', brand: 'bg-brand-50 text-brand-600', violet: 'bg-violet-50 text-violet-600' };
  return (
    <div className="nx-card p-4 flex items-center gap-3">
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={19} /></span>
      <div className="min-w-0">
        <p className="text-xl font-display font-semibold tabular-nums leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1.5">{label}</p>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export default function PremiumTab() {
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [salesStats, setSalesStats] = useState(null);
  const [buyers, setBuyers] = useState(null);
  const [buyersMore, setBuyersMore] = useState(false);
  const [buyersLoading, setBuyersLoading] = useState(false);

  function loadSales() {
    fetch('/api/admin/premium-buyers').then((r) => r.json()).then((data) => {
      if (data.success) {
        setSalesStats(data.stats);
        setBuyers(data.buyers);
        setBuyersMore(data.hasMore);
      }
    });
  }

  async function loadMoreBuyers() {
    setBuyersLoading(true);
    const data = await (await fetch(`/api/admin/premium-buyers?offset=${buyers.length}`)).json();
    if (data.success) {
      setBuyers((prev) => [...prev, ...data.buyers]);
      setBuyersMore(data.hasMore);
    }
    setBuyersLoading(false);
  }

  const [settings, setSettings] = useState(null);
  const [paypal, setPaypal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState(null);
  const [totals, setTotals] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nouvel achat en temps reel
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('admin:premium', loadSales);
    return () => socket.off('admin:premium', loadSales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((data) => {
      if (data.success) {
        setSettings(data.settings);
        setPaypal(data.paypal);
      }
    });
    fetch('/api/admin/payments').then((r) => r.json()).then((data) => {
      if (data.success) {
        setPayments(data.items);
        setTotals(data.totals);
        setHasMore(data.hasMore);
      }
    });
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        showToast({ title: t("Parametres enregistres"), type: 'success', playSound: false });
      } else {
        showToast({ title: td(data.message), type: 'error', playSound: false });
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const data = await (await fetch(`/api/admin/payments?offset=${payments.length}`)).json();
    if (data.success) {
      setPayments((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    }
    setLoadingMore(false);
  }

  if (!settings || !payments || !salesStats) return <Spinner />;

  const set = (key) => (event) => setSettings({ ...settings, [key]: event.target.value });
  const preview = (Math.round(Number(settings.premium_price_mad) * Number(settings.premium_mad_rate) * 100) / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={CircleDollarSign} tone="emerald" label={t("Revenus encaisses")} value={`${formatNumber(salesStats.totalMad)} MAD`} hint={t("{count} paiement(s)", { count: salesStats.payments })} />
        <MiniStat icon={CalendarDays} tone="amber" label={t("Aujourd'hui")} value={`${formatNumber(salesStats.todayMad)} MAD`} hint={t("{count} achat(s)", { count: salesStats.todayCount })} />
        <MiniStat icon={TrendingUp} tone="brand" label={t("7 derniers jours")} value={`${formatNumber(salesStats.week7Mad)} MAD`} hint={t("30 jours : {amount} MAD", { amount: formatNumber(salesStats.month30Mad) })} />
        <MiniStat icon={Crown} tone="amber" label={t("Comptes premium actifs")} value={salesStats.activePremium} />
        <MiniStat icon={Users} tone="violet" label={t("Acheteurs")} value={salesStats.buyers} hint={t("{count} ont rachete", { count: salesStats.repeatBuyers })} />
        <MiniStat icon={Repeat} tone="brand" label={t("Panier moyen / acheteur")} value={`${formatNumber(salesStats.avgPerBuyerMad)} MAD`} />
        <MiniStat icon={Percent} tone="emerald" label={t("Taux de conversion")} value={`${salesStats.conversionRate} %`} hint={t("acheteurs / utilisateurs")} />
      </div>
      <SalesChart series={salesStats.daily} />

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">{t("Acheteurs")}</h2>
        {buyers.length === 0 ? (
          <p className="text-sm text-slate-400">{t("Aucun acheteur pour le moment.")}</p>
        ) : (
          <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
            {buyers.map((buyer) => (
              <div key={buyer.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell
                    person={buyer}
                    subtitle={t("Dernier achat : {date}", { date: formatDate(String(buyer.lastAt).replace(' ', 'T'), { day: 'numeric', month: 'short', year: 'numeric' }) })}
                  />
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{formatNumber(buyer.totalMad)} MAD</p>
                  <p className="text-xs text-slate-400">{t("{count} achat(s)", { count: buyer.purchases })}</p>
                </div>
                <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${buyer.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {buyer.active ? t("Actif") : t("Expire")}
                </span>
              </div>
            ))}
          </div>
        )}
        <LoadMore hasMore={buyersMore} loading={buyersLoading} onClick={loadMoreBuyers} />
      </div>

      <form onSubmit={save} className="nx-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display font-semibold text-slate-900">{t("Tarification et options")}</h2>
          {paypal && (
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${paypal.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              PayPal : {paypal.configured ? paypal.mode : t("non configure")}
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("Prix (MAD)")} hint={t("Prix affiche aux utilisateurs.")}>
            <input type="number" min="1" step="0.01" value={settings.premium_price_mad} onChange={set('premium_price_mad')} className={inputClass} />
          </Field>
          <Field label={t("Duree d'un achat (jours)")} hint={t("0 = Premium a vie.")}>
            <input type="number" min="0" step="1" value={settings.premium_duration_days} onChange={set('premium_duration_days')} className={inputClass} />
          </Field>
          <Field label={t("Devise facturee par PayPal")} hint={t("PayPal n'accepte pas le dirham : le montant est converti.")}>
            <select value={settings.premium_charge_currency} onChange={set('premium_charge_currency')} className={inputClass}>
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("Taux : 1 MAD = ... {currency}", { currency: settings.premium_charge_currency })} hint={t("Montant facture : {amount} {currency}", { amount: preview, currency: settings.premium_charge_currency })}>
            <input type="number" min="0.0001" step="0.0001" value={settings.premium_mad_rate} onChange={set('premium_mad_rate')} className={inputClass} />
          </Field>
          <Field label={t("Duree d'un boost (heures)")}>
            <input type="number" min="1" step="1" value={settings.boost_hours} onChange={set('boost_hours')} className={inputClass} />
          </Field>
          <Field label={t("Boosts actifs max. par utilisateur")}>
            <input type="number" min="1" step="1" value={settings.boost_max_active} onChange={set('boost_max_active')} className={inputClass} />
          </Field>
        </div>
        <button type="submit" disabled={saving} className="nx-btn-primary h-11">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t("Enregistrer")}
        </button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">{t("Paiements")}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400">{t("Aucun paiement pour le moment.")}</p>
        ) : (
          <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell person={payment.user} subtitle={`${formatDate(String(payment.createdAt).replace(' ', 'T'), { day: 'numeric', month: 'short', year: 'numeric' })} · ${payment.orderId}`} />
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{formatNumber(payment.amountMad)} MAD</p>
                  <p className="text-xs text-slate-400">{payment.chargeAmount} {payment.chargeCurrency}</p>
                </div>
                <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${payment.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : payment.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                  {payment.status === 'completed' ? t("Paye") : payment.status === 'failed' ? t("Echoue") : t("En cours")}
                </span>
              </div>
            ))}
          </div>
        )}
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </div>
    </div>
  );
}
