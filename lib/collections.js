import { query } from './db';
import { mediaUrl } from './upload';
import { getFriendRow, getBlockStatus } from './friends';
import { canViewPost, hydrateFullPosts, POST_SELECT } from './posts';
import { hydrateReels, REEL_SELECT, reelVisibilitySql } from './reels';

export const COLLECTION_COLORS = ['violet', 'blue', 'emerald', 'amber', 'rose', 'slate'];
export const COLLECTION_VISIBILITIES = ['private', 'friends', 'public'];
export const MAX_COLLECTIONS_PER_USER = 100;
export const MAX_ITEMS_PER_COLLECTION = 500;
const MAX_DEPTH = 4;

function format(row, extra = {}) {
  return {
    id: row.id,
    userId: row.userId,
    parentId: row.parentId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    color: row.color,
    visibility: row.visibility,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra
  };
}

export async function getCollectionRow(id) {
  const rows = await query('SELECT * FROM collection WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Visibilite : proprietaire = toujours ; amis = amis acceptes ; public = tous
// (sauf blocage) ; prive = proprietaire uniquement.
export async function canViewCollection(viewerId, collection) {
  if (collection.userId === viewerId) return true;
  const { blockedByMe, blockingMe } = await getBlockStatus(viewerId, collection.userId);
  if (blockedByMe || blockingMe) return false;
  const owner = await query('SELECT bannedAt FROM user WHERE id = ? LIMIT 1', [collection.userId]);
  if (!owner[0] || owner[0].bannedAt) return false;
  if (collection.visibility === 'public') return true;
  if (collection.visibility === 'friends') {
    const friend = await getFriendRow(viewerId, collection.userId);
    return Boolean(friend && friend.status === 'accepted');
  }
  return false;
}

async function getDepth(parentId) {
  let depth = 0;
  let current = parentId;
  while (current && depth <= MAX_DEPTH) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await query('SELECT parentId FROM collection WHERE id = ? LIMIT 1', [current]);
    if (!rows[0]) break;
    depth += 1;
    current = rows[0].parentId;
  }
  return depth;
}

async function buildPreviews(collectionIds) {
  const previews = {};
  collectionIds.forEach((id) => {
    previews[id] = [];
  });
  if (collectionIds.length === 0) return previews;
  const placeholders = collectionIds.map(() => '?').join(', ');
  const rows = await query(
    `SELECT ci.collectionId, ci.itemType, ci.itemId, ci.position
     FROM collectionItem ci WHERE ci.collectionId IN (${placeholders})
     ORDER BY ci.collectionId, ci.position ASC, ci.id ASC`,
    collectionIds
  );
  const take = {};
  const wanted = [];
  rows.forEach((row) => {
    take[row.collectionId] = (take[row.collectionId] || 0) + 1;
    if (take[row.collectionId] <= 4) wanted.push(row);
  });

  const postIds = wanted.filter((row) => row.itemType === 'post').map((row) => row.itemId);
  const reelIds = wanted.filter((row) => row.itemType === 'reel').map((row) => row.itemId);
  const postMedia = {};
  if (postIds.length > 0) {
    const mediaRows = await query(
      `SELECT postId, mediaId, type FROM postMedia WHERE postId IN (${postIds.map(() => '?').join(', ')}) ORDER BY position ASC`,
      postIds
    );
    mediaRows.forEach((row) => {
      if (!postMedia[row.postId]) postMedia[row.postId] = { url: mediaUrl(row.mediaId), isVideo: row.type === 'video' };
    });
  }
  const reelMedia = {};
  if (reelIds.length > 0) {
    const reelRows = await query(`SELECT id, mediaId FROM reel WHERE id IN (${reelIds.map(() => '?').join(', ')}) AND deletedAt IS NULL`, reelIds);
    reelRows.forEach((row) => {
      reelMedia[row.id] = { url: mediaUrl(row.mediaId), isVideo: true };
    });
  }
  wanted.forEach((row) => {
    const media = row.itemType === 'post' ? postMedia[row.itemId] : reelMedia[row.itemId];
    previews[row.collectionId].push(media ? { ...media, type: row.itemType } : { url: null, isVideo: false, type: row.itemType });
  });
  return previews;
}

export async function attachCounts(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [itemRows, childRows] = await Promise.all([
    query(`SELECT collectionId, COUNT(*) AS count FROM collectionItem WHERE collectionId IN (${placeholders}) GROUP BY collectionId`, ids),
    query(`SELECT parentId, COUNT(*) AS count FROM collection WHERE parentId IN (${placeholders}) GROUP BY parentId`, ids)
  ]);
  const previews = await buildPreviews(ids);
  const items = Object.fromEntries(itemRows.map((row) => [row.collectionId, Number(row.count)]));
  const children = Object.fromEntries(childRows.map((row) => [row.parentId, Number(row.count)]));
  return rows.map((row) =>
    format(row, { itemCount: items[row.id] || 0, childCount: children[row.id] || 0, previews: previews[row.id] || [] })
  );
}

// Liste les collections d'un niveau (parentId null = racine) visibles par le viewer.
export async function listCollections(ownerId, viewerId, parentId = null) {
  const rows = await query(
    `SELECT * FROM collection WHERE userId = ? AND parentId <=> ? ORDER BY kind = 'folder' DESC, position ASC, id ASC`,
    [ownerId, parentId]
  );
  const visible = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewCollection(viewerId, row)) visible.push(row);
  }
  return attachCounts(visible);
}

// Toutes les collections de l'utilisateur, a plat, avec indicateur de presence d'un element.
export async function listForPicker(userId, itemType, itemId) {
  const rows = await query(
    `SELECT c.*, EXISTS(SELECT 1 FROM collectionItem ci WHERE ci.collectionId = c.id AND ci.itemType = ? AND ci.itemId = ?) AS hasItem
     FROM collection c WHERE c.userId = ? ORDER BY c.kind = 'folder' DESC, c.name ASC`,
    [itemType, itemId, userId]
  );
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  const pathOf = (row) => {
    const parts = [row.name];
    let parent = row.parentId ? byId[row.parentId] : null;
    let guard = 0;
    while (parent && guard < 6) {
      parts.unshift(parent.name);
      parent = parent.parentId ? byId[parent.parentId] : null;
      guard += 1;
    }
    return parts.join(' / ');
  };
  return rows.map((row) => format(row, { hasItem: Boolean(row.hasItem), path: pathOf(row) }));
}

export async function getBreadcrumb(collection) {
  const trail = [];
  let current = collection.parentId;
  let guard = 0;
  while (current && guard < 8) {
    // eslint-disable-next-line no-await-in-loop
    const row = await getCollectionRow(current);
    if (!row) break;
    trail.unshift({ id: row.id, name: row.name });
    current = row.parentId;
    guard += 1;
  }
  return trail;
}

export async function createCollection(userId, { name, description, kind, color, visibility, parentId }) {
  const cleanName = (name || '').toString().trim().slice(0, 100);
  if (!cleanName) return { success: false, message: 'Le nom est requis' };
  if (!['folder', 'playlist'].includes(kind)) return { success: false, message: 'Type invalide' };

  const count = await query('SELECT COUNT(*) AS count FROM collection WHERE userId = ?', [userId]);
  if (Number(count[0].count) >= MAX_COLLECTIONS_PER_USER) {
    return { success: false, message: `Limite atteinte (${MAX_COLLECTIONS_PER_USER} collections)` };
  }

  let parent = null;
  if (parentId) {
    parent = await getCollectionRow(Number(parentId));
    if (!parent || parent.userId !== userId) return { success: false, message: 'Dossier parent introuvable' };
    if (parent.kind !== 'folder') return { success: false, message: 'Une playlist ne peut pas contenir de sous-collection' };
    if ((await getDepth(parent.id)) >= MAX_DEPTH) return { success: false, message: 'Profondeur maximale de dossiers atteinte' };
  }

  const safeColor = COLLECTION_COLORS.includes(color) ? color : 'violet';
  const safeVisibility = COLLECTION_VISIBILITIES.includes(visibility) ? visibility : 'private';
  const position = await query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM collection WHERE userId = ? AND parentId <=> ?', [
    userId,
    parent ? parent.id : null
  ]);

  const result = await query(
    'INSERT INTO collection (userId, parentId, kind, name, description, color, visibility, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      userId,
      parent ? parent.id : null,
      kind,
      cleanName,
      (description || '').toString().trim().slice(0, 300) || null,
      safeColor,
      safeVisibility,
      Number(position[0].next)
    ]
  );
  return { success: true, id: result.insertId };
}

export async function updateCollection(userId, collectionId, body) {
  const collection = await getCollectionRow(collectionId);
  if (!collection || collection.userId !== userId) return { success: false, status: 404, message: 'Collection introuvable' };

  const sets = [];
  const params = [];

  if (body.name !== undefined) {
    const name = (body.name || '').toString().trim().slice(0, 100);
    if (!name) return { success: false, status: 422, message: 'Le nom est requis' };
    sets.push('name = ?');
    params.push(name);
  }
  if (body.description !== undefined) {
    sets.push('description = ?');
    params.push((body.description || '').toString().trim().slice(0, 300) || null);
  }
  if (body.color !== undefined && COLLECTION_COLORS.includes(body.color)) {
    sets.push('color = ?');
    params.push(body.color);
  }
  if (body.visibility !== undefined && COLLECTION_VISIBILITIES.includes(body.visibility)) {
    sets.push('visibility = ?');
    params.push(body.visibility);
  }

  // Deplacement dans un autre dossier (parentId null = racine).
  if (body.parentId !== undefined) {
    const newParentId = body.parentId ? Number(body.parentId) : null;
    if (newParentId === collection.id) return { success: false, status: 422, message: 'Deplacement invalide' };
    if (newParentId) {
      const parent = await getCollectionRow(newParentId);
      if (!parent || parent.userId !== userId || parent.kind !== 'folder') {
        return { success: false, status: 422, message: 'Dossier de destination invalide' };
      }
      // interdit de deplacer un dossier dans l'un de ses descendants
      let cursor = parent;
      let guard = 0;
      while (cursor && guard < 10) {
        if (cursor.id === collection.id) return { success: false, status: 422, message: 'Deplacement circulaire impossible' };
        // eslint-disable-next-line no-await-in-loop
        cursor = cursor.parentId ? await getCollectionRow(cursor.parentId) : null;
        guard += 1;
      }
      if ((await getDepth(newParentId)) >= MAX_DEPTH) return { success: false, status: 422, message: 'Profondeur maximale atteinte' };
    }
    sets.push('parentId = ?');
    params.push(newParentId);
  }

  if (sets.length === 0) return { success: true };
  await query(`UPDATE collection SET ${sets.join(', ')} WHERE id = ?`, [...params, collectionId]);
  return { success: true };
}

export async function deleteCollection(userId, collectionId) {
  const collection = await getCollectionRow(collectionId);
  if (!collection || collection.userId !== userId) return { success: false, status: 404, message: 'Collection introuvable' };
  await query('DELETE FROM collection WHERE id = ?', [collectionId]);
  return { success: true };
}

async function itemExists(itemType, itemId) {
  if (itemType === 'post') {
    const rows = await query('SELECT id, userId, visibility, groupId FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [itemId]);
    return rows[0] || null;
  }
  if (itemType === 'reel') {
    const rows = await query('SELECT id, userId FROM reel WHERE id = ? AND deletedAt IS NULL LIMIT 1', [itemId]);
    return rows[0] || null;
  }
  return null;
}

export async function addItem(userId, collectionId, itemType, itemId) {
  const collection = await getCollectionRow(collectionId);
  if (!collection || collection.userId !== userId) return { success: false, status: 404, message: 'Collection introuvable' };
  if (!['post', 'reel'].includes(itemType) || !Number.isInteger(itemId)) {
    return { success: false, status: 422, message: 'Element invalide' };
  }

  const target = await itemExists(itemType, itemId);
  if (!target) return { success: false, status: 404, message: 'Contenu introuvable' };
  if (itemType === 'post' && !(await canViewPost(userId, target))) {
    return { success: false, status: 403, message: 'Action non autorisee' };
  }

  const count = await query('SELECT COUNT(*) AS count, COALESCE(MAX(position), 0) AS maxPos FROM collectionItem WHERE collectionId = ?', [collectionId]);
  if (Number(count[0].count) >= MAX_ITEMS_PER_COLLECTION) {
    return { success: false, status: 422, message: `Limite atteinte (${MAX_ITEMS_PER_COLLECTION} elements)` };
  }

  const result = await query(
    'INSERT IGNORE INTO collectionItem (collectionId, itemType, itemId, position) VALUES (?, ?, ?, ?)',
    [collectionId, itemType, itemId, Number(count[0].maxPos) + 1]
  );
  await query('UPDATE collection SET updatedAt = NOW() WHERE id = ?', [collectionId]);
  return { success: true, added: result.affectedRows > 0 };
}

export async function removeItem(userId, collectionId, itemType, itemId) {
  const collection = await getCollectionRow(collectionId);
  if (!collection || collection.userId !== userId) return { success: false, status: 404, message: 'Collection introuvable' };
  await query('DELETE FROM collectionItem WHERE collectionId = ? AND itemType = ? AND itemId = ?', [collectionId, itemType, itemId]);
  return { success: true };
}

// orderedItemIds : ids des lignes collectionItem dans le nouvel ordre.
export async function reorderItems(userId, collectionId, orderedItemIds) {
  const collection = await getCollectionRow(collectionId);
  if (!collection || collection.userId !== userId) return { success: false, status: 404, message: 'Collection introuvable' };
  const ids = (orderedItemIds || []).map(Number).filter((id) => Number.isInteger(id));
  for (let index = 0; index < ids.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await query('UPDATE collectionItem SET position = ? WHERE id = ? AND collectionId = ?', [index + 1, ids[index], collectionId]);
  }
  return { success: true };
}

// Elements d'une collection, hydrates et filtres selon ce que le viewer a le droit de voir.
export async function getCollectionItems(collection, viewerId) {
  const rows = await query(
    'SELECT id, itemType, itemId, position, addedAt FROM collectionItem WHERE collectionId = ? ORDER BY position ASC, id ASC',
    [collection.id]
  );
  const isOwner = collection.userId === viewerId;

  const postIds = rows.filter((row) => row.itemType === 'post').map((row) => row.itemId);
  const reelIds = rows.filter((row) => row.itemType === 'reel').map((row) => row.itemId);

  const postsById = {};
  if (postIds.length > 0) {
    const postRows = await query(`${POST_SELECT} WHERE p.id IN (${postIds.map(() => '?').join(', ')}) AND p.deletedAt IS NULL`, postIds);
    const allowed = [];
    for (const row of postRows) {
      // eslint-disable-next-line no-await-in-loop
      if (await canViewPost(viewerId, row)) allowed.push(row);
    }
    const hydrated = await hydrateFullPosts(allowed, viewerId);
    hydrated.forEach((post) => {
      postsById[post.id] = post;
    });
  }

  const reelsById = {};
  if (reelIds.length > 0) {
    const vis = reelVisibilitySql(viewerId);
    const reelRows = await query(`${REEL_SELECT} WHERE r.id IN (${reelIds.map(() => '?').join(', ')}) AND ${vis.clause}`, [
      ...reelIds,
      ...vis.params
    ]);
    const hydrated = await hydrateReels(reelRows, viewerId);
    hydrated.forEach((reel) => {
      reelsById[reel.id] = reel;
    });
  }

  const items = [];
  rows.forEach((row) => {
    const content = row.itemType === 'post' ? postsById[row.itemId] : reelsById[row.itemId];
    if (!content && !isOwner) return; // contenu supprime / prive : masque aux visiteurs
    items.push({
      id: row.id,
      itemType: row.itemType,
      itemId: row.itemId,
      position: row.position,
      addedAt: row.addedAt,
      unavailable: !content,
      post: row.itemType === 'post' ? content || null : null,
      reel: row.itemType === 'reel' ? content || null : null
    });
  });
  return items;
}

export { format as formatCollection };
