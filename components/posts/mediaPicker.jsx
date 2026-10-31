import { useState } from 'react';
import { ImagePlus, X, UploadCloud } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function MediaPicker({ existingMedia = [], onRemoveExisting, newFiles, onNewFilesChange }) {
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(fileList) {
    const selected = Array.from(fileList || []).filter(
      (file) => file.type.startsWith('image') || file.type.startsWith('video')
    );
    if (selected.length === 0) return;
    const withPreview = selected.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : 'image'
    }));
    onNewFilesChange([...newFiles, ...withPreview]);
  }

  function handleFileSelect(event) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeNewFile(index) {
    onNewFilesChange(newFiles.filter((_, i) => i !== index));
  }

  const hasMedia = existingMedia.length > 0 || newFiles.length > 0;

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative">
      {isDragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 backdrop-blur-sm text-brand-600 pointer-events-none">
          <UploadCloud size={22} />
          <p className="text-xs font-medium">{t("Deposez vos fichiers ici")}</p>
        </div>
      )}

      {hasMedia && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {existingMedia.map((media) => (
            <div key={media.id} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 ring-1 ring-inset ring-black/5 animate-pop-in">
              {media.type === 'video' ? (
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt={t("Media existant")} className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onRemoveExisting(media.id)}
                className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-ink/60 hover:bg-ink/85 backdrop-blur text-white flex items-center justify-center transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {newFiles.map((item, index) => (
            <div key={item.previewUrl} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 ring-1 ring-inset ring-black/5 animate-pop-in">
              {item.type === 'video' ? (
                <video src={item.previewUrl} className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={t("Nouveau media")} className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeNewFile(index)}
                className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-ink/60 hover:bg-ink/85 backdrop-blur text-white flex items-center justify-center transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasMedia ? (
        <label
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl2 text-slate-500 cursor-pointer transition-colors hover:text-brand-600 hover:bg-brand-50"
          title={t("Ajouter des photos ou videos (ou glissez-deposez)")}
        >
          <ImagePlus size={15} />
          <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
        </label>
      ) : (
        <label className="group flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 px-3 py-2.5 cursor-pointer text-start transition-colors">
          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center shrink-0 transition-colors">
            <ImagePlus size={16} />
          </span>
          <span className="text-[0.8rem] leading-snug text-slate-500 group-hover:text-slate-700 transition-colors">
            {t("Ajouter des photos ou videos (ou glissez-deposez)")}
          </span>
          <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
        </label>
      )}
    </div>
  );
}
