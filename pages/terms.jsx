import Head from 'next/head';
import { useRouter } from 'next/router';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import LanguageSwitcher from '@/components/shared/languageSwitcher';
import ThemeToggle from '@/components/shared/themeToggle';
import { APP_NAME, TERMS_UPDATED_AT, pageTitle } from '@/lib/constants';
import { useI18n } from '@/lib/i18n';
import { getIntlLocale, isRtl } from '@/lib/i18n/runtime';
import { getTermsContent } from '@/lib/termsContent';

// Termes et conditions : page publique (voir middleware.js), traduite dans les langues
// de l'application. Le texte vit dans lib/termsContent.js.
export default function TermsPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const content = getTermsContent(locale);
  const fill = (text) => text.replaceAll('{app}', APP_NAME);
  const BackIcon = isRtl(locale) ? ArrowRight : ArrowLeft;

  let updatedLabel = TERMS_UPDATED_AT;
  try {
    updatedLabel = new Intl.DateTimeFormat(getIntlLocale(locale), { dateStyle: 'long' }).format(new Date(`${TERMS_UPDATED_AT}T12:00:00`));
  } catch (error) {
    // on garde la date brute
  }

  // Ouverte dans un nouvel onglet depuis l'inscription : pas d'historique -> retour a l'inscription.
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/register');
  }

  return (
    <>
      <Head>
        <title>{pageTitle(content.title)}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-surface/90 backdrop-blur pt-safe">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors"
            >
              <BackIcon size={16} />
              {content.back}
            </button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 pb-safe">
          <article className="rounded-3xl border border-slate-100 bg-surface p-6 shadow-card sm:p-10">
            <p className="text-sm font-semibold text-brand-600">{APP_NAME}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{content.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {content.updated} : {updatedLabel}
            </p>

            <p className="mt-6 leading-relaxed text-slate-600">{fill(content.intro)}</p>

            {/* Sommaire : liens vers chaque article */}
            <nav className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-5" aria-label={content.title}>
              <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {content.sections.map(([title], index) => (
                  <li key={title}>
                    <a href={`#terms-${index + 1}`} className="text-slate-600 hover:text-brand-600 transition-colors">
                      <span className="text-slate-400">{index + 1}.</span> {title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-8 space-y-8">
              {content.sections.map(([title, text, items], index) => (
                <section key={title} id={`terms-${index + 1}`} className="scroll-mt-20">
                  <h2 className="text-lg font-semibold text-slate-900">
                    <span className="text-brand-600">{index + 1}.</span> {title}
                  </h2>
                  <p className="mt-2 leading-relaxed text-slate-600">{fill(text)}</p>
                  {items && (
                    <ul className="mt-3 list-disc space-y-1.5 ps-5 leading-relaxed text-slate-600 marker:text-brand-400">
                      {items.map((item) => (
                        <li key={item}>{fill(item)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>
        </main>
      </div>
    </>
  );
}
