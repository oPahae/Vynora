import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, BadgeCheck, Eye, Rocket, Check, Loader2, PartyPopper } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PaypalCheckout from '@/components/premium/paypalCheckout';
import { useAuth } from '@/lib/authContext';
import { pageTitle } from '@/lib/constants';
import { formatDate, formatNumber, t } from '@/lib/i18n/runtime';

function FeatureCard({ icon: Icon, color, title, text, href, cta }) {
  return (
    <div className="nx-card p-5">
      <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}1F`, color }}><Icon size={22} /></span>
      <p className="font-display font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{text}</p>
      {href && <Link href={href} className="inline-block text-sm font-semibold text-brand-600 hover:underline mt-3">{cta}</Link>}
    </div>
  );
}

export default function PremiumPage() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(() => {
    fetch('/api/premium')
      .then((response) => response.json())
      .then((json) => json.success && setData(json));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePaid = useCallback(() => {
    setJustPaid(true);
    load();
    if (refreshUser) refreshUser();
  }, [load, refreshUser]);

  if (!data) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><Loader2 size={26} className="animate-spin text-brand-400" /></div>
      </AppLayout>
    );
  }

  const { config, status, payments } = data;
  const duration = config.durationDays === 0 ? t("a vie") : t("pour {days} jours", { days: config.durationDays });

  return (
    <>
      <Head>
        <title>{pageTitle(t("Premium"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white shadow-glow" style={{ backgroundColor: '#E8890C' }}>
            <div className="absolute -top-16 -end-10 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur rounded-full px-3 py-1"><Crown size={14} /> Premium</span>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-4 tracking-tight">{t("Passez au niveau superieur")}</h1>
              <p className="text-white/90 mt-2 max-w-lg">{t("Badge verifie, visiteurs de votre profil et boost de vos publications.")}</p>

              {status.active ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 inline-flex items-center gap-2 bg-white text-slate-900 rounded-2xl px-4 py-2.5 font-semibold text-sm">
                  <Check size={16} className="text-emerald-500" strokeWidth={3} />
                  {status.lifetime ? t("Premium actif a vie") : t("Premium actif jusqu'au {date}", { date: formatDate(String(status.until).replace(' ', 'T'), { day: 'numeric', month: 'long', year: 'numeric' }) })}
                </motion.div>
              ) : (
                <p className="mt-5 text-4xl font-display font-semibold">
                  {formatNumber(config.priceMad)} <span className="text-xl font-medium">MAD</span>
                  <span className="text-base font-normal text-white/85"> / {duration}</span>
                </p>
              )}
            </div>
          </div>

          {justPaid && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3.5"
            >
              <PartyPopper size={22} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{t("Felicitations ! Paiement confirme, bienvenue dans Premium.")}</p>
                <p className="text-xs text-emerald-700/80 mt-0.5">{t("Votre badge verifie, vos visiteurs et le boost de publications sont actifs.")}</p>
              </div>
            </motion.div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            <FeatureCard icon={BadgeCheck} color="#0ea5e9" title={t("Badge verifie")} text={t("Un badge bleu a cote de votre nom partout : publications, commentaires, reels et profil.")} />
            <FeatureCard icon={Eye} color="#7C8CF6" title={t("Visiteurs du profil")} text={t("Voyez qui a consulte votre profil et quand.")} href="/visitors" cta={t("Voir mes visiteurs")} />
            <FeatureCard
              icon={Rocket}
              color="#f59e0b"
              title={t("Boost de publications")}
              text={t("Mettez jusqu'a {max} publications en avant pendant {hours} h dans les fils d'actualite.", { max: config.boostMaxActive, hours: config.boostHours })}
            />
          </div>

          {status.isAdmin ? (
            <div className="nx-card p-5 text-sm text-slate-600 flex items-center gap-2.5"><Crown size={18} className="text-amber-500 shrink-0" /> {t("Premium est inclus d'office avec votre role d'administrateur.")}</div>
          ) : (
          <div className="nx-card p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {status.active ? t("Prolonger mon Premium") : t("Activer Premium")}
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              {formatNumber(config.priceMad)} MAD {duration}
              {config.chargeCurrency !== 'MAD' && (
                <span className="text-slate-400"> · {t("facture {amount} {currency} via PayPal", { amount: config.chargeAmount, currency: config.chargeCurrency })}</span>
              )}
            </p>
            <PaypalCheckout config={config} onPaid={handlePaid} />
            <p className="text-xs text-slate-400 mt-4">{t("Paiement securise par PayPal. Chaque achat prolonge la duree de votre Premium.")}</p>
          </div>
          )}

          {payments.length > 0 && (
            <div className="nx-card p-5">
              <h2 className="text-sm font-semibold text-slate-500 mb-3">{t("Historique des paiements")}</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between py-2.5">
                    <span className="text-slate-700">{formatDate(String(payment.completedAt || payment.createdAt).replace(' ', 'T'), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="font-medium text-slate-900">{formatNumber(Number(payment.amountMad))} MAD <span className="text-slate-400 font-normal">({payment.chargeAmount} {payment.chargeCurrency})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
