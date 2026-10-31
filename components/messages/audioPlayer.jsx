import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
const SPEEDS = [1, 1.5, 2, 0.5];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Lecteur audio inspire de WhatsApp : play/pause, barre de progression
// glissable (pointer events, fonctionne au clic ET au glisser), et un
// bouton qui fait cycler la vitesse de lecture (1x -> 1.5x -> 2x -> 0.5x).
export default function AudioPlayer({ src, tone = 'light' }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    function handleLoaded() {
      setDuration(audio.duration || 0);
    }
    function handleTimeUpdate() {
      if (!isDragging) setCurrentTime(audio.currentTime);
    }
    function handleEnded() {
      setIsPlaying(false);
      setCurrentTime(0);
    }

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function cycleSpeed() {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[nextIndex];
  }

  function seekToClientX(clientX) {
    const track = trackRef.current;
    const audio = audioRef.current;
    if (!track || !audio || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    setCurrentTime(newTime);
    audio.currentTime = newTime;
  }

  function handlePointerDown(event) {
    setIsDragging(true);
    seekToClientX(event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isDragging) return;
    seekToClientX(event.clientX);
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  const progressPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isDark = tone === 'dark';

  return (
    <div dir="ltr" className={`flex items-center gap-2.5 min-w-[210px] ${isDark ? 'text-white' : 'text-slate-700'}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={togglePlay}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-brand-500 text-white hover:brightness-110'
        }`}
      >
        {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ms-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative h-4 flex items-center cursor-pointer touch-none select-none"
        >
          <div className={`w-full h-1 rounded-full ${isDark ? 'bg-white/25' : 'bg-slate-200'}`}>
            <div
              className={`h-1 rounded-full ${isDark ? 'bg-surface' : 'bg-brand-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow ${
              isDark ? 'bg-surface' : 'bg-brand-500'
            }`}
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>
        <div className={`flex items-center justify-between text-[10px] mt-0.5 ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        title={t("Vitesse de lecture")}
        className={`shrink-0 text-[10px] font-semibold px-1.5 py-1 rounded-md transition-colors ${
          isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
        }`}
      >
        {SPEEDS[speedIndex]}x
      </button>
    </div>
  );
}
