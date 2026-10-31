import { query } from './db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from './posts';
import { getPostAggregatesBatch } from './posts';

const TRENDING_WINDOW_DAYS = 7;

export async function getTrendingHashtags(limit = 10) {
  const rows = await query(
    `SELECT h.name, COUNT(ph.postId) as postCount
     FROM hashtag h
     JOIN postHashtag ph ON ph.hashtagId = h.id
     JOIN post p ON p.id = ph.postId
     WHERE p.deletedAt IS NULL AND p.groupId IS NULL AND p.visibility = 'public'
       AND p.createdAt > DATE_SUB(NOW(), INTERVAL ${TRENDING_WINDOW_DAYS} DAY)
     GROUP BY h.id, h.name
     ORDER BY postCount DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({ name: row.name, postCount: Number(row.postCount) }));
}

// Publications publiques les plus engageantes de la fenetre recente
// (likes + commentaires*1.5 + partages*2), independamment du reseau social
// du viewer (decouverte de contenu, pas de fil personnalise).
export async function getPopularPosts(viewerId, limit = 10) {
  const candidateRows = await query(
    `SELECT p.* FROM post p
     WHERE p.deletedAt IS NULL AND p.groupId IS NULL AND p.visibility = 'public'
       AND p.createdAt > DATE_SUB(NOW(), INTERVAL ${TRENDING_WINDOW_DAYS} DAY)
       AND p.userId NOT IN (
         SELECT blockedId FROM block WHERE blockerId = ?
         UNION
         SELECT blockerId FROM block WHERE blockedId = ?
       )
     ORDER BY p.createdAt DESC
     LIMIT 100`,
    [viewerId, viewerId]
  );

  if (candidateRows.length === 0) return [];

  const aggregates = await getPostAggregatesBatch(candidateRows.map((row) => row.id), viewerId);
  const ranked = candidateRows
    .map((row) => {
      const agg = aggregates[row.id];
      const engagement = agg.totalReactions + agg.commentCount * 1.5 + agg.shareCount * 2;
      return { row, engagement };
    })
    .filter((item) => item.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const ids = ranked.map((item) => item.row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
  const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  return hydrateFullPosts(orderedRows, viewerId);
}

// Publications publiques recentes, en excluant celles deja mises en avant
// dans "populaires" pour eviter les doublons visuels sur la page.
export async function getRecentPosts(viewerId, limit = 10, excludeIds = []) {
  const rows = await query(
    `SELECT p.* FROM post p
     WHERE p.deletedAt IS NULL AND p.groupId IS NULL AND p.visibility = 'public'
       AND p.userId NOT IN (
         SELECT blockedId FROM block WHERE blockerId = ?
         UNION
         SELECT blockerId FROM block WHERE blockedId = ?
       )
       ${excludeIds.length > 0 ? `AND p.id NOT IN (${excludeIds.map(() => '?').join(', ')})` : ''}
     ORDER BY p.createdAt DESC
     LIMIT ?`,
    [viewerId, viewerId, ...excludeIds, limit]
  );

  if (rows.length === 0) return [];

  const visibleRows = [];
  for (const row of rows) {
    if (await canViewPost(viewerId, row)) visibleRows.push(row);
  }
  if (visibleRows.length === 0) return [];

  const ids = visibleRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
  const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  return hydrateFullPosts(orderedRows, viewerId);
}
