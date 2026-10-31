import { query } from './db';
import { getRelationStatus, getMutualFriendsCount } from './friends';
import { withAvatarUrl } from './upload';
import { canViewPost, hydrateFullPosts, POST_SELECT } from './posts';
import { fuzzyTextScore, fuzzyWordScore } from './fuzzyMatch';

const MAX_HISTORY_PER_USER = 15;

// =====================================================================
// RECHERCHE INTELLIGENTE (tolerante aux fautes de frappe)
// =====================================================================
// Chaque recherche essaie d'abord un chemin rapide base sur un LIKE SQL
// (sous-chaine exacte, utilise les index, tres bon marche). Si ce chemin
// rapide ne remplit pas la limite demandee, on complete avec un second
// passage plus large : on recupere un lot borne de candidats supplementaires
// et on les compare au terme recherche avec `fuzzyTextScore`, qui tolere
// les fautes de frappe et les inversions de lettres (voir lib/fuzzyMatch.js).
// Ce second passage n'est declenche qu'en cas de besoin, pour eviter de
// scanner un lot large a chaque frappe quand la recherche exacte suffit
// deja.
// =====================================================================

const USER_FUZZY_POOL_SIZE = 500;
const HASHTAG_FUZZY_POOL_SIZE = 500;
const POST_FUZZY_POOL_SIZE = 300;

export async function searchUsers(viewerId, searchTerm, limit = 10) {
  const likeTerm = `%${searchTerm}%`;
  const exactRows = await query(
    `SELECT id, firstName, lastName, avatarId, ((premiumUntil IS NOT NULL AND premiumUntil > NOW()) OR role = 'admin') AS verified
     FROM user
     WHERE id != ? AND bannedAt IS NULL AND deactivatedAt IS NULL AND (firstName LIKE ? OR lastName LIKE ? OR CONCAT(firstName, ' ', lastName) LIKE ?)
       AND id NOT IN (
         SELECT blockedId FROM block WHERE blockerId = ?
         UNION
         SELECT blockerId FROM block WHERE blockedId = ?
       )
     ORDER BY firstName ASC, lastName ASC
     LIMIT ?`,
    [viewerId, likeTerm, likeTerm, likeTerm, viewerId, viewerId, limit]
  );

  let rows = exactRows;

  if (rows.length < limit) {
    const poolRows = await query(
      `SELECT id, firstName, lastName, avatarId, ((premiumUntil IS NOT NULL AND premiumUntil > NOW()) OR role = 'admin') AS verified
       FROM user
       WHERE id != ? AND bannedAt IS NULL AND deactivatedAt IS NULL
         AND id NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       LIMIT ?`,
      [viewerId, viewerId, viewerId, USER_FUZZY_POOL_SIZE]
    );

    const alreadyFoundIds = new Set(rows.map((row) => row.id));
    const fuzzyMatches = poolRows
      .filter((row) => !alreadyFoundIds.has(row.id))
      .map((row) => ({ row, score: fuzzyTextScore(`${row.firstName} ${row.lastName}`, searchTerm) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit - rows.length)
      .map((entry) => entry.row);

    rows = [...rows, ...fuzzyMatches];
  }

  return Promise.all(
    withAvatarUrl(rows).map(async (user) => ({
      ...user,
      status: await getRelationStatus(viewerId, user.id),
      mutualFriendsCount: await getMutualFriendsCount(viewerId, user.id)
    }))
  );
}

export async function searchHashtags(searchTerm, limit = 10) {
  const cleanTerm = searchTerm.replace(/^#/, '');
  const likeTerm = `%${cleanTerm}%`;
  const exactRows = await query(
    `SELECT h.name, COUNT(ph.postId) as postCount
     FROM hashtag h
     LEFT JOIN postHashtag ph ON ph.hashtagId = h.id
     LEFT JOIN post p ON p.id = ph.postId AND p.deletedAt IS NULL
     WHERE h.name LIKE ?
     GROUP BY h.id, h.name
     ORDER BY postCount DESC, h.name ASC
     LIMIT ?`,
    [likeTerm, limit]
  );

  let rows = exactRows;

  if (rows.length < limit) {
    const poolRows = await query(
      `SELECT h.name, COUNT(ph.postId) as postCount
       FROM hashtag h
       LEFT JOIN postHashtag ph ON ph.hashtagId = h.id
       LEFT JOIN post p ON p.id = ph.postId AND p.deletedAt IS NULL
       GROUP BY h.id, h.name
       ORDER BY postCount DESC, h.name ASC
       LIMIT ?`,
      [HASHTAG_FUZZY_POOL_SIZE]
    );

    const alreadyFoundNames = new Set(rows.map((row) => row.name));
    const fuzzyMatches = poolRows
      .filter((row) => !alreadyFoundNames.has(row.name))
      .map((row) => ({ row, score: fuzzyWordScore(row.name, cleanTerm) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit - rows.length)
      .map((entry) => entry.row);

    rows = [...rows, ...fuzzyMatches];
  }

  return rows.map((row) => ({ name: row.name, postCount: Number(row.postCount) }));
}

const POST_VISIBILITY_JOIN = `
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
       )`;

export async function searchPosts(viewerId, searchTerm, limit = 10) {
  const likeTerm = `%${searchTerm}%`;
  // Pre-filtre grossier (identique en esprit au fil d'actualite) : on
  // recupere davantage de candidats que necessaire car certains seront
  // ensuite exclus par la verification fine `canViewPost`.
  const rawRows = await query(
    `SELECT DISTINCT p.* FROM post p
     ${POST_VISIBILITY_JOIN}
       AND p.content LIKE ?
     ORDER BY p.createdAt DESC
     LIMIT ?`,
    [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, likeTerm, limit * 3]
  );

  const visibleRows = [];
  for (const row of rawRows) {
    if (visibleRows.length >= limit) break;
    if (await canViewPost(viewerId, row)) visibleRows.push(row);
  }

  if (visibleRows.length < limit) {
    // Chemin flou : on elargit a un lot recent de publications visibles
    // (sans filtre de contenu cette fois) et on compare chaque contenu au
    // terme recherche avec tolerance aux fautes de frappe.
    const poolRows = await query(
      `SELECT DISTINCT p.* FROM post p
       ${POST_VISIBILITY_JOIN}
       ORDER BY p.createdAt DESC
       LIMIT ?`,
      [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, POST_FUZZY_POOL_SIZE]
    );

    const alreadyFoundIds = new Set(visibleRows.map((row) => row.id));
    const scored = [];
    for (const row of poolRows) {
      if (alreadyFoundIds.has(row.id)) continue;
      if (visibleRows.length + scored.length >= limit * 3) break;
      const score = fuzzyTextScore(row.content, searchTerm);
      if (score === null) continue;
      if (!(await canViewPost(viewerId, row))) continue;
      scored.push({ row, score });
    }
    scored.sort((a, b) => b.score - a.score);
    visibleRows.push(...scored.slice(0, limit - visibleRows.length).map((entry) => entry.row));
  }

  if (visibleRows.length === 0) return [];

  const ids = visibleRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
  const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
  return hydrateFullPosts(orderedRows, viewerId);
}

export async function searchAll(viewerId, searchTerm) {
  const [users, hashtags, posts] = await Promise.all([
    searchUsers(viewerId, searchTerm, 5),
    searchHashtags(searchTerm, 5),
    searchPosts(viewerId, searchTerm, 5)
  ]);
  return { users, hashtags, posts };
}

// ---- Historique de recherche ----

export async function recordSearch(userId, searchTerm) {
  const trimmed = searchTerm.trim().slice(0, 150);
  if (!trimmed) return;

  // Evite les doublons consecutifs : si la derniere recherche enregistree
  // est identique, on se contente de la remonter en date plutot que d'en
  // creer une nouvelle ligne.
  const existing = await query(
    'SELECT id FROM searchHistory WHERE userId = ? AND queryText = ? ORDER BY createdAt DESC LIMIT 1',
    [userId, trimmed]
  );
  if (existing.length > 0) {
    await query('UPDATE searchHistory SET createdAt = CURRENT_TIMESTAMP WHERE id = ?', [existing[0].id]);
  } else {
    await query('INSERT INTO searchHistory (userId, queryText) VALUES (?, ?)', [userId, trimmed]);
  }

  // Purge les entrees les plus anciennes au-dela de la limite, pour eviter
  // une croissance illimitee de l'historique.
  await query(
    `DELETE FROM searchHistory WHERE userId = ? AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM searchHistory WHERE userId = ? ORDER BY createdAt DESC LIMIT ?
       ) as keep
     )`,
    [userId, userId, MAX_HISTORY_PER_USER]
  );
}

export async function getRecentSearches(userId, limit = MAX_HISTORY_PER_USER) {
  const rows = await query('SELECT id, queryText, createdAt FROM searchHistory WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [
    userId,
    limit
  ]);
  return rows;
}

export async function clearSearchHistory(userId) {
  await query('DELETE FROM searchHistory WHERE userId = ?', [userId]);
}

export async function deleteSearchHistoryEntry(userId, id) {
  await query('DELETE FROM searchHistory WHERE id = ? AND userId = ?', [id, userId]);
}
