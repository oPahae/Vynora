import { useEffect } from 'react';
import NextApp from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '@/lib/authContext';
import { SocketProvider } from '@/lib/socketContext';
import { ThemeProvider } from '@/lib/themeContext';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LANG_COOKIE, normalizeLocale } from '@/lib/i18n/config';
import { parseCookieHeader } from '@/lib/i18n/server';
import { ToastProvider } from '@/lib/toastContext';
import { ConfirmProvider } from '@/lib/confirmContext';
import { CallProvider } from '@/lib/callContext';
import ToastContainer from '@/components/shared/toastContainer';
import ConfirmDialogContainer from '@/components/shared/confirmDialogContainer';
import GlobalToastListener from '@/components/shared/globalToastListener';
import CallOverlay from '@/components/calls/callOverlay';
import AmbientBackground from '@/components/shared/ambientBackground';
import CursorLight from '@/components/shared/cursorLight';
import RouteProgress from '@/components/shared/routeProgress';
import { registerServiceWorker } from '@/lib/pushClient';
import '@/styles/globals.css';

// Remonte la page a chaque changement de langue : tout l'arbre de la page est
// ainsi re-rendu dans la nouvelle langue (les providers globaux, eux, restent
// montes, ce qui preserve par exemple un appel en cours).
function PageShell({ Component, pageProps }) {
  const { locale } = useI18n();
  return <Component key={locale} {...pageProps} />;
}

export default function App({ Component, pageProps, initialLocale }) {
  useEffect(() => {
    // Enregistre le Service Worker tot, pour qu'il soit pret a recevoir des
    // notifications push des que l'utilisateur les active dans les
    // parametres. Ne demande aucune permission a lui seul.
    registerServiceWorker();
  }, []);

  return (
    <>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    </Head>
    <AuthProvider>
      <I18nProvider initialLocale={initialLocale}>
        <ThemeProvider>
          <SocketProvider>
            <ToastProvider>
              <ConfirmProvider>
                <CallProvider>
                  <AmbientBackground />
                  <CursorLight />
                  <RouteProgress />
                  <GlobalToastListener />
                  <ToastContainer />
                  <ConfirmDialogContainer />
                  <PageShell Component={Component} pageProps={pageProps} />
                  <CallOverlay />
                </CallProvider>
              </ConfirmProvider>
            </ToastProvider>
          </SocketProvider>
        </ThemeProvider>
      </I18nProvider>
    </AuthProvider>
    </>
  );
}

// Langue lue dans le cookie cote serveur : evite le flash de contenu francais
// et garde le rendu serveur et client identiques (hydratation).
App.getInitialProps = async (appContext) => {
  const appProps = await NextApp.getInitialProps(appContext);
  const req = appContext.ctx.req;
  let initialLocale;
  if (req) {
    const cookies = parseCookieHeader(req.headers.cookie);
    initialLocale = normalizeLocale(cookies[LANG_COOKIE]) || undefined;
  }
  return { ...appProps, initialLocale };
};
