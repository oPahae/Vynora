import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n/runtime';

// Apres une connexion : propose d'enregistrer la connexion pour se reconnecter
// sans mot de passe depuis l'Account Center.
export default function SaveLoginPrompt({ onDone }) {
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      await fetch('/api/auth/saved-logins', { method: 'POST' });
    } catch (e) {
      // non bloquant : l'utilisateur pourra reessayer a la prochaine connexion
    }
    onDone();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 nx-scrim flex items-center justify-center p-4 z-[90]"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="nx-pop w-full max-w-sm p-6 text-center"
      >
        <span className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
          <KeyRound size={22} />
        </span>
        <h3 className="font-display text-lg font-semibold text-slate-900">{t("Enregistrer la connexion ?")}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {t("La prochaine fois, vous pourrez vous connecter a ce compte sans mot de passe depuis l'Account Center. A utiliser uniquement sur un appareil personnel.")}
        </p>
        <div className="mt-5 space-y-2">
          <button type="button" onClick={save} disabled={isSaving} className="nx-btn-primary w-full h-11">
            {isSaving && <Loader2 size={15} className="animate-spin" />}
            {t("Enregistrer")}
          </button>
          <button type="button" onClick={onDone} disabled={isSaving} className="w-full h-10 text-sm font-medium text-slate-500 hover:text-slate-800">
            {t("Pas maintenant")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
