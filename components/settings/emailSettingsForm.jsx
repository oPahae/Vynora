import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Mail, MailCheck } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

import { t, tRich } from '@/lib/i18n/runtime';
const inputClasses =
  'w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';
const submitClasses =
  'flex items-center gap-2 bg-brand-500 hover:shadow-glow disabled:opacity-70 text-white text-sm font-medium px-5 py-2.5 rounded-xl2 transition-all duration-200 active:scale-[0.98]';

// Changement d'email en deux etapes : (1) nouvelle adresse + mot de passe,
// un code a 6 chiffres est envoye a la NOUVELLE adresse ; (2) saisie du code
// pour valider. L'email du compte ne change qu'apres cette verification.
export default function EmailSettingsForm() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function requestCode() {
    const response = await fetch('/api/users/me/email-change/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  async function handleRequest(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const data = await requestCode();
      if (!data.success) {
        setError(data.message || t("Erreur lors de la demande"));
        return;
      }
      setResendIn(data.resendAfterSeconds || 60);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const data = await requestCode();
      if (!data.success) {
        setError(data.message || t("Erreur lors de la demande"));
        if (data.resendAfterSeconds) setResendIn(data.resendAfterSeconds);
        return;
      }
      setResendIn(data.resendAfterSeconds || 60);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError(t("Le code doit contenir 6 chiffres"));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users/me/email-change/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Code invalide"));
        return;
      }
      updateUser({ email: data.email });
      setPassword('');
      setCode('');
      setStep('email');
      setSuccess(t("Adresse email verifiee et mise a jour"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const banners = (
    <>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-xl2 px-4 py-3">{success}</div>
      )}
    </>
  );

  if (step === 'code') {
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <MailCheck size={16} />{' '}{t("Verifier la nouvelle adresse")}</h3>
        <p className="text-sm text-slate-500">{tRich("Un code a 6 chiffres a ete envoye a {email}. Saisissez-le pour confirmer le changement (valable 15 minutes).", { email: <strong className="break-all text-slate-700">{email}</strong> })}</p>
        {banners}
        <div className="relative">
          <KeyRound size={16} className="absolute start-3.5 top-3 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t("Code a 6 chiffres")}
            className={`${inputClasses} ps-10 tracking-widest`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" disabled={isSubmitting} className={submitClasses}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}{t("Confirmer")}</button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0 || isSubmitting}
            className="text-sm text-brand-600 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
          >
            {resendIn > 0 ? t("Renvoyer le code ({resendIn}s)", { resendIn }) : t("Renvoyer le code")}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError('');
            }}
            className="text-sm text-slate-500 hover:text-brand-600"
          >{t("Annuler")}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequest} className="space-y-4">
      <h3 className="font-display font-semibold text-slate-900 tracking-tight flex items-center gap-2">
        <Mail size={16} />{' '}{t("Adresse email")}</h3>
      {banners}

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Nouvelle adresse email")}</label>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClasses} />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Mot de passe actuel")}</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("Confirmez avec votre mot de passe")}
          className={inputClasses}
        />
      </div>

      <p className="text-xs text-slate-400">{t("Un code de verification sera envoye a la nouvelle adresse.")}</p>

      <button type="submit" disabled={isSubmitting} className={submitClasses}>
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}{t("Envoyer le code")}</button>
    </form>
  );
}
