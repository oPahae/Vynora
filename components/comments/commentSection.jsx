import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import CommentComposer from '@/components/comments/commentComposer';
import CommentItem from '@/components/comments/commentItem';
import InfiniteScrollSentinel from '@/components/shared/infiniteScrollSentinel';

const PAGE_SIZE = 10;

export default function CommentSection({ postId, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments?offset=0&limit=${PAGE_SIZE}`);
      const data = await response.json();
      const loaded = data.success ? data.comments : [];
      setComments(loaded);
      setHasMore(loaded.length === PAGE_SIZE);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments?offset=${comments.length}&limit=${PAGE_SIZE}`);
      const data = await response.json();
      const loaded = data.success ? data.comments : [];
      setComments((prev) => [...prev, ...loaded]);
      setHasMore(loaded.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, comments.length]);

  const handleIntersect = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const handleCreated = useCallback(
    (comment) => {
      setComments((prev) => [comment, ...prev]);
      onCommentCountChange(1);
    },
    [onCommentCountChange]
  );

  const handleUpdated = useCallback((commentId, updated) => {
    setComments((prev) => prev.map((item) => (item.id === commentId ? updated : item)));
  }, []);

  const handleDeleted = useCallback(
    (commentId) => {
      setComments((prev) => prev.filter((item) => item.id !== commentId));
      onCommentCountChange(-1);
    },
    [onCommentCountChange]
  );

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onAnimationComplete={() => setIsExpanded(true)}
      className={`pt-4 mt-2 border-t border-slate-100 space-y-4 ${isExpanded ? 'overflow-visible' : 'overflow-hidden'}`}
    >
      <CommentComposer postId={postId} onCreated={handleCreated} />

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              postId={postId}
              comment={comment}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {hasMore && !isLoading && (
        <>
          <InfiniteScrollSentinel onIntersect={handleIntersect} enabled={hasMore && !isLoadingMore} />
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 size={16} className="animate-spin text-brand-400" />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
