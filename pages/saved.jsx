import { useState } from 'react';
import Head from 'next/head';
import { Bookmark } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import SavedPostList from '@/components/posts/savedPostList';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const CATEGORIES = [
  { key: 'all', get label() { return t("Tous"); } },
  { key: 'photos', get label() { return t("Photos"); } },
  { key: 'videos', get label() { return t("Videos"); } },
  { key: 'posts', get label() { return t("Publications"); } }
];

export default function SavedPage() {
  const [category, setCategory] = useState('all');

  return (
    <>
      <Head>
        <title>{pageTitle(t("Publications enregistrees"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={Bookmark} title={t("Publications enregistrees")} />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-6 bg-slate-100 rounded-xl2 p-1 w-fit max-w-full">
            {CATEGORIES.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategory(tab.key)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-all ${
                  category === tab.key
                    ? 'bg-surface text-slate-900 shadow-soft'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <SavedPostList key={category} category={category} />
        </div>
      </AppLayout>
    </>
  );
}
