import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, MoreHorizontal, Pencil, Trash2, Flag, ChevronDown, MessageCircle } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import ReactionButton from '@/components/posts/reactionButton';
import ReportModal from '@/components/reports/reportModal';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { AdminDeleteModal } from '@/components/admin/reasonModal';
import REACTIONS from '@/components/shared/reactionTypes';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t, td } from '@/lib/i18n/runtime';

function CommentRow({ comment, reel, onChanged, onDeleted, onReply, isReply = false }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const [reportOpen, setReportOpen] = useState(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const menuRef = useRef(null);

  const isAuthor = user?.id === comment.author.id;
  const canDelete = isAuthor || user?.id === reel.userId || user?.role === 'admin';
  const activeReaction = REACTIONS.find((r) => r.type === comment.myReaction);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  // Repond depuis un panneau parent : la nouvelle reponse arrive via ce callback.
  useEffect(() => {
    if (!comment.__newReply) return;
    setReplies((prev) => (prev.some((r) => r.id === comment.__newReply.id) ? prev : [...prev, comment.__newReply]));
    setRepliesLoaded(true);
    setRepliesOpen(true);
    onChanged({ ...comment, __newReply: undefined, replyCount: comment.replyCount + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment.__newReply]);

  async function toggleReplies() {
    if (repliesLoaded) {
      setRepliesOpen((prev) => !prev);
      return;
    }
    setRepliesLoading(true);
    try {
      const response = await fetch(`/api/reels/${reel.id}/comments?parentId=${comment.id}&limit=30`);
      const data = await response.json();
      setReplies(data.success ? data.comments : []);
      setRepliesLoaded(true);
      setRepliesOpen(true);
    } finally {
      setRepliesLoading(false);
    }
  }

  async function saveEdit() {
    if (!editValue.trim()) return;
    const response = await fetch(`/api/reel-comments/${comment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editValue })
    });
    const data = await response.json();
    if (data.success) {
      onChanged(data.comment);
      setEditing(false);
    }
  }

  // Un administrateur qui n'est ni l'auteur ni le proprietaire du reel passe
  // par l'API d'administration (motif obligatoire, auteur notifie).
  const isAdminOnlyDelete = user?.role === 'admin' && !isAuthor && user?.id !== reel.userId;

  async function remove() {
    setMenuOpen(false);
    if (isAdminOnlyDelete) {
      setAdminDeleteOpen(true);
      return;
    }
    const ok = await confirm({
      title: t("Supprimer ce commentaire ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!ok) return;
    const response = await fetch(`/api/reel-comments/${comment.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) onDeleted(comment.id);
  }

  return (
    <div className="flex items-start gap-2.5">
      <Link href={`/profile/${comment.author.id}`} className="shrink-0">
        <Avatar src={comment.author.avatar} firstName={comment.author.firstName} lastName={comment.author.lastName} size={isReply ? 'xs' : 'sm'} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link href={`/profile/${comment.author.id}`} className="text-[13px] font-semibold text-slate-900 truncate">
            {comment.author.firstName} {comment.author.lastName}
            {comment.author.verified && <VerifiedBadge size={12} />}
          </Link>
          {comment.author.id === reel.userId && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">{t("Auteur")}</span>
          )}
          <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(comment.createdAt)}</span>
          {comment.isEdited && <span className="text-xs text-slate-400">{t("Modifie")}</span>}
        </div>

        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              autoFocus
              value={editValue}
              maxLength={1000}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && saveEdit()}
              className="flex-1 min-w-0 text-sm rounded-xl2 border border-slate-200 bg-surface px-3 py-1.5 outline-none focus:border-brand-400"
            />
            <button onClick={saveEdit} className="text-xs text-brand-600 font-medium">{t("Enregistrer")}</button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-400">{t("Annuler")}</button>
          </div>
        ) : (
          <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
        )}

        <div className="flex items-center gap-x-3 mt-1 -ms-1 text-xs text-slate-400">
          <ReactionButton
            targetType="reelComment"
            targetId={comment.id}
            myReaction={comment.myReaction}
            onChange={(reaction, aggregates) => onChanged({ ...comment, myReaction: reaction, ...aggregates })}
          />
          {comment.totalReactions > 0 && (
            <span className="flex items-center gap-1 text-slate-500 -ms-1">
              {activeReaction && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: activeReaction.color }}>
                  <activeReaction.icon size={9} className="text-white" strokeWidth={3} />
                </span>
              )}
              {comment.totalReactions}
            </span>
          )}
          <button onClick={() => onReply(comment)} className="font-medium hover:text-slate-600">{t("Repondre")}</button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((prev) => !prev)} className="hover:text-slate-600 p-1" aria-label="menu">
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute start-0 bottom-full mb-1 w-40 nx-pop !rounded-xl2 py-1 z-30 overflow-hidden">
                {isAuthor && (
                  <button onClick={() => { setMenuOpen(false); setEditing(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <Pencil size={12} /> {t("Modifier")}
                  </button>
                )}
                {canDelete && (
                  <button onClick={remove} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 size={12} /> {t("Supprimer")}
                  </button>
                )}
                {!isAuthor && (
                  <button onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <Flag size={12} /> {t("Signaler")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {comment.replyCount > 0 && !isReply && (
          <button onClick={toggleReplies} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mt-1.5">
            <ChevronDown size={13} className={`transition-transform ${repliesOpen ? 'rotate-180' : ''}`} />
            {repliesLoading ? t("Chargement...") : repliesOpen ? t("Masquer les reponses") : t("Voir {replyCount} reponses", { replyCount: comment.replyCount })}
          </button>
        )}

        {repliesOpen && replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                reel={reel}
                isReply
                onReply={() => onReply(comment, reply)}
                onChanged={(updated) => setReplies((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                onDeleted={(id) => {
                  setReplies((prev) => prev.filter((r) => r.id !== id));
                  onChanged({ ...comment, replyCount: Math.max(0, comment.replyCount - 1) });
                }}
              />
            ))}
          </div>
        )}
      </div>
 <AnimatePresence>
        {adminDeleteOpen && (
          <AdminDeleteModal
            type="reelComment"
            id={comment.id}
            title={t("Supprimer ce commentaire de reel ?")}
            onClose={() => setAdminDeleteOpen(false)}
            onDeleted={() => {
              setAdminDeleteOpen(false);
              onDeleted(comment.id);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reportOpen && <ReportModal targetType="reelComment" targetId={comment.id} onClose={() => setReportOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

const MemoRow = memo(CommentRow);

// Panneau de commentaires d'un reel : "feuille" qui monte depuis le bas du reel.
export default function ReelComments({ reel, onClose, onCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [sort, setSort] = useState('top');
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null); // { root, to }
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reels/${reel.id}/comments?sort=${sort}&limit=15`);
      const data = await response.json();
      setComments(data.success ? data.comments : []);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setIsLoading(false);
    }
  }, [reel.id, sort]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/reels/${reel.id}/comments?sort=${sort}&limit=15&offset=${comments.length}`);
      const data = await response.json();
      if (data.success) {
        setComments((prev) => [...prev, ...data.comments.filter((c) => !prev.some((p) => p.id === c.id))]);
        setHasMore(Boolean(data.hasMore));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  function startReply(root, to) {
    setReplyTarget({ root, to: to || root });
    const target = to || root;
    setText(`@${target.author.firstName} `);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function send(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const response = await fetch(`/api/reels/${reel.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId: replyTarget ? replyTarget.to.id : null })
      });
      const data = await response.json();
      if (!data.success) {
        setError(td(data.message) || t("Une erreur est survenue"));
        return;
      }
      if (replyTarget) {
        const rootId = replyTarget.root.id;
        setComments((prev) => prev.map((c) => (c.id === rootId ? { ...c, __newReply: data.comment } : c)));
      } else {
        setComments((prev) => [data.comment, ...prev]);
      }
      onCountChange(1);
      setText('');
      setReplyTarget(null);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="absolute inset-x-0 bottom-0 z-30 h-[74%] bg-surface rounded-t-[28px] shadow-pop flex flex-col"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-slate-900">
            {t("Commentaires")} <span className="text-slate-400 font-normal">{reel.commentCount}</span>
          </h3>
          <div className="flex bg-slate-100 rounded-full p-0.5 text-xs">
            {[{ key: 'top', label: t("Populaires") }, { key: 'new', label: t("Recents") }].map((option) => (
              <button
                key={option.key}
                onClick={() => setSort(option.key)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${sort === option.key ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="nx-icon-btn w-8 h-8 text-slate-400" aria-label={t("Fermer")}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-400" /></div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <MessageCircle size={32} className="mx-auto mb-2 opacity-60" />
            <p className="text-sm">{t("Aucun commentaire. Soyez le premier !")}</p>
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <MemoRow
                key={comment.id}
                comment={comment}
                reel={reel}
                onReply={startReply}
                onChanged={(updated) => setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))}
                onDeleted={(id) => {
                  const removed = comments.find((c) => c.id === id);
                  setComments((prev) => prev.filter((c) => c.id !== id));
                  onCountChange(-(1 + (removed ? removed.replyCount : 0)));
                }}
              />
            ))}
            {hasMore && (
              <button onClick={loadMore} disabled={isLoadingMore} className="w-full text-sm text-brand-600 font-medium py-2">
                {isLoadingMore ? <Loader2 size={16} className="animate-spin mx-auto" /> : t("Voir plus de commentaires")}
              </button>
            )}
          </>
        )}
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-slate-100 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {replyTarget && (
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
            <span>{t("Reponse a {name}", { name: replyTarget.to.author.firstName })}</span>
            <button type="button" onClick={() => { setReplyTarget(null); setText(''); }} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-500 mb-1.5 px-1">{error}</p>}
        <div className="flex items-center gap-2.5">
          <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="sm" />
          <input
            ref={inputRef}
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("Ajouter un commentaire...")}
            className="flex-1 min-w-0 h-10 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
          <button
            type="submit"
            disabled={!text.trim() || isSending}
            className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
            aria-label={t("Envoyer")}
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
