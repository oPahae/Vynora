import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Mic, Video, X, Send, Loader2, Square, FolderOpen } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import MentionTextarea from '@/components/posts/mentionTextarea';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
export default function CommentComposer({ postId, parentId, onCreated, placeholder, autoFocus }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const inputRef = useRef(null);
  const audioMenuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (audioMenuRef.current && !audioMenuRef.current.contains(event.target)) {
        setIsAudioMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (selected) setFile(selected);
    event.target.value = '';
  }

  function openFilePicker() {
    setIsAudioMenuOpen(false);
    document.getElementById(`audio-file-input-${postId}-${parentId || 'root'}`)?.click();
  }

  async function startRecording() {
    setIsAudioMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const rawMime = recorder.mimeType || 'audio/webm';
        const baseMime = rawMime.split(';')[0];
        const blob = new Blob(recordedChunksRef.current, { type: baseMime });
        const extension = baseMime.includes('mp4') ? 'm4a' : 'webm';
        const audioFile = new File([blob], t("audio-{now}.{extension}", { now: Date.now(), extension }), { type: baseMime });
        setFile(audioFile);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((prev) => prev + 1), 1000);
    } catch (error) {
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  }

  function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async function handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (isSubmitting) return;
    if (!content.trim() && !file) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      if (parentId) formData.append('parentId', String(parentId));
      const mentionIds = mentionedUsers
        .filter((mentioned) => content.includes(`@${mentioned.firstName} ${mentioned.lastName}`))
        .map((mentioned) => mentioned.id);
      formData.append('mentions', JSON.stringify(mentionIds));
      if (file) formData.append('media', file);

      const response = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', body: formData });
      const data = await response.json();

      if (data.success) {
        setContent('');
        setMentionedUsers([]);
        setFile(null);
        onCreated(data.comment);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2.5">
      <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        {isRecording ? (
          <div className="flex items-center gap-2 bg-red-50 rounded-xl2 px-3.5 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm text-red-600 font-medium">{t("Enregistrement... {formatDuration}", { formatDuration: formatDuration(recordSeconds) })}</span>
            <button
              type="button"
              onClick={stopRecording}
              title={t("Arreter l'enregistrement")}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Square size={12} fill="white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3.5 py-2">
            <div className="flex-1 min-w-0">
              <MentionTextarea
                multiline={false}
                value={content}
                onChange={setContent}
                mentionedUsers={mentionedUsers}
                onMentionedUsersChange={setMentionedUsers}
                placeholder={placeholder || t("Ecrire un commentaire... (@ pour mentionner)")}
                autoFocus={autoFocus}
                dropUp
                onSubmitKey={handleSubmit}
                inputClassName="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <label
              className="shrink-0 text-slate-400 hover:text-brand-500 cursor-pointer transition-colors"
              title={t("Photo ou video")}
            >
              <ImageIcon size={16} />
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            </label>
            <div className="relative shrink-0" ref={audioMenuRef}>
              <button
                type="button"
                onClick={() => setIsAudioMenuOpen((prev) => !prev)}
                className="text-slate-400 hover:text-brand-500 cursor-pointer transition-colors"
                title={t("Audio")}
              >
                <Mic size={16} />
              </button>
              <input
                id={`audio-file-input-${postId}-${parentId || 'root'}`}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {isAudioMenuOpen && (
                <div className="absolute top-full end-0 mt-2 w-48 max-w-[80vw] bg-surface rounded-xl2 shadow-card border border-slate-100 py-1.5 z-40">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Mic size={15} />{' '}{t("Enregistrer un audio")}</button>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FolderOpen size={15} />{' '}{t("Choisir un fichier")}</button>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || (!content.trim() && !file)}
              className="shrink-0 text-brand-500 hover:text-brand-600 disabled:text-slate-300 transition-colors"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}

        {file && !isRecording && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 bg-slate-50 rounded-xl2 px-3 py-1.5 w-fit">
            {file.type.startsWith('video') ? <Video size={13} /> : file.type.startsWith('audio') ? <Mic size={13} /> : <ImageIcon size={13} />}
            <span className="truncate max-w-[160px]">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
