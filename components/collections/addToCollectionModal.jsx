import { useEffect, useState } from 'react';
import { Folder, ListVideo, Plus, Check, Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import CollectionFormModal from '@/components/collections/collectionFormModal';
import { colorGradient } from '@/components/collections/collectionMeta';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/lib/toastContext';
import { t, td } from '@/lib/i18n/runtime';

// Choisir dans quelles collections (dossiers / playlists) ranger un post ou un reel.
export default function AddToCollectionModal({ itemType, itemId, onClose }) {
  const { showToast } = useToast();
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/collections?itemType=${itemType}&itemId=${itemId}`);
      const data = await response.json();
      setCollections(data.success ? data.collections : []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemType, itemId]);

  async function toggle(collection) {
    setBusyId(collection.id);
    try {
      const response = await fetch(`/api/collections/${collection.id}/items`, {
        method: collection.hasItem ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemId })
      });
      const data = await response.json();
      if (data.success) {
        setCollections((prev) => prev.map((item) => (item.id === collection.id ? { ...item, hasItem: !collection.hasItem } : item)));
      } else {
        showToast({ title: td(data.message) || t("Une erreur est survenue"), type: 'error', playSound: false });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Modal
        title={t("Ajouter a une collection")}
        onClose={onClose}
        maxWidth="max-w-md"
        footer={
          <button onClick={() => setIsCreating(true)} className="nx-btn-secondary w-full h-11">
            <Plus size={16} />
            {t("Nouvelle collection")}
          </button>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-400" /></div>
        ) : collections.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">{t("Vous n'avez pas encore de collection. Creez-en une pour ranger ce contenu.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {collections.map((collection) => {
              const Icon = collection.kind === 'folder' ? Folder : ListVideo;
              return (
                <li key={collection.id}>
                  <button
                    onClick={() => toggle(collection)}
                    disabled={busyId === collection.id}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl2 hover:bg-slate-50 transition-colors text-start"
                  >
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: colorGradient(collection.color) }}>
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{collection.name}</span>
                      {collection.parentId && <span className="block text-xs text-slate-400 truncate">{collection.path}</span>}
                    </span>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${collection.hasItem ? 'bg-brand-500 border-brand-500' : 'border-slate-300'}`}>
                      {busyId === collection.id ? <Loader2 size={12} className="animate-spin text-slate-400" /> : collection.hasItem && <Check size={13} className="text-white" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <AnimatePresence>
        {isCreating && (
          <CollectionFormModal
            onClose={() => setIsCreating(false)}
            onSaved={async (data) => {
              setIsCreating(false);
              // ajoute directement l'element dans la collection creee
              await fetch(`/api/collections/${data.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemType, itemId })
              });
              load();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
