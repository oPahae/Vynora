import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clapperboard, FolderOpen, Play, Heart } from 'lucide-react';
import CollectionCard from '@/components/collections/collectionCard';
import { formatNumber, t } from '@/lib/i18n/runtime';

// Grille horizontale de reels d'un profil.
export function ProfileReelsSection({ userId, isSelf }) {
  const [reels, setReels] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reels?mode=user&userId=${userId}&limit=12`)
      .then((response) => response.json())
      .then((data) => !cancelled && setReels(data.success ? data.reels : []))
      .catch(() => !cancelled && setReels([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!reels || (reels.length === 0 && !isSelf)) return null;

  return (
    <section className="nx-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2"><Clapperboard size={17} className="text-brand-600" /> {t("Reels")}</h2>
        {isSelf && <Link href="/reels" className="text-xs text-brand-600 font-medium hover:underline">{t("Creer un reel")}</Link>}
      </div>
      {reels.length === 0 ? (
        <p className="text-sm text-slate-400">{t("Aucun reel publie.")}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {reels.map((reel) => (
            <Link key={reel.id} href={`/reels?user=${userId}&id=${reel.id}`} className="relative w-28 sm:w-32 aspect-[9/16] rounded-2xl overflow-hidden bg-black shrink-0 group">
              <video src={`${reel.videoUrl}#t=0.4`} muted playsInline preload="metadata" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <span className="absolute inset-0 bg-black/25" />
              <span className="absolute bottom-2 start-2 flex items-center gap-1 text-white text-xs font-semibold"><Play size={11} fill="currentColor" /> {formatNumber(reel.viewsCount, { notation: 'compact' })}</span>
              {reel.totalReactions > 0 && <span className="absolute bottom-2 end-2 flex items-center gap-1 text-white text-xs"><Heart size={11} fill="currentColor" /> {reel.totalReactions}</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// Collections visibles d'un profil (publiques, amis ou toutes pour soi-meme).
export function ProfileCollectionsCard({ userId, isSelf }) {
  const [collections, setCollections] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/collections?userId=${userId}`)
      .then((response) => response.json())
      .then((data) => !cancelled && setCollections(data.success ? data.collections : []))
      .catch(() => !cancelled && setCollections([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!collections || collections.length === 0) {
    if (!isSelf || !collections) return null;
  }

  return (
    <section className="nx-card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2"><FolderOpen size={17} className="text-brand-600" /> {t("Collections")}</h2>
        <Link href={isSelf ? '/collections' : `/collections?user=${userId}`} className="text-xs text-brand-600 font-medium hover:underline">{t("Voir tout")}</Link>
      </div>
      {collections.length === 0 ? (
        <p className="text-sm text-slate-400">{t("Organisez vos contenus en dossiers et playlists.")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.slice(0, 4).map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </section>
  );
}
