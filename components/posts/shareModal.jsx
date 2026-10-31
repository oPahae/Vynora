import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Share2 } from 'lucide-react';
import EmbeddedPostCard from '@/components/posts/embeddedPostCard';
import VisibilityPicker from '@/components/posts/visibilityPicker';

import { t } from '@/lib/i18n/runtime';
export default function ShareModal({ post, onClose, onShared }) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${post.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), visibility, visibilityUserIds: selectedUserIds })
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || t("Erreur lors du partage"));
        return;
      }

      onShared(data.post);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
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
          <h3 className="font-display text-lg font-semibold text-slate-900">{t("Partager la publication")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>
          )}

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t("Ajoutez un commentaire (optionnel)...")}
            rows={3}
            className="w-full resize-none bg-slate-50 rounded-xl2 px-4 py-3 text-sm outline-none transition-all focus:bg-surface focus:ring-4 focus:ring-brand-500/10 placeholder:text-slate-400"
          />

          <EmbeddedPostCard post={post} />

          <VisibilityPicker
            value={visibility}
            onChange={setVisibility}
            selectedUserIds={selectedUserIds}
            onSelectedUserIdsChange={setSelectedUserIds}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}{t("Partager maintenant")}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
