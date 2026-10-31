import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Hash, Lock, Users, Send, Trash2, Loader2, Timer, Paperclip, X, Download, AtSign, Mic, Square } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import AudioPlayer from '@/components/messages/audioPlayer';
import Modal, { inputClasses, primaryButton, ghostButton } from '@/components/servers/modal';
import { useSocket } from '@/lib/socketContext';
import { useConfirm } from '@/lib/confirmContext';
import { downloadUrl } from '@/lib/downloadUrl';
import { PERMISSIONS, hasPermission } from '@/lib/guildPermissions';
import { buildMentionCandidates, splitMentionSegments } from '@/lib/guildMentions';

import { t, formatDate as formatLocalDate, formatTime as formatLocalTime } from '@/lib/i18n/runtime';
// Fin du delai du mode lent, par salon (survit au changement de salon
// pendant la session : le compte a rebours reprend la ou il en etait).
const slowmodeEndByChannel = new Map();

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCountdown(seconds) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return t("{h} h {padStart} min", { h, padStart: m.toString().padStart(2, '0') });
  }
  if (seconds >= 60) return formatDuration(seconds);
  return `${seconds} s`;
}

const SLOWMODE_PRESETS = [
  { seconds: 0, get label() { return t("Desactive"); } },
  { seconds: 5, get label() { return t("5 secondes"); } },
  { seconds: 10, get label() { return t("10 secondes"); } },
  { seconds: 30, get label() { return t("30 secondes"); } },
  { seconds: 60, get label() { return t("1 minute"); } },
  { seconds: 300, get label() { return t("5 minutes"); } },
  { seconds: 900, get label() { return t("15 minutes"); } },
  { seconds: 3600, get label() { return t("1 heure"); } }
];

function formatSlowmode(seconds) {
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} h`;
  if (seconds >= 60) return t("{round} min", { round: Math.round(seconds / 60) });
  return `${seconds} s`;
}

// Les dates MySQL arrivent en UTC sous la forme "YYYY-MM-DD HH:MM:SS".
function parseDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z');
}

function formatTime(value) {
  const date = parseDate(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = formatLocalTime(date);
  return sameDay ? t("Aujourd'hui a {time}", { time }) : `${formatLocalDate(date)} ${time}`;
}

function SlowmodeModal({ guildId, channel, onClose, onSaved }) {
  const [seconds, setSeconds] = useState(channel.slowmodeSeconds);
  const [custom, setCustom] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const value = custom !== '' ? Number(custom) : seconds;

  async function save() {
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/guilds/${guildId}/channels/${channel.id}/slowmode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: value })
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Une erreur est survenue"));
        return;
      }
      onSaved();
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title={t("Mode lent")}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>{t("Annuler")}</button>
          <button type="button" onClick={save} disabled={isSaving || !Number.isInteger(value) || value < 0} className={primaryButton}>
            {isSaving && <Loader2 size={15} className="animate-spin" />}{t("Appliquer")}</button>
        </>
      }
    >
      <p className="text-sm text-slate-500">{t("Impose un delai minimal entre deux messages d'un meme membre dans #{name}. Les moderateurs autorises ne sont pas concernes.", { name: channel.name })}</p>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        {SLOWMODE_PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            onClick={() => {
              setSeconds(preset.seconds);
              setCustom('');
            }}
            className={`rounded-xl2 border px-3 py-2 text-sm ${
              custom === '' && seconds === preset.seconds
                ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Ou une duree personnalisee (secondes, max 21600)")}</label>
        <input
          type="number"
          min="0"
          max="21600"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={t("Ex : 45")}
          className={inputClasses}
        />
      </div>
    </Modal>
  );
}

export default function TextChannel({ guildId, channel, permissions, currentUser, onBack, onOpenMembers, onStructureChanged }) {
  const { socket } = useSocket();
  const confirm = useConfirm();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [cooldownEnd, setCooldownEnd] = useState(0); // timestamp (ms) de fin du mode lent
  const [now, setNow] = useState(() => Date.now());
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedFile, setRecordedFile] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slowmodeOpen, setSlowmodeOpen] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file, previewUrl, kind }
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // { term, start }
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const streamRef = useRef(null);
  const discardRecordingRef = useRef(false);

  const cooldown = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));

  function startCooldown(seconds) {
    const end = Date.now() + seconds * 1000;
    slowmodeEndByChannel.set(channel.id, end);
    setNow(Date.now());
    setCooldownEnd(end);
  }

  const canSend = hasPermission(permissions, PERMISSIONS.SEND_MESSAGES);
  const canManageMessages = hasPermission(permissions, PERMISSIONS.MANAGE_MESSAGES);
  const canSetSlowmode = hasPermission(permissions, PERMISSIONS.MANAGE_SLOWMODE);
  const bypassSlowmode = hasPermission(permissions, PERMISSIONS.BYPASS_SLOWMODE);

  const base = `/api/guilds/${guildId}/channels/${channel.id}/messages`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/guilds/${guildId}/members`).then((r) => r.json()),
      fetch(`/api/guilds/${guildId}/roles`).then((r) => r.json())
    ]).then(([membersRes, rolesRes]) => {
      if (cancelled) return;
      if (membersRes.success && rolesRes.success) {
        setMentionCandidates(buildMentionCandidates(membersRes.members, rolesRes.roles));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setIsLoading(true);
    setError('');
    const savedEnd = slowmodeEndByChannel.get(channel.id) || 0;
    setNow(Date.now());
    setCooldownEnd(savedEnd > Date.now() ? savedEnd : 0);
    stickToBottomRef.current = true;
    fetch(base)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [base, channel.id]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (message) => {
      if (message.channelId !== channel.id) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };
    const onDeleted = ({ id, channelId }) => {
      if (channelId !== channel.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };
    socket.on('guild:message', onMessage);
    socket.on('guild:message-deleted', onDeleted);
    return () => {
      socket.off('guild:message', onMessage);
      socket.off('guild:message-deleted', onDeleted);
    };
  }, [socket, channel.id]);

  useEffect(() => {
    if (stickToBottomRef.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Horloge du compte a rebours du mode lent : basee sur l'heure reelle
  // (pas de derive si l'onglet est en arriere-plan).
  useEffect(() => {
    if (cooldownEnd <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownEnd) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [cooldownEnd]);

  // Nettoyage de l'enregistrement audio si on quitte le salon.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        discardRecordingRef.current = true;
        try {
          recorder.stop();
        } catch (err) {
          // Deja arrete.
        }
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlder() {
    if (isLoadingMore || messages.length === 0) return;
    setIsLoadingMore(true);
    stickToBottomRef.current = false;
    const el = listRef.current;
    const previousHeight = el?.scrollHeight || 0;
    try {
      const data = await fetch(`${base}?before=${messages[0].id}`).then((r) => r.json());
      if (data.success) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.hasMore);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - previousHeight;
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  function clearAttachment() {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const kind = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'file';
    clearAttachment();
    removeRecordedAudio();
    setAttachment({ file, kind, previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null });
  }

  // --- Message vocal (meme fonctionnement que la messagerie privee) ---
  async function startRecording() {
    if (isRecording) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordChunksRef.current = [];
      discardRecordingRef.current = false;

      const preferred = ['audio/webm', 'audio/mp4'].find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (discardRecordingRef.current) return;
        const baseMime = (recorder.mimeType || preferred || 'audio/webm').split(';')[0];
        const extension = baseMime.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(recordChunksRef.current, { type: baseMime });
        setRecordedFile(new File([blob], t("message-vocal-{now}.{extension}", { now: Date.now(), extension }), { type: baseMime }));
        setAudioPreviewUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      clearAttachment();
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
    } catch (err) {
      setError(t("Impossible d'acceder au microphone. Verifiez les autorisations du navigateur."));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    setIsRecording(false);
  }

  function cancelRecording() {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    setIsRecording(false);
    setRecordDuration(0);
  }

  function removeRecordedAudio() {
    setRecordedFile(null);
    setAudioPreviewUrl(null);
  }

  // Detecte un "@debut-de-nom" juste avant le curseur pour proposer
  // l'autocompletion de mention.
  function handleTextChange(event) {
    const value = event.target.value;
    const cursor = event.target.selectionStart;
    setText(value);

    const before = value.slice(0, cursor);
    const match = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
    if (match) {
      setMentionQuery({ term: match[1], start: cursor - match[1].length - 1 });
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  const mentionSuggestions = mentionQuery
    ? mentionCandidates
        .filter((c) => c.label.toLowerCase().startsWith(mentionQuery.term.toLowerCase()))
        .slice(0, 6)
    : [];

  function pickMention(candidate) {
    if (!mentionQuery) return;
    const before = text.slice(0, mentionQuery.start);
    const after = text.slice(mentionQuery.start + 1 + mentionQuery.term.length);
    const next = `${before}@${candidate.label} ${after}`;
    setText(next);
    setMentionQuery(null);
    setMentionIndex(0);
    const cursor = before.length + candidate.label.length + 2;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleKeyDown(event) {
    if (mentionSuggestions.length > 0) {
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        pickMention(mentionSuggestions[Math.min(mentionIndex, mentionSuggestions.length - 1)]);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  const send = useCallback(async () => {
    const content = text.trim();
    const fileToSend = recordedFile || attachment?.file || null;
    if ((!content && !fileToSend) || isSending || isRecording || cooldown > 0) return;
    setIsSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('content', content);
      if (fileToSend) formData.append('file', fileToSend);
      const response = await fetch(base, { method: 'POST', body: formData });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Impossible d'envoyer le message"));
        if (data.retryAfterSeconds) startCooldown(data.retryAfterSeconds);
        return;
      }
      setText('');
      clearAttachment();
      removeRecordedAudio();
      stickToBottomRef.current = true;
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      if (channel.slowmodeSeconds && !bypassSlowmode) startCooldown(channel.slowmodeSeconds);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, attachment, recordedFile, isRecording, isSending, cooldown, base, channel.id, channel.slowmodeSeconds, bypassSlowmode]);

  async function handleDelete(message) {
    const ok = await confirm({
      title: t("Supprimer ce message ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer")
    });
    if (!ok) return;
    await fetch(`${base}/${message.id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 md:px-4 h-14 shrink-0 border-b border-slate-100">
        <button type="button" onClick={onBack} className="md:hidden p-1.5 -ms-1 text-slate-500" aria-label={t("Retour aux salons")}>
          <ArrowLeft size={20} />
        </button>
        <Hash size={18} className="text-slate-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-slate-900 truncate flex items-center gap-1.5">
            {channel.name}
            {channel.isPrivate && <Lock size={13} className="text-slate-400" />}
          </h2>
          {channel.topic && <p className="text-xs text-slate-500 truncate hidden sm:block">{channel.topic}</p>}
        </div>
        {channel.slowmodeSeconds > 0 && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-1 shrink-0">
            <Timer size={12} /> {formatSlowmode(channel.slowmodeSeconds)}
          </span>
        )}
        {canSetSlowmode && (
          <button
            type="button"
            onClick={() => setSlowmodeOpen(true)}
            className="p-2 text-slate-400 hover:text-brand-600 shrink-0"
            title={t("Mode lent")}
          >
            <Timer size={18} />
          </button>
        )}
        <button type="button" onClick={onOpenMembers} className="lg:hidden p-2 text-slate-400 hover:text-brand-600 shrink-0" title={t("Membres")}>
          <Users size={18} />
        </button>
      </div>

      <div ref={listRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-3">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-brand-400" />
          </div>
        )}
        {!isLoading && hasMore && (
          <div className="flex justify-center pb-3">
            <button type="button" onClick={loadOlder} disabled={isLoadingMore} className="text-xs text-brand-600 font-medium hover:underline">
              {isLoadingMore ? t("Chargement...") : t("Charger les messages precedents")}
            </button>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-14">{t("Bienvenue dans #{name}. Soyez le premier a ecrire !", { name: channel.name })}</div>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const grouped =
            previous &&
            previous.sender.id === message.sender.id &&
            parseDate(message.createdAt) - parseDate(previous.createdAt) < 5 * 60 * 1000;
          const canDelete = message.sender.id === currentUser.id || canManageMessages;
          const segments = message.content ? splitMentionSegments(message.content, mentionCandidates) : [];
          const mentionsMe = segments.some((s) => s.mention?.type === 'user' && s.mention.id === currentUser.id);
          return (
            <div
              key={message.id}
              className={`group flex gap-3 rounded-xl2 px-2 py-0.5 ${grouped ? '' : 'mt-3'} ${
                mentionsMe ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-slate-50/70'
              }`}
            >
              <div className="w-9 shrink-0 pt-0.5">
                {!grouped && (
                  <Avatar src={message.sender.avatar} firstName={message.sender.firstName} lastName={message.sender.lastName} size="sm" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="text-sm leading-tight">
                    <span className="font-semibold text-slate-900">
                      {message.sender.firstName} {message.sender.lastName}{message.sender.verified && <VerifiedBadge size={14} />}
                    </span>
                    <span className="ms-2 text-[11px] text-slate-400">{formatTime(message.createdAt)}</span>
                  </p>
                )}
                {message.content && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {segments.map((segment, i) =>
                      segment.mention ? (
                        <span
                          key={i}
                          className="font-medium rounded px-1 py-0.5"
                          style={
                            segment.mention.type === 'role'
                              ? { color: segment.mention.color, backgroundColor: `${segment.mention.color}1A` }
                              : { color: '#4548D9', backgroundColor: '#4548D91A' }
                          }
                        >
                          @{segment.mention.label}
                        </span>
                      ) : (
                        <span key={i}>{segment.text}</span>
                      )
                    )}
                  </p>
                )}
                {message.type === 'image' && (
                  <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-1 block w-52">
                    <img src={message.fileUrl} alt={message.fileName || t("Image")} className="max-w-full rounded-xl2 border border-slate-100" />
                  </a>
                )}
                {message.type === 'video' && (
                  <video src={message.fileUrl} controls className="mt-1 w-72 max-w-full rounded-xl2 border border-slate-100" />
                )}
                {message.type === 'audio' && (
                  <div className="mt-1 flex items-center gap-2">
                    <AudioPlayer src={message.fileUrl} tone="light" />
                    <a href={downloadUrl(message.fileUrl, message.fileName)} download title={t("Telecharger")} className="shrink-0 text-slate-400 hover:text-slate-600">
                      <Download size={14} />
                    </a>
                  </div>
                )}
                {message.type === 'file' && (
                  <a
                    href={downloadUrl(message.fileUrl, message.fileName)}
                    download
                    className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-700 underline"
                  >
                    <Download size={13} className="shrink-0" />
                    {message.fileName || t("Fichier joint")}
                  </a>
                )}
              </div>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(message)}
                  className="self-start p-1.5 text-slate-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title={t("Supprimer")}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-3 md:px-4 pb-3 pt-2 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && <p className="text-xs text-red-500 mb-1.5">{error}</p>}
        {channel.slowmodeSeconds > 0 && bypassSlowmode && canSend && (
          <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
            <Timer size={11} />{' '}{t("Mode lent actif ({formatSlowmode}) mais vous en etes exempte (moderateur).", { formatSlowmode: formatSlowmode(channel.slowmodeSeconds) })}</p>
        )}
        {cooldown > 0 && canSend && (
          <div className="mb-2 rounded-xl2 bg-amber-50 border border-amber-100 px-3 py-2" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <Timer size={13} className="shrink-0" />
              <span className="flex-1">{t("Mode lent : vous pourrez ecrire a nouveau dans")}</span>
              <span className="font-display font-semibold text-sm tabular-nums">{formatCountdown(cooldown)}</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-[width] duration-300 ease-linear"
                style={{ width: `${Math.min(100, Math.max(0, (cooldown / Math.max(1, channel.slowmodeSeconds || cooldown)) * 100))}%` }}
              />
            </div>
          </div>
        )}
        {canSend ? (
          <div className="relative">
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full start-0 mb-1.5 w-64 max-w-[90vw] nx-card !rounded-xl2 overflow-hidden py-1 z-10">
                {mentionSuggestions.map((candidate, index) => (
                  <button
                    key={`${candidate.type}-${candidate.id}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickMention(candidate)}
                    onMouseEnter={() => setMentionIndex(index)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-start text-sm ${
                      index === mentionIndex ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {candidate.type === 'role' ? (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: candidate.color }} />
                    ) : (
                      <AtSign size={13} className="text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{candidate.label}</span>
                    {index === 0 && <span className="ms-auto text-[10px] text-slate-400 shrink-0">{t("Tab")}</span>}
                    {candidate.type === 'role' && index !== 0 && <span className="ms-auto text-[10px] text-slate-400 shrink-0">{t("role")}</span>}
                  </button>
                ))}
              </div>
            )}

            {attachment && !isRecording && !audioPreviewUrl && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl2 px-3 py-2 mb-2">
                {attachment.kind === 'image' && <img src={attachment.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                {attachment.kind === 'video' && <video src={attachment.previewUrl} className="w-10 h-10 rounded-lg object-cover" />}
                {(attachment.kind === 'audio' || attachment.kind === 'file') && (
                  <Paperclip size={16} className="text-slate-400 shrink-0" />
                )}
                <span className="text-xs text-slate-600 truncate flex-1">{attachment.file.name}</span>
                <button type="button" onClick={clearAttachment} className="text-slate-400 hover:text-red-500 shrink-0" aria-label={t("Retirer la piece jointe")}>
                  <X size={15} />
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />

            {isRecording ? (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl2 px-3.5 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-ember-500 animate-pulse shrink-0" />
                <span className="flex-1 text-sm text-slate-600">{t("Enregistrement... {formatDuration}", { formatDuration: formatDuration(recordDuration) })}</span>
                <button type="button" onClick={cancelRecording} className="text-slate-400 hover:text-red-500 transition-colors" title={t("Annuler")}>
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
                  onClick={send}
                  disabled={isSending || cooldown > 0}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-brand-500 text-white disabled:opacity-60 transition-all hover:shadow-glow shrink-0"
                  title={cooldown > 0 ? t("Mode lent : {cooldown} s", { cooldown }) : t("Envoyer le message vocal")}
                >
                  {isSending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : cooldown > 0 ? (
                    <span className="text-xs font-semibold">{cooldown}</span>
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2 bg-slate-50 rounded-xl2 px-3.5 py-2 transition-all focus-within:bg-surface focus-within:ring-4 focus-within:ring-brand-500/10">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 h-9 flex items-center text-slate-400 hover:text-brand-500 transition-colors"
                  aria-label={t("Joindre un fichier")}
                  title={t("Joindre un fichier")}
                >
                  <Paperclip size={18} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={2000}
                  placeholder={cooldown > 0 ? t("Mode lent : {cooldown} s", { cooldown }) : t("Ecrire dans #{name} (@ pour mentionner)", { name: channel.name })}
                  className="flex-1 min-w-0 resize-none max-h-32 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
                />
                {!text.trim() && !attachment && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="shrink-0 h-9 flex items-center text-slate-400 hover:text-brand-500 transition-colors"
                    title={t("Enregistrer un audio")}
                    aria-label={t("Enregistrer un audio")}
                  >
                    <Mic size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={(!text.trim() && !attachment) || isSending || cooldown > 0}
                  className="w-8 h-8 mb-0.5 rounded-full flex items-center justify-center bg-brand-500 text-white disabled:opacity-40 disabled:grayscale transition-all hover:shadow-glow shrink-0"
                  aria-label={t("Envoyer")}
                >
                  {isSending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : cooldown > 0 ? (
                    <span className="text-xs font-semibold">{cooldown}</span>
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">{t("Vous n'avez pas la permission d'ecrire dans ce salon.")}</p>
        )}
      </div>

      {slowmodeOpen && (
        <SlowmodeModal
          guildId={guildId}
          channel={channel}
          onClose={() => setSlowmodeOpen(false)}
          onSaved={() => {
            setSlowmodeOpen(false);
            onStructureChanged();
          }}
        />
      )}
    </div>
  );
}
