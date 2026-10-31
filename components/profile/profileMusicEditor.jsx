import { useEffect, useRef, useState } from 'react';
import { Music2, Play, Pause, Trash2, Upload, LoaderCircle } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function ProfileMusicEditor({ profile, onChanged }) {
  const [file, setFile] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [title, setTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const MAX_CLIP = 60;

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function handleFileSelect(selected) {
    if (!selected) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(selected);
    setFile(selected);
    setObjectUrl(url);
    setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    setError('');
    setIsPlaying(false);
  }

  function handleLoadedMetadata(event) {
    const clipDuration = event.currentTarget.duration;
    setDuration(clipDuration);
    setStart(0);
    setEnd(Math.min(clipDuration, MAX_CLIP));
  }

  function handlePreview() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const seekAndPlay = () => {
      audio.currentTime = start;
      audio.play();
    };
    if (audio.readyState === 0) {
      audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      audio.load();
    } else {
      seekAndPlay();
    }
    setIsPlaying(true);
  }

  function handleTimeUpdate(event) {
    if (event.currentTarget.currentTime >= end) {
      event.currentTarget.pause();
      event.currentTarget.currentTime = start;
      setIsPlaying(false);
    }
  }

  function handleStartChange(value) {
    const next = Math.min(Number(value), end - 1);
    setStart(Math.max(0, next));
  }

  function handleEndChange(value) {
    const maxEnd = Math.min(duration, start + MAX_CLIP);
    const next = Math.max(Number(value), start + 1);
    setEnd(Math.min(next, maxEnd));
  }

  async function handleSave() {
    if (!file) return;
    setIsSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('startSec', String(start));
      formData.append('endSec', String(end));

      const response = await fetch('/api/users/me/music', { method: 'POST', body: formData });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Erreur lors de l'enregistrement"));
        return;
      }
      onChanged({
        musicUrl: data.musicUrl,
        musicTitle: data.musicTitle,
        musicStartSec: data.musicStartSec,
        musicEndSec: data.musicEndSec
      });
      setFile(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await fetch('/api/users/me/music', { method: 'DELETE' });
      onChanged({ musicUrl: null, musicTitle: null, musicStartSec: 0, musicEndSec: null });
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-slate-500 block">{t("Musique du profil")}</label>

      {profile.musicUrl && !file && (
        <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
            <Music2 size={16} className="text-brand-500 shrink-0" />
            <span className="truncate">{profile.musicTitle || t("Musique du profil")}</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="text-ember-600 hover:text-ember-700 disabled:opacity-60 shrink-0"
            title={t("Retirer la musique")}
          >
            {isRemoving ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      )}

      {!file ? (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl2 py-4 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600 cursor-pointer transition-colors">
          <Upload size={16} />
          {profile.musicUrl ? t("Remplacer la musique") : t("Choisir un fichier audio")}
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => handleFileSelect(event.target.files[0])}
          />
        </label>
      ) : (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl2 p-4">
          <audio
            ref={audioRef}
            src={objectUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 150))}
            placeholder={t("Titre du morceau")}
            className="w-full rounded-xl2 border border-slate-200 bg-surface px-3.5 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePreview}
              className="w-9 h-9 rounded-full bg-brand-500 hover:brightness-110 text-white flex items-center justify-center shrink-0 transition-colors"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} className="ms-0.5" />}
            </button>
            <span className="text-xs text-slate-500">{t("Ecouter l'extrait selectionne")}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{t("Extrait a jouer")}</span>
              <span className="text-xs font-medium text-brand-600">{t("{formatTime} - {formatTime2} ({formatTime3} / 1:00 max)", { formatTime: formatTime(start), formatTime2: formatTime(end), formatTime3: formatTime(end - start) })}</span>
            </div>
            <div dir="ltr" className="relative h-6 flex items-center">
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-200" />
              <div
                className="absolute h-1.5 rounded-full bg-brand-500"
                style={{
                  left: `${duration ? (start / duration) * 100 : 0}%`,
                  right: `${duration ? 100 - (end / duration) * 100 : 0}%`
                }}
              />
              <input
                type="range"
                min={0}
                max={Math.max(duration - 1, 0)}
                step={0.5}
                value={start}
                onChange={(event) => handleStartChange(event.target.value)}
                className="range-thumb absolute inset-x-0 w-full h-6 appearance-none bg-transparent pointer-events-none"
              />
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.5}
                value={end}
                onChange={(event) => handleEndChange(event.target.value)}
                className="range-thumb absolute inset-x-0 w-full h-6 appearance-none bg-transparent pointer-events-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-ember-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-500 text-white text-sm font-medium rounded-xl2 py-2.5 disabled:opacity-70"
            >
              {isSaving && <LoaderCircle size={15} className="animate-spin" />}{t("Enregistrer la musique")}</button>
            <button
              type="button"
              onClick={() => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                setFile(null);
                setObjectUrl(null);
              }}
              className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700"
            >{t("Annuler")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
