import { query } from './db';
import { mediaUrl } from './upload';
import { syncPostHashtags, syncPostMentions } from './posts';

const VALID_VISIBILITIES = ['public', 'friends', 'private', 'exceptFor', 'onlyFor'];
// Limite raisonnable de brouillons par utilisateur pour eviter les
// sauvegardes serveur excessives ("eviter les sauvegardes excessives cote
// serveur" demande explicitement dans le cahier des charges).
export const MAX_DRAFTS_PER_USER = 30;

export function isValidVisibility(value) {
  return VALID_VISIBILITIES.includes(value);
}

async function attachMedia(draftId, mediaIds) {
  if (!mediaIds || mediaIds.length === 0) return;
  const values = mediaIds.map((mediaId, index) => [draftId, mediaId, 'image', index]);
  await query(
    `INSERT INTO draftMedia (draftId, mediaId, type, position) VALUES ${values.map(() => '(?, ?, ?, ?)').join(', ')}`,
    values.flat()
  );
}

export async function createDraft(userId, { content, visibility, visibilityUserIds, mediaIds, mediaTypes }) {
  const countRows = await query('SELECT COUNT(*) as count FROM postDraft WHERE userId = ?', [userId]);
  if (Number(countRows[0].count) >= MAX_DRAFTS_PER_USER) {
    return { success: false, message: `Vous avez atteint la limite de ${MAX_DRAFTS_PER_USER} brouillons` };
  }

  const result = await query(
    'INSERT INTO postDraft (userId, content, visibility, visibilityUserIds) VALUES (?, ?, ?, ?)',
    [userId, content || null, visibility, visibilityUserIds && visibilityUserIds.length > 0 ? JSON.stringify(visibilityUserIds) : null]
  );
  const draftId = result.insertId;

  if (mediaIds && mediaIds.length > 0) {
    const values = mediaIds.map((mediaId, index) => [draftId, mediaId, mediaTypes?.[index] || 'image', index]);
    await query(
      `INSERT INTO draftMedia (draftId, mediaId, type, position) VALUES ${values.map(() => '(?, ?, ?, ?)').join(', ')}`,
      values.flat()
    );
  }

  return { success: true, draftId };
}

export async function updateDraft(userId, draftId, { content, visibility, visibilityUserIds, mediaIds, mediaTypes, replaceMedia }) {
  const rows = await query('SELECT id FROM postDraft WHERE id = ? AND userId = ? LIMIT 1', [draftId, userId]);
  if (rows.length === 0) return { success: false, message: 'Brouillon introuvable' };

  await query('UPDATE postDraft SET content = ?, visibility = ?, visibilityUserIds = ? WHERE id = ?', [
    content || null,
    visibility,
    visibilityUserIds && visibilityUserIds.length > 0 ? JSON.stringify(visibilityUserIds) : null,
    draftId
  ]);

  if (replaceMedia) {
    await query('DELETE FROM draftMedia WHERE draftId = ?', [draftId]);
    if (mediaIds && mediaIds.length > 0) {
      const values = mediaIds.map((mediaId, index) => [draftId, mediaId, mediaTypes?.[index] || 'image', index]);
      await query(
        `INSERT INTO draftMedia (draftId, mediaId, type, position) VALUES ${values.map(() => '(?, ?, ?, ?)').join(', ')}`,
        values.flat()
      );
    }
  }

  return { success: true };
}

export async function deleteDraft(userId, draftId) {
  await query('DELETE FROM postDraft WHERE id = ? AND userId = ?', [draftId, userId]);
}

export async function getDrafts(userId, offset, limit) {
  const rows = await query(
    `SELECT d.id, d.content, d.visibility, d.createdAt, d.updatedAt,
            (SELECT COUNT(*) FROM draftMedia dm WHERE dm.draftId = d.id) as mediaCount
     FROM postDraft d
     WHERE d.userId = ?
     ORDER BY d.updatedAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset]
  );

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  return {
    drafts: pageRows.map((row) => ({
      id: row.id,
      content: row.content,
      visibility: row.visibility,
      mediaCount: Number(row.mediaCount),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })),
    hasMore
  };
}

export async function getDraftById(userId, draftId) {
  const rows = await query('SELECT * FROM postDraft WHERE id = ? AND userId = ? LIMIT 1', [draftId, userId]);
  if (rows.length === 0) return null;

  const mediaRows = await query(
    'SELECT id, mediaId, type FROM draftMedia WHERE draftId = ? ORDER BY position ASC',
    [draftId]
  );

  let visibilityUserIds = [];
  if (rows[0].visibilityUserIds) {
    try {
      visibilityUserIds = JSON.parse(rows[0].visibilityUserIds);
    } catch (error) {
      visibilityUserIds = [];
    }
  }

  return {
    id: rows[0].id,
    content: rows[0].content,
    visibility: rows[0].visibility,
    visibilityUserIds,
    media: mediaRows.map((row) => ({ id: row.id, mediaId: row.mediaId, type: row.type, url: mediaUrl(row.mediaId) })),
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt
  };
}

export async function publishDraft(userId, draftId, mentionUserIds = []) {
  const draft = await getDraftById(userId, draftId);
  if (!draft) return { success: false, message: 'Brouillon introuvable' };
  if (!draft.content && draft.media.length === 0) {
    return { success: false, message: 'Le brouillon est vide' };
  }

  const result = await query('INSERT INTO post (userId, content, visibility) VALUES (?, ?, ?)', [
    userId,
    draft.content || null,
    draft.visibility
  ]);
  const postId = result.insertId;

  if (draft.media.length > 0) {
    const values = draft.media.map((media, index) => [postId, media.mediaId, media.type, index]);
    await query(
      `INSERT INTO postMedia (postId, mediaId, type, position) VALUES ${values.map(() => '(?, ?, ?, ?)').join(', ')}`,
      values.flat()
    );
  }

  if ((draft.visibility === 'exceptFor' || draft.visibility === 'onlyFor') && draft.visibilityUserIds.length > 0) {
    const visValues = draft.visibilityUserIds.map((visUserId) => [postId, visUserId]);
    await query(
      `INSERT INTO postVisibilityUser (postId, userId) VALUES ${visValues.map(() => '(?, ?)').join(', ')}`,
      visValues.flat()
    );
  }

  await syncPostHashtags(postId, draft.content);
  await syncPostMentions(postId, mentionUserIds, userId);
  await deleteDraft(userId, draftId);

  return { success: true, postId };
}
