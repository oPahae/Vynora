import VerifiedBadge from '@/components/shared/verifiedBadge';
import Link from 'next/link';
import Avatar from '@/components/shared/avatar';
import PostContent from '@/components/posts/postContent';
import MediaGrid from '@/components/posts/mediaGrid';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
export default function EmbeddedPostCard({ post }) {
  if (!post) {
    return (
      <div className="border border-slate-200 rounded-xl2 p-4 text-sm text-slate-400 text-center">{t("Cette publication n'est plus disponible.")}</div>
    );
  }

  return (
    <Link href={`/post/${post.id}`} className="block border border-slate-200 rounded-xl2 p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2.5">
        <Avatar src={post.author.avatar} firstName={post.author.firstName} lastName={post.author.lastName} size="sm" />
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {post.author.firstName} {post.author.lastName}{post.author.verified && <VerifiedBadge size={14} />}
          </p>
          <p className="text-xs text-slate-400">{formatRelativeTime(post.createdAt)}</p>
        </div>
      </div>

      {post.content && (
        <div className="mt-2">
          <PostContent content={post.content} mentions={post.mentions} />
        </div>
      )}

      {post.media.length > 0 && (
        <div className="mt-2">
          <MediaGrid media={post.media} />
        </div>
      )}
    </Link>
  );
}
