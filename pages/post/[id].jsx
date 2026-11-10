import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { query } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import AppLayout from '@/components/layout/appLayout';
import PostCard from '@/components/posts/postCard';
import PublicPostView from '@/components/posts/publicPostView';
import { isPostPubliclyViewable, getBaseUrl } from '@/lib/publicPost';
import { pageTitle, APP_NAME } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function PostPage({ post, isPublicView = false, seo }) {
  const router = useRouter();
  const [currentPost, setCurrentPost] = useState(post);

  const head = (
    <Head>
      <title>
        {pageTitle(t("Publication de {firstName} {lastName}", { firstName: post.author.firstName, lastName: post.author.lastName }))}
      </title>
      {seo && (
        <>
          <meta name="description" content={seo.description} />
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content={APP_NAME} />
          <meta property="og:title" content={seo.title} />
          <meta property="og:description" content={seo.description} />
          <meta property="og:url" content={seo.url} />
          {seo.image && <meta property="og:image" content={seo.image} />}
          <meta name="twitter:card" content={seo.image ? 'summary_large_image' : 'summary'} />
          <meta name="twitter:title" content={seo.title} />
          <meta name="twitter:description" content={seo.description} />
          {seo.image && <meta name="twitter:image" content={seo.image} />}
        </>
      )}
    </Head>
  );

  // Visiteur sans compte (lien partage a l'exterieur) : vue en lecture seule.
  if (isPublicView) {
    return (
      <>
        {head}
        <PublicPostView post={post} loginHref={`/login?next=${encodeURIComponent(`/post/${post.id}`)}`} />
      </>
    );
  }

  return (
    <>
      {head}
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

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) {
    return { notFound: true };
  }

  const rawRows = await query('SELECT * FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [postId]);
  if (rawRows.length === 0) {
    return { notFound: true };
  }

  const isPublicView = !payload;
  if (isPublicView) {
    // Sans compte : uniquement les publications publiques ; sinon connexion.
    if (!(await isPostPubliclyViewable(rawRows[0]))) {
      return { redirect: { destination: `/login?next=${encodeURIComponent(`/post/${postId}`)}`, permanent: false } };
    }
  } else if (!(await canViewPost(payload.id, rawRows[0]))) {
    return { notFound: true };
  }

  const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
  const [hydrated] = await hydrateFullPosts(postRows, payload ? payload.id : 0);

  // Metadonnees Open Graph : apercu riche quand le lien est colle dans
  // WhatsApp, Facebook, Telegram, X, iMessage...
  const post = JSON.parse(JSON.stringify(hydrated));
  let seo = null;
  if (await isPostPubliclyViewable(rawRows[0])) {
    const base = getBaseUrl(req);
    const firstImage = (post.media || []).find((item) => item.type === 'image');
    const imageUrl = firstImage ? firstImage.url : post.author.avatar;
    const text = (post.content || '').replace(/\s+/g, ' ').trim();
    seo = {
      title: `${post.author.firstName} ${post.author.lastName} - ${APP_NAME}`,
      description: text ? (text.length > 200 ? `${text.slice(0, 197)}...` : text) : `${post.author.firstName} ${post.author.lastName} - ${APP_NAME}`,
      url: `${base}/post/${postId}`,
      image: imageUrl ? `${base}${imageUrl}` : null
    };
  }

  return {
    props: {
      post,
      isPublicView,
      seo
    }
  };
}
