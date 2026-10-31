import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Mail, Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthLayout from '@/components/auth/authLayout';
import FormField from '@/components/auth/formField';
import { pageTitle } from '@/lib/constants';
import { t, td } from '@/lib/i18n/runtime';

// Demande de revision d'un bannissement (page publique : le compte banni ne
// peut pas se connecter, il s'identifie avec son email et son mot de passe).
export default function AppealPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', message: '' });
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const email = emailTouched ? form.email : form.email || (router.query.email ? String(router.query.email) : '');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email })
      });
      const data = await response.json();
      if (data.success) setDone(true);
      else setError(td(data.message) || t("Une erreur est survenue"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Demande de revision"))}</title>
      </Head>
      <AuthLayout title={t("Demande de revision")} subtitle={t("Votre compte est suspendu ? Expliquez votre situation, un administrateur examinera votre demande.")}>
        {done ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 size={46} className="mx-auto text-emerald-500" />
            <p className="font-semibold text-slate-900">{t("Demande envoyee")}</p>
            <p className="text-sm text-slate-500">{t("Un administrateur va examiner votre demande. Vous recevrez la decision par email.")}</p>
            <Link href="/login" className="nx-btn-primary inline-flex mt-2">{t("Retour a la connexion")}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3" role="alert">{error}</div>}
            <FormField
              icon={Mail}
              type="email"
              placeholder={t("Adresse email")}
              value={email}
              onChange={(event) => { setEmailTouched(true); setForm({ ...form, email: event.target.value }); }}
              required
            />
            <FormField
              icon={Lock}
              type="password"
              placeholder={t("Mot de passe")}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
              required
            />
            <div>
              <textarea
                value={form.message}
                maxLength={1000}
                rows={6}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder={t("Pourquoi la suspension de votre compte devrait-elle etre levee ?")}
                required
                className="w-full rounded-xl2 border border-slate-200 bg-surface px-4 py-3 text-[0.95rem] outline-none focus:border-brand-500 focus:shadow-ring resize-none"
              />
              <p className="text-xs text-slate-400 text-end mt-1">{form.message.length}/1000</p>
            </div>
            <button type="submit" disabled={busy || form.message.trim().length < 20} className="nx-btn-primary w-full h-12">
              {busy && <Loader2 size={16} className="animate-spin" />} {t("Envoyer ma demande")}
            </button>
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft size={14} className="rtl:rotate-180" /> {t("Retour a la connexion")}
            </Link>
          </form>
        )}
      </AuthLayout>
    </>
  );
}
