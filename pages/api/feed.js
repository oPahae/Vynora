import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import { getFeedCandidates, scoreAndRankPosts } from '@/lib/feedScoring';

async function getChronologicalCandidates(viewerId, limit, offset) {
  return query(
    `SELECT DISTINCT p.* FROM post p
     LEFT JOIN friend f ON f.status = 'accepted'
       AND ((f.requesterId = ? AND f.addresseeId = p.userId) OR (f.addresseeId = ? AND f.requesterId = p.userId))
     LEFT JOIN postVisibilityUser pvu ON pvu.postId = p.id AND pvu.userId = ?
     WHERE p.deletedAt IS NULL
       AND p.groupId IS NULL
       AND p.userId NOT IN (
         SELECT blockedId FROM block WHERE blockerId = ?
         UNION
         SELECT blockerId FROM block WHERE blockedId = ?
       )
       AND (
         p.userId = ?
         OR p.visibility = 'public'
         OR p.visibility = 'exceptFor'
         OR (p.visibility = 'friends' AND f.id IS NOT NULL)
         OR (p.visibility = 'onlyFor' AND pvu.userId IS NOT NULL)
       )
     ORDER BY p.createdAt DESC
     LIMIT ? OFFSET ?`,
    [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, limit + 1, offset]
  );
}

async function finalizePage(rawRows, limit, viewerId) {
  const hasMore = rawRows.length > limit;
  const pageRows = rawRows.slice(0, limit);

  const visibleRows = [];
  for (const row of pageRows) {
    const allowed = await canViewPost(viewerId, row);
    if (allowed) visibleRows.push(row);
  }

  if (visibleRows.length === 0) {
    return { posts: [], hasMore };
  }

  const ids = visibleRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
  const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  const posts = await hydrateFullPosts(orderedRows, viewerId);

  return { posts, hasMore };
}

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
    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const sort = req.query.sort === 'recent' ? 'recent' : 'smart';

    if (sort === 'recent') {
      const rawRows = await getChronologicalCandidates(payload.id, limit, offset);
      const { posts, hasMore } = await finalizePage(rawRows, limit, payload.id);
      return res.status(200).json({ success: true, posts, hasMore, sort });
    }

    // Mode "smart" (par defaut) : on recupere un lot de candidats plus
    // large que la page demandee, on le classe par pertinence (voir
    // lib/feedScoring.js) puis on decoupe la page courante dedans. Le lot
    // est recalcule a chaque requete : voir la limitation "Notes de
    // performance" du README pour la piste d'optimisation (cache) a grande
    // echelle.
    const candidates = await getFeedCandidates(payload.id);
    const ranked = await scoreAndRankPosts(payload.id, candidates);

    const hasMore = ranked.length > offset + limit;
    const pageRows = ranked.slice(offset, offset + limit);
    const { posts } = await finalizePage(pageRows, pageRows.length, payload.id);

    return res.status(200).json({ success: true, posts, hasMore, sort });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
