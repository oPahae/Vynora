import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Trash2, Eye, Send, Loader2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import ReactionButton from '@/components/posts/reactionButton';
import PeopleListModal from '@/components/posts/peopleListModal';
import REACTIONS from '@/components/shared/reactionTypes';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
const TEXT_DURATION_MS = 5000;

export default function StoryViewer({ groups, initialGroupIndex, onClose, onDeleted }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isViewersOpen, setIsViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [localReaction, setLocalReaction] = useState(null);
  const [localTotalReactions, setLocalTotalReactions] = useState(0);
  const videoRef = useRef(null);
  const startRef = useRef(null);
  const pausedAtRef = useRef(0);
  const frameRef = useRef(null);
  const isPausedRef = useRef(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwner = story?.author.id === user?.id;

  const goNext = useCallback(() => {
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, group, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
    } else if (groupIndex > 0) {
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, groupIndex]);

  useEffect(() => {
    if (!story) return undefined;

    if (!isOwner) {
      fetch(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
    }

    setProgress(0);
    pausedAtRef.current = 0;
    startRef.current = performance.now();

    if (story.type === 'video') {
      return undefined;
    }

    function tick(now) {
      const elapsed = pausedAtRef.current + (isPausedRef.current ? 0 : now - startRef.current);
      const ratio = Math.min(elapsed / TEXT_DURATION_MS, 1);
      setProgress(ratio * 100);
      if (ratio >= 1) {
        goNext();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (story?.type !== 'video' || !videoRef.current) return undefined;
    const video = videoRef.current;

    function handleTimeUpdate() {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100);
    }
    function handleEnded() {
      goNext();
    }

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    if (story?.type === 'video' && videoRef.current) {
      if (isPaused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  }, [isPaused, story?.id, story?.type]);

  function handlePressStart() {
    setIsPaused(true);
    pausedAtRef.current += performance.now() - startRef.current;
  }

  function handlePressEnd() {
    setIsPaused(false);
    startRef.current = performance.now();
  }

  // Pause pendant la saisie d'une reponse (sans cumuler les pauses).
  function pauseForInput() {
    if (!isPausedRef.current) handlePressStart();
  }

  function resumeAfterInput() {
    if (isPausedRef.current) handlePressEnd();
  }

  // Les brouillons de reponse ne suivent pas d'une story a l'autre.
  useEffect(() => {
    setReplyText('');
  }, [story?.id]);

  async function handleReply(event) {
    event.preventDefault();
    const content = replyText.trim();
    if (!content || isReplying) return;
    setIsReplying(true);
    try {
      const response = await fetch(`/api/stories/${story.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (data.success) {
        setReplyText('');
        showToast({ title: t("Reponse envoyee en message prive"), type: 'success', playSound: false });
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        resumeAfterInput();
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error', playSound: false });
      }
    } catch (error) {
      showToast({ title: t("Impossible de contacter le serveur"), type: 'error', playSound: false });
    } finally {
      setIsReplying(false);
    }
  }

  async function handleDelete() {
    handlePressStart();
    const confirmed = await confirm({
      title: t("Supprimer cette story ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) {
      handlePressEnd();
      return;
    }
    await fetch(`/api/stories/${story.id}`, { method: 'DELETE' });
    onDeleted();
    onClose();
  }

  useEffect(() => {
    setLocalReaction(story?.myReaction ?? null);
    setLocalTotalReactions(story?.totalReactions ?? 0);
  }, [story?.id, story?.myReaction, story?.totalReactions]);

  async function openViewers() {
    setIsViewersOpen(true);
    handlePressStart();
    const response = await fetch(`/api/stories/${story.id}/viewers`);
    const data = await response.json();
    setViewers(data.success ? data.viewers : []);
  }

  function closeViewers() {
    setIsViewersOpen(false);
    handlePressEnd();
  }

  function handleReactionChange(newReaction, aggregates) {
    setLocalReaction(newReaction);
    setLocalTotalReactions(aggregates.totalReactions);
  }

  if (!story) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
    >
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
        <div className="absolute top-0 start-0 end-0 z-20 p-3 space-y-2">
          <div className="flex gap-1">
            {group.stories.map((item, index) => (
              <div key={item.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-surface transition-all"
                  style={{
                    width: index < storyIndex ? '100%' : index === storyIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Link href={`/profile/${story.author.id}`} onClick={onClose} className="flex items-center gap-2 group">
              <Avatar src={story.author.avatar} firstName={story.author.firstName} lastName={story.author.lastName} size="sm" />
              <span className="text-white text-sm font-medium group-hover:underline">
                {story.author.firstName} {story.author.lastName}{story.author.verified && <VerifiedBadge size={14} />}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {isOwner && (
                <button onClick={handleDelete} className="text-white/80 hover:text-white transition-colors">
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
        >
          {story.type === 'text' && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ backgroundColor: story.backgroundColor || '#3D63E8' }}
            >
              <p className="text-white text-2xl font-semibold text-center">{story.content}</p>
            </div>
          )}
          {story.type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.mediaUrl} alt={t("Story")} className="w-full h-full object-contain" />
          )}
          {story.type === 'video' && (
            <video ref={videoRef} src={story.mediaUrl} className="w-full h-full object-contain" autoPlay playsInline />
          )}

          <button
            onClick={goPrev}
            className="absolute start-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            className="absolute end-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="absolute bottom-0 start-0 end-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-black/60 to-transparent">
          {isOwner ? (
            <div className="flex items-center justify-between">
              <ReactionButton targetType="story" targetId={story.id} myReaction={localReaction} onChange={handleReactionChange} />
              <button onClick={openViewers} className="flex items-center gap-1.5 text-white text-sm">
                <Eye size={16} /> {story.viewsCount}
              </button>
            </div>
          ) : (
            <form onSubmit={handleReply} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                maxLength={2000}
                onChange={(event) => setReplyText(event.target.value)}
                onFocus={pauseForInput}
                onBlur={resumeAfterInput}
                placeholder={t("Repondre a {name}...", { name: story.author.firstName })}
                className="flex-1 min-w-0 h-11 rounded-full bg-black/35 border border-white/40 text-white placeholder:text-white/70 text-sm px-4 outline-none focus:border-white focus:bg-black/50"
              />
              {replyText.trim() ? (
                <button
                  type="submit"
                  disabled={isReplying}
                  onMouseDown={(event) => event.preventDefault()}
                  className="w-11 h-11 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0 disabled:opacity-60"
                  aria-label={t("Envoyer")}
                >
                  {isReplying ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              ) : (
                <ReactionButton targetType="story" targetId={story.id} myReaction={localReaction} onChange={handleReactionChange} />
              )}
              {!replyText.trim() && localTotalReactions > 0 && (
                <span className="text-white text-sm shrink-0">{localTotalReactions}</span>
              )}
            </form>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isViewersOpen && (
          <PeopleListModal
            title={t("Vu par")}
            people={viewers}
            emptyLabel={t("Aucune vue pour le moment")}
            renderBadge={(person) => {
              const reaction = REACTIONS.find((item) => item.type === person.reactionType);
              return reaction ? (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: reaction.color }}
                >
                  <reaction.icon size={15} className="text-white" strokeWidth={2.5} />
                </span>
              ) : null;
            }}
            onClose={closeViewers}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
