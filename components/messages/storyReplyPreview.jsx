import { CornerUpLeft, Clock } from 'lucide-react';
import { t } from '@/lib/i18n/runtime';

// Petit encart "En reponse a une story" au-dessus du texte d'un message.
export default function StoryReplyPreview({ story, isMine }) {
  if (!story) return null;
  const base = isMine ? 'bg-white/15 border-white/60 text-white/90' : 'bg-surface border-brand-400 text-slate-500';
  const title = isMine ? t("Vous avez repondu a une story") : t("A repondu a votre story");

  return (
    <div className={`flex items-stretch gap-2 mb-1.5 rounded-lg border-s-2 overflow-hidden text-xs ${base}`}>
      <div className="flex-1 min-w-0 px-2 py-1.5">
        <p className="flex items-center gap-1 font-medium">
          <CornerUpLeft size={11} className="shrink-0" />
          <span className="truncate">{title}</span>
        </p>
        <p className="truncate opacity-90 mt-0.5">
          {story.expired ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} /> {t("Story expiree")}
            </span>
          ) : story.type === 'text' ? (
            story.content
          ) : story.type === 'video' ? (
            t("Video")
          ) : (
            t("Photo")
          )}
        </p>
      </div>
      {!story.expired && story.type === 'image' && story.mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.mediaUrl} alt="" className="w-11 h-14 object-cover shrink-0" />
      )}
      {!story.expired && story.type === 'video' && story.mediaUrl && (
        <video src={`${story.mediaUrl}#t=0.1`} preload="metadata" muted playsInline className="w-11 h-14 object-cover shrink-0" />
      )}
      {!story.expired && story.type === 'text' && (
        <span className="w-11 h-14 shrink-0" style={{ backgroundColor: story.backgroundColor || '#3D63E8' }} />
      )}
    </div>
  );
}
