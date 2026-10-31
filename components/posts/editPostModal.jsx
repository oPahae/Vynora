import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import VisibilityPicker from '@/components/posts/visibilityPicker';
import MediaPicker from '@/components/posts/mediaPicker';
import MentionTextarea from '@/components/posts/mentionTextarea';
import AiAssistantPanel from '@/components/posts/aiAssistantPanel';
import LocationInput from '@/components/posts/locationInput';
import UploadProgressBar from '@/components/shared/uploadProgressBar';
import { uploadFormData } from '@/lib/uploadClient';

import { t } from '@/lib/i18n/runtime';
export default function EditPostModal({ post, onClose, onSaved }) {
  const [content, setContent] = useState(post.content || '');
  const [mentionedUsers, setMentionedUsers] = useState(post.mentions || []);
  const [visibility, setVisibility] = useState(post.visibility);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [existingMedia, setExistingMedia] = useState(post.media);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [location, setLocation] = useState(post.location || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');

  function handleRemoveExisting(mediaId) {
    setExistingMedia((prev) => prev.filter((item) => item.id !== mediaId));
    setRemovedMediaIds((prev) => [...prev, mediaId]);
  }

  function resolveMentionIds() {
    return mentionedUsers
      .filter((mentioned) => content.includes(`@${mentioned.firstName} ${mentioned.lastName}`))
      .map((mentioned) => mentioned.id);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!content.trim() && existingMedia.length === 0 && newFiles.length === 0) {
      setError(t("La publication ne peut pas etre vide"));
      return;
    }

    setIsSubmitting(true);
    setError('');
    setUploadProgress(newFiles.length > 0 ? 0 : null);

    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('visibility', visibility);
      formData.append('visibilityUserIds', JSON.stringify(selectedUserIds));
      formData.append('removeMediaIds', JSON.stringify(removedMediaIds));
      formData.append('location', location.trim());
      formData.append('mentions', JSON.stringify(resolveMentionIds()));
      newFiles.forEach((item) => formData.append('media', item.file));

      const { data } = await uploadFormData(`/api/posts/${post.id}`, formData, {
        method: 'PUT',
        onProgress: setUploadProgress
      });

      if (!data.success) {
        setError(data.message || t("Erreur lors de la modification"));
        return;
      }

      onSaved(data.post);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

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
          <h3 className="font-display text-lg font-semibold text-slate-900">{t("Modifier la publication")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
          {isSubmitting && uploadProgress !== null && (
            <UploadProgressBar progress={uploadProgress} label={t("Envoi du media...")} />
          )}

          <VisibilityPicker
            value={visibility}
            onChange={setVisibility}
            selectedUserIds={selectedUserIds}
            onSelectedUserIdsChange={setSelectedUserIds}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <AiAssistantPanel text={content} onApply={setContent} />
            <LocationInput value={location} onChange={setLocation} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}{t("Enregistrer les modifications")}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
