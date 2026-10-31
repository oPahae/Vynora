import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Search as SearchIcon, Hash, Loader2, SearchX } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PostCard from '@/components/posts/postCard';
import FriendCard from '@/components/friends/friendCard';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const TABS = [
  { key: 'all', get label() { return t("Tout"); } },
  { key: 'users', get label() { return t("Personnes"); } },
  { key: 'hashtags', get label() { return t("Hashtags"); } },
  { key: 'posts', get label() { return t("Publications"); } }
];

const PAGE_SIZE = 10;

export default function SearchPage() {
  const router = useRouter();
  const q = (router.query.q || '').toString();
  const [tab, setTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [users, setUsers] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [posts, setPosts] = useState([]);
  const recordedRef = useRef('');

  const load = useCallback(async (searchTerm, activeTab) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setIsLoading(false);
      setUsers([]);
      setHashtags([]);
      setPosts([]);
      return;
    }

    setIsLoading(true);
    try {
      const shouldRecord = recordedRef.current !== searchTerm;
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchTerm)}&type=${activeTab}&offset=0&limit=${PAGE_SIZE}${
          shouldRecord ? '&record=1' : ''
        }`
      );
      const data = await response.json();
      if (shouldRecord) recordedRef.current = searchTerm;

      if (data.success) {
        if (activeTab === 'all') {
          setUsers(data.users);
          setHashtags(data.hashtags);
          setPosts(data.posts);
        } else if (activeTab === 'users') {
          setUsers(data.users);
        } else if (activeTab === 'hashtags') {
          setHashtags(data.hashtags);
        } else {
          setPosts(data.posts);
        }
        setHasMore(data.hasMore);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    load(q, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab, router.isReady]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const currentCount = tab === 'users' ? users.length : tab === 'hashtags' ? hashtags.length : posts.length;
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${tab}&offset=${currentCount}&limit=${PAGE_SIZE}`
      );
      const data = await response.json();
      if (data.success) {
        if (tab === 'users') setUsers((prev) => [...prev, ...data.users]);
        else if (tab === 'hashtags') setHashtags((prev) => [...prev, ...data.hashtags]);
        else if (tab === 'posts') setPosts((prev) => [...prev, ...data.posts]);
        setHasMore(data.hasMore);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  const handleIntersect = useCallback(() => {
    if (!isLoadingMore && hasMore && tab !== 'all') loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMore, hasMore, tab, users.length, hashtags.length, posts.length]);

  const hasAnyResult = users.length > 0 || hashtags.length > 0 || posts.length > 0;

  return (
    <>
      <Head>
        <title>{pageTitle(q ? t("Recherche : {q}", { q }) : t("Recherche"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl2 bg-brand-50 flex items-center justify-center text-brand-500">
              <SearchIcon size={18} />
            </div>
            <h1 className="font-display text-xl font-semibold text-slate-900 tracking-tight truncate">
              {q ? <>{t("Resultats pour \"{q}\"", { q })}</> : t("Recherche")}
            </h1>
          </div>

          {q.trim().length >= 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-6 bg-slate-100 rounded-xl2 p-1 w-fit max-w-full">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-all ${
                    tab === item.key
                      ? 'bg-surface text-slate-900 shadow-soft'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {q.trim().length < 2 ? (
            <div className="nx-card p-12 text-center">
              <p className="text-sm text-slate-400">{t("Tapez au moins 2 caracteres pour lancer une recherche.")}</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : (tab === 'all' && !hasAnyResult) ||
            (tab === 'users' && users.length === 0) ||
            (tab === 'hashtags' && hashtags.length === 0) ||
            (tab === 'posts' && posts.length === 0) ? (
            <div className="nx-card p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
                <SearchX size={22} className="text-brand-400" />
              </div>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">{t("Aucun resultat pour \"{q}\". Essayez un autre terme.", { q })}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {(tab === 'all' || tab === 'users') && users.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-slate-400  mb-3 px-1">{t("Personnes")}</h2>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <FriendCard key={user.id} user={user} />
                    ))}
                  </div>
                </section>
              )}

              {(tab === 'all' || tab === 'hashtags') && hashtags.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-slate-400  mb-3 px-1">{t("Hashtags")}</h2>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {hashtags.map((hashtag) => (
                      <Link
                        key={hashtag.name}
                        href={`/hashtag/${hashtag.name}`}
                        className="flex items-center gap-3 nx-card-interactive !rounded-xl2 p-3.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 shrink-0">
                          <Hash size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">#{hashtag.name}</p>
                          <p className="text-xs text-slate-400">{t("{postCount} publications", { postCount: hashtag.postCount })}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {(tab === 'all' || tab === 'posts') && posts.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-slate-400  mb-3 px-1">{t("Publications")}</h2>
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onUpdated={(updated) =>
                          setPosts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
                        }
                        onDeleted={(postId) => setPosts((prev) => prev.filter((item) => item.id !== postId))}
                      />
                    ))}
                  </div>
                </section>
              )}

              {tab !== 'all' && hasMore && (
                <>
                  <InfiniteScrollSentinel onIntersect={handleIntersect} enabled={hasMore && !isLoadingMore} />
                  {isLoadingMore && (
                    <div className="flex justify-center py-3">
                      <Loader2 size={18} className="animate-spin text-brand-400" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
