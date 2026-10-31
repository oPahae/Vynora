import { useState } from 'react';
import { useRouter } from 'next/router';
import { AlertTriangle, Loader2, PauseCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
const inputClasses =
  'w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-red-400 focus:ring-4 focus:ring-red-500/10';

// Deux actions distinctes, toutes deux protegees par une re-saisie du mot
// de passe et une confirmation explicite avant l'appel reseau :
//   - Desactiver : reversible, il suffit de se reconnecter pour revenir.
//   - Supprimer : definitif, toutes les donnees liees sont effacees.
function ActionCard({ icon: Icon, title, description, buttonLabel, buttonClass, confirmLabel, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm(event) {
    event.preventDefault();
    if (!password) return;
    setIsSubmitting(true);
    setError('');
    const message = await onConfirm(password);
    if (message) {
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl2 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Icon size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-sm font-medium px-4 py-2 rounded-xl2 transition-colors ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-2.5 pt-1">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl2 px-3 py-2">{error}</p>}
          <p className="text-xs text-slate-500">{t("Confirmez avec votre mot de passe pour continuer.")}</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Mot de passe")}
            className={inputClasses}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword('');
                setError('');
              }}
              className="text-sm text-slate-500 px-3 py-2"
            >{t("Annuler")}</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function DangerZoneSettings() {
  const router = useRouter();
  const { logout } = useAuth();

  async function post(url, password) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, message: t("Impossible de contacter le serveur") };
    }
  }

  async function handleDeactivate(password) {
    const data = await post('/api/users/me/account/deactivate', password);
    if (!data.success) return data.message || t("Une erreur est survenue");
    router.push('/login');
    return null;
  }

  async function handleDelete(password) {
    const data = await post('/api/users/me/account/delete', password);
    if (!data.success) return data.message || t("Une erreur est survenue");
    router.push('/login');
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display font-semibold text-red-600 tracking-tight flex items-center gap-2">
        <AlertTriangle size={16} />{' '}{t("Zone sensible")}</h3>

      <ActionCard
        icon={PauseCircle}
        title={t("Desactiver mon compte")}
        description={t("Votre profil et votre contenu ne seront plus visibles par les autres. Reconnectez-vous a tout moment avec votre mot de passe pour tout retrouver.")}
        buttonLabel={t("Desactiver mon compte")}
        buttonClass="bg-amber-50 text-amber-700 hover:bg-amber-100"
        confirmLabel={t("Confirmer la desactivation")}
        onConfirm={handleDeactivate}
      />

      <ActionCard
        icon={Trash2}
        title={t("Supprimer mon compte")}
        description={t("Action definitive et irreversible : publications, messages, amities et serveurs dont vous etes proprietaire seront supprimes.")}
        buttonLabel={t("Supprimer mon compte")}
        buttonClass="bg-red-50 text-red-700 hover:bg-red-100"
        confirmLabel={t("Supprimer definitivement")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
