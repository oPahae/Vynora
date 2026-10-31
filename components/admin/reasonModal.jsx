import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { getReasonOptions, resolveReason } from '@/lib/moderationReasons';
import { t, td } from '@/lib/i18n/runtime';

// Demande un motif (liste deroulante + champ libre si "Autre") avant une
// action de moderation. `onConfirm(reason)` renvoie la reponse de l'API
// ({ success, message }) ; en cas d'echec le message s'affiche dans la modale.
export default function ReasonModal({ title, description, confirmLabel, danger = true, children, onConfirm, onClose }) {
  const [key, setKey] = useState('');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = getReasonOptions();

  async function submit() {
    const reason = resolveReason(key, custom);
    if (!key) {
      setError(t("Choisissez un motif"));
      return;
    }
    if (!reason) {
      setError(t("Precisez le motif"));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await onConfirm(reason);
      if (result && result.success === false) setError(td(result.message) || t("Une erreur est survenue"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="nx-btn-secondary flex-1 h-11">{t("Annuler")}</button>
          <button onClick={submit} disabled={busy} className={`${danger ? 'nx-btn-danger' : 'nx-btn-primary'} flex-1 h-11`}>
            {busy && <Loader2 size={16} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {description && <p className="text-sm text-slate-500">{description}</p>}

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Motif (communique a l'utilisateur)")}</label>
          <select
            value={key}
            onChange={(event) => { setKey(event.target.value); setError(''); }}
            className="w-full h-11 rounded-xl2 border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="">{t("Choisir un motif...")}</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>

        {key === 'other' && (
          <textarea
            autoFocus
            value={custom}
            maxLength={180}
            rows={3}
            onChange={(event) => { setCustom(event.target.value); setError(''); }}
            placeholder={t("Saisissez le motif...")}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
          />
        )}

        {children && children({ setError })}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

// Suppression d'un contenu par un administrateur depuis n'importe quel menu :
// passe par l'API d'administration (motif obligatoire + notification de l'auteur).
// type : post | comment | reel | reelComment | group | server | story
export function AdminDeleteModal({ type, id, title, onClose, onDeleted }) {
  async function confirm(reason) {
    const response = await fetch(`/api/admin/content/${type}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await response.json();
    if (data.success) onDeleted();
    return data;
  }

  return (
    <ReasonModal
      title={title}
      description={t("L'auteur sera notifie avec ce motif. Action tracee dans le journal d'audit.")}
      confirmLabel={t("Supprimer")}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
