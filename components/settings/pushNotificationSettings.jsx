import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { isPushSupported, getCurrentSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/pushClient';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
export default function PushNotificationSettings() {
  const { showToast } = useToast();
  const [serverConfigured, setServerConfigured] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/push/vapid-public-key');
      const data = await response.json();
      setServerConfigured(data.success ? data.configured : false);
      setVapidPublicKey(data.publicKey || null);

      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }

      if (isPushSupported()) {
        const subscription = await getCurrentSubscription();
        setIsSubscribed(Boolean(subscription));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleEnable() {
    setError('');
    setIsToggling(true);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== 'granted') {
          setError(t("Vous avez refuse l'autorisation de notification dans le navigateur."));
          return;
        }
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setError(t("Les notifications sont bloquees pour ce site dans les reglages de votre navigateur."));
        return;
      }

      await subscribeToPush(vapidPublicKey);
      setIsSubscribed(true);
      showToast({ title: t("Notifications push activees"), type: 'success' });
    } catch (err) {
      setError(err.message || t("Erreur lors de l'activation"));
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDisable() {
    setIsToggling(true);
    setError('');
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      showToast({ title: t("Notifications push desactivees"), type: 'success' });
    } catch (err) {
      setError(err.message || t("Erreur lors de la desactivation"));
    } finally {
      setIsToggling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-brand-400" />
      </div>
    );
  }

  if (!isPushSupported()) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl2 p-4 text-sm text-slate-500 flex items-start gap-2.5">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />{t("Votre navigateur ne prend pas en charge les notifications push.")}</div>
    );
  }

  if (!serverConfigured) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl2 p-4 text-sm text-slate-500 flex items-start gap-2.5">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />{t("Les notifications push ne sont pas encore configurees sur ce serveur (variables d'environnement VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquantes). Voir le README pour la configuration.")}</div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl2 flex items-center justify-center shrink-0 ${
              isSubscribed ? 'bg-brand-50 text-brand-500' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{t("Notifications push sur cet appareil")}</p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">{t("Recevez une alerte meme lorsque l'application n'est pas ouverte : likes, commentaires, reponses, partages, mentions, demandes d'ami et nouveaux messages. Les notifications dans l'application restent inchangees.")}</p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? handleDisable : handleEnable}
          disabled={isToggling}
          className={`shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 disabled:opacity-60 ${
            isSubscribed ? 'bg-brand-500' : 'bg-slate-200'
          }`}
        >
          <span
            className={`absolute top-0.5 start-0.5 w-6 h-6 bg-surface rounded-full shadow-soft transition-transform duration-200 ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {isSubscribed && !error && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl2 px-4 py-3 flex items-start gap-2">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />{' '}{t("Actives sur cet appareil.")}</div>
      )}
    </div>
  );
}
