import { useState } from 'react';
import { Flag, Loader2, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { td, t } from '@/lib/i18n/runtime';

const REASONS = [
  { key: 'spam', label: () => t("Spam ou publicite indesirable") },
  { key: 'harassment', label: () => t("Harcelement ou intimidation") },
  { key: 'hate', label: () => t("Discours haineux ou discrimination") },
  { key: 'violence', label: () => t("Violence ou contenu dangereux") },
  { key: 'nudity', label: () => t("Nudite ou contenu sexuel") },
  { key: 'misinformation', label: () => t("Fausses informations") },
  { key: 'scam', label: () => t("Arnaque ou fraude") },
  { key: 'impersonation', label: () => t("Usurpation d'identite") },
  { key: 'other', label: () => t("Autre") }
];

const TARGET_TITLES = {
  user: () => t("Signaler ce compte"),
  post: () => t("Signaler cette publication"),
  comment: () => t("Signaler ce commentaire"),
  reel: () => t("Signaler ce reel"),
  reelComment: () => t("Signaler ce commentaire"),
  group: () => t("Signaler ce groupe")
};

// targetType : user | post | comment | reel | reelComment | group
export default function ReportModal({ targetType, targetId, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason) {
      setError(t("Choisissez un motif"));
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details })
      });
      const data = await response.json();
      if (data.success) setDone(true);
      else setError(td(data.message) || t("Une erreur est survenue"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={(TARGET_TITLES[targetType] || TARGET_TITLES.post)()}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        done ? (
          <button onClick={onClose} className="nx-btn-primary w-full h-11">{t("Fermer")}</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="nx-btn-secondary flex-1 h-11">{t("Annuler")}</button>
            <button onClick={submit} disabled={isSubmitting} className="nx-btn-primary flex-1 h-11">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
              {t("Envoyer le signalement")}
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="text-center py-6">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500 mb-3" />
          <p className="font-semibold text-slate-900">{t("Merci pour votre signalement")}</p>
          <p className="text-sm text-slate-500 mt-1">{t("Notre equipe de moderation va examiner ce contenu.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t("Pourquoi signalez-vous ce contenu ? Votre signalement est anonyme.")}</p>
          <div className="space-y-1.5" role="radiogroup">
            {REASONS.map((item) => (
              <label
                key={item.key}
                className={`flex items-center gap-3 px-3.5 h-11 rounded-xl2 border cursor-pointer text-sm transition-colors ${
                  reason === item.key ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input type="radio" name="reason" className="accent-[rgb(var(--spot))]" checked={reason === item.key} onChange={() => { setReason(item.key); setError(''); }} />
                {item.label()}
              </label>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            placeholder={t("Details supplementaires (optionnel)")}
            rows={3}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
