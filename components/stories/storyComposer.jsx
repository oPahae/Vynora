import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Type, ImagePlus, Loader2 } from 'lucide-react';
import { STORY_MAX_VIDEO_DURATION_SECONDS } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const BACKGROUND_COLORS = ['#3D63E8', '#FF6B5B', '#f59e0b', '#10b981', '#7C8CF6', '#0B0E14'];

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return t("{m} min {padStart}s", { m, padStart: s.toString().padStart(2, '0') });
}

export default function StoryComposer({ onClose, onCreated }) {
  const [mode, setMode] = useState('text');
  const [content, setContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleFileSelect(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setError('');

    if (!selected.type.startsWith('video')) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setMode('image');
      return;
    }

    // Les stories sont limitees a 5 minutes de video : on verifie la duree
    // du fichier avant de l'accepter, en le chargeant dans un <video> hors DOM.
    const url = URL.createObjectURL(selected);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (probe.duration > STORY_MAX_VIDEO_DURATION_SECONDS) {
        setError(
          t("Cette video dure {formatDuration}. Les stories sont limitees a {formatDuration2}.", { formatDuration: formatDuration(probe.duration), formatDuration2: formatDuration(
            STORY_MAX_VIDEO_DURATION_SECONDS
          ) })
        );
        URL.revokeObjectURL(url);
        return;
      }
      setFile(selected);
      setPreviewUrl(url);
      setMode('video');
    };
    probe.onerror = () => {
      setError(t("Impossible de lire cette video"));
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  }

  async function handleSubmit() {
    if (mode === 'text' && !content.trim()) {
      setError(t("Ecrivez quelque chose pour votre story"));
      return;
    }
    if (mode !== 'text' && !file) {
      setError(t("Choisissez une photo ou une video"));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('type', mode);
      formData.append('content', content.trim());
      formData.append('backgroundColor', backgroundColor);
      if (file) formData.append('media', file);

      const response = await fetch('/api/stories', { method: 'POST', body: formData });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || t("Erreur lors de la creation"));
        return;
      }

      onCreated(data.story);
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
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display font-semibold text-slate-900">{t("Creer une story")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('text');
                setFile(null);
                setPreviewUrl(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl2 transition-colors ${
                mode === 'text' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Type size={14} />{' '}{t("Texte")}</button>
            <label
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl2 cursor-pointer transition-colors ${
                mode !== 'text' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <ImagePlus size={14} />{' '}{t("Photo / Video")}<input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>

          {mode === 'text' ? (
            <div
              className="w-full aspect-[9/16] rounded-xl2 flex items-center justify-center p-6 transition-colors"
              style={{ backgroundColor }}
            >
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t("Exprimez-vous...")}
                maxLength={200}
                className="w-full bg-transparent text-white text-center text-lg font-medium placeholder:text-white/60 outline-none resize-none"
                rows={4}
              />
            </div>
          ) : (
            <div className="w-full aspect-[9/16] rounded-xl2 overflow-hidden bg-slate-100">
              {previewUrl && mode === 'video' ? (
                <video src={previewUrl} className="w-full h-full object-cover" controls />
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={t("Apercu de la story")} className="w-full h-full object-cover" />
              ) : null}
            </div>
          )}

          {mode === 'text' && (
            <div className="flex items-center gap-2">
              {BACKGROUND_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBackgroundColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    backgroundColor === color ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}{t("Publier la story")}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
