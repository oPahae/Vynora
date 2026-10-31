import { useRef, useState } from 'react';
import { Music2, Play, Pause, Loader2 } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function ProfileMusicPlayer({ musicUrl, musicTitle, musicStartSec, musicEndSec }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  if (!musicUrl) return null;

  function seekToStartAndPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = musicStartSec || 0;
    audio.play();
    setIsPlaying(true);
    setIsBuffering(false);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // readyState 0 = HAVE_NOTHING : le navigateur ignore souvent currentTime
    // tant que les metadonnees ne sont pas chargees, ce qui faisait repartir
    // la lecture du debut. On attend l'evenement loadedmetadata avant de
    // positionner la tete de lecture.
    if (audio.readyState === 0) {
      setIsBuffering(true);
      audio.addEventListener('loadedmetadata', seekToStartAndPlay, { once: true });
      audio.load();
      return;
    }

    if (audio.currentTime < musicStartSec || audio.currentTime >= (musicEndSec || audio.duration)) {
      audio.currentTime = musicStartSec || 0;
    }
    audio.play();
    setIsPlaying(true);
  }

  function handleTimeUpdate(event) {
    if (musicEndSec && event.currentTarget.currentTime >= musicEndSec) {
      event.currentTarget.pause();
      event.currentTarget.currentTime = musicStartSec || 0;
      setIsPlaying(false);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl2 px-4 py-2.5 max-w-sm">
      <audio
        ref={audioRef}
        src={musicUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        disabled={isBuffering}
        className="w-9 h-9 rounded-full bg-brand-500 hover:brightness-110 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-70"
      >
        {isBuffering ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={14} />
        ) : (
          <Play size={14} className="ms-0.5" />
        )}
      </button>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Music2 size={11} />{' '}{t("Musique du profil")}</p>
        <p className="text-sm text-slate-700 font-medium truncate">{musicTitle || t("Sans titre")}</p>
      </div>
    </div>
  );
}
