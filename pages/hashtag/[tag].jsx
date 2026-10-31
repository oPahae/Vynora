import Head from 'next/head';
import { useRouter } from 'next/router';
import { Hash } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PostList from '@/components/posts/postList';
import { getUserFromRequest } from '@/lib/auth';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function HashtagPage() {
  const router = useRouter();
  const { tag } = router.query;

  if (!tag) return null;

  return (
    <>
      <Head>
        <title>{pageTitle(`#${tag}`)}</title>
      </Head>
      <AppLayout>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl2 bg-brand-50 flex items-center justify-center text-brand-600">
            <Hash size={18} />
          </div>
          <h1 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{tag}</h1>
        </div>
        <PostList
          endpoint={`/api/hashtags/${tag}/posts`}
          canCompose={false}
          emptyLabel={t("Aucune publication ne contient #{tag} pour le moment.", { tag })}
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
