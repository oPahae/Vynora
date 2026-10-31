import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Share2 } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PostList from '@/components/posts/postList';
import { getUserFromRequest } from '@/lib/auth';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function PostSharesPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) return null;

  return (
    <>
      <Head>
        <title>{pageTitle(t("Partages"))}</title>
      </Head>
      <AppLayout>
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/post/${id}`}
            className="w-9 h-9 rounded-xl2 bg-surface border border-slate-100 shadow-soft flex items-center justify-center text-slate-500 hover:text-brand-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-10 h-10 rounded-xl2 bg-brand-50 flex items-center justify-center text-brand-600">
            <Share2 size={18} />
          </div>
          <h1 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{t("Publications qui ont partage ce post")}</h1>
        </div>
        <PostList
          endpoint={`/api/posts/${id}/shares`}
          canCompose={false}
          emptyLabel={t("Personne n'a encore partage cette publication.")}
        />
      </AppLayout>
    </>
  );
}

export async function getServerSideProps(context) {
  const payload = await getUserFromRequest(context.req);
  if (!payload) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
