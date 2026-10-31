import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Newspaper, WifiOff } from 'lucide-react';
import PostComposer from '@/components/posts/postComposer';
import PostCard from '@/components/posts/postCard';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';
import EmptyState from '@/components/shared/emptyState';
import { PostListSkeleton } from '@/components/shared/skeletons';

import { t } from '@/lib/i18n/runtime';
const PAGE_SIZE = 5;

export default function PostList({ endpoint, canCompose, emptyLabel, groupId }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const postsCountRef = useRef(0);

  const separator = endpoint.includes('?') ? '&' : '?';

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`${endpoint}${separator}offset=0&limit=${PAGE_SIZE}`);
      const data = await response.json();
      const loaded = data.success ? data.posts : [];
      setPosts(loaded);
      postsCountRef.current = loaded.length;
      setHasMore(data.success ? data.hasMore : false);
      if (!data.success) setLoadError(true);
    } catch (error) {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const response = await fetch(`${endpoint}${separator}offset=${postsCountRef.current}&limit=${PAGE_SIZE}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const handleIntersect = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const handlePostCreated = useCallback((post) => {
    setPosts((prev) => {
      const next = [post, ...prev];
      postsCountRef.current = next.length;
      return next;
    });
  }, []);

  const handlePostShared = useCallback((post) => {
    setPosts((prev) => {
      const next = [post, ...prev];
      postsCountRef.current = next.length;
      return next;
    });
  }, []);

  const handlePostUpdated = useCallback((updated) => {
    setPosts((prev) => prev.map((post) => (post.id === updated.id ? updated : post)));
  }, []);

  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => {
      const next = prev.filter((post) => post.id !== postId);
      postsCountRef.current = next.length;
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {canCompose && <PostComposer onPostCreated={handlePostCreated} groupId={groupId} />}

      {isLoading ? (
        <PostListSkeleton count={canCompose ? 2 : 3} />
      ) : loadError && posts.length === 0 ? (
        <EmptyState
          icon={WifiOff}
          tone="ember"
          title={t("Impossible de contacter le serveur")}
          action={<button type="button" onClick={loadPosts} className="nx-btn-secondary">{t("Reessayer")}</button>}
        />
      ) : posts.length === 0 ? (
        <EmptyState icon={Newspaper} description={emptyLabel || t("Aucune publication a afficher.")} />
      ) : (
        <AnimatePresence initial={false}>
          {posts.map((post) => (
            // Le conteneur porte la sortie (suppression) et le glissement des voisins.
            <motion.div
              key={post.id}
              layout="position"
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
              transition={{ layout: { type: 'spring', stiffness: 380, damping: 36 } }}
            >
              <PostCard
                post={post}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
                onShared={handlePostShared}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {hasMore && !isLoading && (
        <>
          <InfiniteScrollSentinel onIntersect={handleIntersect} enabled={hasMore && !isLoadingMore} />
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-brand-500" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
