import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, LoaderCircle, Cake, KeyRound, MailCheck } from 'lucide-react';
import FormField from '@/components/auth/formField';
import PasswordStrengthMeter from '@/components/auth/passwordStrengthMeter';
import { useAuth } from '@/lib/authContext';

import { t, tRich } from '@/lib/i18n/runtime';
export default function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('form'); // 'form' | 'code'
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    gender: '',
    birthDate: ''
  });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Etape 1 : envoie le formulaire, le serveur envoie un code par email.
  // Le compte n'est cree qu'apres saisie du bon code (etape 2).
  async function requestCode() {
    const response = await fetch('/api/auth/register/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    return response.json();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');
    setIsSubmitting(true);

    try {
      const data = await requestCode();
      if (!data.success) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }
      setResendIn(data.resendAfterSeconds || 60);
      setStep('code');
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
        if (data.resendAfterSeconds) setResendIn(data.resendAfterSeconds);
        return;
      }
      setResendIn(data.resendAfterSeconds || 60);
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Etape 2 : verifie le code et cree le compte.
  async function handleConfirm(event) {
    event.preventDefault();
    setServerError('');
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: t("Le code doit contenir 6 chiffres") });
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code })
      });
      const data = await response.json();

      if (!data.success) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }

      login(data.user);
      router.push('/');
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="flex items-start gap-2.5 bg-brand-50 text-brand-700 text-sm rounded-xl2 px-4 py-3">
          <MailCheck size={18} className="shrink-0 mt-0.5" />
          <p>{tRich("Nous avons envoye un code a 6 chiffres a {email}. Saisissez-le pour verifier votre adresse et creer votre compte. Il est valable 15 minutes.", { email: <strong className="break-all">{form.email}</strong> })}</p>
        </div>

        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3"
          >
            {serverError}
          </motion.div>
        )}

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
            setErrors({});
          }}
          autoComplete="one-time-code"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="nx-btn-primary w-full h-12 text-[0.95rem]"
        >
          {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Verifier et creer mon compte")}</button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setCode('');
              setServerError('');
              setErrors({});
            }}
            className="text-slate-500 hover:text-brand-600 transition-colors"
          >{t("Modifier mes informations")}</button>
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3"
        >
          {serverError}
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField
          icon={User}
          type="text"
          placeholder={t("Prenom")}
          value={form.firstName}
          error={errors.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          autoComplete="given-name"
        />
        <FormField
          icon={User}
          type="text"
          placeholder={t("Nom")}
          value={form.lastName}
          error={errors.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          autoComplete="family-name"
        />
      </div>

      <FormField
        icon={Mail}
        type="email"
        placeholder={t("Adresse email")}
        value={form.email}
        error={errors.email}
        onChange={(e) => handleChange('email', e.target.value)}
        autoComplete="email"
      />

      <div className="relative">
        <FormField
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          placeholder={t("Mot de passe")}
          value={form.password}
          error={errors.password}
          onChange={(e) => handleChange('password', e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute end-4 top-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <PasswordStrengthMeter password={form.password} className="-mt-1" />

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1.5 block">{t("Sexe")}</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'male', label: t("Homme") },
            { value: 'female', label: t("Femme") }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('gender', option.value)}
              className={`flex items-center justify-center gap-2 rounded-xl2 border px-4 py-2.5 text-sm font-medium transition-all ${
                form.gender === option.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-surface text-slate-500 hover:border-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.gender && <p className="text-xs text-red-500 mt-1.5">{errors.gender}</p>}
      </div>

      <FormField
        icon={Cake}
        type="date"
        placeholder={t("Date de naissance (optionnel)")}
        value={form.birthDate}
        error={errors.birthDate}
        onChange={(e) => handleChange('birthDate', e.target.value)}
        autoComplete="bday"
        max={new Date().toISOString().slice(0, 10)}
      />
      <p className="text-xs text-slate-400 -mt-2">{t("La date de naissance est optionnelle.")}</p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="nx-btn-primary w-full h-12 text-[0.95rem]"
      >
        {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Continuer")}</button>

      <p className="text-center text-sm text-slate-500">{t("Deja inscrit ?")}{' '}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">{t("Se connecter")}</Link>
      </p>
    </form>
  );
}
