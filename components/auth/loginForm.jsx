import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, LoaderCircle, CheckCircle2 } from 'lucide-react';
import FormField from '@/components/auth/formField';
import Recaptcha from '@/components/auth/recaptcha';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function LoginForm() {
  const router = useRouter();
  const recaptchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  // Arrivee apres une deconnexion forcee par l'administration.
  const terminated = router.query.terminated;
  const terminatedReason = router.query.reason;
  const terminatedMessage =
    terminated === 'deleted'
      ? terminatedReason
        ? t("Ce compte a ete supprime par l'administration. Motif : {reason}", { reason: terminatedReason })
        : t("Ce compte a ete supprime par l'administration.")
      : terminated === 'banned'
      ? terminatedReason
        ? t("Ce compte a ete suspendu par l'administration. Motif : {reason}", { reason: terminatedReason })
        : t("Ce compte a ete suspendu par l'administration.")
      : '';
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ email: '', password: '' });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function resetCaptcha() {
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');

    if (RECAPTCHA_SITE_KEY && !captchaToken) {
      setErrors((prev) => ({ ...prev, captcha: t("Veuillez cocher la case \"Je ne suis pas un robot\"") }));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captchaToken })
      });
      const data = await response.json();

      if (!data.success) {
        if (data.errors) setErrors(data.errors);
        if (data.deleted || data.banned) {
          // Compte supprime / suspendu par l'administration : on affiche le motif saisi.
          const base = data.deleted
            ? data.reason
              ? t("Ce compte a ete supprime par l'administration. Motif : {reason}", { reason: data.reason })
              : t("Ce compte a ete supprime par l'administration.")
            : data.reason
            ? t("Ce compte a ete suspendu par l'administration. Motif : {reason}", { reason: data.reason })
            : t("Ce compte a ete suspendu par l'administration.");
          setServerError(base);
          setIsBanned(Boolean(data.banned));
        } else {
          setServerError(data.message || t("Une erreur est survenue"));
        }
        // Un jeton reCAPTCHA n'est valable qu'une fois : on le regenere.
        resetCaptcha();
        return;
      }

      login(data.user);
      const nextPath = router.query.next || '/';
      router.push(Array.isArray(nextPath) ? nextPath[0] : nextPath);
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {terminatedMessage && !serverError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3"
          role="alert"
        >
          {terminatedMessage}
          {terminated === 'banned' && (
            <Link href={`/appeal${form.email ? `?email=${encodeURIComponent(form.email)}` : ''}`} className="block mt-2 font-semibold underline">
              {t("Demander une revision de mon compte")}
            </Link>
          )}
        </motion.div>
      )}

      {router.query.reset && !serverError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl2 px-4 py-3"
        >
          <CheckCircle2 size={16} className="shrink-0" />{t("Mot de passe mis a jour. Vous pouvez vous connecter.")}</motion.div>
      )}

      {serverError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3"
        >
          {serverError}
          {isBanned && (
            <Link href={`/appeal?email=${encodeURIComponent(form.email)}`} className="block mt-2 font-semibold underline">
              {t("Demander une revision de mon compte")}
            </Link>
          )}
        </motion.div>
      )}

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
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute end-4 top-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="flex justify-between items-center gap-3 -mt-1">
        <Link href="/find-account" className="text-xs text-brand-600 font-medium hover:underline">{t("Trouver mon compte")}</Link>
        <Link
          href={form.email ? `/forgot-password?email=${encodeURIComponent(form.email)}` : '/forgot-password'}
          className="text-xs text-brand-600 font-medium hover:underline"
        >{t("Mot de passe oublie ?")}</Link>
      </div>

      <Recaptcha
        ref={recaptchaRef}
        siteKey={RECAPTCHA_SITE_KEY}
        onChange={(token) => {
          setCaptchaToken(token);
          if (token) setErrors((prev) => ({ ...prev, captcha: undefined }));
        }}
        error={errors.captcha}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="nx-btn-primary w-full h-12 text-[0.95rem]"
      >
        {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Se connecter")}</button>

      <p className="text-center text-sm text-slate-500">{t("Pas encore de compte ?")}{' '}
        <Link href="/register" className="text-brand-600 font-medium hover:underline">{t("Creer un compte")}</Link>
      </p>
    </form>
  );
}
