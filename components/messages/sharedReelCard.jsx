import Link from 'next/link';
import { Play, Clapperboard } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { t } from '@/lib/i18n/runtime';

// Reel partage dans une conversation : apercu video cliquable.
export default function SharedReelCard({ reel, tone = 'light' }) {
  if (!reel || reel.unavailable) {
    return (
      <div className={`flex items-center gap-2 text-sm rounded-xl2 px-3 py-2.5 ${tone === 'dark' ? 'bg-white/15 text-white/90' : 'bg-slate-100 text-slate-500'}`}>
        <Clapperboard size={16} className="shrink-0" />
        {t("Reel indisponible")}
      </div>
    );
  }

  return (
    <Link
      href={`/reels?id=${reel.id}`}
      className="block w-56 rounded-xl2 overflow-hidden bg-black relative group"
      title={t("Ouvrir le reel")}
    >
      <div className="relative aspect-[9/14] bg-slate-900">
        <video src={`${reel.videoUrl}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center transition-transform group-hover:scale-110">
            <Play size={22} fill="currentColor" className="ms-0.5" />
          </span>
        </span>
        <span className="absolute top-2 start-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-white bg-black/45 rounded-full px-2 py-0.5">
          <Clapperboard size={11} /> Reel
        </span>
        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <div className="flex items-center gap-1.5">
            <Avatar src={reel.author.avatar} firstName={reel.author.firstName} lastName={reel.author.lastName} size="xs" />
            <span className="text-xs font-semibold text-white truncate">
              {reel.author.firstName} {reel.author.lastName}
            </span>
          </div>
          {reel.caption && <p className="text-[11px] text-white/85 mt-1 line-clamp-2">{reel.caption}</p>}
        </div>
      </div>
    </Link>
  );
}
