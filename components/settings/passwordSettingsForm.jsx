import { useState } from 'react';
import PasswordStrengthMeter from '@/components/auth/passwordStrengthMeter';
import { Loader2, Lock } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function PasswordSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError(t("Les mots de passe ne correspondent pas"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || t("Erreur lors de la mise a jour"));
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(t("Mot de passe mis a jour"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2">
        <Lock size={16} />{' '}{t("Mot de passe")}</h3>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-xl2 px-4 py-3">{success}</div>}

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Mot de passe actuel")}</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Nouveau mot de passe")}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Confirmer")}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
      </div>

      <PasswordStrengthMeter password={newPassword} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 bg-brand-500 hover:shadow-glow disabled:opacity-70 text-white text-sm font-medium px-5 py-2.5 rounded-xl2 transition-all duration-200 active:scale-[0.98]"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}{t("Enregistrer")}</button>
    </form>
  );
}
