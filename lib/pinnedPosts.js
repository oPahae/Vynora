import { query } from './db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from './posts';

export const MAX_PINNED_POSTS = 3;

export async function getPinnedPostIds(userId) {
  const rows = await query('SELECT postId FROM pinnedPost WHERE userId = ? ORDER BY position ASC', [userId]);
  return rows.map((row) => row.postId);
}

export async function pinPost(userId, postId) {
  const postRows = await query('SELECT id, userId FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [postId]);
  if (postRows.length === 0) {
    return { success: false, message: 'Publication introuvable' };
  }
  if (postRows[0].userId !== userId) {
    // Empeche explicitement d'epingler une publication qui ne nous appartient pas.
    return { success: false, message: "Vous ne pouvez epingler que vos propres publications" };
  }

  const existing = await query('SELECT id FROM pinnedPost WHERE userId = ? AND postId = ? LIMIT 1', [
    userId,
    postId
  ]);
  if (existing.length > 0) return { success: true };

  const countRows = await query('SELECT COUNT(*) as count, MAX(position) as maxPosition FROM pinnedPost WHERE userId = ?', [
    userId
  ]);
  const count = Number(countRows[0].count);
  if (count >= MAX_PINNED_POSTS) {
    return { success: false, message: `Vous ne pouvez epingler que ${MAX_PINNED_POSTS} publications maximum` };
  }

  const nextPosition = countRows[0].maxPosition !== null ? Number(countRows[0].maxPosition) + 1 : 0;
  await query('INSERT INTO pinnedPost (userId, postId, position) VALUES (?, ?, ?)', [userId, postId, nextPosition]);
  return { success: true };
}

export async function unpinPost(userId, postId) {
  await query('DELETE FROM pinnedPost WHERE userId = ? AND postId = ?', [userId, postId]);
  return { success: true };
}

export async function getPinnedPosts(profileUserId, viewerId) {
  const ids = await getPinnedPostIds(profileUserId);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const rawRows = await query(`SELECT * FROM post WHERE id IN (${placeholders}) AND deletedAt IS NULL`, ids);
  const rawById = Object.fromEntries(rawRows.map((row) => [row.id, row]));

  const visibleIds = [];
  for (const id of ids) {
    const row = rawById[id];
    if (row && (await canViewPost(viewerId, row))) visibleIds.push(id);
  }
  if (visibleIds.length === 0) return [];

  const hydPlaceholders = visibleIds.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${hydPlaceholders})`, visibleIds);
  const orderedRows = visibleIds.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  const posts = await hydrateFullPosts(orderedRows, viewerId);

  return posts.map((post) => ({ ...post, isPinned: true }));
}
