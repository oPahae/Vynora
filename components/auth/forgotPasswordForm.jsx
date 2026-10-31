import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, LoaderCircle, KeyRound, ArrowLeft, MailCheck } from 'lucide-react';
import FormField from '@/components/auth/formField';
import PasswordStrengthMeter from '@/components/auth/passwordStrengthMeter';

import { t } from '@/lib/i18n/runtime';
const DEFAULT_RESEND_SECONDS = 60;

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [info, setInfo] = useState('');
  const [errors, setErrors] = useState({});
  const [resendIn, setResendIn] = useState(0);

  // Pre-remplit l'email depuis /forgot-password?email=... (lien du login).
  useEffect(() => {
    if (router.isReady && typeof router.query.email === 'string') {
      setEmail(router.query.email);
    }
  }, [router.isReady, router.query.email]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function requestCode() {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return response.json();
  }

  async function handleSendCode(event) {
    event.preventDefault();
    setServerError('');
    setErrors({});
    setIsSubmitting(true);

    try {
      const data = await requestCode();
      if (!data.success) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }
      setInfo(data.message);
      setResendIn(data.resendAfterSeconds || DEFAULT_RESEND_SECONDS);
      setStep('reset');
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || isSubmitting) return;
    setServerError('');
    setIsSubmitting(true);
    try {
      const data = await requestCode();
      if (!data.success) {
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }
      setInfo(t("Un nouveau code vient d'etre envoye si le compte existe."));
      setResendIn(data.resendAfterSeconds || DEFAULT_RESEND_SECONDS);
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setServerError('');

    const nextErrors = {};
    if (!/^\d{6}$/.test(code.trim())) nextErrors.code = t("Le code doit contenir 6 chiffres");
    if (password.length < 8) nextErrors.password = t("Le mot de passe doit contenir au moins 8 caracteres");
    if (password !== confirmPassword) nextErrors.confirmPassword = t("Les mots de passe ne correspondent pas");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim(), password })
      });
      const data = await response.json();

      if (!data.success) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }

      router.push('/login?reset=1');
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorBanner = serverError && (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3"
    >
      {serverError}
    </motion.div>
  );

  const submitClasses =
    'nx-btn-primary w-full h-12 text-[0.95rem]';

  if (step === 'email') {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        <p className="text-sm text-slate-500">{t("Saisissez l'adresse email de votre compte. Nous vous enverrons un code a 6 chiffres pour choisir un nouveau mot de passe.")}</p>
        {errorBanner}

        <FormField
          icon={Mail}
          type="email"
          placeholder={t("Adresse email")}
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors({});
          }}
          autoComplete="email"
          required
        />

        <button type="submit" disabled={isSubmitting} className={submitClasses}>
          {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Envoyer le code")}</button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={14} />{t("Retour a la connexion")}</Link>
      </form>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div className="flex items-start gap-2.5 bg-brand-50 text-brand-700 text-sm rounded-xl2 px-4 py-3">
        <MailCheck size={18} className="shrink-0 mt-0.5" />
        <p>{t("{info} Le code est valable 15 minutes. Pensez a verifier vos courriers indesirables.", { info })}</p>
      </div>
      {errorBanner}

      <FormField
        icon={KeyRound}
        type="text"
        inputMode="numeric"
        placeholder={t("Code a 6 chiffres")}
        value={code}
        error={errors.code}
        maxLength={6}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
          setErrors((prev) => ({ ...prev, code: undefined }));
        }}
        autoComplete="one-time-code"
        required
      />

      <div className="relative">
        <FormField
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          placeholder={t("Nouveau mot de passe")}
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          autoComplete="new-password"
          required
        />
        <PasswordStrengthMeter password={password} className="mt-2" />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute end-4 top-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <FormField
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        placeholder={t("Confirmer le mot de passe")}
        value={confirmPassword}
        error={errors.confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
        }}
        autoComplete="new-password"
        required
      />

      <button type="submit" disabled={isSubmitting} className={submitClasses}>
        {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Reinitialiser le mot de passe")}</button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setServerError('');
            setErrors({});
            setCode('');
          }}
          className="text-slate-500 hover:text-brand-600 transition-colors"
        >{t("Changer d'email")}</button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || isSubmitting}
          className="text-brand-600 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          {resendIn > 0 ? t("Renvoyer le code ({resendIn}s)", { resendIn }) : t("Renvoyer le code")}
        </button>
      </div>
    </form>
  );
}
