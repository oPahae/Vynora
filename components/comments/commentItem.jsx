import { useState, useRef, useEffect, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Pencil, Trash2, MoreHorizontal, ChevronDown, Flag } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ReportModal from '@/components/reports/reportModal';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { AdminDeleteModal } from '@/components/admin/reasonModal';
import Avatar from '@/components/shared/avatar';
import ReactionButton from '@/components/posts/reactionButton';
import CommentComposer from '@/components/comments/commentComposer';
import PostContent from '@/components/posts/postContent';
import MentionTextarea from '@/components/posts/mentionTextarea';
import AudioPlayer from '@/components/messages/audioPlayer';
import REACTIONS from '@/components/shared/reactionTypes';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
function CommentItem({ postId, comment, onUpdated, onDeleted }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isOwner = user?.id === comment.author.id;
  const isAdmin = user?.role === 'admin';
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content || '');
  const [editMentions, setEditMentions] = useState(comment.mentions || []);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
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

  const activeReaction = REACTIONS.find((reaction) => reaction.type === comment.myReaction);

  async function loadReplies() {
    if (repliesLoaded) {
      setRepliesOpen((prev) => !prev);
      return;
    }
    setIsLoadingReplies(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}/replies`);
      const data = await response.json();
      setReplies(data.success ? data.replies : []);
      setRepliesLoaded(true);
      setRepliesOpen(true);
    } finally {
      setIsLoadingReplies(false);
    }
  }

  async function handleSaveEdit() {
    if (!editValue.trim() && !comment.mediaUrl) return;
    const response = await fetch(`/api/comments/${comment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editValue.trim(),
        mentions: editMentions
          .filter((mentioned) => editValue.includes(`@${mentioned.firstName} ${mentioned.lastName}`))
          .map((mentioned) => mentioned.id)
      })
    });
    const data = await response.json();
    if (data.success) {
      onUpdated(comment.id, data.comment);
      setIsEditing(false);
    }
  }

  async function handleDelete() {
    setIsMenuOpen(false);
    const confirmed = await confirm({
      title: t("Supprimer ce commentaire ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;
    const response = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) onDeleted(comment.id);
  }

  function handleReactionChange(newReaction, aggregates) {
    onUpdated(comment.id, { ...comment, myReaction: newReaction, ...aggregates });
  }

  function handleReplyCreated(reply) {
    setReplies((prev) => [...prev, reply]);
    setRepliesLoaded(true);
    setRepliesOpen(true);
    setShowReplyBox(false);
    onUpdated(comment.id, { ...comment, replyCount: comment.replyCount + 1 });
  }

  function handleReplyUpdated(replyId, updated) {
    setReplies((prev) => prev.map((reply) => (reply.id === replyId ? updated : reply)));
  }

  function handleReplyDeleted(replyId) {
    setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
    onUpdated(comment.id, { ...comment, replyCount: Math.max(0, comment.replyCount - 1) });
  }

  return (
    <div className="flex items-start gap-2.5">
      <Link href={`/profile/${comment.author.id}`} className="shrink-0">
        <Avatar src={comment.author.avatar} firstName={comment.author.firstName} lastName={comment.author.lastName} size="sm" />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="inline-block bg-slate-50 rounded-xl2 px-3.5 py-2 max-w-full">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${comment.author.id}`} className="text-xs font-semibold text-slate-800">
              {comment.author.firstName} {comment.author.lastName}
              {comment.author.verified && <VerifiedBadge size={13} />}
            </Link>
          </div>

          {isEditing ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[120px]">
                <MentionTextarea
                  multiline={false}
                  value={editValue}
                  onChange={setEditValue}
                  mentionedUsers={editMentions}
                  onMentionedUsersChange={setEditMentions}
                  onSubmitKey={handleSaveEdit}
                  autoFocus
                  inputClassName="w-full text-sm bg-surface border border-slate-200 rounded-xl2 px-2.5 py-1.5 outline-none focus:border-brand-400"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleSaveEdit} className="text-xs text-brand-600 font-medium whitespace-nowrap">{t("Enregistrer")}</button>
                <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 whitespace-nowrap">{t("Annuler")}</button>
              </div>
            </div>
          ) : (
            <>
              {comment.content && (
                <div className="mt-0.5 break-words">
                  <PostContent content={comment.content} mentions={comment.mentions || []} />
                </div>
              )}
              {comment.mediaUrl && comment.mediaType === 'image' && (
                <div className="relative w-40 h-40 mt-1.5 rounded-xl2 overflow-hidden">
                  <Image src={comment.mediaUrl} alt={t("Media du commentaire")} fill className="object-cover" />
                </div>
              )}
              {comment.mediaUrl && comment.mediaType === 'video' && (
                <video src={comment.mediaUrl} controls className="w-full max-w-[224px] mt-1.5 rounded-xl2" />
              )}
              {comment.mediaUrl && comment.mediaType === 'audio' && (
                <div className="mt-1.5 w-full max-w-[260px] bg-surface rounded-xl2 px-3 py-2 border border-slate-100">
                  <AudioPlayer src={comment.mediaUrl} tone="light" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 ms-1 text-xs text-slate-400">
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {comment.isEdited && <span>{t("Modifie")}</span>}
          <ReactionButton
            targetType="comment"
            targetId={comment.id}
            myReaction={comment.myReaction}
            onChange={handleReactionChange}
          />
          {comment.totalReactions > 0 && activeReaction && (
            <span className="flex items-center gap-1 text-slate-500">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: activeReaction.color }}
              >
                <activeReaction.icon size={11} className="text-white" strokeWidth={3} />
              </span>
              {comment.totalReactions}
            </span>
          )}
          <button onClick={() => setShowReplyBox((prev) => !prev)} className="font-medium hover:text-slate-600">{t("Repondre")}</button>
          {user && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen((prev) => !prev)} className="hover:text-slate-600">
                <MoreHorizontal size={14} />
              </button>
              {isMenuOpen && (
                <div className="absolute end-0 mt-1 w-36 bg-surface rounded-xl2 shadow-card border border-slate-100 py-1 z-20 overflow-hidden">
{isOwner && (                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditing(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={12} />{' '}{t("Modifier")}</button>)}
{(isOwner || isAdmin) && (                  <button
                    onClick={isOwner ? handleDelete : () => { setIsMenuOpen(false); setIsAdminDeleteOpen(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={12} />{' '}{t("Supprimer")}</button>)}
                  {!isOwner && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsReportOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Flag size={12} />{' '}{t("Signaler")}</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {comment.replyCount > 0 && (
          <button
            onClick={loadReplies}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mt-2 ms-1"
          >
            <ChevronDown size={13} className={`transition-transform ${repliesOpen ? 'rotate-180' : ''}`} />
            {isLoadingReplies ? t("Chargement...") : repliesOpen ? t("Masquer les reponses") : t("Voir {replyCount} reponses", { replyCount: comment.replyCount })}
          </button>
        )}

        {repliesOpen && replies.length > 0 && (
          <div className="mt-3 ms-2 ps-3 border-s-2 border-slate-100 space-y-3">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                postId={postId}
                comment={reply}
                onUpdated={handleReplyUpdated}
                onDeleted={handleReplyDeleted}
              />
            ))}
          </div>
        )}

        {showReplyBox && (
          <div className="mt-2 ms-1">
            <CommentComposer
              postId={postId}
              parentId={comment.id}
              placeholder={t("Repondre a {firstName}...", { firstName: comment.author.firstName })}
              autoFocus
              onCreated={handleReplyCreated}
            />
          </div>
        )}
      </div>
      <AnimatePresence>
        {isAdminDeleteOpen && (
          <AdminDeleteModal
            type="comment"
            id={comment.id}
            title={t("Supprimer ce commentaire ?")}
            onClose={() => setIsAdminDeleteOpen(false)}
            onDeleted={() => {
              setIsAdminDeleteOpen(false);
              onDeleted(comment.id);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isReportOpen && <ReportModal targetType="comment" targetId={comment.id} onClose={() => setIsReportOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default memo(CommentItem);
