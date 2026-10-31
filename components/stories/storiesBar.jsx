import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import StoryComposer from '@/components/stories/storyComposer';
import StoryViewer from '@/components/stories/storyViewer';
import { useAuth } from '@/lib/authContext';

import { t } from '@/lib/i18n/runtime';
// Anneau d'histoire : un anneau bleu plein signale du contenu non vu.
// Une fois vu, l'anneau devient un simple liseré neutre : l'etat se lit sans texte.
function StoryRing({ unseen, dashed = false, children }) {
  return (
    <div className="relative w-[68px] h-[68px] rounded-full">
      {unseen ? (
        <>
          <span className="absolute inset-0 rounded-full bg-brand-500" aria-hidden />
        </>
      ) : (
        <span
          className={`absolute inset-0 rounded-full ${dashed ? 'border-2 border-dashed border-slate-300' : 'bg-slate-200'}`}
          aria-hidden
        />
      )}
      <span className="absolute inset-[3px] rounded-full bg-surface" aria-hidden />
      <div className="absolute inset-[5px] rounded-full overflow-hidden flex items-center justify-center">{children}</div>
    </div>
  );
}

export default function StoriesBar() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);

  const loadStories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stories');
      const data = await response.json();
      setGroups(data.success ? data.groups : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const myGroup = groups.find((group) => group.author.id === user?.id);
  const otherGroups = groups.filter((group) => group.author.id !== user?.id);

  function handleStoryCreated() {
    setIsComposerOpen(false);
    loadStories();
  }

  function handleStoryDeleted() {
    loadStories();
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 overflow-hidden mb-5 px-1" aria-hidden>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center gap-2 shrink-0">
            <div className="nx-skeleton w-[68px] h-[68px] rounded-full" />
            <div className="nx-skeleton h-2.5 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-1 pt-1 pb-1 mb-5 snap-x scroll-ps-4 sm:scroll-ps-1">
      <div className="flex flex-col items-center gap-1.5 shrink-0 snap-start">
        <div
          role="button"
          tabIndex={0}
          aria-label={t("Votre story")}
          onClick={() => (myGroup ? setViewerIndex(groups.indexOf(myGroup)) : setIsComposerOpen(true))}
          onKeyDown={(event) => event.key === 'Enter' && (myGroup ? setViewerIndex(groups.indexOf(myGroup)) : setIsComposerOpen(true))}
          className="relative cursor-pointer transition-transform duration-200 ease-out-expo active:scale-90 hover:scale-[1.04]"
        >
          <StoryRing unseen={Boolean(myGroup && myGroup.stories.some((story) => !story.viewed))} dashed={!myGroup}>
            <Avatar src={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size="lg" />
          </StoryRing>
          <button
            type="button"
            aria-label={t("Votre story")}
            onClick={(event) => {
              event.stopPropagation();
              setIsComposerOpen(true);
            }}
            className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-brand-500 border-[3px] border-surface flex items-center justify-center text-white shadow-glow hover:scale-110 active:scale-90 transition-transform"
          >
            <Plus size={13} strokeWidth={2.75} />
          </button>
        </div>
        <span className="text-xs text-slate-700 font-medium">{t("Votre story")}</span>
      </div>

      {otherGroups.map((group) => {
        const hasUnviewed = group.stories.some((story) => !story.viewed);
        return (
          <button
            key={group.author.id}
            onClick={() => setViewerIndex(groups.indexOf(group))}
            className="flex flex-col items-center gap-1.5 shrink-0 snap-start group"
          >
            <div className="transition-transform duration-200 ease-out-expo group-hover:scale-[1.04] group-active:scale-90">
              <StoryRing unseen={hasUnviewed}>
                <Avatar
                  src={group.author.avatar}
                  firstName={group.author.firstName}
                  lastName={group.author.lastName}
                  size="lg"
                />
              </StoryRing>
            </div>
            <span className={`text-xs truncate w-[68px] text-center ${hasUnviewed ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium'}`}>
              {group.author.firstName}
              {group.author.verified && <VerifiedBadge size={11} className="!ms-0.5" />}
            </span>
          </button>
        );
      })}

      <AnimatePresence>
        {isComposerOpen && <StoryComposer onClose={() => setIsComposerOpen(false)} onCreated={handleStoryCreated} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewerIndex !== null && (
          <StoryViewer
            groups={groups}
            initialGroupIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onDeleted={handleStoryDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
