import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Compass, Hash, TrendingUp, Sparkles, Loader2, UserPlus } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import EmptyState from '@/components/shared/emptyState';
import { StaggerList, StaggerItem } from '@/components/shared/stagger';
import Avatar from '@/components/shared/avatar';
import PostCard from '@/components/posts/postCard';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function ExplorePage() {
  const [data, setData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState({});

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [exploreResponse, suggestionsResponse] = await Promise.all([
          fetch('/api/explore'),
          fetch('/api/friends/suggestions')
        ]);
        const exploreData = await exploreResponse.json();
        const suggestionsData = await suggestionsResponse.json();
        if (exploreData.success) setData(exploreData);
        if (suggestionsData.success) setSuggestions(suggestionsData.items.slice(0, 6));
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function updatePost(updated) {
    setData((prev) => ({
      ...prev,
      popularPosts: prev.popularPosts.map((post) => (post.id === updated.id ? updated : post)),
      recentPosts: prev.recentPosts.map((post) => (post.id === updated.id ? updated : post))
    }));
  }

  function removePost(postId) {
    setData((prev) => ({
      ...prev,
      popularPosts: prev.popularPosts.filter((post) => post.id !== postId),
      recentPosts: prev.recentPosts.filter((post) => post.id !== postId)
    }));
  }

  async function handleAddFriend(userId) {
    setSentRequests((prev) => ({ ...prev, [userId]: true }));
    await fetch(`/api/friends/${userId}/request`, { method: 'POST' });
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Explorer"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={Compass} title={t("Explorer")} />

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : (
            <div className="space-y-8">
              {data?.hashtags?.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-3">
                    <TrendingUp size={15} className="text-brand-500" />{' '}{t("Hashtags tendance")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.map((hashtag) => (
                      <Link
                        key={hashtag.name}
                        href={`/hashtag/${hashtag.name}`}
                        className="flex items-center gap-1.5 bg-surface border border-slate-100 shadow-soft hover:shadow-card transition-shadow rounded-xl2 px-3.5 py-2 text-sm"
                      >
                        <Hash size={13} className="text-brand-400" />
                        <span className="font-medium text-slate-700">{hashtag.name}</span>
                        <span className="text-xs text-slate-400">{hashtag.postCount}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {suggestions.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-3">
                    <UserPlus size={15} className="text-brand-500" />{' '}{t("Utilisateurs a decouvrir")}</h2>
                  <StaggerList className="grid sm:grid-cols-2 gap-2">
                    {suggestions.map((suggestedUser) => (
                      <StaggerItem
                        key={suggestedUser.id}
                        className="flex items-center justify-between gap-3 nx-card-interactive nx-spot !rounded-xl2 p-3.5"
                      >
                        <Link href={`/profile/${suggestedUser.id}`} className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            src={suggestedUser.avatar}
                            firstName={suggestedUser.firstName}
                            lastName={suggestedUser.lastName}
                            size="md"
                          />
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {suggestedUser.firstName} {suggestedUser.lastName}{suggestedUser.verified && <VerifiedBadge size={14} />}
                          </span>
                        </Link>
                        <button
                          onClick={() => handleAddFriend(suggestedUser.id)}
                          disabled={sentRequests[suggestedUser.id]}
                          className="text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 px-3 py-1.5 rounded-xl2 shrink-0"
                        >
                          {sentRequests[suggestedUser.id] ? t("Envoyee") : t("Ajouter")}
                        </button>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </section>
              )}

              {data?.popularPosts?.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-3">
                    <Sparkles size={15} className="text-brand-500" />{' '}{t("Publications populaires")}</h2>
                  <div className="space-y-4">
                    {data.popularPosts.map((post) => (
                      <PostCard key={post.id} post={post} onUpdated={updatePost} onDeleted={removePost} />
                    ))}
                  </div>
                </section>
              )}

              {data?.recentPosts?.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-600 mb-3">{t("Publications recentes")}</h2>
                  <div className="space-y-4">
                    {data.recentPosts.map((post) => (
                      <PostCard key={post.id} post={post} onUpdated={updatePost} onDeleted={removePost} />
                    ))}
                  </div>
                </section>
              )}

              {!data?.hashtags?.length && !data?.popularPosts?.length && !data?.recentPosts?.length && (
                <EmptyState icon={Compass} title={t("Rien a explorer pour le moment. Revenez plus tard, ou publiez quelque chose !")} />
              )}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
