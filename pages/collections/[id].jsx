import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import {
  Folder, ListVideo, Pencil, Trash2, Plus, Play, ChevronRight, ChevronUp, ChevronDown, X, Loader2, MoveRight, Clapperboard, FolderPlus, FileWarning
} from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import EmptyState from '@/components/shared/emptyState';
import Avatar from '@/components/shared/avatar';
import Modal from '@/components/shared/modal';
import PostCard from '@/components/posts/postCard';
import CollectionCard from '@/components/collections/collectionCard';
import CollectionFormModal from '@/components/collections/collectionFormModal';
import { colorGradient, COLLECTION_VISIBILITY_META } from '@/components/collections/collectionMeta';
import { useConfirm } from '@/lib/confirmContext';
import { pageTitle } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

function MoveModal({ collection, onClose, onMoved }) {
  const [folders, setFolders] = useState(null);

  useEffect(() => {
    fetch('/api/collections?itemType=post&itemId=0')
      .then((response) => response.json())
      .then((data) => setFolders(data.success ? data.collections.filter((c) => c.kind === 'folder' && c.id !== collection.id) : []));
  }, [collection.id]);

  async function move(parentId) {
    const response = await fetch(`/api/collections/${collection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId })
    });
    const data = await response.json();
    if (data.success) onMoved();
  }

  return (
    <Modal title={t("Deplacer vers...")} onClose={onClose} maxWidth="max-w-sm">
      {folders === null ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-400" /></div>
      ) : (
        <ul className="space-y-1">
          <li>
            <button onClick={() => move(null)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl2 hover:bg-slate-50 text-sm text-start">
              <Folder size={16} className="text-slate-400" /> {t("Racine (Collections)")}
            </button>
          </li>
          {folders.map((folder) => (
            <li key={folder.id}>
              <button onClick={() => move(folder.id)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl2 hover:bg-slate-50 text-sm text-start">
                <Folder size={16} style={{ color: '#7c6cf8' }} /> <span className="truncate">{folder.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ReelRow({ item, collectionId, isOwner, index, total, onMove, onRemove }) {
  const reel = item.reel;
  return (
    <div className="nx-card !p-3 flex items-center gap-3.5">
      <span className="w-6 text-center text-sm text-slate-400 tabular-nums shrink-0">{index + 1}</span>
      {reel ? (
        <Link href={`/reels?collection=${collectionId}&id=${reel.id}`} className="relative w-16 aspect-[9/16] rounded-xl overflow-hidden bg-black shrink-0 group">
          <video src={`${reel.videoUrl}#t=0.4`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity text-white"><Play size={20} fill="currentColor" /></span>
        </Link>
      ) : (
        <div className="w-16 aspect-[9/16] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><FileWarning size={20} /></div>
      )}
      <div className="min-w-0 flex-1">
        {reel ? (
          <>
            <p className="text-sm font-medium text-slate-900 line-clamp-2">{reel.caption || t("Reel sans legende")}</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Clapperboard size={12} /> {reel.author.firstName} {reel.author.lastName} · {formatRelativeTime(reel.createdAt)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{t("Ce reel n'est plus disponible.")}</p>
        )}
      </div>
      {isOwner && (
        <div className="flex flex-col sm:flex-row items-center gap-0.5 shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="nx-icon-btn w-8 h-8 disabled:opacity-30" aria-label={t("Monter")}><ChevronUp size={16} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="nx-icon-btn w-8 h-8 disabled:opacity-30" aria-label={t("Descendre")}><ChevronDown size={16} /></button>
          <button onClick={onRemove} className="nx-icon-btn w-8 h-8 text-slate-400 hover:text-red-500" aria-label={t("Retirer")}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

export default function CollectionDetailPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const id = router.query.id;
  const [state, setState] = useState({ loading: true, data: null, notFound: false });
  const [editOpen, setEditOpen] = useState(false);
  const [newChildKind, setNewChildKind] = useState(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/collections/${id}`);
      const data = await response.json();
      if (data.success) setState({ loading: false, data, notFound: false });
      else setState({ loading: false, data: null, notFound: true });
    } catch (error) {
      setState({ loading: false, data: null, notFound: true });
    }
  }, [id]);

  useEffect(() => {
    setState({ loading: true, data: null, notFound: false });
    load();
  }, [load]);

  if (state.loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><Loader2 size={26} className="animate-spin text-brand-400" /></div>
      </AppLayout>
    );
  }
  if (state.notFound) {
    return (
      <AppLayout>
        <EmptyState icon={FolderPlus} tone="neutral" title={t("Collection introuvable")} action={<Link href="/collections" className="nx-btn-primary">{t("Mes collections")}</Link>} />
      </AppLayout>
    );
  }

  const { collection, owner, isOwner, breadcrumb, children, items } = state.data;
  const Icon = collection.kind === 'folder' ? Folder : ListVideo;
  const visibility = COLLECTION_VISIBILITY_META[collection.visibility];
  const reelItems = items.filter((item) => item.itemType === 'reel' && item.reel);

  async function handleDelete() {
    const ok = await confirm({
      title: t("Supprimer cette collection ?"),
      message: collection.kind === 'folder'
        ? t("Les sous-collections seront aussi supprimees. Vos publications et reels ne sont pas supprimes.")
        : t("Vos publications et reels ne sont pas supprimes."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!ok) return;
    const response = await fetch(`/api/collections/${collection.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) router.push(collection.parentId ? `/collections/${collection.parentId}` : '/collections');
  }

  async function removeItem(item) {
    await fetch(`/api/collections/${collection.id}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.itemType, itemId: item.itemId })
    });
    setState((prev) => ({ ...prev, data: { ...prev.data, items: prev.data.items.filter((i) => i.id !== item.id) } }));
  }

  async function moveItem(index, delta) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setState((prev) => ({ ...prev, data: { ...prev.data, items: next } }));
    await fetch(`/api/collections/${collection.id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((i) => i.id) })
    });
  }

  function updatePost(updated) {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, items: prev.data.items.map((i) => (i.post && i.post.id === updated.id ? { ...i, post: updated } : i)) }
    }));
  }

  return (
    <>
      <Head>
        <title>{pageTitle(collection.name)}</title>
      </Head>
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center flex-wrap gap-1 text-sm text-slate-500 mb-4" aria-label="breadcrumb">
            <Link href={isOwner ? '/collections' : `/collections?user=${collection.userId}`} className="hover:text-brand-600">{t("Collections")}</Link>
            {breadcrumb.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-slate-300 rtl:rotate-180" />
                <Link href={`/collections/${crumb.id}`} className="hover:text-brand-600">{crumb.name}</Link>
              </span>
            ))}
          </nav>

          <div className="relative rounded-3xl overflow-hidden text-white p-6 sm:p-8 mb-6 shadow-card" style={{ background: colorGradient(collection.color) }}>
            <div className="absolute inset-0 bg-black/15" />
            <div className="relative flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0"><Icon size={26} /></span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight break-words">{collection.name}</h1>
                {collection.description && <p className="text-white/85 text-sm mt-1.5 break-words">{collection.description}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/80 mt-3">
                  {owner && (
                    <Link href={`/profile/${owner.id}`} className="flex items-center gap-1.5 hover:text-white">
                      <Avatar src={owner.avatar} firstName={owner.firstName} lastName={owner.lastName} size="xs" />
                      {owner.firstName} {owner.lastName}
                    </Link>
                  )}
                  <span>{t("{count} element(s)", { count: items.length + children.length })}</span>
                  {visibility && <span className="flex items-center gap-1"><visibility.icon size={12} /> {visibility.label()}</span>}
                </div>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-2 mt-5">
              {reelItems.length > 0 && (
                <Link
                  href={`/reels?collection=${collection.id}&id=${reelItems[0].reel.id}`}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl2 bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  <Play size={15} fill="currentColor" /> {t("Lire les reels")}
                </Link>
              )}
              {isOwner && (
                <>
                  <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl2 bg-white/20 hover:bg-white/30 backdrop-blur text-sm font-medium transition-colors"><Pencil size={14} /> {t("Modifier")}</button>
                  <button onClick={() => setMoveOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl2 bg-white/20 hover:bg-white/30 backdrop-blur text-sm font-medium transition-colors"><MoveRight size={14} /> {t("Deplacer")}</button>
                  <button onClick={handleDelete} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl2 bg-black/25 hover:bg-black/40 backdrop-blur text-sm font-medium transition-colors"><Trash2 size={14} /> {t("Supprimer")}</button>
                </>
              )}
            </div>
          </div>

          {collection.kind === 'folder' && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-500">{t("Dans ce dossier")}</h2>
                {isOwner && (
                  <div className="flex gap-2">
                    <button onClick={() => setNewChildKind('folder')} className="nx-btn-secondary !h-8 !px-3 !text-xs"><FolderPlus size={14} /> {t("Dossier")}</button>
                    <button onClick={() => setNewChildKind('playlist')} className="nx-btn-secondary !h-8 !px-3 !text-xs"><Plus size={14} /> {t("Playlist")}</button>
                  </div>
                )}
              </div>
              {children.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {children.map((child) => <CollectionCard key={child.id} collection={child} />)}
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t("Aucune sous-collection.")}</p>
              )}
            </section>
          )}

          <section>
            {(items.length > 0 || collection.kind === 'playlist') && (
              <h2 className="text-sm font-semibold text-slate-500 mb-3">{t("Contenus")}</h2>
            )}
            {items.length === 0 ? (
              collection.kind === 'playlist' || children.length === 0 ? (
                <EmptyState
                  icon={Icon}
                  title={t("Cette collection est vide.")}
                  description={isOwner ? t("Ajoutez des publications et des reels depuis leur menu (« Ajouter a une collection »).") : undefined}
                />
              ) : null
            ) : (
              <div className="space-y-4">
                {items.map((item, index) =>
                  item.itemType === 'reel' ? (
                    <ReelRow
                      key={item.id}
                      item={item}
                      collectionId={collection.id}
                      isOwner={isOwner}
                      index={index}
                      total={items.length}
                      onMove={(delta) => moveItem(index, delta)}
                      onRemove={() => removeItem(item)}
                    />
                  ) : (
                    <div key={item.id} className="relative">
                      {item.post ? (
                        <PostCard
                          post={item.post}
                          onUpdated={updatePost}
                          onDeleted={() => setState((prev) => ({ ...prev, data: { ...prev.data, items: prev.data.items.filter((i) => i.id !== item.id) } }))}
                        />
                      ) : (
                        <div className="nx-card !p-4 flex items-center gap-3 text-sm text-slate-500"><FileWarning size={18} /> {t("Cette publication n'est plus disponible.")}</div>
                      )}
                      {isOwner && (
                        <div className="absolute top-3 -end-2 sm:-end-14 flex sm:flex-col gap-0.5">
                          <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="nx-card !rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-30" aria-label={t("Monter")}><ChevronUp size={15} /></button>
                          <button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="nx-card !rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-30" aria-label={t("Descendre")}><ChevronDown size={15} /></button>
                          <button onClick={() => removeItem(item)} className="nx-card !rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500" aria-label={t("Retirer")}><X size={15} /></button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        <AnimatePresence>
          {editOpen && (
            <CollectionFormModal collection={collection} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {newChildKind && (
            <CollectionFormModal parentId={collection.id} defaultKind={newChildKind} onClose={() => setNewChildKind(null)} onSaved={() => { setNewChildKind(null); load(); }} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {moveOpen && <MoveModal collection={collection} onClose={() => setMoveOpen(false)} onMoved={() => { setMoveOpen(false); load(); }} />}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
