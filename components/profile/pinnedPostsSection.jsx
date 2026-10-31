import { useState, useEffect, useCallback } from 'react';
import { Pin } from 'lucide-react';
import PostCard from '@/components/posts/postCard';

import { t } from '@/lib/i18n/runtime';
export default function PinnedPostsSection({ userId }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/pinned-posts`);
      const data = await response.json();
      setPosts(data.success ? data.posts : []);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleUnpinned(postId) {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }

  function handleUpdated(updated) {
    setPosts((prev) => prev.map((post) => (post.id === updated.id ? { ...updated, isPinned: true } : post)));
  }

  function handleDeleted(postId) {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }

  if (isLoading || posts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 px-1">
        <Pin size={15} />{' '}{t("Publications epinglees")}</div>
      {posts.map((post) => (
        <PostCard
          key={t("pinned-{id}", { id: post.id })}
          post={post}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onUnpinned={handleUnpinned}
        />
      ))}
    </div>
  );
}
