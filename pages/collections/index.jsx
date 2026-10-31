import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { FolderOpen, FolderPlus, ListVideo, Loader2, Plus } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EmptyState from '@/components/shared/emptyState';
import CollectionCard from '@/components/collections/collectionCard';
import CollectionFormModal from '@/components/collections/collectionFormModal';
import { pageTitle } from '@/lib/constants';
import { t } from '@/lib/i18n/runtime';

export default function CollectionsPage() {
  const router = useRouter();
  const ownerParam = router.query.user ? Number(router.query.user) : null;
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formKind, setFormKind] = useState(null);

  const load = useCallback(async () => {
    if (!router.isReady) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/collections${ownerParam ? `?userId=${ownerParam}` : ''}`);
      const data = await response.json();
      setCollections(data.success ? data.collections : []);
    } finally {
      setIsLoading(false);
    }
  }, [router.isReady, ownerParam]);

  useEffect(() => {
    load();
  }, [load]);

  const isMine = !ownerParam;
  const folders = collections.filter((c) => c.kind === 'folder');
  const playlists = collections.filter((c) => c.kind === 'playlist');

  return (
    <>
      <Head>
        <title>{pageTitle(t("Collections"))}</title>
      </Head>
      <AppLayout>
        <PageHeader
          icon={FolderOpen}
          title={t("Collections")}
          subtitle={isMine ? t("Organisez vos publications et reels en dossiers et playlists") : t("Collections partagees")}
          actions={
            isMine && (
              <>
                <button onClick={() => setFormKind('folder')} className="nx-btn-secondary hidden sm:inline-flex"><FolderPlus size={16} /> {t("Dossier")}</button>
                <button onClick={() => setFormKind('playlist')} className="nx-btn-primary"><Plus size={16} /> {t("Playlist")}</button>
              </>
            )
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={isMine ? t("Aucune collection pour le moment.") : t("Aucune collection a afficher.")}
            description={isMine ? t("Creez des dossiers et des playlists pour retrouver facilement ce que vous aimez.") : undefined}
            action={isMine ? <button onClick={() => setFormKind('playlist')} className="nx-btn-primary"><Plus size={16} /> {t("Creer une playlist")}</button> : null}
          />
        ) : (
          <div className="space-y-8">
            {folders.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2"><FolderOpen size={15} /> {t("Dossiers")}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {folders.map((c) => <CollectionCard key={c.id} collection={c} />)}
                </div>
              </section>
            )}
            {playlists.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2"><ListVideo size={15} /> {t("Playlists")}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {playlists.map((c) => <CollectionCard key={c.id} collection={c} />)}
                </div>
              </section>
            )}
          </div>
        )}

        <AnimatePresence>
          {formKind && (
            <CollectionFormModal
              defaultKind={formKind}
              onClose={() => setFormKind(null)}
              onSaved={() => {
                setFormKind(null);
                load();
              }}
            />
          )}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
