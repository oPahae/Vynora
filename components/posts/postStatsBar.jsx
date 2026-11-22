import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import REACTIONS from '@/components/shared/reactionTypes';
import AnimatedNumber from '@/components/shared/animatedNumber';
import PeopleListModal from '@/components/posts/peopleListModal';

import { t } from '@/lib/i18n/runtime';
export default function PostStatsBar({ postId, reactionsByType, totalReactions, commentCount, shareCount, viewsCount }) {
  const [modal, setModal] = useState(null);
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const topReactions = REACTIONS.filter((reaction) => reactionsByType[reaction.type] > 0).slice(0, 3);

  async function openReactors() {
    setModal('reactions');
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts/${postId}/reactions`);
      const data = await response.json();
      setPeople(data.success ? data.reactors : []);
    } finally {
      setIsLoading(false);
    }
  }

  async function openViewers() {
    setModal('viewers');
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts/${postId}/viewers`);
      const data = await response.json();
      setPeople(data.success ? data.viewers : []);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 text-[0.8rem] text-slate-500 py-2.5 nx-tabular">
      <button
        onClick={openReactors}
        disabled={totalReactions === 0}
        className="flex items-center gap-2 hover:text-slate-800 transition-colors disabled:cursor-default disabled:hover:text-slate-500"
      >
        {topReactions.length > 0 && (
          <span className="flex -space-x-1">
            {topReactions.map((reaction) => (
              <reaction.icon key={reaction.type} size={22} className="rounded-full ring-2 ring-surface" />
            ))}
          </span>
        )}
        {totalReactions > 0 ? <AnimatedNumber value={totalReactions} /> : ''}
      </button>

      <div className="flex items-center gap-3.5 flex-wrap justify-end">
        {viewsCount > 0 && (
          <button onClick={openViewers} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
            <Eye size={13} /> {viewsCount}
          </button>
        )}
        {commentCount > 0 && <span>{t("{commentCount} commentaires", { commentCount })}</span>}
        {shareCount > 0 && (
          <Link href={`/post/${postId}/shares`} className="hover:text-slate-800 transition-colors">{t("{shareCount} partages", { shareCount })}</Link>
        )}
      </div>

      <AnimatePresence>
        {modal === 'reactions' && (
          <PeopleListModal
            title={t("Personnes ayant reagi")}
            people={isLoading ? [] : people}
            emptyLabel={isLoading ? t("Chargement...") : t("Aucune reaction")}
            renderBadge={(person) => {
              const reaction = REACTIONS.find((item) => item.type === person.type);
              return reaction ? (
                <reaction.icon size={28} />
              ) : null;
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'viewers' && (
          <PeopleListModal
            title={t("Vu par")}
            people={isLoading ? [] : people}
            emptyLabel={isLoading ? t("Chargement...") : t("Aucune vue")}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
