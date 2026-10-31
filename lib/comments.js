import { query } from './db';
import { REACTION_TYPES, canViewPost } from './posts';
import { mediaUrl } from './upload';
import { createNotification } from './notifications';

function emptyReactionMap() {
  return REACTION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
}

export async function getCommentAggregates(commentId, viewerId) {
  const reactionRows = await query(
    'SELECT type, COUNT(*) as count FROM reaction WHERE commentId = ? GROUP BY type',
    [commentId]
  );
  const replyCountRows = await query(
    'SELECT COUNT(*) as count FROM comment WHERE parentId = ? AND deletedAt IS NULL',
    [commentId]
  );
  const myReactionRows = viewerId
    ? await query('SELECT type FROM reaction WHERE commentId = ? AND userId = ? LIMIT 1', [commentId, viewerId])
    : [];

  const reactionsByType = emptyReactionMap();
  let totalReactions = 0;
  reactionRows.forEach((row) => {
    reactionsByType[row.type] = Number(row.count);
    totalReactions += Number(row.count);
  });

  return {
    reactionsByType,
    totalReactions,
    replyCount: replyCountRows[0] ? Number(replyCountRows[0].count) : 0,
    myReaction: myReactionRows[0] ? myReactionRows[0].type : null
  };
}

export async function getCommentAggregatesBatch(commentIds, viewerId) {
  const result = {};
  commentIds.forEach((id) => {
    result[id] = { reactionsByType: emptyReactionMap(), totalReactions: 0, replyCount: 0, myReaction: null };
  });

  if (commentIds.length === 0) return result;

  const placeholders = commentIds.map(() => '?').join(', ');

  const reactionRows = await query(
    `SELECT commentId, type, COUNT(*) as count FROM reaction WHERE commentId IN (${placeholders}) GROUP BY commentId, type`,
    commentIds
  );
  const replyRows = await query(
    `SELECT parentId, COUNT(*) as count FROM comment WHERE parentId IN (${placeholders}) AND deletedAt IS NULL GROUP BY parentId`,
    commentIds
  );
  const myReactionRows = viewerId
    ? await query(`SELECT commentId, type FROM reaction WHERE commentId IN (${placeholders}) AND userId = ?`, [
        ...commentIds,
        viewerId
      ])
    : [];

  reactionRows.forEach((row) => {
    result[row.commentId].reactionsByType[row.type] = Number(row.count);
    result[row.commentId].totalReactions += Number(row.count);
  });
  replyRows.forEach((row) => {
    result[row.parentId].replyCount = Number(row.count);
  });
  myReactionRows.forEach((row) => {
    result[row.commentId].myReaction = row.type;
  });

  return result;
}

// Personnes mentionnees (@Prenom Nom) dans chaque commentaire.
async function getCommentMentionsBatch(commentIds) {
  const result = {};
  commentIds.forEach((id) => {
    result[id] = [];
  });
  if (commentIds.length === 0) return result;

  const rows = await query(
    `SELECT m.commentId, u.id, u.firstName, u.lastName
     FROM mention m JOIN user u ON u.id = m.userId
     WHERE m.commentId IN (${commentIds.map(() => '?').join(', ')})`,
    commentIds
  );
  rows.forEach((row) => {
    result[row.commentId].push({ id: row.id, firstName: row.firstName, lastName: row.lastName });
  });
  return result;
}

// Remplace les mentions d'un commentaire. Seules les personnes qui peuvent
// voir la publication sont retenues ; on ne notifie que les personnes
// NOUVELLEMENT mentionnees (pas de doublon de notification a la
// modification du commentaire).
export async function syncCommentMentions(commentId, post, userIds, actorId) {
  const previous = await query('SELECT userId FROM mention WHERE commentId = ?', [commentId]);
  const previousIds = new Set(previous.map((row) => row.userId));

  const candidates = [...new Set((userIds || []).filter((id) => Number.isInteger(id) && id !== actorId))];
  const allowedIds = [];
  for (const userId of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewPost(userId, post)) allowedIds.push(userId);
  }

  await query('DELETE FROM mention WHERE commentId = ?', [commentId]);
  if (allowedIds.length === 0) return;

  await query(
    `INSERT INTO mention (commentId, userId) VALUES ${allowedIds.map(() => '(?, ?)').join(', ')}`,
    allowedIds.flatMap((userId) => [commentId, userId])
  );

  for (const userId of allowedIds) {
    if (previousIds.has(userId)) continue;
    // eslint-disable-next-line no-await-in-loop
    await createNotification({
      userId,
      actorId,
      type: 'mention',
      targetType: 'comment',
      targetId: commentId,
      content: String(post.id)
    });
  }
}

export async function hydrateComments(commentRows, viewerId) {
  if (commentRows.length === 0) return [];

  const ids = commentRows.map((comment) => comment.id);
  const aggregatesByComment = await getCommentAggregatesBatch(ids, viewerId);
  const mentionsByComment = await getCommentMentionsBatch(ids);

  return commentRows.map((comment) => ({
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    content: comment.content,
    mediaType: comment.mediaType,
    mediaUrl: mediaUrl(comment.mediaId),
    mentions: mentionsByComment[comment.id] || [],
    isEdited: Boolean(comment.isEdited),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: {
      id: comment.authorId,
      firstName: comment.authorFirstName,
      lastName: comment.authorLastName,
      avatar: mediaUrl(comment.authorAvatarId),
      verified: Boolean(comment.authorVerified)
    },
    ...aggregatesByComment[comment.id]
  }));
}

export const COMMENT_SELECT = `
  SELECT c.id, c.postId, c.parentId, c.content, c.mediaType, c.mediaId, c.isEdited, c.createdAt, c.updatedAt,
         u.id as authorId, u.firstName as authorFirstName, u.lastName as authorLastName, u.avatarId as authorAvatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS authorVerified
  FROM comment c
  JOIN user u ON u.id = c.userId AND u.bannedAt IS NULL
`;
