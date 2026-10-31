import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Pencil, Trash2, Link2, MessageCircle, Check, Share2, Bookmark, BookmarkCheck, Pin, PinOff, MapPin, Flag, FolderPlus, ShieldAlert, Rocket, Sparkles } from 'lucide-react';
import { useRouter } from 'next/router';
import Avatar from '@/components/shared/avatar';
import VISIBILITY_META from '@/components/shared/visibilityMeta';
import MediaGrid from '@/components/posts/mediaGrid';
import PostStatsBar from '@/components/posts/postStatsBar';
import ReactionButton from '@/components/posts/reactionButton';
import EditPostModal from '@/components/posts/editPostModal';
import ShareModal from '@/components/posts/shareModal';
import EmbeddedPostCard from '@/components/posts/embeddedPostCard';
import PostContent from '@/components/posts/postContent';
import CommentSection from '@/components/comments/commentSection';
import ReportModal from '@/components/reports/reportModal';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import { AdminDeleteModal } from '@/components/admin/reasonModal';
import AddToCollectionModal from '@/components/collections/addToCollectionModal';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
function PostCard({ post, onUpdated, onDeleted, onShared, onUnpinned, onUnsaved }) {
  const router = useRouter();
  const [boostBusy, setBoostBusy] = useState(false);
  const { user } = useAuth();
  const confirm = useConfirm();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(typeof post.savedAt !== 'undefined' ? true : null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPinned, setIsPinned] = useState(Boolean(post.isPinned));
  const [isPinning, setIsPinning] = useState(false);
  const [pinError, setPinError] = useState('');
  const isOwner = user?.id === post.userId;
  const isAdmin = user?.role === 'admin';
  const VisibilityIcon = VISIBILITY_META[post.visibility]?.icon;
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOwner) {
      fetch(`/api/posts/${post.id}/view`, { method: 'POST' }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

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

  useEffect(() => {
    if (!isMenuOpen || isSaved !== null) return;
    fetch(`/api/posts/${post.id}/save`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setIsSaved(data.saved);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  async function handleToggleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/posts/${post.id}/save`, { method: isSaved ? 'DELETE' : 'POST' });
      const data = await response.json();
      if (data.success) {
        setIsSaved(data.saved);
        if (!data.saved && onUnsaved) onUnsaved(post.id);
      }
    } finally {
      setIsSaving(false);
      setIsMenuOpen(false);
    }
  }

  // Boost (premium) : met la publication en avant dans les fils. Sans premium,
  // l'API repond 402 et on envoie l'utilisateur vers la page Premium.
  async function handleToggleBoost() {
    setBoostBusy(true);
    setPinError('');
    try {
      const response = await fetch(`/api/posts/${post.id}/boost`, { method: post.boostedUntil ? 'DELETE' : 'POST' });
      const data = await response.json();
      if (data.success) {
        onUpdated({ ...post, boostedUntil: data.boostedUntil });
        setIsMenuOpen(false);
      } else if (data.premiumRequired) {
        router.push('/premium');
      } else {
        setPinError(data.message || t("Action impossible"));
      }
    } finally {
      setBoostBusy(false);
    }
  }

  async function handleTogglePin() {
    setIsPinning(true);
    setPinError('');
    try {
      const response = await fetch(`/api/posts/${post.id}/pin`, { method: isPinned ? 'DELETE' : 'POST' });
      const data = await response.json();
      if (data.success) {
        setIsPinned(data.pinned);
        setIsMenuOpen(false);
        if (!data.pinned && onUnpinned) onUnpinned(post.id);
      } else {
        setPinError(data.message || t("Action impossible"));
      }
    } finally {
      setIsPinning(false);
    }
  }

  async function handleDelete() {
    setIsMenuOpen(false);
    const confirmed = await confirm({
      title: t("Supprimer cette publication ?"),
      message: t("Cette action est definitive et ne peut pas etre annulee."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;

    const response = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) onDeleted(post.id);
  }

  function handleCopyLink() {
    setIsMenuOpen(false);
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleReactionChange(newReaction, aggregates) {
    onUpdated({ ...post, myReaction: newReaction, ...aggregates });
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="nx-card nx-spot p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3 group min-w-0">
          <Avatar
            src={post.author.avatar}
            firstName={post.author.firstName}
            lastName={post.author.lastName}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-[0.95rem] font-semibold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug">
              {post.author.firstName} {post.author.lastName}
              {post.author.verified && <VerifiedBadge />}
              {post.kind === 'avatar' && (
                <span className="font-normal text-slate-500">{' '}{t("a mis a jour sa photo de profil")}</span>
              )}
              {post.kind === 'cover' && (
                <span className="font-normal text-slate-500">{' '}{t("a mis a jour sa photo de couverture")}</span>
              )}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
              {isPinned && (
                <span className="flex items-center gap-1 text-brand-600 bg-brand-50 rounded-full px-2 py-0.5 font-medium">
                  <Pin size={11} />{' '}{t("Epingle ·").replace(/\s*·\s*$/, '')}</span>
              )}
              {post.boostedUntil && (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 font-medium">
                  <Sparkles size={11} />{' '}{isOwner ? t("Boost actif") : t("Mis en avant")}
                </span>
              )}
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.isEdited && <span>{t("· Modifie")}</span>}
              {post.location && (
                <span className="flex items-center gap-0.5 truncate">
                  · <MapPin size={11} className="shrink-0" /> {post.location}
                </span>
              )}
              {VisibilityIcon && <VisibilityIcon size={12} />}
            </div>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="nx-icon-btn w-9 h-9 -me-1.5 text-slate-400"
            aria-label={t("Modifier")}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <MoreHorizontal size={18} />
          </button>

          <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              className="absolute end-0 mt-1 w-56 nx-pop rounded-2xl p-1.5 z-20 origin-top-right"
              role="menu"
            >
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {linkCopied ? <Check size={15} className="text-emerald-500" /> : <Link2 size={15} />}
                {linkCopied ? t("Lien copie") : t("Copier le lien")}
              </button>
              <button
                onClick={handleToggleSave}
                disabled={isSaving}
                className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
              >
                {isSaved ? <BookmarkCheck size={15} className="text-brand-500" /> : <Bookmark size={15} />}
                {isSaved ? t("Retirer des enregistrements") : t("Enregistrer")}
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsCollectionOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FolderPlus size={15} />
                {t("Ajouter a une collection")}
              </button>
              {!isOwner && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReportOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Flag size={15} />
                  {t("Signaler")}
                </button>
              )}
              {!isOwner && isAdmin && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsAdminDeleteOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-ember-600 hover:bg-ember-50 transition-colors"
                >
                  <ShieldAlert size={15} />
                  {t("Supprimer (admin)")}
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={handleTogglePin}
                    disabled={isPinning}
                    className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
                  >
                    {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                    {isPinned ? t("Desepingler") : t("Epingler sur le profil")}
                  </button>
                  {post.visibility === 'public' && !post.groupId && (
                    <button
                      onClick={handleToggleBoost}
                      disabled={boostBusy}
                      className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
                    >
                      <Rocket size={15} className="text-amber-500" />
                      {post.boostedUntil ? t("Arreter le boost") : t("Booster la publication")}
                    </button>
                  )}
                  {pinError && <p className="px-3 pb-1 text-xs text-ember-600">{pinError}</p>}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil size={15} />{' '}{t("Modifier")}</button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm text-ember-600 hover:bg-ember-50 transition-colors"
                  >
                    <Trash2 size={15} />{' '}{t("Supprimer")}</button>
                </>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {post.content && (
        <div className="mt-3.5">
          <PostContent content={post.content} mentions={post.mentions} />
        </div>
      )}

      {post.sharedPostId && (
        <div className="mt-3">
          <EmbeddedPostCard post={post.sharedPost} />
        </div>
      )}

      {post.media.length > 0 && (
        <div className="mt-3">
          <MediaGrid media={post.media} />
        </div>
      )}

      <div className="mt-0.5">
        <PostStatsBar
          postId={post.id}
          reactionsByType={post.reactionsByType}
          totalReactions={post.totalReactions}
          commentCount={post.commentCount}
          shareCount={post.shareCount}
          viewsCount={post.viewsCount}
        />
      </div>

      <div className="flex items-stretch gap-1 pt-2 border-t border-slate-200/60 -mx-1 text-slate-500">
        <div className="flex-1 min-w-0 flex justify-center">
          <ReactionButton targetType="post" targetId={post.id} myReaction={post.myReaction} onChange={handleReactionChange} />
        </div>
        <button
          onClick={() => setShowComments((prev) => !prev)}
          aria-expanded={showComments}
          className={`group flex-1 min-w-0 flex items-center justify-center gap-2 text-sm font-medium h-10 px-3 rounded-xl2 hover:bg-brand-50 hover:text-brand-600 active:scale-[0.94] transition-[transform,background-color,color] duration-200 ease-spring-soft ${showComments ? 'bg-brand-50 text-brand-600' : ''}`}
        >
          <MessageCircle size={18} strokeWidth={2} className="shrink-0 transition-transform duration-300 ease-spring-soft group-hover:-rotate-12 group-hover:scale-110" fill={showComments ? 'currentColor' : 'none'} fillOpacity={0.15} /> <span className="truncate">{t("Commenter")}</span>
        </button>
        <button
          onClick={() => setIsShareOpen(true)}
          className={`group flex-1 min-w-0 flex items-center justify-center gap-2 text-sm font-medium h-10 px-3 rounded-xl2 hover:bg-brand-50 hover:text-brand-600 active:scale-[0.94] transition-[transform,background-color,color] duration-200 ease-spring-soft`}
        >
          <Share2 size={18} strokeWidth={2} className="shrink-0 transition-transform duration-300 ease-spring-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-110" /> <span className="truncate">{t("Partager")}</span>
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <CommentSection
            postId={post.id}
            onCommentCountChange={(delta) => onUpdated({ ...post, commentCount: post.commentCount + delta })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditOpen && (
          <EditPostModal
            post={post}
            onClose={() => setIsEditOpen(false)}
            onSaved={(updated) => {
              onUpdated(updated);
              setIsEditOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShareOpen && (
          <ShareModal
            post={post}
            onClose={() => setIsShareOpen(false)}
            onShared={(newPost) => {
              onUpdated({ ...post, shareCount: post.shareCount + 1 });
              if (onShared) onShared(newPost);
              setIsShareOpen(false);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAdminDeleteOpen && (
          <AdminDeleteModal
            type="post"
            id={post.id}
            title={t("Supprimer cette publication ?")}
            onClose={() => setIsAdminDeleteOpen(false)}
            onDeleted={() => {
              setIsAdminDeleteOpen(false);
              onDeleted(post.id);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isReportOpen && <ReportModal targetType="post" targetId={post.id} onClose={() => setIsReportOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isCollectionOpen && <AddToCollectionModal itemType="post" itemId={post.id} onClose={() => setIsCollectionOpen(false)} />}
      </AnimatePresence>
    </motion.article>
  );
}

export default memo(PostCard);
