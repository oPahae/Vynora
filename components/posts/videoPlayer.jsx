import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Download,
  RotateCcw,
  RotateCw,
  Maximize,
  Minimize,
  Gauge
} from 'lucide-react';
import { downloadUrl } from '@/lib/downloadUrl';

import { t } from '@/lib/i18n/runtime';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, className = '', videoClassName, onLoadedMetadata }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const speedMenuRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (!isSpeedMenuOpen) return undefined;
    function handleClickOutside(event) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target)) {
        setIsSpeedMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSpeedMenuOpen]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function handleSeek(value) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(value);
    setCurrentTime(Number(value));
  }

  function skip(delta) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), duration || video.duration || 0);
  }

  function handleVolumeChange(value) {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(value);
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setIsMuted(next === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
    if (!next && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  }

  function changeSpeed(value) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
    setIsSpeedMenuOpen(false);
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  function resetHideControlsTimer() {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    if (!videoRef.current?.paused) {
      hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`relative bg-black group/video ${className}`}
      onMouseMove={resetHideControlsTimer}
      onMouseLeave={() => !videoRef.current?.paused && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className={videoClassName || 'w-full h-full object-contain bg-black'}
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          onLoadedMetadata && onLoadedMetadata(event);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        playsInline
      />

      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <Play size={26} className="ms-1" fill="white" />
          </span>
        </button>
      )}

      <div
        className={`absolute bottom-0 start-0 end-0 px-3 pb-2.5 pt-8 bg-black/60 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 group-hover/video:opacity-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative w-full h-3.5 flex items-center group/progress mb-1.5 cursor-pointer">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25" />
          <div
            className="absolute start-0 h-1 rounded-full bg-brand-500"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="absolute w-3 h-3 rounded-full bg-brand-500 shadow ring-2 ring-surface scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none"
            style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 6px)` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(event) => handleSeek(event.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
          />
        </div>

        <div className="flex items-center gap-2.5 text-white">
          <button type="button" onClick={togglePlay} className="hover:text-brand-300 transition-colors">
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button type="button" onClick={() => skip(-5)} title={t("Reculer de 5s")} className="hover:text-brand-300 transition-colors">
            <RotateCcw size={15} />
          </button>
          <button type="button" onClick={() => skip(5)} title={t("Avancer de 5s")} className="hover:text-brand-300 transition-colors">
            <RotateCw size={15} />
          </button>

          <span className="text-xs tabular-nums text-white/80 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-1.5 group/volume">
            <button type="button" onClick={toggleMute} className="hover:text-brand-300 transition-colors">
              <VolumeIcon size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(event) => handleVolumeChange(event.target.value)}
              className="w-0 group-hover/volume:w-16 focus:w-16 transition-all duration-200 h-1 accent-brand-500 cursor-pointer overflow-hidden"
            />
          </div>

          <div className="flex-1" />

          <div className="relative" ref={speedMenuRef}>
            <button
              type="button"
              onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium hover:text-brand-300 transition-colors"
              title={t("Vitesse de lecture")}
            >
              <Gauge size={15} /> {speed}x
            </button>
            {isSpeedMenuOpen && (
              <div className="absolute bottom-full end-0 mb-2 w-20 bg-ink/95 rounded-xl2 shadow-card py-1 z-20">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeSpeed(value)}
                    className={`w-full text-center text-xs py-1.5 hover:bg-white/10 transition-colors ${
                      speed === value ? 'text-brand-300 font-semibold' : 'text-white/80'
                    }`}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href={downloadUrl(src)}
            download
            title={t("Telecharger")}
            className="hover:text-brand-300 transition-colors"
            onClick={(event) => event.stopPropagation()}
          >
            <Download size={15} />
          </a>

          <button type="button" onClick={toggleFullscreen} title={t("Plein ecran")} className="hover:text-brand-300 transition-colors">
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
