import { getUserFromRequest } from '@/lib/auth';
import { getTrendingHashtags, getPopularPosts, getRecentPosts } from '@/lib/explore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const hashtags = await getTrendingHashtags(8);
    const popularPosts = await getPopularPosts(payload.id, 6);
    const recentPosts = await getRecentPosts(
      payload.id,
      8,
      popularPosts.map((post) => post.id)
    );

    return res.status(200).json({ success: true, hashtags, popularPosts, recentPosts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
