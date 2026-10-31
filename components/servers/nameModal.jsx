import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal, { inputClasses, primaryButton, ghostButton } from '@/components/servers/modal';

import { t } from '@/lib/i18n/runtime';
// Modale a un seul champ texte (creer / renommer une categorie, etc.).
export default function NameModal({ title, label, initialValue = '', submitLabel = t("Enregistrer"), onSubmit, onClose }) {
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    setIsSubmitting(true);
    setError('');
    const message = await onSubmit(value.trim());
    if (message) {
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>{t("Annuler")}</button>
          <button type="submit" form="name-modal-form" disabled={isSubmitting || !value.trim()} className={primaryButton}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="name-modal-form" onSubmit={handleSubmit} className="space-y-2">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
        <label className="text-xs font-medium text-slate-500 block">{label}</label>
        <input autoFocus maxLength={60} value={value} onChange={(e) => setValue(e.target.value)} className={inputClasses} />
      </form>
    </Modal>
  );
}
