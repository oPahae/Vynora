import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { MapPin, Monitor, Smartphone, ShieldCheck, Trash2, Loader2, KeyRound } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EmptyState from '@/components/shared/emptyState';
import { useConfirm } from '@/lib/confirmContext';
import { pageTitle } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

function placeOf(device) {
  const place = [device.city, device.country].filter(Boolean).join(', ');
  return place || t("Localisation inconnue");
}

export default function DevicesPage() {
  const confirm = useConfirm();
  const [devices, setDevices] = useState(null);

  useEffect(() => {
    fetch('/api/devices')
      .then((response) => response.json())
      .then((data) => setDevices(data.success ? data.devices : []))
      .catch(() => setDevices([]));
  }, []);

  async function forget(device) {
    const ok = await confirm({
      title: t("Oublier cet appareil ?"),
      message: t("Une alerte vous sera envoyee a sa prochaine connexion."),
      confirmLabel: t("Oublier"),
      danger: true
    });
    if (!ok) return;
    await fetch('/api/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: device.id }) });
    setDevices((prev) => prev.filter((item) => item.id !== device.id));
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Appareils connectes"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={ShieldCheck} title={t("Appareils connectes")} subtitle={t("Vous etes alerte a chaque connexion depuis un nouvel appareil")} />

          <div className="nx-card !p-4 mb-5 flex items-start gap-3 bg-amber-50/60 border-amber-200">
            <KeyRound size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-700">
              {t("Un appareil ou un lieu que vous ne reconnaissez pas ?")}{' '}
              <Link href="/settings" className="font-semibold text-brand-600 hover:underline">{t("Changez votre mot de passe")}</Link>
            </p>
          </div>

          {devices === null ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-400" /></div>
          ) : devices.length === 0 ? (
            <EmptyState icon={Monitor} tone="neutral" title={t("Aucun appareil enregistre.")} />
          ) : (
            <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
              {devices.map((device) => {
                const mobile = /iPhone|iPad|Android/i.test(device.label);
                const Icon = mobile ? Smartphone : Monitor;
                return (
                  <div key={device.id} className="flex items-center gap-3.5 p-4">
                    <span className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><Icon size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                        {device.label}
                        {device.current && <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5">{t("Cet appareil")}</span>}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <MapPin size={12} /> {placeOf(device)}
                        {device.ip && <span className="text-slate-400" dir="ltr">· {device.ip}</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{t("Derniere activite")} : {formatRelativeTime(device.lastSeenAt)}</p>
                    </div>
                    {!device.current && (
                      <button onClick={() => forget(device)} className="nx-icon-btn w-9 h-9 text-slate-400 hover:text-red-500" title={t("Oublier")}><Trash2 size={16} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
