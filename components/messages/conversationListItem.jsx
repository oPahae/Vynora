import VerifiedBadge from '@/components/shared/verifiedBadge';
import { memo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreVertical, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import StatusBadge from '@/components/status/statusBadge';
import { useSocket } from '@/lib/socketContext';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
const TYPE_LABELS = {
  get image() { return t("Photo"); },
  get video() { return t("Video"); },
  get audio() { return t("Message audio"); },
  get file() { return t("Fichier"); }
};

function ConversationListItem({ conversation, status, onArchive, onDelete }) {
  const { user } = useAuth();
  const { onlineUserIds } = useSocket();
  const confirm = useConfirm();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const other = conversation.participants[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!other) return null;

  const isOnline = onlineUserIds.has(other.id);
  const lastMessage = conversation.lastMessage;
  const isMine = lastMessage?.senderId === user?.id;

  let preview = t("Demarrez la conversation");
  if (lastMessage) {
    if (lastMessage.content) preview = lastMessage.content;
    else if (TYPE_LABELS[lastMessage.type]) preview = TYPE_LABELS[lastMessage.type];
  }

  function handleArchiveClick(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsMenuOpen(false);
    onArchive?.(conversation, !conversation.isArchived);
  }

  async function handleDeleteClick(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsMenuOpen(false);
    const confirmed = await confirm({
      title: t("Supprimer cette conversation ?"),
      message: t("Elle sera retiree de votre liste. L'autre personne pourra toujours vous ecrire."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (confirmed) {
      onDelete?.(conversation);
    }
  }

  return (
    <div className="relative group">
      <Link
        href={`/messages/${conversation.id}`}
        className={`flex items-center gap-3 px-4 py-3 pe-12 rounded-2xl transition-colors active:bg-slate-100 ${
          conversation.unreadCount > 0 ? 'bg-brand-50/70 hover:bg-brand-50 shadow-[inset_3px_0_0_0_rgb(var(--spot))]' : 'hover:bg-slate-100/60'
        }`}
      >
        <div className="relative shrink-0">
          <Avatar src={other.avatar} firstName={other.firstName} lastName={other.lastName} size="lg" />
          {isOnline && (
            <span className="absolute bottom-0.5 end-0.5 nx-presence" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {other.firstName} {other.lastName}{other.verified && <VerifiedBadge size={14} />}
            </p>
            {lastMessage && <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(lastMessage.createdAt)}</span>}
          </div>
          {status && <StatusBadge status={status} size="xs" className="mb-0.5" />}
          <p
            className={`text-sm truncate ${
              conversation.unreadCount > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            {isMine && lastMessage ? t("Vous: ") : ''}
            {preview}
          </p>
        </div>

        {conversation.unreadCount > 0 && (
          <span className="shrink-0 nx-badge">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        )}
      </Link>

      <div className="absolute top-1/2 -translate-y-1/2 end-2" ref={menuRef}>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 data-[open=true]:opacity-100"
          data-open={isMenuOpen}
          title={t("Options")}
        >
          <MoreVertical size={16} />
        </button>

        {isMenuOpen && (
          <div className="absolute end-0 top-full mt-1 w-52 nx-pop !rounded-2xl py-1.5 z-30 overflow-hidden">
            <button
              type="button"
              onClick={handleArchiveClick}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {conversation.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              {conversation.isArchived ? t("Desarchiver") : t("Archiver")}
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />{' '}{t("Supprimer")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ConversationListItem);
