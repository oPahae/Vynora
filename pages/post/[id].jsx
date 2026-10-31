import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import AppLayout from '@/components/layout/appLayout';
import PostCard from '@/components/posts/postCard';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function PostPage({ post }) {
  const router = useRouter();
  const [currentPost, setCurrentPost] = useState(post);

  return (
    <>
      <Head>
        <title>
          {pageTitle(t("Publication de {firstName} {lastName}", { firstName: post.author.firstName, lastName: post.author.lastName }))}
        </title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PostCard
            post={currentPost}
            onUpdated={setCurrentPost}
            onDeleted={() => router.push(`/profile/${post.author.id}`)}
          />
        </div>
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

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) {
    return { notFound: true };
  }

  const rawRows = await query('SELECT * FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [postId]);
  if (rawRows.length === 0) {
    return { notFound: true };
  }

  const allowed = await canViewPost(payload.id, rawRows[0]);
  if (!allowed) {
    return { notFound: true };
  }

  const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
  const [hydrated] = await hydrateFullPosts(postRows, payload.id);

  return {
    props: {
      post: JSON.parse(JSON.stringify(hydrated))
    }
  };
}
