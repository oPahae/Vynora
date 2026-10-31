import { query } from './db';
import { mediaUrl } from './upload';
import { sendPushForNotification } from './push';

// Regroupe les types bruts de la table `notification` en categories lisibles
// pour les onglets de l'UI (Tout / J'aime / Commentaires / Amis / Mentions / Partages).
export const NOTIFICATION_CATEGORIES = {
  all: null,
  like: ['like'],
  comments: ['comment', 'reply'],
  friends: ['friendRequest', 'friendAccept'],
  mentions: ['mention'],
  shares: ['share'],
  groups: ['groupInvite', 'groupRemoved', 'groupRoleChange']
};

function buildCategoryFilter(category) {
  const types = NOTIFICATION_CATEGORIES[category];
  if (!types) return { clause: '', params: [] };
  return { clause: `AND n.type IN (${types.map(() => '?').join(', ')})`, params: types };
}

export async function createNotification({ userId, actorId, type, targetType = null, targetId = null, content = null, allowSelf = false }) {
  if (userId === actorId && !allowSelf) return;

  const result = await query(
    'INSERT INTO notification (userId, actorId, type, targetType, targetId, content) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, actorId, type, targetType, targetId, content]
  );

  const actorRows = await query('SELECT id, firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1', [
    actorId
  ]);
  const actorRow = actorRows[0];
  // Sanctions de moderation : l'identite de l'administrateur n'est jamais exposee.
  const actor =
    type === 'moderation'
      ? { id: 0, firstName: 'Administration', lastName: '', avatar: null }
      : type === 'loginAlert'
      ? { id: 0, firstName: 'Securite', lastName: '', avatar: null }
      : type === 'premiumWelcome'
      ? { id: 0, firstName: 'Premium', lastName: '', avatar: null }
      : actorRow && {
          id: actorRow.id,
          firstName: actorRow.firstName,
          lastName: actorRow.lastName,
          avatar: mediaUrl(actorRow.avatarId)
        };

  if (global.io) {
    const notification = {
      id: result.insertId,
      userId,
      type,
      targetType,
      targetId,
      content,
      isRead: false,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      actor
    };

    global.io.to(`user:${userId}`).emit('notification:new', notification);
  }

  // Couche supplementaire, non bloquante : si l'envoi push echoue pour une
  // raison quelconque, la notification in-app ci-dessus a deja ete creee
  // et diffusee normalement, donc on ne fait jamais echouer
  // createNotification a cause d'un probleme de push.
  sendPushForNotification({ userId, type, actor, content, targetType, targetId }).catch(() => {});
}

export async function getNotifications(userId, offset, limit, category = 'all') {
  // 'message' notifications are never created anymore (messages have their
  // own unread badge), but this filter also protects against any legacy
  // rows so chat messages never leak into the alerts dropdown/page.
  const { clause, params } = buildCategoryFilter(category);
  const rows = await query(
    `SELECT n.id, n.type, n.targetType, n.targetId, n.content, n.isRead, n.createdAt,
            u.id as actorId, u.firstName as actorFirstName, u.lastName as actorLastName, u.avatarId as actorAvatarId
     FROM notification n
     JOIN user u ON u.id = n.actorId
     WHERE n.userId = ? AND n.type != 'message' ${clause}
     ORDER BY n.createdAt DESC
     LIMIT ? OFFSET ?`,
    [userId, ...params, limit, offset]
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    targetType: row.targetType,
    targetId: row.targetId,
    content: row.content,
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt,
    actor:
      row.type === 'moderation'
        ? { id: 0, firstName: 'Administration', lastName: '', avatar: null }
        : row.type === 'loginAlert'
        ? { id: 0, firstName: 'Securite', lastName: '', avatar: null }
        : row.type === 'premiumWelcome'
        ? { id: 0, firstName: 'Premium', lastName: '', avatar: null }
        : {
            id: row.actorId,
            firstName: row.actorFirstName,
            lastName: row.actorLastName,
            avatar: mediaUrl(row.actorAvatarId)
          }
  }));
}

export async function getUnreadNotificationCount(userId) {
  const rows = await query(
    "SELECT COUNT(*) as count FROM notification WHERE userId = ? AND isRead = 0 AND type != 'message'",
    [userId]
  );
  return rows[0] ? Number(rows[0].count) : 0;
}
