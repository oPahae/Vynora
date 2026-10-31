import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, LoaderCircle, Search } from 'lucide-react';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function FriendsCard({ userId, friendsCount, friendsPreview, isSelf }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [cardFocused, setCardFocused] = useState(false);
  const needsFullList = isModalOpen || cardFocused || cardSearch.trim() !== '';

  // La liste complete des amis est chargee a la demande : a l'ouverture de
  // la fenetre, ou des qu'on clique dans la barre de recherche de la carte.
  useEffect(() => {
    if (!needsFullList || items) return;
    setIsLoading(true);
    fetch(`/api/users/${userId}/friends`)
      .then((response) => response.json())
      .then((data) => setItems(data.success ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [needsFullList, items, userId]);

  useEffect(() => {
    if (!isModalOpen) setSearch('');
  }, [isModalOpen]);

  const filteredItems = useMemo(() => {
    const term = normalize(search.trim());
    if (!term || !items) return items;
    return items.filter((friend) => normalize(`${friend.firstName} ${friend.lastName}`).includes(term));
  }, [items, search]);

  const cardTerm = normalize(cardSearch.trim());
  const cardResults = useMemo(() => {
    if (!cardTerm || !items) return [];
    return items.filter((friend) => normalize(`${friend.firstName} ${friend.lastName}`).includes(cardTerm));
  }, [items, cardTerm]);

  return (
    <div className="nx-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-slate-900 tracking-tight">
          {isSelf ? t("Mes amis") : t("Amis")}
        </h2>
        <span className="text-sm text-slate-400">{friendsCount}</span>
      </div>

      {friendsCount > 0 && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 py-2 border border-slate-100 mb-4 focus-within:border-brand-300 focus-within:bg-surface">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={cardSearch}
            onChange={(event) => setCardSearch(event.target.value)}
            onFocus={() => setCardFocused(true)}
            placeholder={isSelf ? t("Rechercher parmi mes amis") : t("Rechercher un ami")}
            aria-label={t("Rechercher un ami")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {cardSearch && (
            <button type="button" onClick={() => setCardSearch('')} aria-label={t("Effacer la recherche")} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {cardTerm ? (
        <div className="max-h-72 overflow-y-auto -mx-1">
          {isLoading && !items && (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <LoaderCircle size={20} className="animate-spin" />
            </div>
          )}
          {items &&
            cardResults.map((friend) => (
              <Link
                key={friend.id}
                href={`/profile/${friend.id}`}
                className="flex items-center gap-3 p-2 rounded-xl2 hover:bg-slate-50 transition-colors"
              >
                <Avatar src={friend.avatar} firstName={friend.firstName} lastName={friend.lastName} size="md" />
                <span className="text-sm font-medium text-slate-800 truncate">
                  {friend.firstName} {friend.lastName}{friend.verified && <VerifiedBadge size={14} />}
                </span>
              </Link>
            ))}
          {items && cardResults.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">{t("Aucun resultat pour \"{trim}\".", { trim: cardSearch.trim() })}</p>
          )}
        </div>
      ) : friendsPreview.length === 0 ? (
        <p className="text-sm text-slate-400">{t("Aucun ami pour le moment.")}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {friendsPreview.slice(0, 9).map((friend) => (
              <Link
                key={friend.id}
                href={`/profile/${friend.id}`}
                className="flex flex-col items-center gap-1.5 text-center group"
              >
                <Avatar src={friend.avatar} firstName={friend.firstName} lastName={friend.lastName} size="lg" />
                <span className="text-xs text-slate-600 truncate w-full group-hover:text-brand-600 transition-colors">
                  {friend.firstName}
                </span>
              </Link>
            ))}
          </div>
          {friendsCount > friendsPreview.length && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >{t("Voir tous les amis")}</button>
          )}
        </>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-md max-h-[75vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-surface">
                <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Users size={18} /> {isSelf ? t("Mes amis") : t("Amis")} ({friendsCount})
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                {items && items.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 py-2 border border-slate-100 mb-3 focus-within:border-brand-300">
                    <Search size={15} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("Rechercher un ami")}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </div>
                )}
                {isLoading && (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <LoaderCircle size={22} className="animate-spin" />
                  </div>
                )}
                {!isLoading &&
                  filteredItems &&
                  filteredItems.map((friend) => (
                    <Link
                      key={friend.id}
                      href={`/profile/${friend.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl2 hover:bg-slate-50 transition-colors"
                    >
                      <Avatar src={friend.avatar} firstName={friend.firstName} lastName={friend.lastName} size="md" />
                      <span className="text-sm font-medium text-slate-800">
                        {friend.firstName} {friend.lastName}{friend.verified && <VerifiedBadge size={14} />}
                      </span>
                    </Link>
                  ))}
                {!isLoading && items && items.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">{t("Aucun ami pour le moment.")}</p>
                )}
                {!isLoading && items && items.length > 0 && filteredItems.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">{t("Aucun resultat pour \"{search}\".", { search })}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
