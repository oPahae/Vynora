import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ExternalLink, Trash2 } from 'lucide-react';
import { SearchBox, useDebounced, PersonCell, LoadMore, Spinner } from '@/components/admin/adminCommon';
import EmptyState from '@/components/shared/emptyState';
import { AnimatePresence } from 'framer-motion';
import { AdminDeleteModal } from '@/components/admin/reasonModal';
import { useToast } from '@/lib/toastContext';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

const DELETE_LABELS = {
  posts: () => t("Supprimer cette publication ?"),
  comments: () => t("Supprimer ce commentaire ?"),
  reels: () => t("Supprimer ce reel ?"),
  reelComments: () => t("Supprimer ce commentaire de reel ?"),
  groups: () => t("Supprimer ce groupe et toutes ses publications ?"),
  servers: () => t("Supprimer ce serveur, ses salons et ses messages ?")
};

// type API (pluriel de l'onglet) -> type attendu par la route de suppression
const DELETE_TYPE = { posts: 'post', comments: 'comment', reels: 'reel', reelComments: 'reelComment', groups: 'group', servers: 'server' };

// Liste generique (publications, commentaires, reels, groupes, serveurs) avec
// recherche, pagination et suppression.
export default function ContentTab({ type }) {
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (offset = 0) => {
    const response = await fetch(`/api/admin/content/${type}?q=${encodeURIComponent(debounced)}&offset=${offset}&limit=20`);
    return response.json();
  }, [type, debounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(0).then((data) => {
      if (cancelled) return;
      setItems(data.success ? data.items : []);
      setHasMore(Boolean(data.hasMore));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await load(items.length);
    if (data.success) {
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(Boolean(data.hasMore));
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="mb-4"><SearchBox value={q} onChange={setQ} /></div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState tone="neutral" title={t("Aucun resultat")} />
      ) : (
        <div className="nx-card !p-0 divide-y divide-slate-100 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3.5">
              {item.videoUrl && (
                <video src={`${item.videoUrl}#t=0.4`} muted playsInline preload="metadata" className="w-12 aspect-[9/16] rounded-lg object-cover bg-black shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <PersonCell person={item.author} subtitle={`#${item.id} · ${formatRelativeTime(item.createdAt)}`} />
                {item.title && <p className="text-sm font-semibold text-slate-800 mt-2 truncate">{item.title}</p>}
                {item.text && <p className="text-sm text-slate-600 mt-1.5 line-clamp-3 break-words">{item.text}</p>}
                <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap gap-x-3">
                  {item.mediaCount > 0 && <span>{t("{count} media", { count: item.mediaCount })}</span>}
                  {item.visibility && <span>{item.visibility}</span>}
                  {item.members !== undefined && <span>{t("{count} membre(s)", { count: item.members })}</span>}
                  {item.views !== undefined && <span>{t("{count} vue(s)", { count: item.views })}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.href && (
                  <Link href={item.href} target="_blank" className="nx-icon-btn w-9 h-9 text-slate-400" title={t("Ouvrir")}><ExternalLink size={16} /></Link>
                )}
                <button onClick={() => setDeleteTarget(item)} className="nx-icon-btn w-9 h-9 text-red-500 hover:bg-red-50" title={t("Supprimer")}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

      <AnimatePresence>
        {deleteTarget && (
          <AdminDeleteModal
            type={DELETE_TYPE[type]}
            id={deleteTarget.id}
            title={DELETE_LABELS[type]()}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => {
              setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
              setDeleteTarget(null);
              showToast({ title: t("Supprime"), type: 'success', playSound: false });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
