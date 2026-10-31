import { query } from './db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from './posts';

export async function isPostSaved(userId, postId) {
  const rows = await query('SELECT 1 FROM savedPost WHERE userId = ? AND postId = ? LIMIT 1', [userId, postId]);
  return rows.length > 0;
}

export async function savePost(userId, postId) {
  // ON DUPLICATE KEY ignore : evite les doublons si l'utilisateur double-clique.
  await query(
    'INSERT INTO savedPost (userId, postId) VALUES (?, ?) ON DUPLICATE KEY UPDATE createdAt = createdAt',
    [userId, postId]
  );
}

export async function unsavePost(userId, postId) {
  await query('DELETE FROM savedPost WHERE userId = ? AND postId = ?', [userId, postId]);
}

const CATEGORY_FILTERS = {
  all: '',
  photos: `AND EXISTS (SELECT 1 FROM postMedia pm WHERE pm.postId = p.id AND pm.type = 'image')`,
  videos: `AND EXISTS (SELECT 1 FROM postMedia pm WHERE pm.postId = p.id AND pm.type = 'video')`,
  posts: `AND NOT EXISTS (SELECT 1 FROM postMedia pm WHERE pm.postId = p.id)`
};

export async function getSavedPosts(userId, { offset, limit, category = 'all' }) {
  const filter = CATEGORY_FILTERS[category] || '';

  const rawRows = await query(
    `SELECT p.*, sp.createdAt as savedAt FROM savedPost sp
     JOIN post p ON p.id = sp.postId
     WHERE sp.userId = ? AND p.deletedAt IS NULL ${filter}
     ORDER BY sp.createdAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset]
  );

  const hasMore = rawRows.length > limit;
  const pageRows = rawRows.slice(0, limit);

  // Un post enregistre peut ne plus etre visible (visibilite changee, auteur
  // devenu prive, blocage...) : on le filtre silencieusement plutot que de
  // planter, sans jamais le supprimer des favoris de l'utilisateur.
  const visibleRows = [];
  for (const row of pageRows) {
    const allowed = await canViewPost(userId, row);
    if (allowed) visibleRows.push(row);
  }

  if (visibleRows.length === 0) {
    return { posts: [], hasMore };
  }

  const ids = visibleRows.map((row) => row.id);
  const savedAtById = Object.fromEntries(visibleRows.map((row) => [row.id, row.savedAt]));
  const placeholders = ids.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
  const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  const posts = await hydrateFullPosts(orderedRows, userId);

  return {
    posts: posts.map((post) => ({ ...post, savedAt: savedAtById[post.id] })),
    hasMore
  };
}
