import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Send, Save } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import VisibilityPicker from '@/components/posts/visibilityPicker';
import MediaPicker from '@/components/posts/mediaPicker';
import MentionTextarea from '@/components/posts/mentionTextarea';
import AiAssistantPanel from '@/components/posts/aiAssistantPanel';
import LocationInput from '@/components/posts/locationInput';
import UploadProgressBar from '@/components/shared/uploadProgressBar';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { uploadFormData } from '@/lib/uploadClient';

import { t } from '@/lib/i18n/runtime';
export default function PostComposer({ onPostCreated, groupId }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');

  function resetForm() {
    setContent('');
    setMentionedUsers([]);
    setVisibility('public');
    setSelectedUserIds([]);
    setNewFiles([]);
    setLocation('');
  }

  function resolveMentionIds() {
    return mentionedUsers
      .filter((mentioned) => content.includes(`@${mentioned.firstName} ${mentioned.lastName}`))
      .map((mentioned) => mentioned.id);
  }

  async function handleSaveDraft() {
    if (!content.trim() && newFiles.length === 0) {
      setError(t("Ecrivez quelque chose ou ajoutez un media avant de sauvegarder"));
      return;
    }

    setIsSavingDraft(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('visibility', visibility);
      formData.append('visibilityUserIds', JSON.stringify(selectedUserIds));
      formData.append('location', location.trim());
      newFiles.forEach((item) => formData.append('media', item.file));

      const { data } = await uploadFormData('/api/drafts', formData);

      if (!data.success) {
        setError(data.message || t("Erreur lors de la sauvegarde du brouillon"));
        return;
      }

      resetForm();
      showToast({ title: t("Brouillon enregistre"), message: t("Retrouvez-le dans \"Mes brouillons\""), type: 'success' });
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!content.trim() && newFiles.length === 0) {
      setError(t("Ecrivez quelque chose ou ajoutez un media"));
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
      formData.append('location', location.trim());
      formData.append('mentions', JSON.stringify(resolveMentionIds()));
      newFiles.forEach((item) => formData.append('media', item.file));

      const { data } = await uploadFormData(groupId ? `/api/groups/${groupId}/posts` : '/api/posts', formData, {
        onProgress: setUploadProgress
      });

      if (!data.success) {
        setError(data.message || t("Erreur lors de la publication"));
        return;
      }

      resetForm();
      onPostCreated(data.post);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  const canSubmit = Boolean(content.trim()) || newFiles.length > 0;

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onSubmit={handleSubmit}
      className="nx-card nx-aurora-focus p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="md" />
        <div className="w-full min-w-0">
          <MentionTextarea
            value={content}
            onChange={setContent}
            mentionedUsers={mentionedUsers}
            onMentionedUsersChange={setMentionedUsers}
            placeholder={t("Exprimez-vous... utilisez # pour un sujet ou @ pour mentionner")}
            rows={2}
            inputClassName="w-full resize-none bg-transparent px-0 py-2 text-base sm:text-[1.05rem] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-xs mt-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 animate-pop-in" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2">
        <MediaPicker existingMedia={[]} onRemoveExisting={() => {}} newFiles={newFiles} onNewFilesChange={setNewFiles} />
        {isSubmitting && uploadProgress !== null && (
          <UploadProgressBar progress={uploadProgress} label={t("Envoi du media...")} />
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 flex-wrap gap-y-3 gap-x-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {!groupId && (
            <VisibilityPicker
              value={visibility}
              onChange={setVisibility}
              selectedUserIds={selectedUserIds}
              onSelectedUserIdsChange={setSelectedUserIds}
            />
          )}
          <AiAssistantPanel text={content} onApply={setContent} />
          <LocationInput value={location} onChange={setLocation} />
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {!groupId && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting || isSavingDraft}
              title={t("Enregistrer comme brouillon")}
              aria-label={t("Enregistrer comme brouillon")}
              className="nx-btn-ghost px-3"
            >
              {isSavingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span className="hidden sm:inline">{t("Brouillon")}</span>
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || isSavingDraft || !canSubmit}
            className="nx-btn-primary px-5"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}{t("Publier")}</button>
        </div>
      </div>
    </motion.form>
  );
}
