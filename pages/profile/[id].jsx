import { useEffect } from 'react';
import Head from 'next/head';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { isPremiumDate } from '@/lib/premium';
import { getRelationStatus, getMutualFriendsCount, getFriendsCount, getBlockStatus, getFriendsList } from '@/lib/friends';
import { withProfileUrls, withAvatarUrl } from '@/lib/upload';
import AppLayout from '@/components/layout/appLayout';
import ProfileHeader from '@/components/profile/profileHeader';
import AboutCard from '@/components/profile/aboutCard';
import FriendsCard from '@/components/profile/friendsCard';
import PostList from '@/components/posts/postList';
import PinnedPostsSection from '@/components/profile/pinnedPostsSection';
import { ProfileReelsSection, ProfileCollectionsCard } from '@/components/profile/profileReelsAndCollections';
import { pageTitle } from '@/lib/constants';

import BlockedProfileNotice from '@/components/profile/blockedProfileNotice';
import PrivateProfileNotice from '@/components/profile/privateProfileNotice';

import { t } from '@/lib/i18n/runtime';
export default function ProfilePage({ profile, relation, mutualFriendsCount, friendsCount, friendsPreview, isSelf }) {
  const isUnavailable = (relation.blockingMe || relation.blockedByMe) && !isSelf;
  const isPrivateLocked = !isUnavailable && !isSelf && profile.isPrivate && relation.status !== 'friends';

  // Enregistre la visite (les visiteurs sont visibles par les comptes premium).
  useEffect(() => {
    if (isSelf || isUnavailable) return;
    fetch(`/api/users/${profile.id}/visit`, { method: 'POST' }).catch(() => {});
  }, [profile.id, isSelf, isUnavailable]);

  return (
    <>
      <Head>
        <title>
          {pageTitle(`${profile.firstName} ${profile.lastName}`)}
        </title>
      </Head>
      <AppLayout>
        {isUnavailable ? (
          <BlockedProfileNotice profile={profile} relation={relation} />
        ) : (
          <>
            <ProfileHeader
              key={profile.id}
              profile={profile}
              relation={relation}
              mutualFriendsCount={mutualFriendsCount}
              friendsCount={friendsCount}
              isSelf={isSelf}
              showStatus={isSelf || !isPrivateLocked}
            />
            {isPrivateLocked ? (
              <div className="mt-6">
                <PrivateProfileNotice firstName={profile.firstName} relationStatus={relation.status} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="md:col-span-1 space-y-6">
                  <AboutCard key={profile.id} profile={profile} />
                  <ProfileCollectionsCard key={`collections-${profile.id}`} userId={profile.id} isSelf={isSelf} />
                  <FriendsCard
                    key={t("friends-{id}", { id: profile.id })}
                    userId={profile.id}
                    friendsCount={friendsCount}
                    friendsPreview={friendsPreview}
                    isSelf={isSelf}
                  />
                </div>
                <div className="md:col-span-2 space-y-6">
                  <ProfileReelsSection key={`reels-${profile.id}`} userId={profile.id} isSelf={isSelf} />
                  <PinnedPostsSection key={t("pinned-{id}", { id: profile.id })} userId={profile.id} />
                  <PostList key={profile.id} endpoint={`/api/users/${profile.id}/posts`} canCompose={isSelf} />
                </div>
              </div>
            )}
          </>
        )}
      </AppLayout>
    </>
  );
}

export async function getServerSideProps(context) {
  const { req, params } = context;
  const payload = await getUserFromRequest(req);

  if (!payload) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const targetId = Number(params.id);
  if (!Number.isInteger(targetId)) {
    return { notFound: true };
  }

  const rows = await query(
    `SELECT id, firstName, lastName, avatarId, coverId, avatarPostId, coverPostId, bio, work, education,
            city, country, gender, birthDate, createdAt, socialLinks, musicMediaId, musicTitle, musicStartSec, musicEndSec,
            isPrivate, deactivatedAt, bannedAt, premiumUntil, role
     FROM user WHERE id = ? LIMIT 1`,
    [targetId]
  );

  if (rows.length === 0 || (rows[0].bannedAt && !payload.isAdmin) || (rows[0].deactivatedAt && payload.id !== targetId)) {
    return { notFound: true };
  }

  const { premiumUntil, role: profileRole, ...rowData } = rows[0];
  const profile = {
    ...withProfileUrls(rowData),
    verified: isPremiumDate(premiumUntil) || profileRole === 'admin',
    isPrivate: Boolean(rows[0].isPrivate),
    musicStartSec: rows[0].musicStartSec !== null ? Number(rows[0].musicStartSec) : 0,
    musicEndSec: rows[0].musicEndSec !== null ? Number(rows[0].musicEndSec) : null
  };
  const isSelf = payload.id === targetId;
  const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, targetId);
  const status = await getRelationStatus(payload.id, targetId);
  const isPrivateLocked = !isSelf && profile.isPrivate && status !== 'friends' && !blockedByMe && !blockingMe;
  const mutualFriendsCount = isSelf ? 0 : await getMutualFriendsCount(payload.id, targetId);
  const friendsCount = await getFriendsCount(targetId);
  const friendsPreview =
    blockedByMe || blockingMe || isPrivateLocked ? [] : withAvatarUrl(await getFriendsList(targetId, 9));

  return {
    props: {
      profile: JSON.parse(JSON.stringify(profile)),
      relation: { status, blockedByMe, blockingMe },
      mutualFriendsCount,
      friendsCount,
      friendsPreview: JSON.parse(JSON.stringify(friendsPreview)),
      isSelf
    }
  };
}
