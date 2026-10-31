import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Send, Trash2 } from 'lucide-react';
import VisibilityPicker from '@/components/posts/visibilityPicker';
import MediaPicker from '@/components/posts/mediaPicker';
import MentionTextarea from '@/components/posts/mentionTextarea';
import AiAssistantPanel from '@/components/posts/aiAssistantPanel';
import UploadProgressBar from '@/components/shared/uploadProgressBar';
import { useConfirm } from '@/lib/confirmContext';
import { uploadFormData } from '@/lib/uploadClient';

import { t } from '@/lib/i18n/runtime';
export default function DraftEditorModal({ draft, onClose, onSaved, onDeleted, onPublished }) {
  const confirm = useConfirm();
  const [content, setContent] = useState(draft.content || '');
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [visibility, setVisibility] = useState(draft.visibility || 'public');
  const [selectedUserIds, setSelectedUserIds] = useState(draft.visibilityUserIds || []);
  const [existingMedia, setExistingMedia] = useState(draft.media || []);
  const [removedAnyExisting, setRemovedAnyExisting] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');

  function handleRemoveExisting(mediaId) {
    setExistingMedia((prev) => prev.filter((item) => item.id !== mediaId));
    setRemovedAnyExisting(true);
  }

  const mediaChanged = removedAnyExisting || newFiles.length > 0;

  function buildFormData() {
    const formData = new FormData();
    formData.append('content', content.trim());
    formData.append('visibility', visibility);
    formData.append('visibilityUserIds', JSON.stringify(selectedUserIds));
    if (mediaChanged) {
      formData.append('replaceMedia', 'true');
      newFiles.forEach((item) => formData.append('media', item.file));
    }
    return formData;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!content.trim() && existingMedia.length === 0 && newFiles.length === 0) {
      setError(t("Le brouillon ne peut pas etre totalement vide"));
      return;
    }

    setIsSaving(true);
    setError('');
    setUploadProgress(newFiles.length > 0 ? 0 : null);

    try {
      const { data } = await uploadFormData(`/api/drafts/${draft.id}`, buildFormData(), {
        method: 'PUT',
        onProgress: setUploadProgress
      });

      if (!data.success) {
        setError(data.message || t("Erreur lors de la sauvegarde"));
        return;
      }
      onSaved();
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  }

  async function handlePublish() {
    if (!content.trim() && existingMedia.length === 0 && newFiles.length === 0) {
      setError(t("Le brouillon ne peut pas etre totalement vide"));
      return;
    }

    setIsPublishing(true);
    setError('');
    try {
      // On sauvegarde d'abord les eventuelles modifications non enregistrees,
      // puis on publie le brouillon a jour.
      if (mediaChanged || content !== (draft.content || '') || visibility !== draft.visibility) {
        const { data: saveData } = await uploadFormData(`/api/drafts/${draft.id}`, buildFormData(), {
          method: 'PUT'
        });
        if (!saveData.success) {
          setError(saveData.message || t("Erreur lors de la sauvegarde"));
          return;
        }
      }

      const response = await fetch(`/api/drafts/${draft.id}/publish`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Erreur lors de la publication"));
        return;
      }
      onPublished(data.post);
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t("Supprimer ce brouillon ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await fetch(`/api/drafts/${draft.id}`, { method: 'DELETE' });
      onDeleted(draft.id);
    } finally {
      setIsDeleting(false);
    }
  }

  const isBusy = isSaving || isPublishing || isDeleting;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-surface">
          <h3 className="font-display text-lg font-semibold text-slate-900">{t("Modifier le brouillon")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>
          )}

          <MentionTextarea
            value={content}
            onChange={setContent}
            mentionedUsers={mentionedUsers}
            onMentionedUsersChange={setMentionedUsers}
            rows={4}
          />

          <MediaPicker
            existingMedia={existingMedia}
            onRemoveExisting={handleRemoveExisting}
            newFiles={newFiles}
            onNewFilesChange={setNewFiles}
          />
          {(isSaving || isPublishing) && uploadProgress !== null && (
            <UploadProgressBar progress={uploadProgress} label={t("Envoi du media...")} />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <VisibilityPicker
              value={visibility}
              onChange={setVisibility}
              selectedUserIds={selectedUserIds}
              onSelectedUserIdsChange={setSelectedUserIds}
            />
            <AiAssistantPanel text={content} onApply={setContent} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 text-ember-600 hover:bg-ember-50 disabled:opacity-60 rounded-xl2 px-4 py-3 text-sm font-medium transition-colors"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="nx-btn-secondary flex-1 h-11"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}{t("Enregistrer le brouillon")}</button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-500 hover:shadow-glow disabled:opacity-70 text-white font-medium rounded-xl2 py-3 text-sm transition-all duration-200"
            >
              {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}{t("Publier")}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
