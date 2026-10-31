import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Clock, Hash, Loader2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
const DEBOUNCE_MS = 300;

export default function GlobalSearchBar() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Raccourci clavier : "/" ou Ctrl/Cmd+K place le curseur dans la recherche.
  useEffect(() => {
    function onKey(event) {
      const tag = (event.target && event.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable;
      if ((event.key === '/' && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function loadRecentSearches() {
    fetch('/api/search/history')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setRecentSearches(data.history);
      })
      .catch(() => {});
  }

  function handleFocus() {
    setIsOpen(true);
    if (!term.trim()) loadRecentSearches();
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=all`);
        const data = await response.json();
        if (data.success) setResults(data);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [term]);

  function goToFullSearch(searchTerm) {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    goToFullSearch(term);
  }

  async function handleClearHistory() {
    await fetch('/api/search/history', { method: 'DELETE' });
    setRecentSearches([]);
  }

  async function handleRemoveHistoryEntry(id) {
    setRecentSearches((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/search/history/${id}`, { method: 'DELETE' });
  }

  const showRecent = isOpen && !term.trim() && recentSearches.length > 0;
  const showResults = isOpen && term.trim().length >= 2;
  const hasAnyResult =
    results && (results.users.length > 0 || results.hashtags.length > 0 || results.posts.length > 0);

  return (
    <div className="relative w-full" ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative">
        <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={handleFocus}
          placeholder={t("Rechercher...")}
          className="nx-field h-10 !py-0 !rounded-full ps-10 pe-10"
        />
        {!term && (
          <kbd
            title={t("Raccourci : touche /")}
            className="nx-kbd hidden lg:flex absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            /
          </kbd>
        )}
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              setResults(null);
            }}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </form>

      <AnimatePresence>
        {(showRecent || showResults) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute start-0 end-0 mt-2 nx-pop overflow-hidden z-30 max-h-[70vh] overflow-y-auto"
          >
            {showRecent && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-semibold text-slate-400 ">{t("Recherches recentes")}</span>
                  <button onClick={handleClearHistory} className="text-xs text-brand-600 hover:underline font-medium">{t("Effacer")}</button>
                </div>
                {recentSearches.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-xl2 group">
                    <button
                      onClick={() => goToFullSearch(item.queryText)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-start"
                    >
                      <Clock size={13} className="text-slate-300 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{item.queryText}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveHistoryEntry(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-ember-500 transition-opacity"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showResults && (
              <div className="p-2">
                {isSearching && !results && (
                  <div className="flex justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-brand-400" />
                  </div>
                )}

                {results && !hasAnyResult && !isSearching && (
                  <p className="text-sm text-slate-400 text-center py-6">{t("Aucun resultat pour \"{term}\".", { term })}</p>
                )}

                {results && results.users.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold text-slate-400 ">{t("Personnes")}</p>
                    {results.users.map((user) => (
                      <Link
                        key={user.id}
                        href={`/profile/${user.id}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-2 py-2 hover:bg-slate-50 rounded-xl2"
                      >
                        <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="sm" />
                        <span className="text-sm text-slate-800 truncate">
                          {user.firstName} {user.lastName}{user.verified && <VerifiedBadge size={14} />}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {results && results.hashtags.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold text-slate-400 ">{t("Hashtags")}</p>
                    {results.hashtags.map((hashtag) => (
                      <Link
                        key={hashtag.name}
                        href={`/hashtag/${hashtag.name}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-2 py-2 hover:bg-slate-50 rounded-xl2"
                      >
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 shrink-0">
                          <Hash size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">#{hashtag.name}</p>
                          <p className="text-xs text-slate-400">{t("{postCount} publications", { postCount: hashtag.postCount })}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {results && results.posts.length > 0 && (
                  <div>
                    <p className="px-2 py-1 text-xs font-semibold text-slate-400 ">{t("Publications")}</p>
                    {results.posts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/post/${post.id}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-start gap-2.5 px-2 py-2 hover:bg-slate-50 rounded-xl2"
                      >
                        <Avatar src={post.author.avatar} firstName={post.author.firstName} lastName={post.author.lastName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700 line-clamp-2">{post.content}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {hasAnyResult && (
                  <button
                    onClick={() => goToFullSearch(term)}
                    className="w-full text-center text-sm font-medium text-brand-600 hover:underline py-2"
                  >{t("Voir tous les resultats pour \"{term}\"", { term })}</button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
