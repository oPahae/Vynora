import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Lock, Eye, EyeOff, LoaderCircle, KeyRound, ArrowLeft, MailCheck, UserRound } from 'lucide-react';
import FormField from '@/components/auth/formField';
import PasswordStrengthMeter from '@/components/auth/passwordStrengthMeter';

import { t, tRich } from '@/lib/i18n/runtime';
const DEFAULT_RESEND_SECONDS = 60;
const submitClasses =
  'nx-btn-primary w-full h-12 text-[0.95rem]';

// "Trouver mon compte" : recherche par nom ou email -> choix du compte ->
// code recu par email -> nouveau mot de passe. L'email complet n'est jamais
// expose au navigateur (uniquement une version masquee).
export default function FindAccountForm() {
  const router = useRouter();
  const [step, setStep] = useState('search'); // 'search' | 'pick' | 'reset'
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState({});
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function post(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async function handleSearch(event) {
    event.preventDefault();
    setServerError('');
    setIsSubmitting(true);
    try {
      const data = await post('/api/auth/find-account/search', { query: searchTerm });
      if (!data.success) {
        setServerError(data.message || t("Une erreur est survenue"));
        return;
      }
      setAccounts(data.accounts);
      setStep('pick');
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendCode(account) {
    setServerError('');
    setIsSubmitting(true);
    try {
      const data = await post('/api/auth/find-account/send-code', { id: account.id });
      if (!data.success) {
        setServerError(data.message || t("Une erreur est survenue"));
        return false;
      }
      setSelected(account);
      setMaskedEmail(data.maskedEmail);
      setResendIn(data.resendAfterSeconds || DEFAULT_RESEND_SECONDS);
      return true;
    } catch (error) {
      setServerError(t("Impossible de contacter le serveur"));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePick(account) {
    if (await sendCode(account)) setStep('reset');
  }

  async function handleResend() {
    if (resendIn > 0 || isSubmitting || !selected) return;
    await sendCode(selected);
  }

  async function handleReset(event) {
    event.preventDefault();
    setServerError('');
    const nextErrors = {};
    if (!/^\d{6}$/.test(code)) nextErrors.code = t("Le code doit contenir 6 chiffres");
    if (password.length < 8) nextErrors.password = t("Le mot de passe doit contenir au moins 8 caracteres");
    if (password !== confirmPassword) nextErrors.confirmPassword = t("Les mots de passe ne correspondent pas");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const data = await post('/api/auth/find-account/reset', { id: selected.id, code, password });
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

  if (step === 'search') {
    return (
      <form onSubmit={handleSearch} className="space-y-4">
        <p className="text-sm text-slate-500">{t("Saisissez votre nom ou l'adresse email de votre compte pour le retrouver et recuperer l'acces.")}</p>
        {errorBanner}
        <FormField
          icon={Search}
          type="text"
          placeholder={t("Nom ou adresse email")}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setServerError('');
          }}
          required
        />
        <button type="submit" disabled={isSubmitting || searchTerm.trim().length < 2} className={submitClasses}>
          {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Rechercher")}</button>
        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={14} />{t("Retour a la connexion")}</Link>
      </form>
    );
  }

  if (step === 'pick') {
    return (
      <div className="space-y-4">
        {errorBanner}
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl2 px-4 py-5 text-center">{t("Aucun compte ne correspond a \"{searchTerm}\". Verifiez l'orthographe ou essayez avec votre adresse email.", { searchTerm })}</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">{t("Est-ce votre compte ? Un code sera envoye a l'adresse email associee.")}</p>
            <ul className="space-y-2">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePick(account)}
                    className="w-full flex items-center gap-3 text-start border border-slate-200 hover:border-brand-400 hover:bg-brand-50 rounded-xl2 px-4 py-3 transition-colors disabled:opacity-60"
                  >
                    <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <UserRound size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">
                        {account.firstName} {account.lastName}
                      </span>
                      <span className="block text-xs text-slate-500 truncate">{account.maskedEmail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setStep('search');
            setServerError('');
          }}
          className="flex items-center justify-center gap-1.5 w-full text-sm text-slate-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={14} />{t("Modifier ma recherche")}</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div className="flex items-start gap-2.5 bg-brand-50 text-brand-700 text-sm rounded-xl2 px-4 py-3">
        <MailCheck size={18} className="shrink-0 mt-0.5" />
        <p>{tRich("Un code a 6 chiffres a ete envoye a {email}. Il est valable 15 minutes. Pensez a verifier vos courriers indesirables.", { email: <strong className="break-all">{maskedEmail}</strong> })}</p>
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
        {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Recuperer mon compte")}</button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep('pick');
            setServerError('');
            setErrors({});
            setCode('');
          }}
          className="text-slate-500 hover:text-brand-600 transition-colors"
        >{t("Choisir un autre compte")}</button>
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
