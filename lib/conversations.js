import { query } from './db';
import { mediaUrl } from './upload';

export async function isParticipant(conversationId, userId) {
  const rows = await query(
    'SELECT 1 FROM conversationParticipant WHERE conversationId = ? AND userId = ? AND leftAt IS NULL LIMIT 1',
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function getOrCreateDirectConversation(userAId, userBId) {
  const rows = await query(
    `SELECT c.id FROM conversation c
     JOIN conversationParticipant p1 ON p1.conversationId = c.id AND p1.userId = ?
     JOIN conversationParticipant p2 ON p2.conversationId = c.id AND p2.userId = ?
     WHERE c.isGroup = 0
     LIMIT 1`,
    [userAId, userBId]
  );

  if (rows.length > 0) {
    // The conversation might already exist but have been deleted/archived
    // by the current user earlier - reopen it for them so they can chat
    // again instead of silently failing on a "not a participant" check.
    await query(
      'UPDATE conversationParticipant SET leftAt = NULL, archivedAt = NULL WHERE conversationId = ? AND userId = ?',
      [rows[0].id, userAId]
    );
    return rows[0].id;
  }

  const result = await query('INSERT INTO conversation (isGroup) VALUES (0)', []);
  const conversationId = result.insertId;
  await query('INSERT INTO conversationParticipant (conversationId, userId) VALUES (?, ?), (?, ?)', [
    conversationId,
    userAId,
    conversationId,
    userBId
  ]);
  return conversationId;
}

export async function leaveConversation(conversationId, userId) {
  await query('UPDATE conversationParticipant SET leftAt = NOW() WHERE conversationId = ? AND userId = ?', [
    conversationId,
    userId
  ]);
}

export async function clearConversationForUser(conversationId, userId) {
  await query('UPDATE conversationParticipant SET clearedAt = NOW() WHERE conversationId = ? AND userId = ?', [
    conversationId,
    userId
  ]);
}

export async function getClearedAt(conversationId, userId) {
  const rows = await query(
    'SELECT clearedAt FROM conversationParticipant WHERE conversationId = ? AND userId = ? LIMIT 1',
    [conversationId, userId]
  );
  return rows[0]?.clearedAt || null;
}

export async function setConversationArchived(conversationId, userId, archived) {
  await query(
    `UPDATE conversationParticipant SET archivedAt = ${archived ? 'NOW()' : 'NULL'}
     WHERE conversationId = ? AND userId = ?`,
    [conversationId, userId]
  );
}

export async function getOtherParticipants(conversationId, viewerId) {
  const rows = await query(
    `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
     FROM conversationParticipant cp JOIN user u ON u.id = cp.userId
     WHERE cp.conversationId = ? AND cp.userId != ? AND cp.leftAt IS NULL`,
    [conversationId, viewerId]
  );
  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatar: mediaUrl(row.avatarId),
    verified: Boolean(row.verified)
  }));
}

export async function getConversationSummaries(userId, { archived = false } = {}) {
  const conversationRows = await query(
    `SELECT DISTINCT c.id, cp.clearedAt FROM conversation c
     JOIN conversationParticipant cp ON cp.conversationId = c.id
     WHERE cp.userId = ? AND cp.leftAt IS NULL AND ${archived ? 'cp.archivedAt IS NOT NULL' : 'cp.archivedAt IS NULL'}`,
    [userId]
  );

  const summaries = (
    await Promise.all(
      conversationRows.map(async (row) => {
        const others = await getOtherParticipants(row.id, userId);

        const lastMessageRows = await query(
          `SELECT m.id, m.content, m.type, m.senderId, m.createdAt, m.deletedForEveryone
           FROM message m
           WHERE m.conversationId = ?
             AND NOT EXISTS (SELECT 1 FROM messageDeletion md WHERE md.messageId = m.id AND md.userId = ?)
             ${row.clearedAt ? 'AND m.createdAt > ?' : ''}
           ORDER BY m.createdAt DESC LIMIT 1`,
          row.clearedAt ? [row.id, userId, row.clearedAt] : [row.id, userId]
        );

        // If the user cleared this conversation and no new message has
        // arrived since, hide it from their list entirely.
        if (row.clearedAt && lastMessageRows.length === 0) {
          return null;
        }

        const participantRow = await query(
          'SELECT lastReadMessageId FROM conversationParticipant WHERE conversationId = ? AND userId = ? LIMIT 1',
          [row.id, userId]
        );
        const lastReadMessageId = participantRow[0]?.lastReadMessageId || 0;

        const unreadRows = await query(
          `SELECT COUNT(*) as count FROM message m
           WHERE m.conversationId = ? AND m.senderId != ? AND m.id > ?
             AND NOT EXISTS (SELECT 1 FROM messageDeletion md WHERE md.messageId = m.id AND md.userId = ?)
             ${row.clearedAt ? 'AND m.createdAt > ?' : ''}`,
          row.clearedAt
            ? [row.id, userId, lastReadMessageId, userId, row.clearedAt]
            : [row.id, userId, lastReadMessageId, userId]
        );

        return {
          id: row.id,
          participants: others,
          isArchived: archived,
          lastMessage: lastMessageRows[0]
            ? {
                ...lastMessageRows[0],
                content: lastMessageRows[0].deletedForEveryone ? null : lastMessageRows[0].content
              }
            : null,
          unreadCount: unreadRows[0] ? Number(unreadRows[0].count) : 0
        };
      })
    )
  ).filter(Boolean);

  summaries.sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
    return bTime - aTime;
  });

  return summaries;
}

export async function hydrateMessages(rows, viewerId) {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');

  const seenRows = await query(`SELECT messageId, userId FROM messageSeen WHERE messageId IN (${placeholders})`, ids);
  const seenByMessage = {};
  seenRows.forEach((row) => {
    if (!seenByMessage[row.messageId]) seenByMessage[row.messageId] = [];
    seenByMessage[row.messageId].push(row.userId);
  });

  // Accuses de lecture : reglage symetrique, comme sur la plupart des
  // messageries. Si le spectateur a desactive ses propres accuses de
  // lecture, il ne voit ceux de personne d'autre. Sinon, il ne voit que
  // ceux des personnes qui ont elles-memes garde cette option active.
  let seenVisibilityByUser = {};
  if (viewerId) {
    const viewerRows = await query('SELECT showReadReceipts FROM user WHERE id = ? LIMIT 1', [viewerId]);
    const viewerShowsReceipts = viewerRows[0] ? Boolean(viewerRows[0].showReadReceipts) : true;

    if (viewerShowsReceipts) {
      const otherSeenUserIds = [...new Set(seenRows.map((row) => row.userId).filter((id) => id !== viewerId))];
      if (otherSeenUserIds.length > 0) {
        const prefPlaceholders = otherSeenUserIds.map(() => '?').join(', ');
        const prefRows = await query(
          `SELECT id, showReadReceipts FROM user WHERE id IN (${prefPlaceholders})`,
          otherSeenUserIds
        );
        prefRows.forEach((row) => {
          seenVisibilityByUser[row.id] = Boolean(row.showReadReceipts);
        });
      }
    } else {
      seenVisibilityByUser = null; // le spectateur a tout masque de son cote
    }
  }

  const favoriteRows = viewerId
    ? await query(`SELECT messageId FROM messageFavorite WHERE userId = ? AND messageId IN (${placeholders})`, [
        viewerId,
        ...ids
      ])
    : [];
  const favoriteIds = new Set(favoriteRows.map((row) => row.messageId));

  // Aperçu du message cite en reponse (contenu tronque, sans re-imbriquer
  // toute la chaine de reponses).
  const replyToIds = [...new Set(rows.filter((row) => row.replyToId).map((row) => row.replyToId))];
  const replyPreviewById = {};
  if (replyToIds.length > 0) {
    const replyPlaceholders = replyToIds.map(() => '?').join(', ');
    const replyRows = await query(
      `SELECT m.id, m.senderId, m.content, m.type, m.fileName, m.deletedForEveryone,
              u.firstName as senderFirstName, u.lastName as senderLastName
       FROM message m JOIN user u ON u.id = m.senderId
       WHERE m.id IN (${replyPlaceholders})`,
      replyToIds
    );
    replyRows.forEach((row) => {
      replyPreviewById[row.id] = {
        id: row.id,
        senderId: row.senderId,
        senderName: `${row.senderFirstName} ${row.senderLastName}`,
        type: row.type,
        content: row.deletedForEveryone ? null : row.content,
        fileName: row.fileName,
        deletedForEveryone: Boolean(row.deletedForEveryone)
      };
    });
  }

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.deletedForEveryone ? null : row.content,
    type: row.type,
    fileUrl: row.deletedForEveryone ? null : mediaUrl(row.mediaId),
    fileName: row.fileName,
    replyToId: row.replyToId,
    replyTo: row.replyToId ? replyPreviewById[row.replyToId] || null : null,
    isEdited: Boolean(row.isEdited),
    isFavorite: favoriteIds.has(row.id),
    deletedForEveryone: Boolean(row.deletedForEveryone),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    seenBy:
      seenVisibilityByUser === null
        ? []
        : (seenByMessage[row.id] || []).filter(
            (id) => id !== viewerId && seenVisibilityByUser[id] !== false
          )
  }));
}

export const MESSAGE_SELECT = `
  SELECT m.id, m.conversationId, m.senderId, m.content, m.type, m.mediaId, m.fileName,
         m.replyToId, m.isEdited, m.deletedForEveryone, m.createdAt, m.updatedAt
  FROM message m
`;

// Recherche parmi les conversations actives de l'utilisateur : les
// personnes (participants dont le nom correspond) et les messages dont le
// contenu correspond. Utilise par l'onglet recherche de la liste des
// discussions.
export async function searchConversationsAndMessages(userId, term) {
  const like = `%${term}%`;

  const peopleRows = await query(
    `SELECT DISTINCT c.id as conversationId, u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
     FROM conversation c
     JOIN conversationParticipant cp ON cp.conversationId = c.id AND cp.userId = ? AND cp.leftAt IS NULL
     JOIN conversationParticipant cp2 ON cp2.conversationId = c.id AND cp2.userId != ? AND cp2.leftAt IS NULL
     JOIN user u ON u.id = cp2.userId
     WHERE c.isGroup = 0 AND (u.firstName LIKE ? OR u.lastName LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?)
     LIMIT 15`,
    [userId, userId, like, like, like]
  );

  const messageRows = await query(
    `SELECT m.id, m.conversationId, m.content, m.type, m.senderId, m.createdAt,
            u.firstName as senderFirstName, u.lastName as senderLastName
     FROM message m
     JOIN conversationParticipant cp ON cp.conversationId = m.conversationId AND cp.userId = ? AND cp.leftAt IS NULL
     JOIN user u ON u.id = m.senderId
     WHERE m.deletedForEveryone = 0 AND m.content LIKE ?
       AND NOT EXISTS (SELECT 1 FROM messageDeletion md WHERE md.messageId = m.id AND md.userId = ?)
     ORDER BY m.createdAt DESC
     LIMIT 20`,
    [userId, like, userId]
  );

  return {
    people: peopleRows.map((row) => ({
      conversationId: row.conversationId,
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      avatar: mediaUrl(row.avatarId),
      verified: Boolean(row.verified)
    })),
    messages: messageRows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      content: row.content,
      type: row.type,
      senderId: row.senderId,
      senderName: `${row.senderFirstName} ${row.senderLastName}`,
      createdAt: row.createdAt
    }))
  };
}

// Liste des messages que l'utilisateur a mis en favoris, tous les
// conversations confondues, les plus recents d'abord.
export async function getFavoriteMessages(userId) {
  const rows = await query(
    `${MESSAGE_SELECT}
     JOIN messageFavorite mf ON mf.messageId = m.id AND mf.userId = ?
     WHERE NOT EXISTS (SELECT 1 FROM messageDeletion md WHERE md.messageId = m.id AND md.userId = ?)
     ORDER BY mf.createdAt DESC`,
    [userId, userId]
  );

  const messages = await hydrateMessages(rows, userId);
  if (messages.length === 0) return [];

  const conversationIds = [...new Set(messages.map((message) => message.conversationId))];
  const participantsByConversation = {};
  await Promise.all(
    conversationIds.map(async (conversationId) => {
      participantsByConversation[conversationId] = await getOtherParticipants(conversationId, userId);
    })
  );

  return messages.map((message) => ({
    ...message,
    conversationParticipants: participantsByConversation[message.conversationId] || []
  }));
}
