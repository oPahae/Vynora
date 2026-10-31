import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import VideoPlayer from '@/components/posts/videoPlayer';
import { downloadUrl } from '@/lib/downloadUrl';

import { t } from '@/lib/i18n/runtime';
export default function MediaLightbox({ media, index, onIndexChange, onClose }) {
  const total = media.length;
  const current = media[index];

  const goTo = useCallback(
    (nextIndex) => {
      const wrapped = (nextIndex + total) % total;
      onIndexChange(wrapped);
    },
    [total, onIndexChange]
  );

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goTo(index + 1);
      if (event.key === 'ArrowLeft') goTo(index - 1);
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [goTo, index, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 end-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        title={t("Fermer")}
      >
        <X size={20} />
      </button>

      <a
        href={downloadUrl(current.url)}
        download
        onClick={(event) => event.stopPropagation()}
        className="absolute top-4 end-16 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        title={t("Telecharger")}
      >
        <Download size={18} />
      </a>

      {total > 1 && (
        <span className="absolute top-5 start-5 z-10 text-white/80 text-sm font-medium tabular-nums">
          {index + 1} / {total}
        </span>
      )}

      {total > 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goTo(index - 1);
          }}
          className="absolute start-2 sm:start-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          title={t("Precedent")}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      <div
        className="w-full h-full flex items-center justify-center p-4 sm:p-10"
        onClick={(event) => event.stopPropagation()}
      >
        {current.type === 'video' ? (
          <VideoPlayer
            key={current.id}
            src={current.url}
            className="max-w-full max-h-full"
            videoClassName="max-w-full max-h-[85vh] w-auto h-auto object-contain mx-auto bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.url}
            alt={t("Media de la publication")}
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain mx-auto"
          />
        )}
      </div>

      {total > 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goTo(index + 1);
          }}
          className="absolute end-2 sm:end-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          title={t("Suivant")}
        >
          <ChevronRight size={22} />
        </button>
      )}

      {total > 1 && (
        <div
          className="absolute bottom-4 start-1/2 -translate-x-1/2 z-10 flex gap-1.5 max-w-[90vw] overflow-x-auto px-2"
          onClick={(event) => event.stopPropagation()}
        >
          {media.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              className={`shrink-0 w-1.5 h-1.5 rounded-full transition-all ${
                i === index ? 'bg-surface w-4' : 'bg-white/40 hover:bg-surface/70'
              }`}
              title={t("Media {v}", { v: i + 1 })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
