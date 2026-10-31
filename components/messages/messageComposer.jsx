import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Loader2, X, FileIcon, Mic, Square, Trash2, CornerUpLeft } from 'lucide-react';
import { useSocket } from '@/lib/socketContext';
import { useToast } from '@/lib/toastContext';
import { uploadFormData } from '@/lib/uploadClient';
import UploadProgressBar from '@/components/shared/uploadProgressBar';

import { t } from '@/lib/i18n/runtime';
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function replyPreviewText(message) {
  if (!message) return '';
  if (message.type === 'text') return message.content || '';
  if (message.type === 'image') return t("Photo");
  if (message.type === 'video') return t("Video");
  if (message.type === 'audio') return t("Message vocal");
  return message.fileName || t("Fichier");
}

export default function MessageComposer({ conversationId, onSent, files, onFilesChange, replyingTo, onCancelReply }) {
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedFile, setRecordedFile] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const streamRef = useRef(null);
  const contentInputRef = useRef(null);

  // Quand on clique sur "Repondre" a un message, on remet automatiquement
  // le focus sur le champ de saisie pour pouvoir ecrire directement.
  useEffect(() => {
    if (replyingTo) {
      contentInputRef.current?.focus();
    }
  }, [replyingTo]);

  function handleTyping(value) {
    setContent(value);
    if (!socket) return;

    socket.emit('typing:start', { conversationId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId });
    }, 2000);
  }

  function handleFileChange(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) {
      onFilesChange([...files, ...selected]);
      removeRecordedAudio();
    }
    event.target.value = '';
  }

  function removeFileAt(index) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], t("message-vocal-{now}.webm", { now: Date.now() }), { type: 'audio/webm' });
        setRecordedFile(audioFile);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      if (files.length > 0) onFilesChange([]);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      showToast({
        title: t("Microphone indisponible"),
        message: t("Impossible d'acceder au microphone. Verifiez les autorisations du navigateur."),
        type: 'error',
        playSound: false
      });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordDuration(0);
  }

  function removeRecordedAudio() {
    setRecordedFile(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
  }

  async function sendOne(payloadContent, file, onProgress) {
    const formData = new FormData();
    formData.append('content', payloadContent);
    if (file) formData.append('media', file);
    if (replyingTo) formData.append('replyToId', String(replyingTo.id));
    const { data } = await uploadFormData(`/api/conversations/${conversationId}/messages`, formData, {
      onProgress
    });
    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const attachments = recordedFile ? [recordedFile] : files;
    if (!content.trim() && attachments.length === 0) return;

    setIsSubmitting(true);
    if (socket) socket.emit('typing:stop', { conversationId });

    try {
      if (attachments.length === 0) {
        const data = await sendOne(content.trim(), null);
        if (data.success) {
          setContent('');
          onSent(data.message);
          if (onCancelReply) onCancelReply();
        }
        return;
      }

      setUploadProgress(0);
      // Le premier fichier part avec le texte (comme une legende), les
      // suivants sont envoyes comme des messages separes juste apres.
      for (let i = 0; i < attachments.length; i += 1) {
        const isFirst = i === 0;
        // eslint-disable-next-line no-await-in-loop
        const data = await sendOne(isFirst ? content.trim() : '', attachments[i], (percent) => {
          setUploadProgress(Math.round(((i + percent / 100) / attachments.length) * 100));
        });
        if (data.success) {
          onSent(data.message);
        }
      }

      setContent('');
      onFilesChange([]);
      removeRecordedAudio();
      if (onCancelReply) onCancelReply();
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  const hasAttachments = files.length > 0;

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-100 p-3">
      {replyingTo && (
        <div className="flex items-center gap-2 bg-brand-50 border-s-2 border-brand-400 rounded-lg px-3 py-2 mb-2">
          <CornerUpLeft size={14} className="text-brand-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-brand-700">{t("Reponse a un message")}</p>
            <p className="text-xs text-slate-500 truncate">{replyPreviewText(replyingTo)}</p>
          </div>
          <button type="button" onClick={onCancelReply} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {uploadProgress !== null && (
        <UploadProgressBar
          progress={uploadProgress}
          label={
            (recordedFile ? 1 : files.length) > 1
              ? t("Envoi des pieces jointes...")
              : t("Envoi de la piece jointe...")
          }
        />
      )}

      {hasAttachments && !isRecording && !audioPreviewUrl && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-xl2 border border-slate-200 px-2 py-1"
            >
              <FileIcon size={13} />
              <span className="truncate max-w-[120px]">{item.name}</span>
              <button
                type="button"
                onClick={() => removeFileAt(index)}
                className="text-slate-400 hover:text-red-500"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl2 px-3.5 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-ember-500 animate-pulse shrink-0" />
          <span className="flex-1 text-sm text-slate-600">{t("Enregistrement... {formatDuration}", { formatDuration: formatDuration(recordDuration) })}</span>
          <button
            type="button"
            onClick={cancelRecording}
            className="text-slate-400 hover:text-red-500 transition-colors"
            title={t("Annuler")}
          >
            <Trash2 size={17} />
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-500 text-white transition-all hover:shadow-glow"
            title={t("Arreter l'enregistrement")}
          >
            <Square size={13} fill="currentColor" />
          </button>
        </div>
      ) : audioPreviewUrl ? (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl2 px-3.5 py-2.5">
          <button
            type="button"
            onClick={removeRecordedAudio}
            className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
            title={t("Supprimer l'enregistrement")}
          >
            <Trash2 size={17} />
          </button>
          <audio src={audioPreviewUrl} controls className="h-9 flex-1 min-w-0" />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-brand-500 text-white disabled:opacity-60 transition-all hover:shadow-glow shrink-0"
            title={t("Envoyer le message vocal")}
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3.5 py-2.5 transition-all focus-within:bg-surface focus-within:ring-4 focus-within:ring-brand-500/10">
          <label className="text-slate-400 hover:text-brand-500 cursor-pointer transition-colors shrink-0">
            <Paperclip size={18} />
            <input type="file" multiple className="hidden" onChange={handleFileChange} />
          </label>
          <input
            ref={contentInputRef}
            type="text"
            value={content}
            onChange={(event) => handleTyping(event.target.value)}
            placeholder={t("Ecrire un message... (ou glissez-deposez des fichiers ici)")}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {!content.trim() && !hasAttachments && (
            <button
              type="button"
              onClick={startRecording}
              className="text-slate-400 hover:text-brand-500 transition-colors shrink-0"
              title={t("Enregistrer un audio")}
            >
              <Mic size={18} />
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || (!content.trim() && !hasAttachments)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-500 text-white disabled:opacity-40 disabled:grayscale transition-all hover:shadow-glow shrink-0"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      )}
    </form>
  );
}
