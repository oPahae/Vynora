import { useState } from 'react';
import { Play, Download } from 'lucide-react';
import VideoPlayer from '@/components/posts/videoPlayer';
import MediaLightbox from '@/components/posts/mediaLightbox';
import { downloadUrl } from '@/lib/downloadUrl';

import { t } from '@/lib/i18n/runtime';
function gridClass(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 3) return 'grid-cols-2';
  return 'grid-cols-2';
}

export default function MediaGrid({ media }) {
  const [ratios, setRatios] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!media || media.length === 0) return null;

  const visible = media.slice(0, 4);
  const extraCount = media.length - visible.length;
  const single = visible.length === 1;

  const registerRatio = (id, width, height) => {
    if (!width || !height) return;
    setRatios((prev) => {
      const next = width / height;
      if (prev[id] === next) return prev;
      return { ...prev, [id]: next };
    });
  };

  return (
    <>
      <div className={`grid ${gridClass(visible.length)} gap-1.5 rounded-xl2 overflow-hidden bg-slate-100`}>
        {visible.map((item, index) => {
          const spanTall = visible.length === 3 && index === 0;
          const ratio = ratios[item.id] || 1;

          if (single) {
            return (
              <div
                key={item.id}
                className="relative w-full flex items-center justify-center bg-slate-100 overflow-hidden group"
                style={{ maxHeight: '75vh' }}
              >
                {item.type === 'video' ? (
                  <VideoPlayer
                    src={item.url}
                    className="max-w-full"
                    videoClassName="max-w-full max-h-[75vh] w-auto h-auto object-contain mx-auto bg-black"
                    onLoadedMetadata={(e) =>
                      registerRatio(item.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                    }
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={t("Media de la publication")}
                      className="max-w-full object-contain mx-auto cursor-pointer transition-transform duration-[900ms] ease-out-expo group-hover:scale-[1.025]"
                      style={{ maxHeight: '75vh', width: 'auto', height: 'auto' }}
                      loading="lazy"
                      onClick={() => setLightboxIndex(0)}
                      onLoad={(e) =>
                        registerRatio(item.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                      }
                    />
                    <a
                      href={downloadUrl(item.url)}
                      download
                      onClick={(event) => event.stopPropagation()}
                      title={t("Telecharger")}
                      className="absolute top-2.5 end-2.5 w-8 h-8 rounded-full bg-ink/60 hover:bg-ink/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download size={15} />
                    </a>
                  </>
                )}
              </div>
            );
          }

          // Au dela d'un seul media, les vignettes ne sont plus des lecteurs
          // interactifs complets (ca creait un conflit de clics avec
          // l'ouverture de la visionneuse) : elles ouvrent la visionneuse
          // plein ecran, qui elle-meme donne acces a TOUS les medias du post
          // (pas seulement les 4 visibles), avec navigation precedent/suivant.
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setLightboxIndex(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setLightboxIndex(index);
                }
              }}
              className={`relative flex items-center justify-center bg-slate-100 overflow-hidden cursor-pointer group ${
                spanTall ? 'row-span-2' : ''
              }`}
              style={{ aspectRatio: ratio, maxHeight: '420px' }}
            >
              {item.type === 'video' ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) =>
                      registerRatio(item.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                    }
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <span className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <Play size={18} className="ms-0.5" fill="white" />
                    </span>
                  </div>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={t("Media de la publication")}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onLoad={(e) =>
                    registerRatio(item.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                  }
                />
              )}
              {index === 3 && extraCount > 0 && (
                <div className="absolute inset-0 bg-ink/60 flex items-center justify-center text-white font-semibold text-lg">
                  +{extraCount}
                </div>
              )}
              <a
                href={downloadUrl(item.url)}
                download
                onClick={(event) => event.stopPropagation()}
                title={t("Telecharger")}
                className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-ink/60 hover:bg-ink/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download size={13} />
              </a>
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          media={media}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
