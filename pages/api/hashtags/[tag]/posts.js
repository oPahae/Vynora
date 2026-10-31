import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const tag = (req.query.tag || '').toString().toLowerCase();
  if (!tag) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    const rawRows = await query(
      `SELECT p.* FROM post p
       JOIN postHashtag ph ON ph.postId = p.id
       JOIN hashtag h ON h.id = ph.hashtagId
       WHERE h.name = ? AND p.deletedAt IS NULL
         AND p.userId NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       ORDER BY p.createdAt DESC
       LIMIT ? OFFSET ?`,
      [tag, payload.id, payload.id, limit + 1, offset]
    );

    const hasMore = rawRows.length > limit;
    const pageRows = rawRows.slice(0, limit);

    const visibleRows = [];
    for (const row of pageRows) {
      const allowed = await canViewPost(payload.id, row);
      if (allowed) visibleRows.push(row);
    }

    if (visibleRows.length === 0) {
      return res.status(200).json({ success: true, posts: [], hasMore });
    }

    const ids = visibleRows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders}) ORDER BY p.createdAt DESC`, ids);
    const posts = await hydrateFullPosts(postRows, payload.id);

    return res.status(200).json({ success: true, posts, hasMore });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
