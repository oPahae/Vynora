import Head from 'next/head';
import AppLayout from '@/components/layout/appLayout';
import ReelFeed from '@/components/reels/reelFeed';
import { pageTitle } from '@/lib/constants';
import { t } from '@/lib/i18n/runtime';

export default function ReelsPage() {
  return (
    <>
      <Head>
        <title>{pageTitle(t("Reels"))}</title>
      </Head>
      <AppLayout noMobileChrome>
        <ReelFeed />
      </AppLayout>
    </>
  );
}
