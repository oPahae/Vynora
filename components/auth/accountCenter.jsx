import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, X, UserPlus, KeyRound, Check, Users } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useConfirm } from '@/lib/confirmContext';
import { t, td } from '@/lib/i18n/runtime';

// Account Center : comptes enregistres sur ce navigateur, connexion en un clic
// sans mot de passe. `variant="login"` : page de connexion ; `settings` : parametres.
export default function AccountCenter({ variant = 'settings', onSwitched }) {
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/saved-logins', { cache: 'no-store' });
      const data = await response.json();
      setAccounts(data.success ? data.accounts : []);
      setCurrentUserId(data.currentUserId || null);
    } catch (e) {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function switchTo(account) {
    if (busyId || account.id === currentUserId) return;
    setError('');
    setBusyId(account.id);
    try {
      const response = await fetch('/api/auth/saved-logins/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.id })
      });
      const data = await response.json();
      if (data.success) {
        if (onSwitched) onSwitched(data.user);
        // Rechargement complet : repart d'un etat propre (sockets, contextes) pour le nouveau compte.
        window.location.assign('/');
        return;
      }
      setError(td(data.message) || t("Une erreur est survenue"));
      if (data.expired) load();
    } catch (e) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setBusyId(null);
    }
  }

  async function forget(account) {
    const ok = await confirm({
      title: t("Retirer ce compte ?"),
      message: t("{name} ne pourra plus se connecter sans mot de passe depuis ce navigateur.", {
        name: `${account.firstName} ${account.lastName}`
      }),
      confirmLabel: t("Retirer")
    });
    if (!ok) return;
    await fetch(`/api/auth/saved-logins?userId=${account.id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  if (accounts === null) {
    if (variant === 'login') return null;
    return <Loader2 size={18} className="animate-spin text-slate-400" />;
  }
  if (variant === 'login' && accounts.length === 0) return null;

  return (
    <section className={variant === 'login' ? 'mb-6' : 'space-y-3'} aria-label="Account Center">
      <div>
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <Users size={16} /> Account Center
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {t("Passez d'un compte a l'autre en un clic, sans retaper le mot de passe.")}
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-2.5">{error}</div>}

      {accounts.length === 0 ? (
        <p className="text-sm text-slate-400">
          {t("Aucun compte enregistre sur ce navigateur. Apres une connexion, choisissez « Enregistrer » pour l'ajouter ici.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => {
            const isCurrent = account.id === currentUserId;
            return (
              <li key={account.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchTo(account)}
                  disabled={Boolean(busyId) || isCurrent}
                  className="flex-1 min-w-0 flex items-center gap-3 p-2.5 rounded-xl2 border border-slate-200 bg-surface hover:border-brand-300 hover:bg-brand-50/40 transition-colors text-start disabled:cursor-default"
                >
                  <Avatar src={account.avatar} firstName={account.firstName} lastName={account.lastName} size="md" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">
                      {account.firstName} {account.lastName}
                      {account.verified && <VerifiedBadge size={14} />}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{account.emailMasked}</span>
                  </span>
                  {busyId === account.id ? (
                    <Loader2 size={16} className="animate-spin text-brand-500 shrink-0" />
                  ) : isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                      <Check size={14} /> {t("Connecte")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 shrink-0">
                      <KeyRound size={13} /> {t("Continuer")}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => forget(account)}
                  className="p-2 text-slate-400 hover:text-red-500 shrink-0"
                  title={t("Retirer ce compte")}
                  aria-label={t("Retirer ce compte")}
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {variant === 'settings' && (
        <Link
          href="/login?add=1"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
        >
          <UserPlus size={15} /> {t("Ajouter un autre compte")}
        </Link>
      )}
    </section>
  );
}
