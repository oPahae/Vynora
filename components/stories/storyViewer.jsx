import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import ReactionButton from '@/components/posts/reactionButton';
import PeopleListModal from '@/components/posts/peopleListModal';
import REACTIONS from '@/components/shared/reactionTypes';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';

import { t } from '@/lib/i18n/runtime';
const TEXT_DURATION_MS = 5000;

export default function StoryViewer({ groups, initialGroupIndex, onClose, onDeleted }) {
  const { user } = useAuth();
  const confirm = useConfirm();
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

        <div className="absolute bottom-0 start-0 end-0 p-4 flex items-center justify-between z-20">
          <ReactionButton targetType="story" targetId={story.id} myReaction={localReaction} onChange={handleReactionChange} />
          {isOwner ? (
            <button onClick={openViewers} className="flex items-center gap-1.5 text-white text-sm">
              <Eye size={16} /> {story.viewsCount}
            </button>
          ) : (
            localTotalReactions > 0 && <span className="text-white text-sm">{t("{localTotalReactions} reactions", { localTotalReactions })}</span>
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
