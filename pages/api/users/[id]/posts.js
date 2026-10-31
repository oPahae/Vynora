import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import { getBlockStatus } from '@/lib/friends';
import { getPinnedPostIds } from '@/lib/pinnedPosts';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const targetId = Number(req.query.id);
  if (!Number.isInteger(targetId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, targetId);
    if (blockedByMe || blockingMe) {
      return res.status(200).json({ success: true, posts: [], hasMore: false });
    }

    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    // Les publications epinglees sont deja affichees dans leur propre
    // bandeau en haut du profil : on evite de les dupliquer ici, seulement
    // sur la premiere page (offset 0) pour ne pas decaler la pagination.
    const pinnedIds = offset === 0 ? await getPinnedPostIds(targetId) : [];
    const pinnedExclusion = pinnedIds.length > 0 ? `AND id NOT IN (${pinnedIds.map(() => '?').join(', ')})` : '';

    // Les publications faites dans un groupe n'apparaissent pas sur le
    // profil (elles restent visibles dans le groupe lui-meme).
    const rawRows = await query(
      `SELECT * FROM post WHERE userId = ? AND deletedAt IS NULL AND groupId IS NULL ${pinnedExclusion} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [targetId, ...pinnedIds, limit + 1, offset]
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
