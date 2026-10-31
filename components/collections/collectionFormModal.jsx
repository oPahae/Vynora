import { useState } from 'react';
import { Folder, ListVideo, Loader2, Check } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { COLLECTION_COLOR_STYLES, colorGradient, COLLECTION_VISIBILITY_META } from '@/components/collections/collectionMeta';
import { t, td } from '@/lib/i18n/runtime';

// Creation / edition d'un dossier ou d'une playlist.
export default function CollectionFormModal({ collection, parentId = null, defaultKind = 'playlist', onClose, onSaved }) {
  const isEdit = Boolean(collection);
  const [kind, setKind] = useState(collection?.kind || defaultKind);
  const [name, setName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [color, setColor] = useState(collection?.color || 'violet');
  const [visibility, setVisibility] = useState(collection?.visibility || 'private');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("Le nom est requis"));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch(isEdit ? `/api/collections/${collection.id}` : '/api/collections', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color, visibility, kind, parentId })
      });
      const data = await response.json();
      if (data.success) onSaved(data);
      else setError(td(data.message) || t("Une erreur est survenue"));
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSaving(false);
    }
  }

  const kinds = [
    { key: 'playlist', icon: ListVideo, title: t("Playlist"), desc: t("Une liste ordonnee de publications et de reels, lisible en continu.") },
    { key: 'folder', icon: Folder, title: t("Dossier"), desc: t("Pour ranger d'autres dossiers, playlists et elements.") }
  ];

  return (
    <Modal title={isEdit ? t("Modifier la collection") : t("Nouvelle collection")} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {!isEdit && (
          <div className="grid grid-cols-2 gap-2.5">
            {kinds.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setKind(item.key)}
                className={`text-start p-3 rounded-xl2 border transition-all ${kind === item.key ? 'border-brand-500 bg-brand-50 shadow-ring' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <item.icon size={20} className={kind === item.key ? 'text-brand-600' : 'text-slate-500'} />
                <p className="font-semibold text-sm text-slate-900 mt-1.5">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Nom")}</label>
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === 'folder' ? t("Ex. Voyages 2026") : t("Ex. Recettes a essayer")}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Description (optionnel)")}</label>
          <textarea
            value={description}
            maxLength={300}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block">{t("Couleur")}</label>
          <div className="flex gap-2.5">
            {Object.keys(COLLECTION_COLOR_STYLES).map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setColor(key)}
                aria-label={key}
                className="w-8 h-8 rounded-full flex items-center justify-center ring-offset-2 ring-offset-[rgb(var(--surface))] transition-transform active:scale-90"
                style={{ background: colorGradient(key), boxShadow: color === key ? '0 0 0 2px rgb(var(--spot))' : undefined }}
              >
                {color === key && <Check size={14} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block">{t("Visibilite")}</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(COLLECTION_VISIBILITY_META).map(([key, meta]) => (
              <button
                type="button"
                key={key}
                onClick={() => setVisibility(key)}
                className={`flex items-center justify-center gap-1.5 h-10 rounded-xl2 border text-sm font-medium transition-colors ${
                  visibility === key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <meta.icon size={14} />
                {meta.label()}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={isSaving} className="nx-btn-primary w-full h-11">
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          {isEdit ? t("Enregistrer") : t("Creer")}
        </button>
      </form>
    </Modal>
  );
}
