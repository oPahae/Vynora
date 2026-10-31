import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ShieldOff, Shield, UploadCloud } from 'lucide-react';
import MessageBubble from '@/components/messages/messageBubble';
import MessageComposer from '@/components/messages/messageComposer';
import TypingIndicator from '@/components/messages/typingIndicator';
import ForwardMessageModal from '@/components/messages/forwardMessageModal';
import { useAuth } from '@/lib/authContext';
import { useSocket } from '@/lib/socketContext';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
const PAGE_SIZE = 20;

export default function ChatWindow({ conversationId, otherUser, initialRelation, onRelationChange }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [seenMessageIds, setSeenMessageIds] = useState(new Set());
  const [relation, setRelation] = useState(
    initialRelation || { blockedByMe: false, blockingMe: false }
  );
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessageId, setForwardingMessageId] = useState(null);

  // Remonte l'etat de blocage a la page (les boutons d'appel de l'en-tete en dependent).
  useEffect(() => {
    if (onRelationChange) onRelationChange(relation);
  }, [relation, onRelationChange]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  // Messages deja presents au chargement : seuls les messages arrives ensuite entrent en animation.
  const knownIds = useRef(new Set());

  const markRead = useCallback(() => {
    fetch(`/api/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
  }, [conversationId]);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages?offset=0&limit=${PAGE_SIZE}`);
      const data = await response.json();
      knownIds.current = new Set(data.success ? data.messages.map((item) => item.id) : []);
      setMessages(data.success ? data.messages : []);
      setHasMore(data.success ? data.hasMore : false);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      markRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.emit('conversation:join', conversationId);

    function handleNewMessage(message) {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (message.senderId !== user?.id) markRead();
    }

    function handleUpdated(update) {
      if (update.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((message) => (message.id === update.id ? { ...message, ...update } : message))
      );
    }

    function handleDeleted(update) {
      if (update.conversationId !== conversationId) return;
      if (update.scope === 'everyone') {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === update.id ? { ...message, deletedForEveryone: true, content: null } : message
          )
        );
      } else {
        setMessages((prev) => prev.filter((message) => message.id !== update.id));
      }
    }

    function handleSeen(update) {
      if (update.conversationId !== conversationId) return;
      // Si j'ai desactive mes accuses de lecture, je ne vois pas non plus
      // ceux des autres (reglage symetrique).
      if (user?.showReadReceipts === false) return;
      setSeenMessageIds((prev) => {
        const next = new Set(prev);
        update.messageIds.forEach((id) => next.add(id));
        return next;
      });
    }

    function handleTypingStart(update) {
      if (update.conversationId === conversationId && update.userId !== user?.id) {
        setIsOtherTyping(true);
      }
    }

    function handleTypingStop(update) {
      if (update.conversationId === conversationId && update.userId !== user?.id) {
        setIsOtherTyping(false);
      }
    }

    function handleBlockChanged(update) {
      if (update.self) {
        // I just blocked/unblocked them from another tab/action
        setRelation((prev) => ({ ...prev, blockedByMe: update.blocked }));
      } else if (update.byUserId === otherUser?.id) {
        // They blocked/unblocked me
        setRelation((prev) => ({ ...prev, blockingMe: update.blocked }));
      }
    }

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleUpdated);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:seen', handleSeen);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('block:changed', handleBlockChanged);

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleUpdated);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:seen', handleSeen);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('block:changed', handleBlockChanged);
    };
  }, [socket, conversationId, user?.id, markRead, otherUser?.id]);

  async function loadMore() {
    if (!containerRef.current) return;
    setIsLoadingMore(true);
    const previousHeight = containerRef.current.scrollHeight;

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?offset=${messages.length}&limit=${PAGE_SIZE}`
      );
      const data = await response.json();
      if (data.success) {
        data.messages.forEach((item) => knownIds.current.add(item.id));
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.hasMore);
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - previousHeight;
          }
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleScroll(event) {
    if (event.target.scrollTop < 80 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }

  function handleSent(message) {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function handleEdit(messageId, content) {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await response.json();
    if (data.success) {
      setMessages((prev) =>
        prev.map((message) => (message.id === messageId ? { ...message, content, isEdited: true } : message))
      );
    }
  }

  async function handleDelete(messageId, scope) {
    const confirmed = await confirm({
      title: scope === 'everyone' ? t("Supprimer pour tout le monde ?") : t("Supprimer ce message ?"),
      message:
        scope === 'everyone'
          ? t("Ce message sera supprime pour tous les participants de la conversation.")
          : t("Ce message ne sera supprime que pour vous."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;

    const response = await fetch(`/api/messages/${messageId}?scope=${scope}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      if (scope === 'everyone') {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId ? { ...message, deletedForEveryone: true, content: null } : message
          )
        );
      } else {
        setMessages((prev) => prev.filter((message) => message.id !== messageId));
      }
    }
  }

  function handleReply(message) {
    setReplyingTo(message);
  }

  function handleForward(message) {
    setForwardingMessageId(message.id);
  }

  async function handleToggleFavorite(message) {
    const nextValue = !message.isFavorite;
    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, isFavorite: nextValue } : item))
    );
    try {
      const response = await fetch(`/api/messages/${message.id}/favorite`, { method: nextValue ? 'PUT' : 'DELETE' });
      const data = await response.json();
      if (!data.success) throw new Error(t("failed"));
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, isFavorite: !nextValue } : item))
      );
    }
  }

  async function handleUnblock() {
    setIsUnblocking(true);
    try {
      const response = await fetch(`/api/block/${otherUser.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setRelation((prev) => ({ ...prev, blockedByMe: false }));
      }
    } finally {
      setIsUnblocking(false);
    }
  }

  const isBlocked = relation.blockedByMe || relation.blockingMe;

  // Le glisser-deposer fonctionne desormais sur toute la zone de discussion
  // (messages + composeur), pas seulement sur l'input : les fichiers deposes
  // sont ajoutes a la liste de pieces jointes du composeur.
  function handleChatDragOver(event) {
    if (isBlocked) return;
    event.preventDefault();
    setIsDraggingOverChat(true);
  }

  function handleChatDragLeave(event) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDraggingOverChat(false);
  }

  function handleChatDrop(event) {
    event.preventDefault();
    setIsDraggingOverChat(false);
    if (isBlocked) return;
    const dropped = Array.from(event.dataTransfer.files || []);
    if (dropped.length > 0) {
      setAttachedFiles((prev) => [...prev, ...dropped]);
    }
  }

  return (
    <div
      className="relative flex flex-col flex-1 min-h-0"
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      {isDraggingOverChat && (
        <div className="absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-brand-400 bg-brand-50/95 text-brand-600 pointer-events-none">
          <UploadCloud size={28} />
          <p className="text-sm font-medium">{t("Deposez vos fichiers pour les envoyer")}</p>
        </div>
      )}

      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-brand-400" />
          </div>
        ) : (
          <>
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 size={16} className="animate-spin text-brand-400" />
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                animateIn={!knownIds.current.has(message.id)}
                isMine={message.senderId === user?.id}
                isSeen={
                  user?.showReadReceipts !== false &&
                  (seenMessageIds.has(message.id) || (message.seenBy && message.seenBy.length > 0))
                }
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReply={handleReply}
                onForward={handleForward}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {isOtherTyping && <TypingIndicator name={otherUser?.firstName || 'Il/elle'} />}

      {relation.blockedByMe && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldOff size={14} className="text-ember-500" />{t("Vous avez bloque {firstName}. Vous ne pouvez plus envoyer ni recevoir de messages.", { firstName: otherUser?.firstName })}</p>
          <button
            onClick={handleUnblock}
            disabled={isUnblocking}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
          >
            {isUnblocking ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}{t("Debloquer")}</button>
        </div>
      )}

      {!relation.blockedByMe && relation.blockingMe && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldOff size={14} className="text-ember-500" />{t("{firstName} vous a bloque. Vous ne pouvez plus lui envoyer de message.", { firstName: otherUser?.firstName })}</p>
        </div>
      )}

      {!isBlocked && (
        <MessageComposer
          conversationId={conversationId}
          onSent={handleSent}
          files={attachedFiles}
          onFilesChange={setAttachedFiles}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

      {forwardingMessageId && (
        <ForwardMessageModal messageId={forwardingMessageId} onClose={() => setForwardingMessageId(null)} />
      )}
    </div>
  );
}
