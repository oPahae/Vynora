import { getUserFromRequest } from '@/lib/auth';
import { getSavedPosts } from '@/lib/savedPosts';

const VALID_CATEGORIES = ['all', 'photos', 'videos', 'posts'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const offset = Number(req.query.offset) || 0;
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  const category = VALID_CATEGORIES.includes(req.query.category) ? req.query.category : 'all';

  try {
    const { posts, hasMore } = await getSavedPosts(payload.id, { offset, limit, category });
    return res.status(200).json({ success: true, posts, hasMore });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
