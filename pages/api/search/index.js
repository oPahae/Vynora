import { getUserFromRequest } from '@/lib/auth';
import { searchAll, searchUsers, searchHashtags, searchPosts, recordSearch } from '@/lib/search';

const VALID_TYPES = ['all', 'users', 'hashtags', 'posts'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const searchTerm = (req.query.q || '').toString().trim();
  const type = VALID_TYPES.includes(req.query.type) ? req.query.type : 'all';

  if (searchTerm.length < 2) {
    return res.status(200).json({ success: true, users: [], hashtags: [], posts: [], hasMore: false });
  }

  try {
    // On n'enregistre l'historique que sur une recherche "confirmee"
    // (Entree / clic), jamais a chaque frappe du debounce cote client.
    if (req.query.record === '1') {
      await recordSearch(payload.id, searchTerm);
    }

    if (type === 'all') {
      const result = await searchAll(payload.id, searchTerm);
      return res.status(200).json({ success: true, ...result, hasMore: false });
    }

    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 15, 30);

    if (type === 'users') {
      const users = await searchUsers(payload.id, searchTerm, offset + limit + 1);
      const hasMore = users.length > offset + limit;
      return res.status(200).json({ success: true, users: users.slice(offset, offset + limit), hasMore });
    }

    if (type === 'hashtags') {
      const hashtags = await searchHashtags(searchTerm, offset + limit + 1);
      const hasMore = hashtags.length > offset + limit;
      return res.status(200).json({ success: true, hashtags: hashtags.slice(offset, offset + limit), hasMore });
    }

    // type === 'posts'
    const posts = await searchPosts(payload.id, searchTerm, offset + limit + 1);
    const hasMore = posts.length > offset + limit;
    return res.status(200).json({ success: true, posts: posts.slice(offset, offset + limit), hasMore });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
