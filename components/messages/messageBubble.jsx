import { useState, useEffect, useRef, memo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  Download,
  Copy,
  Reply,
  Forward,
  Star,
  CornerUpLeft
} from 'lucide-react';
import { downloadUrl } from '@/lib/downloadUrl';
import { useToast } from '@/lib/toastContext';
import AudioPlayer from '@/components/messages/audioPlayer';

import { t, formatTime as formatLocalTime } from '@/lib/i18n/runtime';
function formatTime(dateString) {
  return formatLocalTime(dateString.replace(' ', 'T'));
}

function replyPreviewLabel(replyTo) {
  if (!replyTo) return '';
  if (replyTo.deletedForEveryone) return t("Message supprime");
  if (replyTo.type === 'text') return replyTo.content || '';
  if (replyTo.type === 'image') return t("Photo");
  if (replyTo.type === 'video') return t("Video");
  if (replyTo.type === 'audio') return t("Message vocal");
  return replyTo.fileName || t("Fichier");
}

// Panneau d'actions : il s'ouvre en ressort depuis le bouton et se ferme sans disparaitre brutalement.
function MenuPanel({ className, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Sur tactile il n'y a pas de survol : le bouton d'actions reste donc visible (discret).
const ACTION_VISIBILITY = 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-60 transition-opacity';

function MessageBubble({ message, isMine, isSeen, animateIn, onEdit, onDelete, onReply, onForward, onToggleFavorite }) {
  const { showToast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content || '');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  function handleSaveEdit() {
    if (!editValue.trim()) return;
    onEdit(message.id, editValue.trim());
    setIsEditing(false);
  }

  async function handleCopy() {
    setIsMenuOpen(false);
    try {
      const textToCopy = message.type === 'text' ? message.content : message.fileName || '';
      await navigator.clipboard.writeText(textToCopy || '');
    } catch (error) {
      showToast({ title: t("Impossible de copier le message"), type: 'error', playSound: false });
    }
  }

  function handleReplyClick() {
    setIsMenuOpen(false);
    if (onReply) onReply(message);
  }

  function handleForwardClick() {
    setIsMenuOpen(false);
    if (onForward) onForward(message);
  }

  function handleFavoriteClick() {
    setIsMenuOpen(false);
    if (onToggleFavorite) onToggleFavorite(message);
  }

  const sharedMenuItems = (
    <>
      {message.type === 'text' && (
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
        >
          <Copy size={12} />{' '}{t("Copier")}</button>
      )}
      <button
        onClick={handleReplyClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
      >
        <Reply size={12} />{' '}{t("Repondre")}</button>
      <button
        onClick={handleForwardClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
      >
        <Forward size={12} />{' '}{t("Transferer")}</button>
      <button
        onClick={handleFavoriteClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
      >
        <Star
          size={12}
          fill={message.isFavorite ? 'currentColor' : 'none'}
          className={message.isFavorite ? 'text-amber-500' : ''}
        />
        {message.isFavorite ? t("Retirer des favoris") : t("Ajouter aux favoris")}
      </button>
    </>
  );

  if (message.deletedForEveryone) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-400 text-sm italic">{t("Message supprime")}</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 16, scale: 0.92, x: isMine ? 18 : -18 } : false}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30, mass: 0.7 }}
      style={{ transformOrigin: 'bottom center' }}
      className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      {isMine && (
        <div className={`relative ${ACTION_VISIBILITY}`} ref={menuRef}>
          <button onClick={() => setIsMenuOpen((prev) => !prev)} className="text-slate-300 hover:text-slate-500">
            <MoreHorizontal size={16} />
          </button>
          <AnimatePresence>
          {isMenuOpen && (
            <MenuPanel className="absolute bottom-6 end-0 w-44 nx-pop !rounded-2xl py-1 z-20 overflow-hidden origin-bottom-right">
              {sharedMenuItems}
              {message.type === 'text' && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditing(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={12} />{' '}{t("Modifier")}</button>
              )}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete(message.id, 'me');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Trash2 size={12} />{' '}{t("Supprimer pour moi")}</button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete(message.id, 'everyone');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} />{' '}{t("Supprimer pour tous")}</button>
            </MenuPanel>
          )}
          </AnimatePresence>
        </div>
      )}

      <div
        className={`max-w-[82%] sm:max-w-sm rounded-[20px] px-4 py-2.5 ${
          isMine ? 'nx-bubble-own rounded-ee-md' : 'nx-bubble-other text-slate-800 rounded-es-md'
        }`}
      >
        {message.replyTo && (
          <div
            className={`flex items-start gap-1.5 mb-1.5 px-2 py-1.5 rounded-lg border-s-2 text-xs ${
              isMine ? 'bg-white/15 border-white/60 text-white/85' : 'bg-surface border-brand-400 text-slate-500'
            }`}
          >
            <CornerUpLeft size={11} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className={`font-medium truncate ${isMine ? 'text-white' : 'text-slate-700'}`}>
                {message.replyTo.senderName}
              </p>
              <p className="truncate opacity-90">{replyPreviewLabel(message.replyTo)}</p>
            </div>
          </div>
        )}

        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              className="bg-white/20 rounded-lg px-2 py-1 text-sm outline-none placeholder:text-white/60"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="text-xs font-medium">{t("OK")}</button>
          </div>
        ) : (
          <>
            {message.type === 'text' && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
            {message.type === 'image' && (
              <div className="relative w-52 h-52 rounded-lg overflow-hidden group">
                <Image src={message.fileUrl} alt={t("Image")} fill className="object-cover" />
                <a
                  href={downloadUrl(message.fileUrl, message.fileName)}
                  download
                  title={t("Telecharger")}
                  className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-ink/60 hover:bg-ink/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download size={13} />
                </a>
              </div>
            )}
            {message.type === 'video' && (
              <div className="relative w-64 rounded-lg overflow-hidden group">
                <video src={message.fileUrl} controls className="w-64 rounded-lg" />
                <a
                  href={downloadUrl(message.fileUrl, message.fileName)}
                  download
                  title={t("Telecharger")}
                  className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-ink/60 hover:bg-ink/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
                >
                  <Download size={13} />
                </a>
              </div>
            )}
            {message.type === 'audio' && (
              <div className="flex items-center gap-2">
                <AudioPlayer src={message.fileUrl} tone={isMine ? 'dark' : 'light'} />
                <a
                  href={downloadUrl(message.fileUrl, message.fileName)}
                  download
                  title={t("Telecharger")}
                  className={`shrink-0 hover:opacity-80 transition-opacity ${
                    isMine ? 'text-white/80' : 'text-slate-500'
                  }`}
                >
                  <Download size={15} />
                </a>
              </div>
            )}
            {message.type === 'file' && (
              <a
                href={downloadUrl(message.fileUrl, message.fileName)}
                download
                className="flex items-center gap-1.5 text-sm underline"
              >
                <Download size={13} className="shrink-0" />
                {message.fileName || t("Fichier joint")}
              </a>
            )}
          </>
        )}

        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
          {message.isFavorite && <Star size={10} fill="currentColor" className="text-amber-400 shrink-0" />}
          <span>{formatTime(message.createdAt)}</span>
          {message.isEdited && <span>{t("· Modifie")}</span>}
          {isMine && (isSeen ? <CheckCheck size={12} /> : <Check size={12} />)}
        </div>
      </div>

      {!isMine && (
        <div className={`relative ${ACTION_VISIBILITY}`} ref={menuRef}>
          <button onClick={() => setIsMenuOpen((prev) => !prev)} className="text-slate-300 hover:text-slate-500">
            <MoreHorizontal size={16} />
          </button>
          <AnimatePresence>
          {isMenuOpen && (
            <MenuPanel className="absolute bottom-6 start-0 w-44 nx-pop !rounded-2xl py-1 z-20 overflow-hidden origin-bottom-left">
              {sharedMenuItems}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete(message.id, 'me');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Trash2 size={12} />{' '}{t("Supprimer pour moi")}</button>
            </MenuPanel>
          )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

export default memo(MessageBubble);
