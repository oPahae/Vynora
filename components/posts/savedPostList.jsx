import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, BookmarkX } from 'lucide-react';
import PostCard from '@/components/posts/postCard';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
const PAGE_SIZE = 5;

export default function SavedPostList({ category }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const postsCountRef = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts/saved?category=${category}&offset=0&limit=${PAGE_SIZE}`);
      const data = await response.json();
      const loaded = data.success ? data.posts : [];
      setPosts(loaded);
      postsCountRef.current = loaded.length;
      setHasMore(data.success ? data.hasMore : false);
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/posts/saved?category=${category}&offset=${postsCountRef.current}&limit=${PAGE_SIZE}`
      );
      const data = await response.json();
      const loaded = data.success ? data.posts : [];
      setPosts((prev) => {
        const next = [...prev, ...loaded];
        postsCountRef.current = next.length;
        return next;
      });
      setHasMore(data.success ? data.hasMore : false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [category]);

  const handleIntersect = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  function handleUnsaved(postId) {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }

  function handleUpdated(updated) {
    setPosts((prev) => prev.map((post) => (post.id === updated.id ? { ...updated, savedAt: post.savedAt } : post)));
  }

  function handleDeleted(postId) {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={22} className="animate-spin text-brand-400" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="nx-card p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
          <BookmarkX size={22} className="text-brand-400" />
        </div>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">{t("Aucune publication enregistree dans cette categorie.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id}>
          <p className="text-xs text-slate-400 mb-1.5 ms-1">{t("Enregistre {formatRelativeTime}", { formatRelativeTime: formatRelativeTime(post.savedAt) })}</p>
          <PostCard post={post} onUpdated={handleUpdated} onDeleted={handleDeleted} onUnsaved={handleUnsaved} />
        </div>
      ))}

      {hasMore && (
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
  );
}
