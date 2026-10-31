import { useState, useRef, useEffect } from 'react';
import { Clapperboard, Upload, X, Globe, Users, Lock, Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import UploadProgressBar from '@/components/shared/uploadProgressBar';
import { uploadFormData } from '@/lib/uploadClient';
import { t, td } from '@/lib/i18n/runtime';

const MAX_SECONDS = 180;
const MAX_BYTES = 200 * 1024 * 1024;

const VISIBILITIES = [
  { key: 'public', icon: Globe, label: () => t("Public") },
  { key: 'friends', icon: Users, label: () => t("Amis") },
  { key: 'private', icon: Lock, label: () => t("Prive") }
];

export default function ReelComposer({ onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  function pick(selected) {
    setError('');
    if (!selected) return;
    if (!selected.type.startsWith('video/')) {
      setError(t("Choisissez un fichier video."));
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(t("La video est trop lourde (200 Mo maximum)."));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setDuration(0);
  }

  function handleMetadata(event) {
    const seconds = event.currentTarget.duration;
    setDuration(seconds);
    if (seconds > MAX_SECONDS) setError(t("Un reel dure {minutes} minutes maximum.", { minutes: MAX_SECONDS / 60 }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || error) return;
    setProgress(0);
    setError('');
    const formData = new FormData();
    formData.append('video', file);
    formData.append('caption', caption);
    formData.append('visibility', visibility);
    formData.append('durationSec', String(Math.round(duration * 100) / 100 || 0));
    try {
      const { data } = await uploadFormData('/api/reels', formData, { onProgress: setProgress });
      if (data.success) onCreated(data.reel);
      else {
        setError(td(data.message) || t("Une erreur est survenue"));
        setProgress(null);
      }
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const tooLong = duration > MAX_SECONDS;

  return (
    <Modal title={t("Nouveau reel")} onClose={uploading ? () => {} : onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="grid sm:grid-cols-[200px_1fr] gap-5">
        <div>
          {previewUrl ? (
            <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black">
              <video src={previewUrl} controls playsInline muted onLoadedMetadata={handleMetadata} className="w-full h-full object-contain" />
              {!uploading && (
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreviewUrl(null); setError(''); }}
                  className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center"
                  aria-label={t("Retirer")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => { event.preventDefault(); setDragOver(false); pick(event.dataTransfer.files?.[0]); }}
              className={`aspect-[9/16] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center p-4 transition-colors ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'}`}
            >
              <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center"><Upload size={22} /></span>
              <span className="text-sm font-medium text-slate-800">{t("Choisir une video")}</span>
              <span className="text-xs text-slate-400">{t("Format vertical conseille · 3 min max")}</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" className="hidden" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} />
          {duration > 0 && !tooLong && <p className="text-xs text-slate-400 mt-2 text-center">{Math.round(duration)} s</p>}
        </div>

        <div className="space-y-4 min-w-0">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Legende")}</label>
            <textarea
              value={caption}
              maxLength={500}
              rows={5}
              disabled={uploading}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={t("Decrivez votre reel... #hashtags")}
              className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
            />
            <p className="text-xs text-slate-400 text-end mt-1">{caption.length}/500</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">{t("Qui peut le voir ?")}</label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITIES.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  disabled={uploading}
                  onClick={() => setVisibility(option.key)}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-xl2 border text-sm font-medium transition-colors ${visibility === option.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <option.icon size={14} /> {option.label()}
                </button>
              ))}
            </div>
          </div>

          {uploading && <UploadProgressBar progress={progress} label={progress >= 100 ? t("Traitement...") : t("Envoi en cours...")} />}
          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={!file || uploading || Boolean(error)} className="nx-btn-primary w-full h-11">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
            {t("Publier le reel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
