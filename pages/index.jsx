import { useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Sparkles, Clock } from 'lucide-react';
import Segmented from '@/components/shared/segmented';
import RightRail from '@/components/layout/rightRail';
import Logomark from '@/components/shared/logomark';
import { useAuth } from '@/lib/authContext';
import AppLayout from '@/components/layout/appLayout';
import PostList from '@/components/posts/postList';
import StoriesBar from '@/components/stories/storiesBar';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function HomePage() {
  const { isLoading } = useAuth();
  const [sort, setSort] = useState('smart');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <Logomark size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Accueil"))}</title>
      </Head>
      <AppLayout>
        <div className="flex items-start justify-center gap-6">
          <div className="w-full max-w-2xl min-w-0">
            <StoriesBar />

            <div className="flex items-center justify-between gap-3 mb-4">
              <Segmented
                value={sort}
                onChange={setSort}
                items={[
                  { key: 'smart', icon: Sparkles, label: t("Pour vous") },
                  { key: 'recent', icon: Clock, label: t("Recent") }
                ]}
              />
            </div>

            <PostList
              key={sort}
              endpoint={`/api/feed?sort=${sort}`}
              canCompose
              emptyLabel={t("Aucune publication a afficher. Ajoutez des amis ou publiez quelque chose !")}
            />
          </div>
          <RightRail />
        </div>
      </AppLayout>
    </>
  );
}
