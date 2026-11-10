import Link from 'next/link';
import { LogIn, UserPlus, Heart, MessageCircle, Share2 } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import Logomark from '@/components/shared/logomark';
import VerifiedBadge from '@/components/shared/verifiedBadge';
import MediaGrid from '@/components/posts/mediaGrid';
import { APP_NAME } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/dateUtils';

import { t } from '@/lib/i18n/runtime';
// Affichage en lecture seule d'une publication publique pour un visiteur
// sans compte (lien partage depuis WhatsApp, Facebook, etc.).
export default function PublicPostView({ post, loginHref }) {
  const shared = post.sharedPost;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logomark size={30} />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={loginHref} className="nx-btn-ghost px-3 h-9 text-sm">
              <LogIn size={15} /> {t("Se connecter")}
            </Link>
            <Link href="/register" className="nx-btn-primary px-4 h-9 text-sm">
              <UserPlus size={15} /> {t("Creer un compte")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <article className="nx-card overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <Avatar src={post.author.avatar} firstName={post.author.firstName} lastName={post.author.lastName} size="md" />
            <div className="min-w-0">
              <p className="font-display font-semibold text-slate-900 truncate">
                {post.author.firstName} {post.author.lastName}
                {post.author.verified && <VerifiedBadge size={14} />}
              </p>
              <p className="text-xs text-slate-500">{formatRelativeTime(post.createdAt)}</p>
            </div>
          </div>

          {post.content && (
            <p className="px-4 pb-3 text-sm text-slate-700 whitespace-pre-wrap break-words">{post.content}</p>
          )}

          {post.media && post.media.length > 0 && <MediaGrid media={post.media} />}

          {shared && (
            <div className="mx-4 my-3 rounded-xl2 border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">
                {shared.author.firstName} {shared.author.lastName}
              </p>
              {shared.content && <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{shared.content}</p>}
              {shared.media && shared.media.length > 0 && (
                <div className="mt-2 rounded-xl overflow-hidden">
                  <MediaGrid media={shared.media} />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-5 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Heart size={16} /> {post.totalReactions || 0}</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle size={16} /> {post.commentCount || 0}</span>
            <span className="inline-flex items-center gap-1.5"><Share2 size={16} /> {post.shareCount || 0}</span>
          </div>
        </article>

        <div className="mt-6 nx-card p-6 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t("Rejoignez {APP_NAME} pour reagir et commenter", { APP_NAME })}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("Retrouvez vos amis et votre communaute")}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href={loginHref} className="nx-btn-ghost px-5 h-10">{t("Se connecter")}</Link>
            <Link href="/register" className="nx-btn-primary px-5 h-10">{t("Creer un compte")}</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
