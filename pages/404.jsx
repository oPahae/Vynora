import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Compass, ArrowLeft, Home } from 'lucide-react';

import { pageTitle } from '@/lib/constants';
import { t } from '@/lib/i18n/runtime';

// Page 404 : utilisable connecte ou non (sans AppLayout, qui suppose une session).
export default function NotFoundPage() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Page introuvable"))}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-5 py-10 pt-safe pb-safe">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Compass size={38} />
          </div>
          <p className="font-display text-7xl font-bold tracking-tight text-brand-600">404</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-slate-900">{t("Page introuvable")}</h1>
          <p className="mt-2 text-slate-500">{t("Cette page n'existe pas ou a ete deplacee.")}</p>

          <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={goBack} className="nx-btn-secondary w-full sm:w-auto">
              <ArrowLeft size={16} className="rtl:rotate-180" />
              {t("Page precedente")}
            </button>
            <Link href="/" className="nx-btn-primary w-full sm:w-auto">
              <Home size={16} />
              {t("Retour a l'accueil")}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
