import { useRouter } from 'next/router';
import Head from 'next/head';
import AppLayout from '@/components/layout/appLayout';
import ServerView from '@/components/servers/serverView';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function ServerPage() {
  const router = useRouter();
  const guildId = Number(router.query.id);

  return (
    <>
      <Head>
        <title>{pageTitle(t("Serveur"))}</title>
      </Head>
      {/* Plein ecran sur mobile (sans barre du haut/bas) ; conteneur large
          arrondi sur ordinateur. */}
      <AppLayout noMobileChrome wide>
        <div className="h-full md:h-[calc(100vh-8rem)] md:rounded-xl3 md:shadow-soft md:border border-slate-100 overflow-hidden bg-surface">
          {router.isReady && Number.isInteger(guildId) && <ServerView guildId={guildId} />}
        </div>
      </AppLayout>
    </>
  );
}
